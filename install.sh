#!/bin/bash

# ==================================================
# MARZ-X INSTALL SCRIPT (FIXED BUILD CONTEXT)
# Repo structure:
# ├── dist/
# ├── src/
# ├── prisma/
# ├── template/
# ├── prisma.config.ts
# ==================================================

APP_PORT=3000
TARGET_PORT=6104
ADMIN_EMAIL="admin@admin.com"
MARZBAN_ADMIN_USER="admin"

set -e

# ---------------- ROOT CHECK ----------------
if [ "$EUID" -ne 0 ]; then
  echo "❌ Run as root"
  exit 1
fi

# ---------------- DOMAIN ----------------
read -p "Enter domain (dashboard.example.com): " DOMAIN_NAME
[ -z "$DOMAIN_NAME" ] && echo "❌ Domain required" && exit 1

echo "🚀 Installing MARZ-X..."

# ---------------- DEPENDENCIES ----------------
apt update
apt install -y \
  docker.io docker-compose-v2 nginx certbot \
  python3-certbot-nginx curl jq openssl expect

systemctl enable docker --now

# ---------------- DOCKERFILE ----------------
mkdir -p backend

cat <<'DOCKERFILE' > backend/Dockerfile
FROM node:18-alpine

WORKDIR /app

RUN apk add --no-cache openssl

COPY package*.json ./
RUN npm install --production

COPY src ./src
COPY prisma ./prisma
COPY dist ./dist
COPY prisma.config.ts ./

RUN npx prisma generate

EXPOSE 5000
CMD ["npm", "start"]
DOCKERFILE

# ---------------- ENV ----------------
JWT_SECRET=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)

cat <<ENV > .env
PORT=5000
NODE_ENV=production
DATABASE_URL="file:/app/data/prod.db"
JWT_SECRET="$JWT_SECRET"
ENCRYPTION_KEY="$ENCRYPTION_KEY"

ADMIN_EMAIL="$ADMIN_EMAIL"
ADMIN_NAME="Administrator"
ADMIN_PASSWORD="admin123"
ENV

# ---------------- DOCKER COMPOSE ----------------
cat <<COMPOSE > docker-compose.yml
services:
  app:
    build:
      context: .
      dockerfile: backend/Dockerfile
    container_name: marz_x_app
    restart: always
    env_file: .env
    volumes:
      - marzban_data:/app/data
    ports:
      - "127.0.0.1:${APP_PORT}:5000"

volumes:
  marzban_data:
COMPOSE

# ---------------- BUILD ----------------
docker compose down || true
docker compose build --no-cache
docker compose up -d

# ---------------- PRISMA INIT ----------------
sleep 10
docker compose exec app npx prisma db push

# ---------------- NGINX ----------------
cat <<NGINX > /etc/nginx/sites-available/$DOMAIN_NAME
server {
    listen 80;
    server_name $DOMAIN_NAME;

    location / {
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/$DOMAIN_NAME /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# ---------------- SSL ----------------
certbot --nginx -d $DOMAIN_NAME \
  --non-interactive --agree-tos \
  -m $ADMIN_EMAIL --redirect

sed -i "s/listen 443 ssl;/listen $TARGET_PORT ssl;/g" \
  /etc/nginx/sites-available/$DOMAIN_NAME

ufw allow $TARGET_PORT/tcp
ufw allow 80/tcp
systemctl reload nginx

# ---------------- MARZBAN OPTIONAL ----------------
read -p "Install Marzban? (y/N): " INSTALL_MARZBAN
INSTALL_MARZBAN=${INSTALL_MARZBAN,,}

if [[ "$INSTALL_MARZBAN" == "y" || "$INSTALL_MARZBAN" == "yes" ]]; then
  bash -c "$(curl -sL https://github.com/Gozargah/Marzban-scripts/raw/master/marzban.sh)" @ install

  mkdir -p /var/lib/marzban/certs
  cp /etc/letsencrypt/live/$DOMAIN_NAME/fullchain.pem /var/lib/marzban/certs/
  cp /etc/letsencrypt/live/$DOMAIN_NAME/privkey.pem /var/lib/marzban/certs/
  chmod 600 /var/lib/marzban/certs/privkey.pem
  chown -R marzban:marzban /var/lib/marzban/certs || true

  mkdir -p /var/lib/marzban/templates/subscription
  [ -f "./template/index.html" ] && \
    cp ./template/index.html /var/lib/marzban/templates/subscription/index.html

  marzban restart
fi

# ---------------- DONE ----------------
echo "=================================================="
echo "✅ INSTALL COMPLETE"
echo "🌐 https://$DOMAIN_NAME:$TARGET_PORT"
echo "👤 admin@admin.com"
echo "🔑 admin123"
echo "=================================================="
