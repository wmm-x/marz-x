#!/bin/bash

# --- Configuration ---
APP_PORT=3000          # Internal Port for Frontend (served by Nginx)
TARGET_PORT=6104       # EXTERNAL Port for Dashboard (HTTPS)
ADMIN_EMAIL="admin@admin.com" # Default email for Let's Encrypt
MARZBAN_ADMIN_USER="admin"
# ---------------------

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 1. Check for Root
if [ "$EUID" -ne 0 ]; then
  echo "Please run as root (use sudo)"
  exit
fi

# 2. Ask for Domain Name
read -p "Enter your domain name (e.g., dashboard.example.com): " DOMAIN_NAME
if [ -z "$DOMAIN_NAME" ]; then
    echo "Domain name is required!"
    exit 1
fi

echo "--- Updating System & Installing Dependencies ---"
apt update
apt install -y nginx certbot python3-certbot-nginx curl jq openssl

# 3. Install Node.js 20.x LTS if not present (or upgrade if < 20)
if ! command -v node &> /dev/null; then
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

# 4. Ensure dotenv is available for prisma.config.ts
cd "$SCRIPT_DIR"
if [ ! -d "$SCRIPT_DIR/node_modules/dotenv" ]; then
  echo "--- Installing dotenv (no full npm install) ---"
  npm install --no-save dotenv
fi

# 5. Generate Production .env File
echo "--- Generating Production .env File ---"
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

# 6. Create data directory for SQLite
mkdir -p "$SCRIPT_DIR/data"

# 7. Generate Prisma Client / Migrate DB
echo "--- Setting up Prisma ---"
cd "$SCRIPT_DIR"
npx prisma generate
npx prisma db push

# 8. Setup systemd service for Backend
echo "--- Creating Backend Service ---"
cat <<SERVICE > /etc/systemd/system/marzban-dashboard.service
[Unit]
Description=Marzban Dashboard Backend
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$SCRIPT_DIR
ExecStart=/usr/bin/node $SCRIPT_DIR/src/index.js
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production
EnvironmentFile=$SCRIPT_DIR/.env

[Install]
WantedBy=multi-user.target
SERVICE

systemctl daemon-reload
systemctl enable marzban-dashboard
systemctl start marzban-dashboard

# 9. Configure Nginx for Frontend (dist) and Backend API
echo "--- Configuring Nginx ---"
cat <<NGINX > /etc/nginx/sites-available/$DOMAIN_NAME
server {
    listen 80;
    server_name $DOMAIN_NAME;

    # Serve pre-built frontend from dist folder
    location / {
        root $SCRIPT_DIR/dist;
        index index.html index.htm;
        try_files \$uri \$uri/ /index.html;
    }

    # Proxy API requests to backend
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

# 10. Setup SSL & Switch to Port 6104
echo "--- Setting up SSL (HTTPS) ---"
certbot --nginx -d $DOMAIN_NAME --non-interactive --agree-tos -m $ADMIN_EMAIL --redirect

echo "--- Moving SSL to Port $TARGET_PORT ---"
sed -i "s/listen 443 ssl/listen $TARGET_PORT ssl/g" /etc/nginx/sites-available/$DOMAIN_NAME

ufw allow $TARGET_PORT/tcp
ufw allow 80/tcp # Keep 80 open for Certbot renewals
systemctl reload nginx

echo "------------------------------------------------------------------"
echo "✅ MARZ-X Dashboard Installation Complete!"
echo "Dashboard is live at: https://$DOMAIN_NAME:$TARGET_PORT"
echo "Username: admin@admin.com"
echo "Password: admin123"
echo "------------------------------------------------------------------"

# 11. Prompt for Marzban installation
read -p "Do you want to install Marzban on this server? (y/N): " INSTALL_MARZBAN
INSTALL_MARZBAN=${INSTALL_MARZBAN,,}  # to lowercase

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