#!/bin/bash
# MARZ-X installer for consolidated repo (backend + frontend dist in root)

set -euo pipefail

# --- Configuration ---
APP_PORT=3000          # internal app port (container)
TARGET_PORT=6104       # external HTTPS port
ADMIN_EMAIL="admin@admin.com"
MARZBAN_ADMIN_USER="admin"
# ---------------------

if [ "$EUID" -ne 0 ]; then
  echo "Please run as root (use sudo)"
  exit 1
fi

read -p "Enter your domain name (e.g., dashboard.example.com): " DOMAIN_NAME
if [ -z "$DOMAIN_NAME" ]; then
  echo "Domain name is required!"
  exit 1
fi

echo "--- Updating System & Installing Dependencies ---"
apt update
apt install -y docker.io docker-compose-v2 nginx certbot python3-certbot-nginx curl jq openssl expect ufw

echo "--- Creating Dockerfiles ---"
# Backend + frontend build in one image
cat <<'DOCKERFILE' > Dockerfile
FROM node:18-alpine as build
WORKDIR /app
RUN apk add --no-cache python3 make g++ openssl
COPY package*.json ./
RUN npm ci
COPY . .
# Build frontend (assumes src -> dist)
RUN npm run build
# Generate Prisma client
RUN npx prisma generate

FROM node:18-alpine as app
WORKDIR /app
RUN apk add --no-cache openssl
COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/src ./src
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY --from=build /app/.env /app/.env
EXPOSE 5000
CMD ["npm", "run", "start"]

FROM nginx:alpine as web
WORKDIR /usr/share/nginx/html
COPY --from=build /app/dist ./
# Nginx config added at runtime via bind mount
DOCKERFILE

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

echo "--- Configuring Docker Compose ---"
cat <<COMPOSE > docker-compose.yml
services:
  app:
    build:
      context: .
      target: app
    container_name: marzban_app
    restart: always
    env_file: .env
    volumes:
      - marzban_data:/app/data
    ports:
      - "5000:5000"
    depends_on:
      - db_push

  db_push:
    build:
      context: .
      target: app
    entrypoint: ["npx", "prisma", "db", "push"]
    env_file: .env
    volumes:
      - marzban_data:/app/data
    restart: "no"

  web:
    build:
      context: .
      target: web
    container_name: marzban_web
    restart: always
    ports:
      - "127.0.0.1:${APP_PORT}:80"
    depends_on:
      - app
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro

volumes:
  marzban_data:
COMPOSE

echo "--- Writing nginx.conf ---"
cat <<NGINX > nginx.conf
server {
    listen 80;
    server_name _;

    # Static files
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://app:5000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
    }
}
NGINX

echo "--- Building and Starting Application ---"
docker compose down
docker compose up -d --build

echo "--- Verifying DB migration (db push) ---"
docker compose logs db_push

echo "--- Configuring Nginx (host) ---"
cat <<HOSTNGINX > /etc/nginx/sites-available/$DOMAIN_NAME
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
HOSTNGINX

ln -sf /etc/nginx/sites-available/$DOMAIN_NAME /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo "--- Setting up SSL (HTTPS) ---"
certbot --nginx -d $DOMAIN_NAME --non-interactive --agree-tos -m $ADMIN_EMAIL --redirect

echo "--- Moving SSL to Port $TARGET_PORT ---"
sed -i "s/listen 443 ssl/listen $TARGET_PORT ssl/g" /etc/nginx/sites-available/$DOMAIN_NAME
ufw allow $TARGET_PORT/tcp
ufw allow 80/tcp
systemctl reload nginx

echo "------------------------------------------------------------------"
echo "✅ MARZ-X Dashboard Installation Complete!"
echo "Dashboard is live at: https://$DOMAIN_NAME:$TARGET_PORT"
echo "Username: admin@admin.com"
echo "Password: admin123"
echo "------------------------------------------------------------------"

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

  echo "--- Restarting Marzban ---"
  marzban restart

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