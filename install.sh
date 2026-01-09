#!/bin/bash

# ==================================================
# MARZ-X FULL INSTALL SCRIPT (NEW STRUCTURE)
# Repo Structure:
# ├── dist/        (frontend build)
# ├── src/         (backend)
# ├── prisma/
# ├── template/
# ==================================================

# -------- CONFIG --------
APP_PORT=3000
TARGET_PORT=6104
ADMIN_EMAIL="admin@admin.com"
MARZBAN_ADMIN_USER="admin"
# ------------------------

set -e

# 1. ROOT CHECK
if [ "$EUID" -ne 0 ]; then
  echo "❌ Please run as root"
  exit 1
fi

# 2. DOMAIN INPUT
read -p "Enter domain name (e.g. dashboard.example.com): " DOMAIN_NAME
if [ -z "$DOMAIN_NAME" ]; then
  echo "❌ Domain name required"
  exit 1
fi

echo "🚀 Starting MARZ-X installation..."

# 3. SYSTEM DEPENDENCIES
apt update
apt install -y \
  docker.io \
  docker-compose-v2 \
  nginx \
  certbot \
  python3-certbot-nginx \
  curl \
  jq \
  openssl \
  expect

systemctl enable docker --now

# 4. BACKEND DOCKERFILE
echo "📦 Creating backend Dockerfile..."

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

# 5. ENV FILE
echo "🔐 Generating .env..."

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

# 6. DOCKER COMPOSE
echo "🐳 Creating docker-compose.yml..."

cat <<COMPOSE > docker-compose.yml
services:
  app:
    build: ./backend
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

# 7. BUILD & START
echo "🏗 Building application..."
docker compose down || true
docker compose up -d --build

# 8. INIT PRISMA
echo "🗄 Initializing database..."
sleep 10
docker compose exec app npx prisma db push

# 9. NGINX (HTTP)
echo "🌐 Configuring Nginx..."

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

# 10. SSL SETUP
echo "🔐 Issuing SSL certificate..."
certbot --nginx -d $DOMAIN_NAME \
  --non-interactive \
  --agree-tos \
  -m $ADMIN_EMAIL \
  --redirect

# 11. MOVE TO CUSTOM PORT
echo "🔄 Switching HTTPS to port $TARGET_PORT..."
sed -i "s/listen 443 ssl;/listen $TARGET_PORT ssl;/g" \
  /etc/nginx/sites-available/$DOMAIN_NAME

ufw allow $TARGET_PORT/tcp
ufw allow 80/tcp
systemctl reload nginx

# 12. MARZBAN OPTIONAL
read -p "Install Marzban on this server? (y/N): " INSTALL_MARZBAN
INSTALL_MARZBAN=${INSTALL_MARZBAN,,}

if [[ "$INSTALL_MARZBAN" == "y" || "$INSTALL_MARZBAN" == "yes" ]]; then
  echo "⚙ Installing Marzban..."

  bash -c "$(curl -sL https://github.com/Gozargah/Marzban-scripts/raw/master/marzban.sh)" @ install

  echo "📜 Preparing Marzban SSL certs..."
  mkdir -p /var/lib/marzban/certs

  cp /etc/letsencrypt/live/$DOMAIN_NAME/fullchain.pem /var/lib/marzban/certs/
  cp /etc/letsencrypt/live/$DOMAIN_NAME/privkey.pem /var/lib/marzban/certs/

  chmod 600 /var/lib/marzban/certs/privkey.pem
  chown -R marzban:marzban /var/lib/marzban/certs || true

  echo "📄 Deploying subscription template..."
  mkdir -p /var/lib/marzban/templates/subscription
  if [ -f "./template/index.html" ]; then
    cp ./template/index.html /var/lib/marzban/templates/subscription/index.html
  fi

  echo "🔄 Restarting Marzban..."
  marzban restart
fi

# 13. DONE
echo "=================================================="
echo "✅ MARZ-X INSTALLATION COMPLETE"
echo "🌐 Dashboard: https://$DOMAIN_NAME:$TARGET_PORT"
echo "👤 Login: admin@admin.com"
echo "🔑 Password: admin123"
echo "=================================================="
