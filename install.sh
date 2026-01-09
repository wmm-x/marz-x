#!/bin/bash
set -euo pipefail

# --- Configuration ---
APP_PORT=3000          # Internal Docker Port for Frontend
TARGET_PORT=6104       # EXTERNAL Port for Dashboard (HTTPS)
ADMIN_EMAIL="admin@admin.com" # Default email for Let's Encrypt
MARZBAN_ADMIN_USER="admin"
# ---------------------

# 0. Clean conflicting Docker/containerd packages
echo "--- Cleaning conflicting Docker/containerd packages ---"
apt remove -y containerd containerd.io docker.io docker-doc docker-compose docker-compose-v2 runc || true
apt autoremove -y
apt update

# 1. Check for Root
if [ "$EUID" -ne 0 ]; then
  echo "Please run as root (use sudo)"
  exit 1
fi

# 2. Ask for Domain Name
read -p "Enter your domain name (e.g., dashboard.example.com): " DOMAIN_NAME
if [ -z "$DOMAIN_NAME" ]; then
    echo "Domain name is required!"
    exit 1
fi

echo "--- Installing Docker, Nginx, Certbot, and deps ---"
apt install -y docker.io docker-compose-v2 nginx certbot python3-certbot-nginx curl jq openssl expect
systemctl enable --now docker

# 3. Create Dockerfiles (Includes OpenSSL Fix)
echo "--- Creating Dockerfiles ---"
mkdir -p backend frontend

# Backend Dockerfile
cat <<'DOCKERFILE' > backend/Dockerfile
FROM node:18-alpine
WORKDIR /app
# Install OpenSSL (Required for Prisma on Alpine)
RUN apk add --no-cache openssl
COPY package*.json ./
RUN npm install --production
COPY . .
RUN npx prisma generate
EXPOSE 5000
CMD ["npm", "start"]
DOCKERFILE

# Frontend Dockerfile
cat <<'DOCKERFILE' > frontend/Dockerfile
FROM node:18-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
# Custom Nginx config for React Router & API Proxy
RUN echo 'server { \
    listen 80; \
    location / { \
        root /usr/share/nginx/html; \
        index index.html index.htm; \
        try_files $uri $uri/ /index.html; \
    } \
    location /api { \
        proxy_pass http://backend:5000; \
        proxy_http_version 1.1; \
        proxy_set_header Upgrade $http_upgrade; \
        proxy_set_header Connection "upgrade"; \
        proxy_set_header Host $host; \
    } \
}' > /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
DOCKERFILE

# 4. Generate Production .env File
echo "--- Generating Production .env File ---"
JWT_SECRET=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)

cat <<ENVFILE > .env
PORT=5000
NODE_ENV=production
DATABASE_URL="file:/app/data/prod.db"
JWT_SECRET="${JWT_SECRET}"
ENCRYPTION_KEY="${ENCRYPTION_KEY}"
ADMIN_EMAIL="${ADMIN_EMAIL}"
ADMIN_PASSWORD="admin123"
ADMIN_NAME="Administrator"
MARZBAN_ADMIN="MarzbanAdminx"
MARZBAN_ADMIN_PASS="G\$2WuaYJW@THP!9"
ENVFILE

# 5. Create docker-compose.yml
echo "--- Configuring Docker Compose ---"
cat <<COMPOSE > docker-compose.yml
services:
  backend:
    build: ./backend
    container_name: marzban_backend
    restart: always
    env_file: .env
    volumes:
      - marzban_data:/app/data
    ports:
      - "5000:5000"

  frontend:
    build: ./frontend
    container_name: marzban_frontend
    restart: always
    ports:
      - "127.0.0.1:${APP_PORT}:80"
    depends_on:
      - backend

volumes:
  marzban_data:
COMPOSE

# 6. Build and Start Docker
echo "--- Building and Starting Application ---"
docker compose down || true
docker compose up -d --build

# 7. Initialize Database (Prevents 502 Error)
echo "--- Initializing Database Tables ---"
sleep 10
docker compose run --rm backend npx prisma db push
docker compose restart backend

# 8. Configure Nginx (Pre-SSL)
echo "--- Configuring Nginx ---"
cat <<NGINX > /etc/nginx/sites-available/$DOMAIN_NAME
server {
    listen 80;
    server_name $DOMAIN_NAME;

    location / {
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/$DOMAIN_NAME /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# 9. Setup SSL & Switch to Port 6104
echo "--- Setting up SSL (HTTPS) ---"
certbot --nginx -d $DOMAIN_NAME --non-interactive --agree-tos -m $ADMIN_EMAIL --redirect

echo "--- Moving SSL to Port $TARGET_PORT ---"
sed -i "s/listen 443 ssl/listen $TARGET_PORT ssl/g" /etc/nginx/sites-available/$DOMAIN_NAME

ufw allow $TARGET_PORT/tcp || true
ufw allow 80/tcp || true # Keep 80 open for Certbot renewals
systemctl reload nginx

echo "------------------------------------------------------------------"
echo "✅ MARZ-X Dashboard Installation Complete!"
echo "Dashboard is live at: https://$DOMAIN_NAME:$TARGET_PORT"
echo "Username: admin@admin.com"
echo "Password: admin123"
echo "------------------------------------------------------------------"

# 10. Prompt for Marzban installation (Ctrl+C-safe)
read -p "Do you want to install Marzban on this server? (y/N): " INSTALL_MARZBAN
INSTALL_MARZBAN=${INSTALL_MARZBAN,,}  # to lowercase

if [[ "$INSTALL_MARZBAN" == "y" || "$INSTALL_MARZBAN" == "yes" ]]; then
  echo "--- Installing Marzban (detached; ignoring Ctrl+C during install) ---"
  trap 'echo "Ignoring Ctrl+C during Marzban install...";' INT
  sudo bash -c "$(curl -sL https://github.com/Gozargah/Marzban-scripts/raw/master/marzban.sh)" @ install
  trap - INT

  echo "--- Preparing certs for Marzban ---"
  mkdir -p /var/lib/marzban/certs
  cp /etc/letsencrypt/live/$DOMAIN_NAME/fullchain.pem /var/lib/marzban/certs/fullchain.pem
  cp /etc/letsencrypt/live/$DOMAIN_NAME/privkey.pem /var/lib/marzban/certs/privkey.pem
  chmod 600 /var/lib/marzban/certs/privkey.pem
  if id -u marzban >/dev/null 2>&1; then
    chown -R marzban:marzban /var/lib/marzban/certs || true
  fi

  echo "--- Setting up cert renewal hook ---"
  mkdir -p /etc/letsencrypt/renewal-hooks/post
  cat <<'HOOK' > /etc/letsencrypt/renewal-hooks/post/20-marzban-cert-sync.sh
#!/bin/bash
DOMAIN_DIR=$(basename "$(dirname "$(readlink -f "$RENEWED_LINEAGE")")")
SRC="/etc/letsencrypt/live/$DOMAIN_DIR"
DEST="/var/lib/marzban/certs"
if [ -f "$SRC/fullchain.pem" ] && [ -f "$SRC/privkey.pem" ]; then
  cp "$SRC/fullchain.pem" "$DEST/fullchain.pem"
  cp "$SRC/privkey.pem" "$DEST/privkey.pem"
  chmod 600 "$DEST/privkey.pem"
  if id -u marzban >/dev/null 2>&1; then
    chown -R marzban:marzban "$DEST" || true
  fi
  systemctl restart marzban || true
fi
HOOK
  chmod +x /etc/letsencrypt/renewal-hooks/post/20-marzban-cert-sync.sh

  echo "--- Configuring Marzban .env for SSL and admin ---"
  MARZBAN_ENV="/opt/marzban/.env"
  MARZBAN_SUDO_PASS=$(openssl rand -base64 16 | tr -d '\n')
  if [ -f "$MARZBAN_ENV" ]; then
    sed -i 's|^[[:space:]]*#\s*UVICORN_SSL_CERTFILE *=.*|UVICORN_SSL_CERTFILE="/var/lib/marzban/certs/fullchain.pem"|' "$MARZBAN_ENV"
    sed -i 's|^[[:space:]]*#\s*UVICORN_SSL_KEYFILE *=.*|UVICORN_SSL_KEYFILE="/var/lib/marzban/certs/privkey.pem"|' "$MARZBAN_ENV"

    if ! grep -q '^CUSTOM_TEMPLATES_DIRECTORY=' "$MARZBAN_ENV"; then
      echo 'CUSTOM_TEMPLATES_DIRECTORY="/var/lib/marzban/templates/"' >> "$MARZBAN_ENV"
    else
      sed -i 's|^CUSTOM_TEMPLATES_DIRECTORY=.*|CUSTOM_TEMPLATES_DIRECTORY="/var/lib/marzban/templates/"|' "$MARZBAN_ENV"
    fi
    if ! grep -q '^SUBSCRIPTION_PAGE_TEMPLATE=' "$MARZBAN_ENV"; then
      echo 'SUBSCRIPTION_PAGE_TEMPLATE="subscription/index.html"' >> "$MARZBAN_ENV"
    else
      sed -i 's|^SUBSCRIPTION_PAGE_TEMPLATE=.*|SUBSCRIPTION_PAGE_TEMPLATE="subscription/index.html"|' "$MARZBAN_ENV"
    fi

    if grep -q '^[[:space:]]*#\s*SUDO_USERNAME' "$MARZBAN_ENV"; then
      sed -i 's|^[[:space:]]*#\s*SUDO_USERNAME *=.*|SUDO_USERNAME="'"$MARZBAN_ADMIN_USER"'"|' "$MARZBAN_ENV"
    elif grep -q '^SUDO_USERNAME' "$MARZBAN_ENV"; then
      sed -i 's|^SUDO_USERNAME *=.*|SUDO_USERNAME="'"$MARZBAN_ADMIN_USER"'"|' "$MARZBAN_ENV"
    else
      echo 'SUDO_USERNAME="'"$MARZBAN_ADMIN_USER"'"' >> "$MARZBAN_ENV"
    fi

    if grep -q '^[[:space:]]*#\s*SUDO_PASSWORD' "$MARZBAN_ENV"; then
      sed -i 's|^[[:space:]]*#\s*SUDO_PASSWORD *=.*|SUDO_PASSWORD="'"$MARZBAN_SUDO_PASS"'"|' "$MARZBAN_ENV"
    elif grep -q '^SUDO_PASSWORD' "$MARZBAN_ENV"; then
      sed -i 's|^SUDO_PASSWORD *=.*|SUDO_PASSWORD="'"$MARZBAN_SUDO_PASS"'"|' "$MARZBAN_ENV"
    else
      echo 'SUDO_PASSWORD="'"$MARZBAN_SUDO_PASS"'"' >> "$MARZBAN_ENV"
    fi
  else
    echo "WARNING: $MARZBAN_ENV not found; cannot configure Marzban SSL/admin."
  fi

  echo "--- Deploying subscription template ---"
  mkdir -p /var/lib/marzban/templates/subscription
  if [ -f "./template/index.html" ]; then
    cp ./template/index.html /var/lib/marzban/templates/subscription/index.html
  else
    echo "WARNING: ./template/index.html not found; skipping template copy."
  fi

  echo "--- Restarting Marzban (detached) ---"
  if [ -d "/opt/marzban" ]; then
    (cd /opt/marzban && docker compose up -d) || true
  fi
  marzban restart || true

  echo "------------------------------------------------------------------"
  echo "✅ Marzban installation and configuration complete."
  echo "Admin username: $MARZBAN_ADMIN_USER"
  echo "Admin password: $MARZBAN_SUDO_PASS"
  echo "------------------------------------------------------------------"
  echo "✅ MARZ-X Dashboard Installation Complete!"
  echo "Dashboard is live at: https://$DOMAIN_NAME:$TARGET_PORT"
  echo "Username: admin@admin.com"
  echo "Password: admin123"
  echo "------------------------------------------------------------------"
else
  echo "Skipped Marzban installation."
fi