#!/bin/bash

# Stop script on error
set -e

# ==============================================================================
#                               PRE-CHECKS & SETUP
# ==============================================================================
DOCKER_IMAGE="malindamalshan/marzban-dashboard:latest"

# Root Check
if [ "$EUID" -ne 0 ]; then
  echo "[X] Please run as root (sudo)"
  exit 1
fi

echo "=================================================================="
echo -e "\033[1;90m===========================================================\033[0m"
echo -e "\033[1;97m    __  __    _    ____  _____         __  __\033[0m"
echo -e "\033[1;96m   |  \/  |  / \  |  _ \|__  /         \ \/ /\033[0m"
echo -e "\033[1;36m   | |\/| | / _ \ | |_) | / /   _____   \  / \033[0m"
echo -e "\033[0;36m   | |  | |/ ___ \|  _ < / /_  |_____|  /  \ \033[0m"
echo -e "\033[0;34m   |_|  |_/_/   \_\_| \_\____|         /_/\_\\\ "
echo ""
echo -e "\033[1;37m              M A R Z - X\033[0m"
echo -e "\033[1;37m         Advanced Marzban Installer\033[0m"
echo -e "\033[1;37m     MARX-X Dashboard |  Server  | Integration\033[0m"
echo -e "\033[1;90m===========================================================\033[0m"

# Install Dependencies
echo "[PACK] Updating system and installing dependencies..."
apt update -y 
apt install -y curl ca-certificates openssl jq ufw 

# Check/Install Docker
if ! command -v docker &> /dev/null; then
  echo "[DOCKER] Docker not found. Installing..."
    curl -fsSL https://get.docker.com | sh
    echo "[OK] Docker installed."
else
    echo "[OK] Docker is already installed."
fi

# ==============================================================================
#                        PART 1: DASHBOARD CONFIGURATION
# ==============================================================================
echo ""
echo "--- [CONFIG] Dashboard Configuration ---"
read -p "Enter your Domain (e.g., panel.example.com): " DOMAIN_NAME
read -p "Enter Dashboard Public Port [6104]: " HTTPS_PORT
HTTPS_PORT=${HTTPS_PORT:-6104}

if [ -z "$DOMAIN_NAME" ]; then
  echo "[X] Error: You must provide a domain name."
    exit 1
fi

echo ""
read -p "Auto Optimize Interval (Minutes) [10]: " OPTIMIZE_INTERVAL
OPTIMIZE_INTERVAL=${OPTIMIZE_INTERVAL:-10}

echo ""
echo "[SECURE] Setup Dashboard Admin Credentials"
read -p "Admin Username [admin]: " ADMIN_USER
ADMIN_USER=${ADMIN_USER:-admin}

read -p "Admin Password [admin123]: " ADMIN_PASSWORD
ADMIN_PASSWORD=${ADMIN_PASSWORD:-admin123}

# Generate Secure Keys
JWT_SECRET=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)
MARZBAN_ADMIN_PASS=$(openssl rand -base64 12)

# ==============================================================================
#                        PART 2: SSL GENERATION
# ==============================================================================
# NOTE: We use /root/marzban-dashboard/certs/live so it matches your marz.sh CERT_BASE variable
INSTALL_DIR="/root/marzban-dashboard"
mkdir -p $INSTALL_DIR/data
mkdir -p $INSTALL_DIR/certs
cd $INSTALL_DIR

echo ""
# Check if certificate already exists in system path
if [ -d "/etc/letsencrypt/live/$DOMAIN_NAME" ]; then
    echo "[SSL] Certificate already exists for $DOMAIN_NAME in /etc/letsencrypt/live/"
    echo "[SSL] Copying existing certificate to dashboard directory..."
    
    # Copy existing certificates to dashboard certs directory
    cp -r /etc/letsencrypt/live/$DOMAIN_NAME $INSTALL_DIR/certs/live/
    cp -r /etc/letsencrypt/archive/$DOMAIN_NAME $INSTALL_DIR/certs/archive/ 2>/dev/null || true
    cp -r /etc/letsencrypt/renewal/$DOMAIN_NAME.conf $INSTALL_DIR/certs/renewal/ 2>/dev/null || true
    
    echo "[OK] Existing SSL Certificate copied successfully."
    
elif [ -d "$INSTALL_DIR/certs/live/$DOMAIN_NAME" ]; then
    echo "[SSL] Certificate already exists for $DOMAIN_NAME in dashboard directory."
    echo "[OK] Using existing SSL Certificate."
    
else
    echo "[SSL] No existing certificate found. Requesting new SSL Certificate for $DOMAIN_NAME..."
    
    # Stop any existing processes on port 80 to allow Certbot to run
    docker compose down 2>/dev/null || true
    if command -v systemctl >/dev/null; then
        systemctl stop nginx 2>/dev/null || true
        systemctl stop apache2 2>/dev/null || true
    fi
    
    docker run -it --rm --name certbot \
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

# 2. nginx.conf
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
        location / { try_files \$uri \$uri/ /index.html; }
        location /api/ {
            proxy_pass http://127.0.0.1:5000;
            proxy_http_version 1.1;
            proxy_set_header Upgrade \$http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host \$host;
            proxy_cache_bypass \$http_upgrade;
        }
    }
}
EOF

# 3. docker-compose.yml (HOST NETWORK MODE)
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
      - /var/lib/marzban:/var/lib/marzban
      - /var/run/docker.sock:/var/run/docker.sock
    env_file:
      - .env
EOF

echo "[START] Starting Marzban Dashboard..."
docker compose pull
docker compose up -d
echo "[OK] Dashboard is running at https://$DOMAIN_NAME:$HTTPS_PORT"



# ==============================================================================
#                        PART 3.5: CLI TOOL SETUP (marz-x)
# ==============================================================================
echo ""
echo "[INSTALL] Installing 'marz-x' CLI tool..."

# Use 'EOF' (quoted) to prevent variable expansion during script generation
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
        1) # UPDATE
            echo ""
            echo -e "${YELLOW}Updating Marzban Dashboard...${NC}"
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
                rm -rf $DASH_DIR
                
                echo -e "${YELLOW}Removing 'marz-x' CLI tool...${NC}"
                rm /usr/local/bin/marz-x
                sudo systemctl restart docker 2>/dev/null || true
                
                echo -e "${GREEN}[OK] Dashboard uninstalled successfully!${NC}"
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
                
                echo -e "${GREEN}[OK] Complete Uninstall Done. Bye!${NC}"
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

# ==============================================================================
#                        PART 4: MARZBAN SERVER EXECUTION
# ==============================================================================
echo ""
echo "--------------------------------------------------------"
read -p "[?] Do you need to install Marzban Server (VPN Panel)? [y/N]: " INSTALL_SERVER
echo "--------------------------------------------------------"

if [[ "$INSTALL_SERVER" =~ ^[Yy]$ ]]; then
    echo "[START] Starting Marzban Server Installation (Running marz.sh content)..."
    echo "==================================================================="

    # !!! BEGIN MARZ.SH CONTENT (UNMODIFIED) !!!
    
    # ---------------- CONFIG ----------------
    CERT_BASE="/root/marzban-dashboard/certs/live"
    CERT_DEST="/var/lib/marzban/certs"
    MARZBAN_ENV="/opt/marzban/.env"

    # Custom template
    TEMPLATE_DIR="/var/lib/marzban/templates/subscription"
    TEMPLATE_FILE="$TEMPLATE_DIR/index.html"
    TEMPLATE_RAW_URL="https://raw.githubusercontent.com/wmm-x/marz-x/main/template/index.html"

    # Xray config
    XRAY_CONFIG_FILE="/var/lib/marzban/xray_config.json"
    XRAY_CONFIG_RAW_URL="https://raw.githubusercontent.com/wmm-x/marz-x/main/xray_config.json"
    # ----------------------------------------

    # Root check
    if [ "$EUID" -ne 0 ]; then
      echo "Please run as root (sudo)"
      exit 1
    fi
   
    echo "Detecting existing Let's Encrypt certificate in: $CERT_BASE"

    if [ ! -d "$CERT_BASE" ]; then
      echo "$CERT_BASE not found. You must have an existing Let's Encrypt certificate first."
      exit 1
    fi

    # Pick the first valid LE cert directory (has fullchain.pem + privkey.pem)
    CERT_DIR="$(find "$CERT_BASE" -mindepth 1 -maxdepth 1 -type d \
      -exec test -f "{}/fullchain.pem" \; \
      -exec test -f "{}/privkey.pem" \; \
      -print | head -n 1)"

    if [ -z "$CERT_DIR" ]; then
      echo "No valid cert found in $CERT_BASE (missing fullchain.pem/privkey.pem)."
      exit 1
    fi

    DOMAIN_NAME="$(basename "$CERT_DIR")"
    echo "Using cert directory: $DOMAIN_NAME"

    # ------------------------------------------------
    # INSTALL MARZBAN (CTRL+C WON'T STOP THIS SCRIPT)
    # ------------------------------------------------
    echo "Installing Marzban..."
    echo "If installer shows logs, you can press CTRL+C to stop logs; this script will continue."

    trap 'echo; echo "CTRL+C detected. Stopping installer/log view and continuing script...";' INT
    bash -c "$(curl -fsSL https://github.com/Gozargah/Marzban-scripts/raw/master/marzban.sh)" @ install || true
    trap - INT

    # ------------------------------------------------
    # COPY SSL CERTS TO MARZBAN
    # ------------------------------------------------
    echo "Copying SSL certs to: $CERT_DEST"

    mkdir -p "$CERT_DEST"
    cp "$CERT_DIR/fullchain.pem" "$CERT_DEST/fullchain.pem"
    cp "$CERT_DIR/privkey.pem"   "$CERT_DEST/privkey.pem"

    chmod 600 "$CERT_DEST/privkey.pem" || true
    chown -R marzban:marzban "$CERT_DEST" 2>/dev/null || true

    # ------------------------------------------------
    # UPDATE /opt/marzban/.env (SSL + CUSTOM TEMPLATE + SUDO CREDS)
    # ------------------------------------------------
    echo "Updating Marzban env file: $MARZBAN_ENV"

    if [ ! -f "$MARZBAN_ENV" ]; then
      echo "Marzban env file not found: $MARZBAN_ENV"
      echo "   (Marzban install may not have completed. Check /opt/marzban/)"
      exit 1
    fi

    # Ensure file ends with newline
    [ -n "$(tail -c1 "$MARZBAN_ENV")" ] && echo >> "$MARZBAN_ENV"

    # ---------------- SSL: uncomment/set ----------------
    sed -i \
      's|^[[:space:]]*#\?[[:space:]]*UVICORN_SSL_CERTFILE.*|UVICORN_SSL_CERTFILE="/var/lib/marzban/certs/fullchain.pem"|' \
      "$MARZBAN_ENV" || true

    sed -i \
      's|^[[:space:]]*#\?[[:space:]]*UVICORN_SSL_KEYFILE.*|UVICORN_SSL_KEYFILE="/var/lib/marzban/certs/privkey.pem"|' \
      "$MARZBAN_ENV" || true

    grep -q '^UVICORN_SSL_CERTFILE=' "$MARZBAN_ENV" || echo 'UVICORN_SSL_CERTFILE="/var/lib/marzban/certs/fullchain.pem"' >> "$MARZBAN_ENV"
    grep -q '^UVICORN_SSL_KEYFILE='  "$MARZBAN_ENV" || echo 'UVICORN_SSL_KEYFILE="/var/lib/marzban/certs/privkey.pem"'  >> "$MARZBAN_ENV"

    # ---------------- SUDO creds: ask user or generate ----------------
    echo "Marzban Admin (SUDO) credentials"
    read -p "Enter SUDO username (leave empty to auto-generate): " SUDO_USER_INPUT
    read -s -p "Enter SUDO password (leave empty to auto-generate): " SUDO_PASS_INPUT
    echo

    gen_user() { echo "admin_$(openssl rand -hex 3)"; }
    gen_pass() { openssl rand -base64 18 | tr -d '\n' | tr '+/' 'Aa'; }

    SUDO_USERNAME="${SUDO_USER_INPUT:-$(gen_user)}"
    SUDO_PASSWORD="${SUDO_PASS_INPUT:-$(gen_pass)}"

    # Ensure newline
    [ -n "$(tail -c1 "$MARZBAN_ENV")" ] && echo >> "$MARZBAN_ENV"

    # Replace commented/uncommented SUDO lines; add if missing (idempotent)
    if grep -qE '^[[:space:]]*#?[[:space:]]*SUDO_USERNAME' "$MARZBAN_ENV"; then
      sed -i 's|^[[:space:]]*#\?[[:space:]]*SUDO_USERNAME.*|SUDO_USERNAME="'"$SUDO_USERNAME"'"|' "$MARZBAN_ENV" || true
    else
      echo 'SUDO_USERNAME="'"$SUDO_USERNAME"'"' >> "$MARZBAN_ENV"
    fi

    if grep -qE '^[[:space:]]*#?[[:space:]]*SUDO_PASSWORD' "$MARZBAN_ENV"; then
      sed -i 's|^[[:space:]]*#\?[[:space:]]*SUDO_PASSWORD.*|SUDO_PASSWORD="'"$SUDO_PASSWORD"'"|' "$MARZBAN_ENV" || true
    else
      echo 'SUDO_PASSWORD="'"$SUDO_PASSWORD"'"' >> "$MARZBAN_ENV"
    fi

    # ------------------------------------------------
    # CUSTOM TEMPLATE: create folder + download index.html
    # ------------------------------------------------
    echo "Installing custom subscription template..."

    mkdir -p "$TEMPLATE_DIR"
    curl -fsSL "$TEMPLATE_RAW_URL" -o "$TEMPLATE_FILE"

    chown -R marzban:marzban /var/lib/marzban/templates 2>/dev/null || true
    chmod -R 755 /var/lib/marzban/templates 2>/dev/null || true

    # Add/Set env vars (bottom, with a blank line)
    if grep -q '^CUSTOM_TEMPLATES_DIRECTORY=' "$MARZBAN_ENV"; then
      sed -i 's|^CUSTOM_TEMPLATES_DIRECTORY=.*|CUSTOM_TEMPLATES_DIRECTORY="/var/lib/marzban/templates/"|' "$MARZBAN_ENV"
    else
      echo "" >> "$MARZBAN_ENV"
      echo 'CUSTOM_TEMPLATES_DIRECTORY="/var/lib/marzban/templates/"' >> "$MARZBAN_ENV"
    fi

    if grep -q '^SUBSCRIPTION_PAGE_TEMPLATE=' "$MARZBAN_ENV"; then
      sed -i 's|^SUBSCRIPTION_PAGE_TEMPLATE=.*|SUBSCRIPTION_PAGE_TEMPLATE="subscription/index.html"|' "$MARZBAN_ENV"
    else
      echo 'SUBSCRIPTION_PAGE_TEMPLATE="subscription/index.html"' >> "$MARZBAN_ENV"
    fi

    # ------------------------------------------------
    # XRAY CONFIG: replace /var/lib/marzban/xray_config.json BEFORE restart
    # ------------------------------------------------
    read -r -p "Do you want to create the default Xray inbounds (VLESS: 443/80/8080 + VMESS: 8443)? [y/N]: " ANSWER

    if [[ "$ANSWER" =~ ^[Yy]$ ]]; then
      echo "Creating default Xray inbounds config..."
    
      mkdir -p "$(dirname "$XRAY_CONFIG_FILE")"
    
      TMP_XRAY="$(mktemp)"
      curl -fsSL "$XRAY_CONFIG_RAW_URL" -o "$TMP_XRAY"
    
      # Validate JSON (won't allow broken config)
      jq . "$TMP_XRAY" >/dev/null
    
      # Backup existing config if it exists
      if [ -f "$XRAY_CONFIG_FILE" ]; then
        cp "$XRAY_CONFIG_FILE" "${XRAY_CONFIG_FILE}.bak.$(date +%Y%m%d_%H%M%S)" || true
      fi
    
      # Replace atomically
      install -m 644 "$TMP_XRAY" "$XRAY_CONFIG_FILE"
      rm -f "$TMP_XRAY"
    
      chown marzban:marzban "$XRAY_CONFIG_FILE" 2>/dev/null || true
    else
      echo "Skipped default inbound creation."
    fi
    

    # ------------------------------------------------
    # CERT RENEWAL SYNC HOOK (DOCKER-SAFE RESTART)
    # ------------------------------------------------
    echo "Installing Let's Encrypt renewal hook for Marzban cert sync..."

    mkdir -p /etc/letsencrypt/renewal-hooks/post

    cat > /etc/letsencrypt/renewal-hooks/post/20-marzban-cert-sync.sh <<'HOOK'
#!/bin/bash
DEST="/var/lib/marzban/certs"

if [ -f "$RENEWED_LINEAGE/fullchain.pem" ] && [ -f "$RENEWED_LINEAGE/privkey.pem" ]; then
  cp "$RENEWED_LINEAGE/fullchain.pem" "$DEST/fullchain.pem"
  cp "$RENEWED_LINEAGE/privkey.pem" "$DEST/privkey.pem"
  chmod 600 "$DEST/privkey.pem"
  chown -R marzban:marzban "$DEST" 2>/dev/null || true

  # Prefer Marzban CLI restart if available
  if command -v marzban >/dev/null 2>&1; then
    marzban restart >/dev/null 2>&1 || true
  fi

  # Fallback: docker compose restart
  if [ -f /opt/marzban/docker-compose.yml ]; then
    (cd /opt/marzban && docker compose restart >/dev/null 2>&1) || true
  fi
fi
HOOK

    chmod +x /etc/letsencrypt/renewal-hooks/post/20-marzban-cert-sync.sh

    # ------------------------------------------------
    # FIREWALL DISABLE (AS REQUESTED) - do BEFORE restart
    # ------------------------------------------------
    echo "Disabling firewall to avoid port blocking..."

    if command -v ufw >/dev/null 2>&1; then
      ufw disable >/dev/null 2>&1 || true
      echo "UFW disabled"
    else
      echo "[INFO] UFW not installed"
    fi

    if systemctl list-unit-files 2>/dev/null | grep -q '^firewalld\.service'; then
      systemctl stop firewalld >/dev/null 2>&1 || true
      systemctl disable firewalld >/dev/null 2>&1 || true
      echo "firewalld stopped and disabled"
    fi

    if command -v iptables >/dev/null 2>&1; then
      iptables -F || true
      iptables -X || true
      iptables -t nat -F || true
      iptables -t nat -X || true
      iptables -t mangle -F || true
      iptables -t mangle -X || true
      iptables -P INPUT ACCEPT || true
      iptables -P FORWARD ACCEPT || true
      iptables -P OUTPUT ACCEPT || true
      echo "iptables flushed + policies set to ACCEPT"
    fi

    # ------------------------------------------------
    # RESTART MARZBAN (DOCKER)
    # ------------------------------------------------
    echo "Restarting Marzban..."

    if command -v marzban >/dev/null 2>&1; then
      marzban restart || true
    fi

    if [ -f /opt/marzban/docker-compose.yml ]; then
      cd /opt/marzban
      docker compose up -d
      docker compose restart || true
    fi

  # ------------------------------------------------
  # FINAL OUTPUT
  # ------------------------------------------------
  echo ""
     echo "------------------------------------------------------------------"
  echo "[OK] INSTALLATION COMPLETE!"
  echo "------------------------------------------------------------------"
  echo "🔹 1. MARZ-X DASHBOARD LOGIN"
  echo "Access at: https://$DOMAIN_NAME:$HTTPS_PORT"
  echo "Username: $ADMIN_USER"
  echo "Password: $ADMIN_PASSWORD"
  echo ""
  echo "🔹 2. CONNECT MARZBAN TO DASHBOARD (REQUIRED)"
  echo "   1. Log in to the Marz-X Dashboard above."
  echo "   2. Go to 'Settings' > 'Add Server'."
  echo "   3. Enter the following Marzban credentials:"
  echo "      - URL:      https://$DOMAIN_NAME:8000"
  echo "      - Username: $SUDO_USERNAME"
  echo "      - Password: $SUDO_PASSWORD"
  echo "------------------------------------------------------------------"
  echo ""
  echo "🔹 To manage the marz-x panel, type: marz-x"
  echo "🔹 To manage the marzban server, type: marzban"

    # !!! END MARZ.SH CONTENT !!!

else
    echo ""
    echo "Skipping Marzban Server installation."
    echo "------------------------------------------------------------------"
    echo ""
    echo "✅ MARZ-X DASHBOARD Installation Complete!"
    echo "Access at: https://$DOMAIN_NAME:$HTTPS_PORT"
    echo "Username: $ADMIN_USER"
    echo "Password: $ADMIN_PASSWORD"
    echo ""
    echo "🔹 To manage the marz-x panel, type: marz-x"
    echo "🔹 To manage the marzban server, type: marzban"
    echo ""
    echo "------------------------------------------------------------------"



    
fi