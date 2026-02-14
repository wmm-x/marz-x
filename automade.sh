#!/bin/bash

# Stop script on error
set -e

DOCKER_IMAGE="malindamalshan/marzban-dashboard:latest"

# Root Check
if [ "$EUID" -ne 0 ]; then
  echo "[X] Please run as root (sudo)"
  exit 1
fi

# ==============================================================================
#                      FIXED DEPENDENCY & DOCKER INSTALL
# ==============================================================================
export DEBIAN_FRONTEND=noninteractive

echo "[PACK] Updating system and installing dependencies..."
apt-get update -qq -y 
apt-get install -qq -y curl ca-certificates openssl jq ufw docker.io

# ----------------------------------------------------------------------
#  FORCE INSTALL DOCKER COMPOSE (Manual Binary Download)
# ----------------------------------------------------------------------
# 1. Create the CLI plugins directory
mkdir -p /usr/libexec/docker/cli-plugins

# 2. Download the official Docker Compose binary
echo "[INSTALL] Downloading Docker Compose binary..."
curl -SL https://github.com/docker/compose/releases/download/v2.24.5/docker-compose-linux-x86_64 -o /usr/libexec/docker/cli-plugins/docker-compose

# 3. Make it executable
chmod +x /usr/libexec/docker/cli-plugins/docker-compose

# 4. Verify installation
if ! docker compose version > /dev/null 2>&1; then
    echo "[X] Docker Compose plugin failed. Trying standalone install..."
    # Fallback: install as standalone command /usr/local/bin/docker-compose
    curl -SL https://github.com/docker/compose/releases/download/v2.24.5/docker-compose-linux-x86_64 -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    # Create a symlink so "docker compose" command works via legacy method if needed, 
    # but mostly we just need "docker-compose" to work.
fi

# 5. Enable and Start Docker Service
systemctl start docker
systemctl enable docker

echo "[WAIT] Waiting 5s for Docker to stabilize..."
sleep 5
if ! command -v docker &> /dev/null; then
    echo "[X] Docker installation failed."
    exit 1
else
    echo "[OK] Docker is installed and ready."
fi
# ==============================================================================
# ==============================================================================
#                        PART 1: DASHBOARD CONFIGURATION (AUTOMATED)
# ==============================================================================
echo ""
echo "--- [CONFIG] Dashboard Configuration ---"

# 1. Domain Name (Check Env Var first, else Prompt)
if [ -z "$DOMAIN_NAME" ]; then
    read -p "Enter your Domain (e.g., panel.example.com): " DOMAIN_NAME
fi

if [ -z "$DOMAIN_NAME" ]; then
  echo "[X] Error: You must provide a domain name."
  exit 1
fi

# 2. Port (Default 6104)
HTTPS_PORT="${HTTPS_PORT:-6104}"
if [ -z "$HTTPS_PORT" ] && [ -z "$CI" ]; then
    read -p "Enter Dashboard Public Port [6104]: " INPUT_PORT
    HTTPS_PORT="${INPUT_PORT:-6104}"
fi

# 3. Optimize Interval
OPTIMIZE_INTERVAL="${OPTIMIZE_INTERVAL:-10}"

# 4. Admin Credentials
if [ -z "$ADMIN_USER" ]; then
    echo ""
    echo "[SECURE] Setup Dashboard Admin Credentials"
    read -p "Admin Username [admin]: " INPUT_USER
    ADMIN_USER="${INPUT_USER:-admin}"
fi

if [ -z "$ADMIN_PASSWORD" ]; then
    read -p "Admin Password [admin123]: " INPUT_PASS
    ADMIN_PASSWORD="${INPUT_PASS:-admin123}"
fi

echo "[INFO] Configuring for Domain: $DOMAIN_NAME"
echo "[INFO] Dashboard Port: $HTTPS_PORT"

# Generate Secure Keys
JWT_SECRET=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)
MARZBAN_ADMIN_PASS=$(openssl rand -base64 12)

# ==============================================================================
#                        PART 2: SSL GENERATION
# ==============================================================================
INSTALL_DIR="/root/marzban-dashboard"
mkdir -p $INSTALL_DIR/data
mkdir -p $INSTALL_DIR/certs
cd $INSTALL_DIR

echo ""
# Check if certificate already exists in system path
if [ -d "/etc/letsencrypt/live/$DOMAIN_NAME" ]; then
    echo "[SSL] Certificate already exists for $DOMAIN_NAME in /etc/letsencrypt/live/"
    echo "[SSL] Copying existing certificate to dashboard directory..."
    
    cp -r /etc/letsencrypt/live/$DOMAIN_NAME $INSTALL_DIR/certs/live/
    cp -r /etc/letsencrypt/archive/$DOMAIN_NAME $INSTALL_DIR/certs/archive/ 2>/dev/null || true
    cp -r /etc/letsencrypt/renewal/$DOMAIN_NAME.conf $INSTALL_DIR/certs/renewal/ 2>/dev/null || true
    
    echo "[OK] Existing SSL Certificate copied successfully."
    
elif [ -d "$INSTALL_DIR/certs/live/$DOMAIN_NAME" ]; then
    echo "[SSL] Certificate already exists for $DOMAIN_NAME in dashboard directory."
    echo "[OK] Using existing SSL Certificate."
    
else
    echo "[SSL] No existing certificate found. Requesting new SSL Certificate for $DOMAIN_NAME..."
    
    docker compose down 2>/dev/null || true
    if command -v systemctl >/dev/null; then
        systemctl stop nginx 2>/dev/null || true
    fi
    
    docker run --rm --name certbot \
      -v "$(pwd)/certs:/etc/letsencrypt" \
      -v "$(pwd)/certs-data:/var/lib/letsencrypt" \
      -p 80:80 \
      certbot/certbot certonly --standalone \
      -d "$DOMAIN_NAME" \
      --email "admin@$DOMAIN_NAME" --agree-tos --no-eff-email --non-interactive
    
    if [ ! -d "certs/live/$DOMAIN_NAME" ]; then
      echo "[X] SSL Generation Failed! Port 80 might be blocked or DNS is incorrect."
        exit 1
    fi
    echo "[OK] SSL Certificate obtained successfully."
fi

# ==============================================================================
#                        PART 3: DASHBOARD INSTALLATION
# ==============================================================================
echo ""
echo "[FILE] Creating Dashboard configuration files..."

# 1. .env
cat > .env <<EOF
NODE_ENV=production
PORT=5000
BACKUP_INTERVAL_MINUTES=60
AUTO_OPTIMIZE_INTERVAL_MINUTES=${OPTIMIZE_INTERVAL}
DATABASE_URL="file:/app/data/db.sqlite"
JWT_SECRET="${JWT_SECRET}"
ENCRYPTION_KEY="${ENCRYPTION_KEY}"
ADMIN_USER="${ADMIN_USER}"
ADMIN_PASSWORD="${ADMIN_PASSWORD}"
ADMIN_NAME="Administrator"
MARZBAN_ADMIN="MarzbanAdminx"
MARZBAN_ADMIN_PASS="${MARZBAN_ADMIN_PASS}"
EOF

# 2. nginx.conf (With Swagger Routes preserved)
cat > nginx.conf <<EOF
events { worker_connections 1024; }
http {
    include mime.types;
    default_type application/octet-stream;
    server {
        listen $HTTPS_PORT ssl;
        error_page 497 https://\$host:\$server_port\$request_uri;
        server_name $DOMAIN_NAME;
        ssl_certificate /etc/letsencrypt/live/$DOMAIN_NAME/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/$DOMAIN_NAME/privkey.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        root /usr/share/nginx/html;
        index index.html;
        
        # Redirect /api-docs to /api-docs/
        location = /api-docs {
            return 301 \$scheme://\$host:\$server_port/api-docs/;
        }
        
        # API Documentation - Swagger UI
        location /api-docs/ {
            proxy_pass http://127.0.0.1:5000;
            proxy_http_version 1.1;
            proxy_set_header Upgrade \$http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host \$host;
            proxy_cache_bypass \$http_upgrade;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
            add_header Cache-Control "no-cache, no-store, must-revalidate";
        }
        
        # Swagger CSS file
        location /swagger-theme.css {
            proxy_pass http://127.0.0.1:5000;
            proxy_http_version 1.1;
            proxy_set_header Host \$host;
            add_header Cache-Control "no-cache, no-store, must-revalidate";
        }
        
        # API routes
        location /api/ {
            proxy_pass http://127.0.0.1:5000;
            proxy_http_version 1.1;
            proxy_set_header Upgrade \$http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host \$host;
            proxy_cache_bypass \$http_upgrade;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
        }
        
        # Frontend - React App
        location / { 
            try_files \$uri \$uri/ /index.html; 
        }
    }
}
EOF

# 3. docker-compose.yml
cat > docker-compose.yml <<EOF
version: '3.8'
services:
  dashboard:
    container_name: marzban-dashboard
    image: ${DOCKER_IMAGE}
    restart: always
    network_mode: "host"
    volumes:
      - ./data:/app/data
      - ./certs:/etc/letsencrypt
      - ./nginx.conf:/etc/nginx/nginx.conf
      - /var/run/docker.sock:/var/run/docker.sock
    env_file:
      - .env
EOF

echo "[START] Starting Marzban Dashboard..."
docker compose pull
docker compose up -d
echo "[OK] Dashboard is running at https://$DOMAIN_NAME:$HTTPS_PORT"

# ==============================================================================
#                        PART 4: CLI TOOL SETUP (marz-x)
# ==============================================================================
echo ""
echo "[INSTALL] Installing 'marz-x' CLI tool..."

cat > /usr/local/bin/marz-x << 'EOF'
#!/bin/bash

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

DASH_DIR="/root/marzban-dashboard"

# Helper Functions
show_header() {
    clear
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}      [START] Marz-X Management Menu      ${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
}

wait_key() {
    echo ""
    read -n 1 -s -r -p "Press any key to return to menu..."
    echo ""
}

# Root Check
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}[X] Please run as root (sudo marz-x)${NC}"
  exit 1
fi

# Main Menu Loop
while true; do
    show_header
    echo "1) Update Panel"
    echo "2) Start Services"
    echo "3) Stop Services"
    echo "4) View Logs"
    echo "5) Panel Info"
    echo "6) Change Panel Port"
    echo "7) Uninstall Dashboard"
    echo "8) Exit"
    echo ""
    read -p "Select an option [1-8]: " OPTION

    case $OPTION in
        1) # UPDATE PANEL
            echo ""
            echo -e "${YELLOW}Updating Marzban Dashboard...${NC}"
            
            CLI_MENU_URL="https://raw.githubusercontent.com/wmm-x/marz-x/main/cli-menu.sh"
            CLI_TEMP=$(mktemp)
            
            curl -fsSL "$CLI_MENU_URL" -o "$CLI_TEMP" 2>/dev/null || true
            cp /usr/local/bin/marz-x /usr/local/bin/marz-x.backup 2>/dev/null || true
            install -m 755 "$CLI_TEMP" /usr/local/bin/marz-x
            rm -f "$CLI_TEMP"
            CLI_UPDATED=true
            
            if [ -d "$DASH_DIR" ]; then
                cd $DASH_DIR
                
                # Stop and remove old container
                echo -e "${YELLOW}Stopping and removing old container...${NC}"
                docker compose down || true
                
                # Remove all existing images of this dashboard to force fresh pull
                echo -e "${YELLOW}Removing old dashboard images...${NC}"
                docker rmi malindamalshan/marzban-dashboard:latest 2>/dev/null || true
                docker rmi $(docker images | grep malindamalshan/marzban-dashboard | awk '{print $3}') 2>/dev/null || true
                
                # Remove all dangling images
                echo -e "${YELLOW}Cleaning up unused images...${NC}"
                docker image prune -f --filter "dangling=true" 2>/dev/null || true
                
                # Fix nginx.conf certificate path to use actual domain
                echo -e "${YELLOW}Verifying SSL certificate paths...${NC}"
                ACTUAL_CERT_DIR=$(find /root/marzban-dashboard/certs/live -mindepth 1 -maxdepth 1 -type d 2>/dev/null | head -1)
                if [ -n "$ACTUAL_CERT_DIR" ]; then
                    ACTUAL_DOMAIN=$(basename "$ACTUAL_CERT_DIR")
                    echo -e "${GREEN}Found SSL certificate for: ${ACTUAL_DOMAIN}${NC}"
                    
                    # Update nginx.conf with correct domain
                    sed -i "s|ssl_certificate /etc/letsencrypt/live/.*/fullchain.pem|ssl_certificate /etc/letsencrypt/live/${ACTUAL_DOMAIN}/fullchain.pem|g" "$DASH_DIR/nginx.conf"
                    sed -i "s|ssl_certificate_key /etc/letsencrypt/live/.*/privkey.pem|ssl_certificate_key /etc/letsencrypt/live/${ACTUAL_DOMAIN}/privkey.pem|g" "$DASH_DIR/nginx.conf"
                    sed -i "s|server_name .*;|server_name ${ACTUAL_DOMAIN};|g" "$DASH_DIR/nginx.conf"
                else
                    echo -e "${YELLOW}No SSL certificate found. You may need to re-run installation for certificate setup.${NC}"
                fi
                
                # Update docker-compose.yml to ensure it uses :latest
                echo -e "${YELLOW}Updating docker-compose.yml to use latest image...${NC}"
                sed -i 's|image: malindamalshan/marzban-dashboard:.*|image: malindamalshan/marzban-dashboard:latest|g' "$DASH_DIR/docker-compose.yml"
                
                # Pull latest image fresh
                echo -e "${YELLOW}Pulling latest dashboard image...${NC}"
                docker pull malindamalshan/marzban-dashboard:latest
                
                # Recreate and start container with fresh image
                echo -e "${YELLOW}Starting dashboard with latest image...${NC}"
                docker compose up -d --pull always --force-recreate
                
                echo -e "${GREEN}[OK] Dashboard updated successfully!${NC}"
                
                # Verify the running image
                RUNNING_IMAGE=$(docker inspect marzban-dashboard --format='{{.Config.Image}}' 2>/dev/null || echo "unknown")
                RUNNING_DIGEST=$(docker inspect marzban-dashboard --format='{{.Image}}' 2>/dev/null || echo "unknown")
                echo -e "${GREEN}Running image: ${RUNNING_IMAGE}${NC}"
                echo -e "${GREEN}Image SHA: ${RUNNING_DIGEST}${NC}"
                
                # Clean up unused images and volumes
                echo -e "${YELLOW}Cleaning up old images and unused volumes...${NC}"
                docker image prune -f 2>/dev/null || true
                docker volume prune -f 2>/dev/null || true
                
                echo ""
                echo -e "${GREEN}[OK] Dashboard and CLI menu update completed!${NC}"
                
                # If CLI was updated, restart menu to apply changes
                if [ "$CLI_UPDATED" = true ]; then
                    echo -e "${BLUE}[INFO] Restarting menu to apply CLI updates...${NC}"
                    sleep 2
                    exec marz-x
                fi
            else
                echo -e "${RED}Dashboard directory not found!${NC}"
            fi
            wait_key
            ;;

        2) # START
            echo ""
            echo -e "${GREEN}Starting Dashboard...${NC}"
            if [ -d "$DASH_DIR" ]; then
                cd $DASH_DIR && docker compose up -d
            else
                echo -e "${RED}Dashboard directory not found!${NC}"
            fi

            # Optional: Start Marzban Server if installed
            if command -v marzban &> /dev/null; then
                echo -e "${GREEN}Starting Marzban Server...${NC}"
                marzban restart
            fi
            
            echo -e "${GREEN}[OK] Start command executed.${NC}"
            wait_key
            ;;

        3) # STOP
            echo ""
            echo -e "${YELLOW}Stopping Dashboard...${NC}"
            if [ -d "$DASH_DIR" ]; then
                cd $DASH_DIR && docker compose down
            fi

            # Optional: Stop Marzban Server
            if command -v marzban &> /dev/null; then
                 echo ""
                 read -p "Do you want to stop Marzban VPN Server as well? [y/N]: " STOP_VPN
                 if [[ "$STOP_VPN" =~ ^[Yy]$ ]]; then
                    echo -e "${YELLOW}Stopping Marzban Server...${NC}"
                    marzban stop
                 fi
            fi
            echo -e "${GREEN}[OK] Stop command executed.${NC}"
            wait_key
            ;;

        4) # LOGS
            echo ""
            echo "Which logs would you like to view?"
            echo "1) Dashboard Logs"
            echo "2) Marzban VPN Logs"
            read -p "Select [1-2]: " LOG_CHOICE
            
            if [ "$LOG_CHOICE" == "1" ]; then
                echo -e "${BLUE}Showing Dashboard Logs (Press CTRL+C to exit)...${NC}"
                sleep 1
                cd $DASH_DIR && docker compose logs -f
            elif [ "$LOG_CHOICE" == "2" ]; then
                if command -v marzban &> /dev/null; then
                    echo -e "${BLUE}Showing Marzban VPN Logs (Press CTRL+C to exit)...${NC}"
                    sleep 1
                    marzban logs
                else
                    echo -e "${RED}Marzban VPN Server is not installed.${NC}"
                    wait_key
                fi
            else
                echo "Invalid selection."
            fi
            ;;

        5) # PANEL INFO
            echo ""
            echo -e "${BLUE}========================================${NC}"
            echo -e "${BLUE}      PANEL INFORMATION${NC}"
            echo -e "${BLUE}========================================${NC}"
            echo ""
            
            if [ -f "$DASH_DIR/.env" ]; then
                # Extract Marz-X Dashboard info
                DASHBOARD_DOMAIN=$(grep -i "server_name" "$DASH_DIR/nginx.conf" 2>/dev/null | head -1 | awk '{print $2}' | sed 's/;//' || echo "Not found")
                DASHBOARD_PORT=$(grep -i "listen" "$DASH_DIR/nginx.conf" 2>/dev/null | grep "ssl" | head -1 | awk '{print $2}' | sed 's/ssl;//' | sed 's/;//' || echo "Not found")
                ADMIN_USER=$(grep "^ADMIN_USER=" "$DASH_DIR/.env" 2>/dev/null | cut -d'=' -f2 | tr -d '"' || echo "Not found")
                ADMIN_PASS=$(grep "^ADMIN_PASSWORD=" "$DASH_DIR/.env" 2>/dev/null | cut -d'=' -f2 | tr -d '"' || echo "Not found")
                
                echo -e "${GREEN}🔹 MARZ-X DASHBOARD${NC}"
                echo -e "   Domain:   ${YELLOW}${DASHBOARD_DOMAIN}${NC}"
                echo -e "   Port:     ${YELLOW}${DASHBOARD_PORT}${NC}"
                echo -e "   URL:      ${YELLOW}https://${DASHBOARD_DOMAIN}:${DASHBOARD_PORT}${NC}"
                echo -e "   Username: ${YELLOW}${ADMIN_USER}${NC}"
                echo -e "   Password: ${YELLOW}${ADMIN_PASS}${NC}"
                echo ""
            else
                echo -e "${RED}Dashboard configuration not found!${NC}"
            fi
            
            # Check if Marzban is installed and get its info
            if command -v marzban &> /dev/null; then
                if [ -f "/opt/marzban/.env" ]; then
                    MARZBAN_SUDO_USER=$(grep "^SUDO_USERNAME=" "/opt/marzban/.env" 2>/dev/null | cut -d'=' -f2 | tr -d '"' || echo "Not found")
                    MARZBAN_SUDO_PASS=$(grep "^SUDO_PASSWORD=" "/opt/marzban/.env" 2>/dev/null | cut -d'=' -f2 | tr -d '"' || echo "Not found")
                    
                    echo -e "${GREEN}🔹 MARZBAN VPN SERVER${NC}"
                    echo -e "   URL:      ${YELLOW}https://${DASHBOARD_DOMAIN}:8000${NC}"
                    echo -e "   Username: ${YELLOW}${MARZBAN_SUDO_USER}${NC}"
                    echo -e "   Password: ${YELLOW}${MARZBAN_SUDO_PASS}${NC}"
                    echo ""
                fi
            fi
            
            echo -e "${BLUE}========================================${NC}"
            wait_key
            ;;

        6) # CHANGE PANEL PORT
            echo ""
            echo -e "${BLUE}========================================${NC}"
            echo -e "${BLUE}      CHANGE PANEL PORT${NC}"
            echo -e "${BLUE}========================================${NC}"
            echo ""
            
            if [ -f "$DASH_DIR/nginx.conf" ]; then
                CURRENT_PORT=$(grep -i "listen" "$DASH_DIR/nginx.conf" 2>/dev/null | grep "ssl" | head -1 | awk '{print $2}' | sed 's/ssl;//' | sed 's/;//' || echo "6104")
                echo -e "${YELLOW}Current Panel Port: ${CURRENT_PORT}${NC}"
                echo ""
                read -p "Enter new port number: " NEW_PORT
                
                # Validate port is a number
                if ! [[ "$NEW_PORT" =~ ^[0-9]+$ ]]; then
                    echo -e "${RED}Invalid port! Port must be a number.${NC}"
                    wait_key
                else
                    # Validate port range
                    if [ "$NEW_PORT" -lt 1 ] || [ "$NEW_PORT" -gt 65535 ]; then
                        echo -e "${RED}Invalid port! Port must be between 1 and 65535.${NC}"
                        wait_key
                    else
                        echo -e "${YELLOW}Updating panel port from ${CURRENT_PORT} to ${NEW_PORT}...${NC}"
                        
                        # Stop services
                        echo -e "${YELLOW}Stopping Dashboard...${NC}"
                        cd $DASH_DIR && docker compose down || true
                        
                        # Update nginx.conf
                        sed -i "s/listen ${CURRENT_PORT} ssl;/listen ${NEW_PORT} ssl;/" "$DASH_DIR/nginx.conf"
                        
                        # Get domain for confirmation
                        DASHBOARD_DOMAIN=$(grep -i "server_name" "$DASH_DIR/nginx.conf" 2>/dev/null | head -1 | awk '{print $2}' | sed 's/;//' || echo "")
                        
                        # Start services
                        echo -e "${YELLOW}Starting Dashboard with new port...${NC}"
                        cd $DASH_DIR && docker compose up -d
                        
                        echo ""
                        echo -e "${GREEN}[OK] Port changed successfully!${NC}"
                        echo -e "${GREEN}New URL: https://${DASHBOARD_DOMAIN}:${NEW_PORT}${NC}"
                        echo ""
                    fi
                fi
            else
                echo -e "${RED}Dashboard configuration not found!${NC}"
            fi
            
            wait_key
            ;;

        7) # UNINSTALL
            echo ""
            echo -e "${RED}[!!] DANGER ZONE [!!]${NC}"
            echo "This will completely remove the Marzban Dashboard and this Menu tool."
            echo "Your Marzban VPN Server (if installed) will remain safe."
            echo ""
            read -p "Are you sure you want to uninstall Marz-X Dashboard? [y/N]: " CONFIRM
            if [[ "$CONFIRM" =~ ^[Yy]$ ]]; then
                echo -e "${YELLOW}Removing Dashboard Container...${NC}"
                cd $DASH_DIR && docker compose down || true
                
                echo -e "${YELLOW}Removing Docker Images...${NC}"
                docker rmi malindamalshan/marzban-dashboard:latest 2>/dev/null || true
                docker image prune -f 2>/dev/null || true
                
                echo -e "${YELLOW}Removing Volumes and Data...${NC}"
                docker volume prune -f 2>/dev/null || true
                
                echo -e "${YELLOW}Removing Dashboard Files and Data...${NC}"
                echo -e "${BLUE}[INFO] Preserving SSL certificates for future installations...${NC}"
                
                # Check which certificates exist
                if [ -d "$DASH_DIR/certs/live" ]; then
                    PRESERVED_DOMAINS=$(ls -1 "$DASH_DIR/certs/live" 2>/dev/null | tr '\n' ', ' | sed 's/,$//')
                    if [ -n "$PRESERVED_DOMAINS" ]; then
                        echo -e "${BLUE}[INFO] Found certificates for: $PRESERVED_DOMAINS${NC}"
                    fi
                fi
                
                # Remove everything except SSL certificates
                cd $DASH_DIR
                rm -f .env docker-compose.yml nginx.conf 2>/dev/null || true
                rm -rf data 2>/dev/null || true
                
                # Keep only certs folder
                find $DASH_DIR -mindepth 1 -maxdepth 1 ! -name 'certs' -exec rm -rf {} + 2>/dev/null || true
                
                echo -e "${GREEN}[OK] SSL certificates preserved in: $DASH_DIR/certs${NC}"
                
                echo -e "${YELLOW}Removing 'marz-x' CLI tool...${NC}"
                rm /usr/local/bin/marz-x
                sudo systemctl restart docker 2>/dev/null || true
                
                echo -e "${GREEN}[OK] Dashboard uninstalled successfully!${NC}"
                echo -e "${BLUE}[INFO] SSL certificates have been preserved for future installations.${NC}"
                echo -e "${BLUE}[INFO] You can reinstall without regenerating SSL certificates.${NC}"
                echo ""
                
                # Ask if user wants to uninstall Marzban as well
                read -p "Do you also want to uninstall Marzban VPN Server? [y/N]: " UNINSTALL_MARZBAN
                if [[ "$UNINSTALL_MARZBAN" =~ ^[Yy]$ ]]; then
                    echo -e "${YELLOW}Uninstalling Marzban VPN Server...${NC}"
                    if command -v marzban &> /dev/null; then
                        marzban uninstall
                        echo -e "${GREEN}[OK] Marzban VPN Server uninstalled.${NC}"
                    else
                        echo -e "${RED}Marzban VPN Server is not installed.${NC}"
                    fi
                else
                    echo "Marzban VPN Server will remain installed."
                fi
                
                echo ""
                echo -e "${GREEN}[OK] Complete Uninstall Done!${NC}"
                echo -e "${BLUE}[INFO] SSL certificates preserved in: $DASH_DIR/certs${NC}"
                echo -e "${BLUE}[INFO] Run the install script again to reinstall without regenerating SSL.${NC}"
                echo ""
                exit 0
            else
                echo "Cancelled."
                wait_key
            fi
            ;;

        5) # LOGS
            echo ""
            echo "Which logs would you like to view?"
            echo "1) Dashboard Logs"
            echo "2) Marzban VPN Logs"
            read -p "Select [1-2]: " LOG_CHOICE
            
            if [ "$LOG_CHOICE" == "1" ]; then
                echo -e "${BLUE}Showing Dashboard Logs (Press CTRL+C to exit)...${NC}"
                sleep 1
                cd $DASH_DIR && docker compose logs -f
            elif [ "$LOG_CHOICE" == "2" ]; then
                if command -v marzban &> /dev/null; then
                    echo -e "${BLUE}Showing Marzban VPN Logs (Press CTRL+C to exit)...${NC}"
                    sleep 1
                    marzban logs
                else
                    echo -e "${RED}Marzban VPN Server is not installed.${NC}"
                    wait_key
                fi
            else
                echo "Invalid selection."
            fi
            ;;

        6) # PANEL INFO
            echo ""
            echo -e "${BLUE}========================================${NC}"
            echo -e "${BLUE}      PANEL INFORMATION${NC}"
            echo -e "${BLUE}========================================${NC}"
            echo ""
            
            if [ -f "$DASH_DIR/.env" ]; then
                # Extract Marz-X Dashboard info
                DASHBOARD_DOMAIN=$(grep -i "server_name" "$DASH_DIR/nginx.conf" 2>/dev/null | head -1 | awk '{print $2}' | sed 's/;//' || echo "Not found")
                DASHBOARD_PORT=$(grep -i "listen" "$DASH_DIR/nginx.conf" 2>/dev/null | grep "ssl" | head -1 | awk '{print $2}' | sed 's/ssl;//' | sed 's/;//' || echo "Not found")
                ADMIN_USER=$(grep "^ADMIN_USER=" "$DASH_DIR/.env" 2>/dev/null | cut -d'=' -f2 | tr -d '"' || echo "Not found")
                ADMIN_PASS=$(grep "^ADMIN_PASSWORD=" "$DASH_DIR/.env" 2>/dev/null | cut -d'=' -f2 | tr -d '"' || echo "Not found")
                
                echo -e "${GREEN}🔹 MARZ-X DASHBOARD${NC}"
                echo -e "   Domain:   ${YELLOW}${DASHBOARD_DOMAIN}${NC}"
                echo -e "   Port:     ${YELLOW}${DASHBOARD_PORT}${NC}"
                echo -e "   URL:      ${YELLOW}https://${DASHBOARD_DOMAIN}:${DASHBOARD_PORT}${NC}"
                echo -e "   Username: ${YELLOW}${ADMIN_USER}${NC}"
                echo -e "   Password: ${YELLOW}${ADMIN_PASS}${NC}"
                echo ""
            else
                echo -e "${RED}Dashboard configuration not found!${NC}"
            fi
            
            # Check if Marzban is installed and get its info
            if command -v marzban &> /dev/null; then
                if [ -f "/opt/marzban/.env" ]; then
                    MARZBAN_SUDO_USER=$(grep "^SUDO_USERNAME=" "/opt/marzban/.env" 2>/dev/null | cut -d'=' -f2 | tr -d '"' || echo "Not found")
                    MARZBAN_SUDO_PASS=$(grep "^SUDO_PASSWORD=" "/opt/marzban/.env" 2>/dev/null | cut -d'=' -f2 | tr -d '"' || echo "Not found")
                    
                    echo -e "${GREEN}🔹 MARZBAN VPN SERVER${NC}"
                    echo -e "   URL:      ${YELLOW}https://${DASHBOARD_DOMAIN}:8000${NC}"
                    echo -e "   Username: ${YELLOW}${MARZBAN_SUDO_USER}${NC}"
                    echo -e "   Password: ${YELLOW}${MARZBAN_SUDO_PASS}${NC}"
                    echo ""
                fi
            fi
            
            echo -e "${BLUE}========================================${NC}"
            wait_key
            ;;

        7) # CHANGE PANEL PORT
            echo ""
            echo -e "${BLUE}========================================${NC}"
            echo -e "${BLUE}      CHANGE PANEL PORT${NC}"
            echo -e "${BLUE}========================================${NC}"
            echo ""
            
            if [ -f "$DASH_DIR/nginx.conf" ]; then
                CURRENT_PORT=$(grep -i "listen" "$DASH_DIR/nginx.conf" 2>/dev/null | grep "ssl" | head -1 | awk '{print $2}' | sed 's/ssl;//' | sed 's/;//' || echo "6104")
                echo -e "${YELLOW}Current Panel Port: ${CURRENT_PORT}${NC}"
                echo ""
                read -p "Enter new port number: " NEW_PORT
                
                # Validate port is a number
                if ! [[ "$NEW_PORT" =~ ^[0-9]+$ ]]; then
                    echo -e "${RED}Invalid port! Port must be a number.${NC}"
                    wait_key
                else
                    # Validate port range
                    if [ "$NEW_PORT" -lt 1 ] || [ "$NEW_PORT" -gt 65535 ]; then
                        echo -e "${RED}Invalid port! Port must be between 1 and 65535.${NC}"
                        wait_key
                    else
                        echo -e "${YELLOW}Updating panel port from ${CURRENT_PORT} to ${NEW_PORT}...${NC}"
                        
                        # Stop services
                        echo -e "${YELLOW}Stopping Dashboard...${NC}"
                        cd $DASH_DIR && docker compose down || true
                        
                        # Update nginx.conf
                        sed -i "s/listen ${CURRENT_PORT} ssl;/listen ${NEW_PORT} ssl;/" "$DASH_DIR/nginx.conf"
                        
                        # Get domain for confirmation
                        DASHBOARD_DOMAIN=$(grep -i "server_name" "$DASH_DIR/nginx.conf" 2>/dev/null | head -1 | awk '{print $2}' | sed 's/;//' || echo "")
                        
                        # Start services
                        echo -e "${YELLOW}Starting Dashboard with new port...${NC}"
                        cd $DASH_DIR && docker compose up -d
                        
                        echo ""
                        echo -e "${GREEN}[OK] Port changed successfully!${NC}"
                        echo -e "${GREEN}New URL: https://${DASHBOARD_DOMAIN}:${NEW_PORT}${NC}"
                        echo ""
                    fi
                fi
            else
                echo -e "${RED}Dashboard configuration not found!${NC}"
            fi
            
            wait_key
            ;;

        8) # EXIT
            echo "Exiting..."
            exit 0
            ;;

        *)
            echo -e "${RED}Invalid option.${NC}"
            sleep 1
            ;;
    esac
done
EOF

chmod +x /usr/local/bin/marz-x
echo "[OK] 'marz-x' menu installed successfully!"

echo ""
echo "------------------------------------------------------------------"
echo "✅ MARZ-X DASHBOARD SETUP FINISHED!"
echo "   Dashboard: https://$DOMAIN_NAME:$HTTPS_PORT"
echo "   Admin:     $ADMIN_USER"
echo "   Password:  $ADMIN_PASSWORD"
echo ""
echo "   Type 'marz-x' to open the management menu."
echo "------------------------------------------------------------------"
