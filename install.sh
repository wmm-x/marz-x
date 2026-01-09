#!/bin/bash

# --- Configuration ---
APP_PORT=3000                 # Internal port for frontend (served by Nginx)
TARGET_PORT=6104              # External HTTPS port
ADMIN_EMAIL="admin@admin.com" # Certbot email
MARZBAN_ADMIN_USER="admin"
WEB_ROOT="/var/www/marz-x/dist"  # Public path for prebuilt frontend
# ---------------------

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 1) Require root
if [ "$EUID" -ne 0 ]; then
  echo "Please run as root (use sudo)"
  exit 1
fi

# 2) Domain
read -p "Enter your domain name (e.g., dashboard.example.com): " DOMAIN_NAME
if [ -z "$DOMAIN_NAME" ]; then
  echo "Domain name is required!"
  exit 1
fi

echo "--- Updating system & installing dependencies ---"
apt update
apt install -y nginx certbot python3-certbot-nginx curl jq openssl

# 3) Node.js 20.x LTS (install or upgrade if <20)
if ! command -v node &>/dev/null; then
  echo "--- Installing Node.js 20.x LTS ---"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt install -y nodejs
else
  NODE_MAJOR=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
  if [ "$NODE_MAJOR" -lt 20 ]; then
    echo "--- Upgrading Node.js to 20.x LTS ---"
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
  fi
fi

# 4) Ensure dotenv exists (minimal install; node_modules already present)
cd "$SCRIPT_DIR"
if [ ! -d "$SCRIPT_DIR/node_modules/dotenv" ]; then
  echo "--- Installing dotenv only ---"
  npm install --no-save dotenv
fi

# 5) Generate .env
echo "--- Generating .env ---"
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

# 6) Prisma: generate client & push schema
echo "--- Setting up Prisma ---"
npx prisma generate
npx prisma db push

# 7) systemd service for backend
echo "--- Creating backend service ---"
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
echo "--- Preparing frontend assets ---"
mkdir -p /var/www/marz-x
rm -rf "$WEB_ROOT"
cp -r "$SCRIPT_DIR/dist" "$WEB_ROOT"
chown -R www-data:www-data /var/www/marz-x
find /var/www/marz-x -type d -exec chmod 755 {} \;
find /var/www/marz-x -type f -exec chmod 644 {} \;

# 9) Nginx for frontend and backend proxy
echo "--- Configuring Nginx ---"
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
echo "--- Setting up SSL (HTTPS) ---"
certbot --nginx -d "$DOMAIN_NAME" --non-interactive --agree-tos -m "$ADMIN_EMAIL" --redirect

echo "--- Moving SSL to port $TARGET_PORT ---"
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

# 11) Optional Marzban installation
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

  echo "--- Cert renewal hook ---"
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

  echo "--- Configure Marzban .env ---"
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
  if [ -f "$SCRIPT_DIR/template/index.html" ]; then
    cp "$SCRIPT_DIR/template/index.html" /var/lib/marzban/templates/subscription/index.html
  else
    echo "WARNING: $SCRIPT_DIR/template/index.html not found; skipping template copy."
  fi

  echo "--- Restarting Marzban ---"
  marzban restart

  echo "------------------------------------------------------------------"
  echo "✅ Marzban installation and configuration complete."
  echo "Admin username: $MARZBAN_ADMIN_USER"
  echo "Admin password: $MARZBAN_SUDO_PASS"
  echo "------------------------------------------------------------------"
fi

echo "------------------------------------------------------------------"
echo "✅ MARZ-X Dashboard Installation Complete!"
echo "Dashboard is live at: https://$DOMAIN_NAME:$TARGET_PORT"
echo "Username: admin@admin.com"
echo "Password: admin123"
echo "------------------------------------------------------------------"