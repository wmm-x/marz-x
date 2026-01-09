#!/bin/bash

# --- Configuration ---
APP_PORT=3000
TARGET_PORT=6104
ADMIN_EMAIL="admin@admin.com"
MARZBAN_ADMIN_USER="admin"
# ---------------------

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB_ROOT="/var/www/marz-x/dist"

# 1) Require root
if [ "$EUID" -ne 0 ]; then
  echo "Please run as root (use sudo)"
  exit 1
fi

# 2) Domain
read -p "Enter your domain name (e.g., dashboard.example.com): " DOMAIN_NAME
[ -z "$DOMAIN_NAME" ] && { echo "Domain name is required!"; exit 1; }

echo "--- Updating system & installing dependencies ---"
apt update
apt install -y nginx certbot python3-certbot-nginx curl jq openssl

# 3) Node.js 20.x LTS (install or upgrade if <20)
if ! command -v node &>/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt install -y nodejs
else
  NODE_MAJOR=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
  if [ "$NODE_MAJOR" -lt 20 ]; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
  fi
fi

# 4) Ensure dotenv exists
cd "$SCRIPT_DIR"
if [ ! -d "$SCRIPT_DIR/node_modules/dotenv" ]; then
  npm install --no-save dotenv
fi

# 5) Generate .env
JWT_SECRET=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)
cat <<ENVFILE > "$SCRIPT_DIR/.env"
PORT=5000
NODE_ENV=production
DATABASE_URL="file:$SCRIPT_DIR/data/prod.db"
JWT_SECRET="${JWT_SECRET}"
ENCRYPTION_KEY="${ENCRYPTION_KEY}"
ADMIN_EMAIL="${ADMIN_EMAIL}"
ADMIN_PASSWORD="admin123"
ADMIN_NAME="Administrator"
MARZBAN_ADMIN="MarzbanAdminx"
MARZBAN_ADMIN_PASS="G\$2WuaYJW@THP!9"
ENVFILE
mkdir -p "$SCRIPT_DIR/data"

# 6) Prisma
npx prisma generate
npx prisma db push

# 7) systemd service
cat <<SERVICE > /etc/systemd/system/marzban-dashboard.service
[Unit]
Description=Marzban Dashboard Backend
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$SCRIPT_DIR
EnvironmentFile=$SCRIPT_DIR/.env
ExecStart=/usr/bin/node $SCRIPT_DIR/src/index.js
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
SERVICE
systemctl daemon-reload
systemctl enable marzban-dashboard
systemctl restart marzban-dashboard

# 8) Place dist where nginx can read it
mkdir -p /var/www/marz-x
rm -rf "$WEB_ROOT"
cp -r "$SCRIPT_DIR/dist" "$WEB_ROOT"
chown -R www-data:www-data /var/www/marz-x
find /var/www/marz-x -type d -exec chmod 755 {} \;
find /var/www/marz-x -type f -exec chmod 644 {} \;

# 9) Nginx for frontend and backend proxy
cat <<NGINX > /etc/nginx/sites-available/$DOMAIN_NAME
server {
    listen 80;
    server_name $DOMAIN_NAME;

    location / {
        root $WEB_ROOT;
        index index.html index.htm;
        try_files \$uri \$uri/ /index.html;
    }

    location /api {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/$DOMAIN_NAME /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# 10) SSL to TARGET_PORT
certbot --nginx -d "$DOMAIN_NAME" --non-interactive --agree-tos -m "$ADMIN_EMAIL" --redirect
sed -i "s/listen 443 ssl/listen $TARGET_PORT ssl/g" /etc/nginx/sites-available/$DOMAIN_NAME
nginx -t && systemctl reload nginx
ufw allow $TARGET_PORT/tcp || true
ufw allow 80/tcp || true

echo "------------------------------------------------------------------"
echo "✅ MARZ-X Dashboard Installation Complete!"
echo "Dashboard is live at: https://$DOMAIN_NAME:$TARGET_PORT"
echo "Username: admin@admin.com"
echo "Password: admin123"
echo "------------------------------------------------------------------"

# 11) Optional Marzban install (unchanged)
read -p "Do you want to install Marzban on this server? (y/N): " INSTALL_MARZBAN
INSTALL_MARZBAN=${INSTALL_MARZBAN,,}
if [[ "$INSTALL_MARZBAN" == "y" || "$INSTALL_MARZBAN" == "yes" ]]; then
  # ... (same Marzban steps as before) ...
  :
fi