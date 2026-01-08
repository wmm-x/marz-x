#!/bin/bash

# --- Configuration ---
APP_PORT=3000  # Port where Docker will expose the frontend
# ---------------------

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
apt update && apt upgrade -y
apt install -y docker.io docker-compose-v2 nginx certbot python3-certbot-nginx

# 3. Generate Secure .env File
echo "--- Generating Production .env File ---"

# Generate random keys
JWT_SECRET=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)

cat <<EOF > .env
# Server
PORT=5000
NODE_ENV=production

# Database (Saved in Docker Volume)
DATABASE_URL="file:/app/data/prod.db"

# Security Keys (Auto-Generated)
JWT_SECRET="${JWT_SECRET}"
ENCRYPTION_KEY="${ENCRYPTION_KEY}"

# Default Admin Credentials
ADMIN_EMAIL="admin@admin.com"
ADMIN_PASSWORD="admin123"
ADMIN_NAME="Administrator"

# Marzban Credentials (Backend internal use)
MARZBAN_ADMIN="MarzbanAdminx"
MARZBAN_ADMIN_PASS="G\$2WuaYJW@THP!9"
EOF

echo ".env file created with secure keys."

# 4. Create/Update docker-compose.yml for Production
# We map the frontend to 127.0.0.1:3000 so it's not exposed directly, only via Nginx
echo "--- Configuring Docker Compose ---"
cat <<EOF > docker-compose.yml
version: '3.8'

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
EOF

# 5. Build and Start Docker Containers
echo "--- Building and Starting Application ---"
docker compose down  # Stop any existing containers
docker compose up -d --build

# 6. Configure Nginx Reverse Proxy
echo "--- Configuring Nginx ---"
cat <<EOF > /etc/nginx/sites-available/$DOMAIN_NAME
server {
    listen 80;
    server_name $DOMAIN_NAME;

    location / {
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }

    # Proxy API requests to backend
    location /api {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

# Enable Site
ln -sf /etc/nginx/sites-available/$DOMAIN_NAME /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default  # Remove default nginx page if it exists
nginx -t && systemctl reload nginx

# 7. Setup SSL with Certbot
echo "--- Setting up SSL (HTTPS) ---"
certbot --nginx -d $DOMAIN_NAME --non-interactive --agree-tos -m $ADMIN_EMAIL --redirect

echo "------------------------------------------------------------------"
echo "✅ Installation Complete!"
echo "------------------------------------------------------------------"
echo "Dashboard is live at: https://$DOMAIN_NAME"
echo "Login: admin@admin.com / admin123"
echo "------------------------------------------------------------------"