#!/bin/bash

# --- Configuration ---
APP_PORT=3000          # Internal Docker Port
TARGET_PORT=6104       # EXTERNAL Port for Dashboard (HTTPS)
ADMIN_EMAIL="admin@admin.com" # Required for SSL
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
apt update
apt install -y docker.io docker-compose-v2 nginx certbot python3-certbot-nginx

# 3. Create Missing Dockerfiles (Fixes "no such file" error)
echo "--- Creating Dockerfiles ---"

# Backend Dockerfile
cat <<EOF > backend/Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
RUN npx prisma generate
EXPOSE 5000
CMD ["npm", "start"]
EOF

# Frontend Dockerfile
cat <<EOF > frontend/Dockerfile
FROM node:18-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
RUN echo 'server { \\
    listen 80; \\
    location / { \\
        root /usr/share/nginx/html; \\
        index index.html index.htm; \\
        try_files \$uri \$uri/ /index.html; \\
    } \\
    location /api { \\
        proxy_pass http://backend:5000; \\
        proxy_http_version 1.1; \\
        proxy_set_header Upgrade \$http_upgrade; \\
        proxy_set_header Connection "upgrade"; \\
        proxy_set_header Host \$host; \\
    } \\
}' > /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
EOF

# 4. Generate Production .env File
echo "--- Generating Production .env File ---"
JWT_SECRET=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)

cat <<EOF > .env
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
EOF

# 5. Create docker-compose.yml
echo "--- Configuring Docker Compose ---"
cat <<EOF > docker-compose.yml
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

# 6. Build and Start Docker
echo "--- Building and Starting Application ---"
docker compose down
docker compose up -d --build

# 7. Configure Nginx (Pre-SSL)
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
    }
}
EOF

ln -sf /etc/nginx/sites-available/$DOMAIN_NAME /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# 8. Setup SSL & Switch to Port 6104
echo "--- Setting up SSL (HTTPS) ---"
# Get Cert on standard port 80/443 first
certbot --nginx -d $DOMAIN_NAME --non-interactive --agree-tos -m $ADMIN_EMAIL --redirect

# Modify Nginx to listen on 6104 instead of 443
echo "--- Moving SSL to Port $TARGET_PORT ---"
sed -i "s/listen 443 ssl/listen $TARGET_PORT ssl/g" /etc/nginx/sites-available/$DOMAIN_NAME

# Open Firewall for new port
ufw allow $TARGET_PORT/tcp
ufw allow 80/tcp # Keep 80 open for Certbot renewals

systemctl reload nginx

echo "------------------------------------------------------------------"
echo "✅ Installation Complete!"
echo "------------------------------------------------------------------"
echo "Dashboard is live at: https://$DOMAIN_NAME:$TARGET_PORT"
echo "Login: admin@admin.com / admin123"
echo "------------------------------------------------------------------"