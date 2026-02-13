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
    echo -e "${BLUE}      Marz-X Management Menu      ${NC}"
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
