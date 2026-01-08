#!/bin/bash
# --- Configuration ---
APP_PORT=3000          # Internal Docker Port for Frontend
TARGET_PORT=6104       # EXTERNAL Port for Dashboard (HTTPS)
ADMIN_EMAIL="admin@admin.com" 
# ---------------------

# 1. Check for Root
if [ "$EUID" -ne 0 ]; then
  echo "Please run as root (use sudo)"
  exit
fi

# SAVE CURRENT LOCATION (Crucial for fixing "no such service" error)
DASHBOARD_DIR=$(pwd)

# 2. Ask for Domain Name
read -p "Enter your domain name (e.g., dashboard.example.com): " DOMAIN_NAME
if [ -z "$DOMAIN_NAME" ]; then
    echo "Domain name is required!"
    exit 1
fi

echo "--- Updating System & Installing Dependencies ---"
apt update
apt install -y docker.io docker-compose-v2 nginx certbot python3-certbot-nginx curl git

# 3. SYNC CODE FROM GITHUB (Fixes missing package.json)
echo "--- Fetching latest files from GitHub ---"
# Mark directory as safe for git operations
git config --global --add safe.directory "$DASHBOARD_DIR"
git pull origin main || git pull origin master

# Verify package.json exists
if [ ! -f "backend/package.json" ]; then
    echo "❌ ERROR: backend/package.json is missing!"
    echo "Please ensure you have pushed your backend code to GitHub."
    exit 1
fi

# 4. Create Dashboard Dockerfiles
echo "--- Creating Dashboard Dockerfiles ---"
mkdir -p backend frontend

# Backend Dockerfile (Includes OpenSSL Fix)
cat <<DOCKERFILE > backend/Dockerfile
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

# Frontend Dockerfile
cat <<DOCKERFILE > frontend/Dockerfile
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
DOCKERFILE

# 5. Generate Dashboard .env File
echo "--- Generating Dashboard .env File ---"
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

# 6. Create Dashboard docker-compose.yml
echo "--- Configuring Dashboard Docker Compose ---"
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

# 7. Setup SSL First (Needed for both)
echo "--- Setting up SSL (HTTPS) ---"
systemctl stop nginx
# Create dummy nginx config for certbot
cat <<NGINX > /etc/nginx/sites-available/$DOMAIN_NAME
server {
    listen 80;
    server_name $DOMAIN_NAME;
}
NGINX
ln -sf /etc/nginx/sites-available/$DOMAIN_NAME /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
systemctl start nginx

# Get Certificate
certbot --nginx -d $DOMAIN_NAME --non-interactive --agree-tos -m $ADMIN_EMAIL --redirect

# -----------------------------------------------------------
# MARZBAN INSTALLATION (AUTO-REPAIR & DETACHED MODE)
# -----------------------------------------------------------
read -p "Do you want to install Marzban to this server? (y/N): " INSTALL_MARZBAN
if [[ "$INSTALL_MARZBAN" =~ ^[Yy]$ ]]; then
    echo "--- Checking Marzban Installation ---"
    
    # 1. Clean up potential broken installs
    if [ -d "/opt/marzban" ]; then
        if [ ! -d "/opt/marzban/.git" ]; then
            echo "⚠️ Found broken Marzban folder. Removing..."
            rm -rf /opt/marzban
        fi
    fi

    # 2. Clone Marzban
    if [ ! -d "/opt/marzban" ]; then
        echo "--- Cloning Marzban Repository ---"
        git clone https://github.com/Gozargah/Marzban /opt/marzban
    else
        echo "--- Pulling Latest Marzban ---"
        cd /opt/marzban && git pull
    fi

    # 3. Setup Command & Env
    ln -sf /opt/marzban/marzban.sh /usr/local/bin/marzban
    chmod +x /usr/local/bin/marzban
    
    if [ ! -f "/opt/marzban/.env" ]; then
        cp /opt/marzban/.env.example /opt/marzban/.env
    fi

    # 4. Configure SSL in Marzban .env
    echo "--- Configuring Marzban SSL ---"
    mkdir -p /var/lib/marzban/certs
    cp /etc/letsencrypt/live/$DOMAIN_NAME/fullchain.pem /var/lib/marzban/certs/
    cp /etc/letsencrypt/live/$DOMAIN_NAME/privkey.pem /var/lib/marzban/certs/

    MARZBAN_ENV="/opt/marzban/.env"
    
    sed -i 's/^#UVICORN_SSL_CERTFILE.*/UVICORN_SSL_CERTFILE="\/var\/lib\/marzban\/certs\/fullchain.pem"/' $MARZBAN_ENV
    sed -i 's/^#UVICORN_SSL_KEYFILE.*/UVICORN_SSL_KEYFILE="\/var\/lib\/marzban\/certs\/privkey.pem"/' $MARZBAN_ENV
    
    if ! grep -q "UVICORN_SSL_CERTFILE" $MARZBAN_ENV; then
        echo 'UVICORN_SSL_CERTFILE="/var/lib/marzban/certs/fullchain.pem"' >> $MARZBAN_ENV
        echo 'UVICORN_SSL_KEYFILE="/var/lib/marzban/certs/privkey.pem"' >> $MARZBAN_ENV
    fi

    # 5. Install Custom Template (If exists in Dashboard repo)
    cd "$DASHBOARD_DIR" 
    if [ -d "template" ] || [ -d "templates" ]; then
        echo "--- Installing Custom Subscription Template ---"
        mkdir -p /var/lib/marzban/templates/subscription/
        
        if [ -f "template/index.html" ]; then
            cp template/index.html /var/lib/marzban/templates/subscription/
        elif [ -f "templates/index.html" ]; then
            cp templates/index.html /var/lib/marzban/templates/subscription/
        fi

        if ! grep -q "CUSTOM_TEMPLATES_DIRECTORY" $MARZBAN_ENV; then
            echo 'CUSTOM_TEMPLATES_DIRECTORY="/var/lib/marzban/templates/"' >> $MARZBAN_ENV
            echo 'SUBSCRIPTION_PAGE_TEMPLATE="subscription/index.html"' >> $MARZBAN_ENV
        fi
    fi

    # 6. Start Marzban (DETACHED MODE - No Hanging)
    echo "--- Starting Marzban ---"
    cd /opt/marzban
    docker compose up -d

    # 7. Auto-Renew Job
    cat <<CRON > /usr/local/bin/renew_marzban_certs.sh
#!/bin/bash
certbot renew --quiet --deploy-hook "cp /etc/letsencrypt/live/$DOMAIN_NAME/fullchain.pem /var/lib/marzban/certs/ && cp /etc/letsencrypt/live/$DOMAIN_NAME/privkey.pem /var/lib/marzban/certs/ && marzban restart"
CRON
    chmod +x /usr/local/bin/renew_marzban_certs.sh
    (crontab -l 2>/dev/null; echo "0 3 * * * /usr/local/bin/renew_marzban_certs.sh") | crontab -

    # 8. Create Admin User
    echo "--- Creating Marzban Admin ---"
    sleep 20 
    
    MB_PASS=$(openssl rand -hex 8)
    printf "admin\nn\n$MB_PASS\n$MB_PASS\n" | marzban cli admin create
    
    echo "--------------------------------------------------------"
    echo "🔴 MARZBAN ADMIN CREDENTIALS:"
    echo "Username: admin"
    echo "Password: $MB_PASS"
    echo "--------------------------------------------------------"
fi
# -----------------------------------------------------------

# 8. Build and Start Dashboard
echo "--- Building and Starting Marz-X Dashboard ---"
cd "$DASHBOARD_DIR"

docker compose down
docker compose up -d --build

# Initialize Database (Prevents 502 Error)
echo "--- Initializing Database ---"
sleep 10
docker compose run --rm backend npx prisma db push
docker compose restart backend

# 9. Configure Nginx Proxy for Dashboard
echo "--- Finalizing Nginx Configuration ---"
cat <<NGINX > /etc/nginx/sites-available/$DOMAIN_NAME
server {
    listen 80;
    server_name $DOMAIN_NAME;

    # Dashboard Proxy
    location / {
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
    }
    
    # API Proxy
    location /api {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
    }
}
NGINX

# Re-apply SSL Config and Port 6104
sed -i "s/listen 80;/listen $TARGET_PORT ssl;/g" /etc/nginx/sites-available/$DOMAIN_NAME
sed -i "/server_name $DOMAIN_NAME;/a \    ssl_certificate /etc/letsencrypt/live/$DOMAIN_NAME/fullchain.pem;\n    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN_NAME/privkey.pem;" /etc/nginx/sites-available/$DOMAIN_NAME

# Firewall
ufw allow $TARGET_PORT/tcp
ufw allow 80/tcp
ufw allow 443/tcp
systemctl reload nginx

echo "------------------------------------------------------------------"
echo "✅ Installation Complete!"
echo "------------------------------------------------------------------"
echo "🔹 Marz-X Dashboard: https://$DOMAIN_NAME:$TARGET_PORT"
echo "   Login: admin@admin.com / admin123"
echo ""
if [[ "$INSTALL_MARZBAN" =~ ^[Yy]$ ]]; then
echo "🔹 Marzban Panel: https://$DOMAIN_NAME:8000/dashboard"
echo "   Login: admin / $MB_PASS"
fi
echo "------------------------------------------------------------------"