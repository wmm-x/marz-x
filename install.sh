#!/bin/bash

# --- Configuration ---
APP_PORT=3000                 # Internal Docker Port for Frontend (bound to 127.0.0.1)
TARGET_PORT=6104              # EXTERNAL Port for Dashboard (HTTPS)
ADMIN_EMAIL="admin@admin.com" # Email for Let's Encrypt
MARZBAN_ADMIN_USER="admin"
# ---------------------

set -e

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

echo "--- Updating System & Installing Dependencies ---"
apt update
apt install -y docker.io docker-compose-v2 nginx certbot python3-certbot-nginx curl jq openssl expect ufw

# Make sure UFW is enabled (won't error if already enabled)
ufw --force enable || true

# Open ports required for initial issuance + your final HTTPS port
ufw allow 80/tcp
ufw allow $TARGET_PORT/tcp

# 3. Prepare Build Directories & Copy Files
echo "--- Preparing Docker Build Contexts ---"
rm -rf backend frontend
mkdir -p backend frontend

echo "Copying backend files..."
cp -r src prisma package*.json prisma.config.ts backend/ 2>/dev/null || true

echo "Copying frontend dist folder..."
if [ -d "dist" ]; then
  cp -r dist frontend/
else
  echo "ERROR: 'dist' folder not found! Please ensure you have built the frontend."
  exit 1
fi

# 4. Create Dockerfiles
echo "--- Creating Dockerfiles ---"

cat <<'DOCKERFILE' > backend/Dockerfile
FROM node:18-alpine
WORKDIR /app
RUN apk add --no-cache openssl
COPY package*.json ./
RUN npm install --production
COPY . .
RUN npx prisma generate
EXPOSE 5000
CMD ["npm", "start"]
DOCKERFILE

cat <<'DOCKERFILE' > frontend/Dockerfile
FROM nginx:alpine
COPY dist /usr/share/nginx/html
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

# 5. Generate Production .env File
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

# 6. Create docker-compose.yml
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

# 7. Build and Start Docker
echo "--- Building and Starting Application ---"
docker compose down || true
docker compose up -d --build

# 8. Initialize Database (Prevents 502 Error)
echo "--- Initializing Database Tables ---"
sleep 10
docker compose run --rm backend npx prisma db push
docker compose restart backend

# 9. Configure Nginx (HTTP only, for Certbot issuance)
echo "--- Configuring Nginx (HTTP for certificate issuance) ---"
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

# 10. Setup SSL (HTTPS) using Certbot (needs port 80 open)
echo "--- Setting up SSL (HTTPS) ---"
certbot --nginx -d "$DOMAIN_NAME" --non-interactive --agree-tos -m "$ADMIN_EMAIL"

# 11. Replace Nginx config with HTTPS-only on TARGET_PORT and CLOSE port 80
echo "--- Switching Nginx to HTTPS-only on port $TARGET_PORT and closing port 80 ---"

cat <<NGINX_SSL > /etc/nginx/sites-available/$DOMAIN_NAME
server {
    listen ${TARGET_PORT} ssl;
    server_name ${DOMAIN_NAME};

    ssl_certificate     /etc/letsencrypt/live/${DOMAIN_NAME}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN_NAME}/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
    }
}
NGINX_SSL

nginx -t && systemctl reload nginx

# Close port 80 (NO renewals expected)
ufw delete allow 80/tcp 2>/dev/null || true
ufw deny 80/tcp || true

echo "------------------------------------------------------------------"
echo "✅ MARZ-X Dashboard Installation Complete!"
echo "Dashboard is live at: https://$DOMAIN_NAME:$TARGET_PORT"
echo "Username: admin@admin.com"
echo "Password: admin123"
echo "------------------------------------------------------------------"

# 12. Prompt for Marzban installation
read -p "Do you want to install Marzban on this server? (y/N): " INSTALL_MARZBAN
INSTALL_MARZBAN=${INSTALL_MARZBAN,,}

if [[ "$INSTALL_MARZBAN" == "y" || "$INSTALL_MARZBAN" == "yes" ]]; then
  echo "--- Installing Marzban ---"
  sudo bash -c "$(curl -sL https://github.com/Gozargah/Marzban-scripts/raw/master/marzban.sh)" @ install

  echo "--- Preparing certs for Marzban ---"
  mkdir -p /var/lib/marzban/certs
  cp /etc/letsencrypt/live/$DOMAIN_NAME/fullchain.pem /var/lib/marzban/certs/fullchain.pem
  cp /etc/letsencrypt/live/$DOMAIN_NAME/privkey.pem /var/lib/marzban/certs/privkey.pem
  chmod 600 /var/lib/marzban/certs/privkey.pem
  if id -u marzban >/dev/null 2>&1; then
    chown -R marzban:marzban /var/lib/marzban/certs || true
  fi

  # NOTE: You said you don't need renewal.
  # So we intentionally DO NOT install cert renewal hooks.

  echo "--- Configuring Marzban .env for SSL and admin ---"
  MARZBAN_ENV="/opt/marzban/.env"
  MARZBAN_SUDO_PASS=$(openssl rand -base64 16 | tr -d '\n')

  if [ -f "$MARZBAN_ENV" ]; then
    [ -n "$(tail -c1 "$MARZBAN_ENV")" ] && echo >> "$MARZBAN_ENV"

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

  echo "--- Restarting Marzban ---"
  marzban restart

  echo "------------------------------------------------------------------"
  echo "✅ INSTALLATION COMPLETE!"
  echo "Dashboard: https://$DOMAIN_NAME:$TARGET_PORT"
  echo "Dashboard user/pass: admin@admin.com / admin123"
  echo ""
  echo "Marzban add-server values:"
  echo "  - URL:      https://$DOMAIN_NAME:8000"
  echo "  - Username: $MARZBAN_ADMIN_USER"
  echo "  - Password: $MARZBAN_SUDO_PASS"
  echo "------------------------------------------------------------------"
else
  echo "Skipped Marzban installation."
fi
