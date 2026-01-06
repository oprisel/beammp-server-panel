#!/bin/bash

# ===================================================================
# BeamMP Server + Panel - Universal Installer
# Automatic installation script for fresh Ubuntu servers
# Author: Gigicax
# ===================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Default values
DEFAULT_BEAMMP_PORT=30814
DEFAULT_PANEL_PORT=3000
DEFAULT_NGINX_PORT=8081
DEFAULT_SERVER_NAME="My BeamMP Server"
DEFAULT_MAX_PLAYERS=8
DEFAULT_MAX_CARS=4

# Script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# ===================================================================
# FUNCTIONS
# ===================================================================

print_header() {
    echo ""
    echo -e "${PURPLE}=========================================${NC}"
    echo -e "${PURPLE}  BeamMP Complete Installer${NC}"
    echo -e "${PURPLE}  Fresh Ubuntu → Full Server Setup${NC}"
    echo -e "${PURPLE}=========================================${NC}"
    echo ""
}

print_step() {
    echo ""
    echo -e "${GREEN}➜ $1${NC}"
}

print_info() {
    echo -e "${CYAN}ℹ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✖ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✔ $1${NC}"
}

check_root() {
    if [ "$EUID" -eq 0 ]; then 
        print_error "Please do NOT run this script as root!"
        print_info "Run as regular user: ./install-beammp-complete.sh"
        exit 1
    fi
}

check_ubuntu() {
    if [ ! -f /etc/os-release ]; then
        print_error "Cannot detect OS. This script is designed for Ubuntu."
        exit 1
    fi
    
    . /etc/os-release
    
    if [[ "$ID" != "ubuntu" ]]; then
        print_warning "This script is designed for Ubuntu but will try to continue..."
    fi
    
    print_info "Detected: $PRETTY_NAME"
}

detect_architecture() {
    local arch
    arch=$(uname -m)
    
    case $arch in
        x86_64)
            BEAMMP_ARCH="x86_64"
            BEAMMP_BINARY_NAME="BeamMP-Server.ubuntu.22.04.x86_64"
            print_info "Architecture: x86_64 (AMD64)"
            ;;
        aarch64|arm64)
            BEAMMP_ARCH="aarch64"
            BEAMMP_BINARY_NAME="BeamMP-Server.ubuntu.22.04.aarch64"
            print_info "Architecture: ARM64 (aarch64)"
            ;;
        armv7l|armhf)
            BEAMMP_ARCH="armv7"
            BEAMMP_BINARY_NAME="BeamMP-Server.ubuntu.22.04.armhf"
            print_info "Architecture: ARM32 (armv7l)"
            print_warning "ARM32 support may be limited"
            ;;
        *)
            print_error "Unsupported architecture: $arch"
            print_info "Supported: x86_64, aarch64 (ARM64), armv7l (ARM32)"
            exit 1
            ;;
    esac
    
    print_success "Detected architecture: $BEAMMP_ARCH"
}

get_server_ip() {
    # Try to detect server IP
    local ip
    ip=$(hostname -I | awk '{print $1}')
    
    if [ -z "$ip" ]; then
        ip="127.0.0.1"
    fi
    
    echo "$ip"
}

ask_questions() {
    print_step "Configuration"
    echo ""
    
    # Server IP
    local detected_ip
    detected_ip=$(get_server_ip)
    read -p "$(echo -e "${CYAN}Server IP address${NC}") [${detected_ip}]: " SERVER_IP
    SERVER_IP=${SERVER_IP:-$detected_ip}
    
    # Server Name
    read -p "$(echo -e "${CYAN}Server Name${NC}") [${DEFAULT_SERVER_NAME}]: " SERVER_NAME
    SERVER_NAME=${SERVER_NAME:-$DEFAULT_SERVER_NAME}
    
    # Max Players
    read -p "$(echo -e "${CYAN}Max Players${NC}") [${DEFAULT_MAX_PLAYERS}]: " MAX_PLAYERS
    MAX_PLAYERS=${MAX_PLAYERS:-$DEFAULT_MAX_PLAYERS}
    
    # Max Cars
    read -p "$(echo -e "${CYAN}Max Cars${NC}") [${DEFAULT_MAX_CARS}]: " MAX_CARS
    MAX_CARS=${MAX_CARS:-$DEFAULT_MAX_CARS}
    
    # BeamMP Port
    read -p "$(echo -e "${CYAN}BeamMP Server Port${NC}") [${DEFAULT_BEAMMP_PORT}]: " BEAMMP_PORT
    BEAMMP_PORT=${BEAMMP_PORT:-$DEFAULT_BEAMMP_PORT}
    
    # Panel Port
    read -p "$(echo -e "${CYAN}Panel Port (nginx)${NC}") [${DEFAULT_NGINX_PORT}]: " NGINX_PORT
    NGINX_PORT=${NGINX_PORT:-$DEFAULT_NGINX_PORT}
    
    # Install path
    read -p "$(echo -e "${CYAN}Installation path${NC}") [$HOME/beammp]: " INSTALL_PATH
    INSTALL_PATH=${INSTALL_PATH:-$HOME/beammp}
    
    echo ""
    print_info "Configuration Summary:"
    echo "  Server IP: $SERVER_IP"
    echo "  Server Name: $SERVER_NAME"
    echo "  Max Players: $MAX_PLAYERS"
    echo "  Max Cars: $MAX_CARS"
    echo "  BeamMP Port: $BEAMMP_PORT"
    echo "  Panel Access: http://${SERVER_IP}:${NGINX_PORT}"
    echo "  Install Path: $INSTALL_PATH"
    echo ""
    
    read -p "$(echo -e "${YELLOW}Continue with installation?${NC}") [Y/n]: " CONFIRM
    CONFIRM=${CONFIRM:-Y}
    
    if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
        print_info "Installation cancelled."
        exit 0
    fi
}

install_dependencies() {
    print_step "Installing dependencies..."
    
    # Update package list
    print_info "Updating package list..."
    sudo apt-get update -qq
    
    # Install required packages
    print_info "Installing required packages..."
    sudo apt-get install -y -qq \
        curl \
        wget \
        unzip \
        nginx \
        git \
        build-essential
    
    # Check if Node.js is installed
    if ! command -v node &> /dev/null; then
        print_info "Installing Node.js 20.x..."
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt-get install -y nodejs
    else
        print_info "Node.js already installed: $(node --version)"
    fi
    
    print_success "Dependencies installed"
}

download_beammp_server() {
    print_step "Downloading BeamMP Server..."
    
    local BEAMMP_DIR="$INSTALL_PATH/server"
    
    # Create directory - use sudo only if outside home directory
    if [[ "$INSTALL_PATH" == "$HOME"* ]]; then
        # Installing in home directory - no sudo needed
        mkdir -p "$BEAMMP_DIR"
    else
        # Installing outside home - need sudo
        sudo mkdir -p "$BEAMMP_DIR"
        sudo chown $USER:$USER "$BEAMMP_DIR"
    fi
    
    # Download BeamMP Server for detected architecture
    print_info "Downloading BeamMP Server for $BEAMMP_ARCH..."
    cd "$BEAMMP_DIR"
    
    # Try to download architecture-specific binary
    local DOWNLOAD_URL="https://github.com/BeamMP/BeamMP-Server/releases/latest/download/${BEAMMP_BINARY_NAME}"
    
    print_info "Attempting download from: $DOWNLOAD_URL"
    
    if wget -q --spider "$DOWNLOAD_URL" 2>/dev/null; then
        wget -q --show-progress "$DOWNLOAD_URL" -O BeamMP-Server
        chmod +x BeamMP-Server
        print_success "BeamMP Server downloaded successfully"
    else
        print_warning "Architecture-specific binary not found: $BEAMMP_BINARY_NAME"
        
        # Fallback to x86_64 if ARM binary doesn't exist
        if [[ "$BEAMMP_ARCH" != "x86_64" ]]; then
            print_info "Attempting fallback to x86_64 binary..."
            print_warning "This may not work on ARM! You might need to compile from source."
            
            DOWNLOAD_URL="https://github.com/BeamMP/BeamMP-Server/releases/latest/download/BeamMP-Server.ubuntu.22.04.x86_64"
            
            if wget -q --spider "$DOWNLOAD_URL" 2>/dev/null; then
                wget -q --show-progress "$DOWNLOAD_URL" -O BeamMP-Server
                chmod +x BeamMP-Server
                print_warning "Downloaded x86_64 binary - this may not work on ARM!"
                print_info "If server fails to start, you'll need to compile BeamMP for ARM"
                print_info "See: https://github.com/BeamMP/BeamMP-Server#building"
            else
                print_error "Failed to download BeamMP Server"
                print_info "Please download manually from: https://github.com/BeamMP/BeamMP-Server/releases"
                exit 1
            fi
        else
            print_error "Failed to download BeamMP Server"
            print_info "Please check: https://github.com/BeamMP/BeamMP-Server/releases"
            exit 1
        fi
    fi
    
    # Verify downloaded binary
    if [ -f "BeamMP-Server" ]; then
        print_success "Binary downloaded: $(ls -lh BeamMP-Server | awk '{print $5}')"
        
        # Check if it's actually executable on this architecture
        if ./BeamMP-Server --version 2>/dev/null | grep -q "BeamMP"; then
            print_success "Binary is compatible with this system"
        else
            print_warning "Could not verify binary compatibility"
            print_info "Server will be tested on first start"
        fi
    else
        print_error "BeamMP Server binary not found after download"
        exit 1
    fi
}

create_beammp_config() {
    print_step "Creating BeamMP configuration..."
    
    local BEAMMP_DIR="$INSTALL_PATH/server"
    local CONFIG_FILE="$BEAMMP_DIR/ServerConfig.toml"
    
    # Create Resources directory
    mkdir -p "$BEAMMP_DIR/Resources/Client"
    mkdir -p "$BEAMMP_DIR/Resources/Server"
    
    # Generate auth key message
    print_warning "You need a BeamMP Auth Key!"
    print_info "Get your free key at: https://beammp.com/keymaster"
    echo ""
    read -p "$(echo -e ${CYAN}Enter your BeamMP Auth Key${NC}): " AUTH_KEY
    
    if [ -z "$AUTH_KEY" ]; then
        print_warning "No auth key provided. You'll need to add it manually later."
        AUTH_KEY="YOUR_AUTH_KEY_HERE"
    fi
    
    # Create ServerConfig.toml
    cat > "$CONFIG_FILE" << EOF
[General]
AuthKey = "$AUTH_KEY"
Debug = false
Private = true
Port = $BEAMMP_PORT
Cars = $MAX_CARS
MaxPlayers = $MAX_PLAYERS
Map = "/levels/gridmap_v2/info.json"
Name = "$SERVER_NAME"
Description = "BeamMP Server with Admin Panel"
Tags = "Freeroam"
ResourceFolder = "Resources"
LogChat = true

[Misc]
ImScaredOfUpdates = false
SendErrorsShowMessage = true
SendErrors = true
UpdateCheck = true
EOF
    
    print_success "Configuration created: $CONFIG_FILE"
}

install_panel() {
    print_step "Installing Admin Panel..."
    
    local PANEL_DIR="$INSTALL_PATH/panel"
    
    # Create panel directory - use sudo only if outside home directory
    if [[ "$INSTALL_PATH" == "$HOME"* ]]; then
        # Installing in home directory - no sudo needed
        mkdir -p "$PANEL_DIR"
    else
        # Installing outside home - need sudo
        sudo mkdir -p "$PANEL_DIR"
        sudo chown $USER:$USER "$PANEL_DIR"
    fi
    
    # Copy panel files from script directory
    print_info "Copying panel files..."
    cp -r "$SCRIPT_DIR/panel/"* "$PANEL_DIR/"
    
    # Create .env file
    cat > "$PANEL_DIR/.env" << EOF
# BeamMP Panel Configuration
PORT=$DEFAULT_PANEL_PORT
SERVER_IP=$SERVER_IP

# BeamMP Server Paths
BEAMMP_PATH=$INSTALL_PATH/server
BEAMMP_EXECUTABLE=BeamMP-Server
CONFIG_FILE=ServerConfig.toml
RESOURCES_PATH=$INSTALL_PATH/server/Resources/Client
SERVER_LOG=$INSTALL_PATH/server/Server.log

# Panel Settings
MAX_UPLOAD_SIZE=2000
ALLOWED_EXTENSIONS=.zip
EOF
    
    # Install Node.js dependencies
    print_info "Installing Node.js dependencies..."
    cd "$PANEL_DIR"
    npm install --production --silent
    
    print_success "Admin Panel installed"
}

setup_systemd_services() {
    print_step "Setting up systemd services..."
    
    # BeamMP Server service
    print_info "Creating beammp-server.service..."
    sudo tee /etc/systemd/system/beammp-server.service > /dev/null << EOF
[Unit]
Description=BeamMP Server
After=network.target

[Service]
Type=simple
User=$USER
Group=$USER
WorkingDirectory=$INSTALL_PATH/server
ExecStart=$INSTALL_PATH/server/BeamMP-Server
Restart=always
RestartSec=10
StandardOutput=append:$INSTALL_PATH/server/Server.log
StandardError=append:$INSTALL_PATH/server/Server.log

# Resource limits
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
EOF
    
    # BeamMP Panel service
    print_info "Creating beammp-panel.service..."
    sudo tee /etc/systemd/system/beammp-panel.service > /dev/null << EOF
[Unit]
Description=BeamMP Administration Panel
After=network.target

[Service]
Type=simple
User=$USER
Group=$USER
WorkingDirectory=$INSTALL_PATH/panel
Environment="NODE_ENV=production"
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
StandardOutput=append:/var/log/beammp-panel.log
StandardError=append:/var/log/beammp-panel-error.log

# Security settings
NoNewPrivileges=false
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF
    
    # Create log files
    sudo touch /var/log/beammp-panel.log
    sudo touch /var/log/beammp-panel-error.log
    sudo chown $USER:$USER /var/log/beammp-panel*.log
    
    # Reload systemd
    sudo systemctl daemon-reload
    
    print_success "Systemd services created"
}

setup_nginx() {
    print_step "Configuring nginx..."
    
    # Create nginx config
    sudo tee /etc/nginx/sites-available/beammp-panel > /dev/null << EOF
server {
    listen $NGINX_PORT;
    server_name $SERVER_IP localhost;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Logging
    access_log /var/log/nginx/beammp-panel.access.log;
    error_log /var/log/nginx/beammp-panel.error.log;

    # Max upload size
    client_max_body_size 2000M;
    client_body_timeout 600s;

    location / {
        proxy_pass http://localhost:$DEFAULT_PANEL_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # Timeouts for large uploads
        proxy_connect_timeout 600s;
        proxy_send_timeout 600s;
        proxy_read_timeout 600s;
    }

    # Static files caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        proxy_pass http://localhost:$DEFAULT_PANEL_PORT;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF
    
    # Enable site
    sudo ln -sf /etc/nginx/sites-available/beammp-panel /etc/nginx/sites-enabled/
    
    # Test nginx config
    sudo nginx -t
    
    # Reload nginx
    sudo systemctl reload nginx
    
    print_success "Nginx configured"
}

setup_sudo_permissions() {
    print_step "Setting up sudo permissions..."
    
    # Create sudoers file for panel
    echo "$USER ALL=(ALL) NOPASSWD: /bin/systemctl start beammp-server" | sudo tee /etc/sudoers.d/beammp-panel > /dev/null
    echo "$USER ALL=(ALL) NOPASSWD: /bin/systemctl stop beammp-server" | sudo tee -a /etc/sudoers.d/beammp-panel > /dev/null
    echo "$USER ALL=(ALL) NOPASSWD: /bin/systemctl restart beammp-server" | sudo tee -a /etc/sudoers.d/beammp-panel > /dev/null
    echo "$USER ALL=(ALL) NOPASSWD: /bin/systemctl status beammp-server" | sudo tee -a /etc/sudoers.d/beammp-panel > /dev/null
    
    sudo chmod 0440 /etc/sudoers.d/beammp-panel
    
    print_success "Sudo permissions configured"
}

start_services() {
    print_step "Starting services..."
    
    # Enable services
    sudo systemctl enable beammp-server
    sudo systemctl enable beammp-panel
    
    # Start services
    print_info "Starting BeamMP Server..."
    sudo systemctl start beammp-server
    sleep 2
    
    print_info "Starting Admin Panel..."
    sudo systemctl start beammp-panel
    sleep 2
    
    # Check status
    if systemctl is-active --quiet beammp-server; then
        print_success "BeamMP Server is running"
    else
        print_warning "BeamMP Server failed to start. Check logs: sudo journalctl -u beammp-server"
    fi
    
    if systemctl is-active --quiet beammp-panel; then
        print_success "Admin Panel is running"
    else
        print_warning "Admin Panel failed to start. Check logs: sudo journalctl -u beammp-panel"
    fi
}

configure_firewall() {
    print_step "Firewall configuration..."
    
    if command -v ufw &> /dev/null; then
        print_info "Configuring UFW firewall..."
        sudo ufw allow $BEAMMP_PORT/tcp comment "BeamMP Server"
        sudo ufw allow $NGINX_PORT/tcp comment "BeamMP Panel"
        print_success "Firewall rules added"
    else
        print_info "UFW not installed. Skipping firewall configuration."
        print_warning "Make sure to open ports $BEAMMP_PORT and $NGINX_PORT manually if using a firewall."
    fi
}

print_final_info() {
    echo ""
    echo -e "${GREEN}=========================================${NC}"
    echo -e "${GREEN}  Installation Complete! 🎉${NC}"
    echo -e "${GREEN}=========================================${NC}"
    echo ""
    echo -e "${CYAN}Access Information:${NC}"
    echo -e "  Admin Panel: ${YELLOW}http://${SERVER_IP}:${NGINX_PORT}${NC}"
    echo -e "  BeamMP Server: ${YELLOW}${SERVER_IP}:${BEAMMP_PORT}${NC}"
    echo ""
    echo -e "${CYAN}Server Paths:${NC}"
    echo -e "  Server: ${INSTALL_PATH}/server"
    echo -e "  Panel: ${INSTALL_PATH}/panel"
    echo -e "  Config: ${INSTALL_PATH}/server/ServerConfig.toml"
    echo -e "  Mods/Maps: ${INSTALL_PATH}/server/Resources/Client"
    echo ""
    echo -e "${CYAN}Useful Commands:${NC}"
    echo -e "  Server status:  ${YELLOW}sudo systemctl status beammp-server${NC}"
    echo -e "  Panel status:   ${YELLOW}sudo systemctl status beammp-panel${NC}"
    echo -e "  Server logs:    ${YELLOW}tail -f ${INSTALL_PATH}/server/Server.log${NC}"
    echo -e "  Panel logs:     ${YELLOW}sudo tail -f /var/log/beammp-panel.log${NC}"
    echo -e "  Restart server: ${YELLOW}sudo systemctl restart beammp-server${NC}"
    echo -e "  Restart panel:  ${YELLOW}sudo systemctl restart beammp-panel${NC}"
    echo ""
    
    if [ "$AUTH_KEY" == "YOUR_AUTH_KEY_HERE" ]; then
        echo -e "${YELLOW}⚠ IMPORTANT: You need to add your BeamMP Auth Key!${NC}"
        echo -e "  1. Get your key at: https://beammp.com/keymaster"
        echo -e "  2. Edit: sudo nano ${INSTALL_PATH}/server/ServerConfig.toml"
        echo -e "  3. Replace 'YOUR_AUTH_KEY_HERE' with your actual key"
        echo -e "  4. Restart: sudo systemctl restart beammp-server"
        echo ""
    fi
    
    echo -e "${GREEN}Enjoy your BeamMP Server! 🚗💨${NC}"
    echo ""
}

# ===================================================================
# MAIN INSTALLATION FLOW
# ===================================================================

main() {
    print_header
    
    check_root
    check_ubuntu
    detect_architecture
    ask_questions
    
    install_dependencies
    download_beammp_server
    create_beammp_config
    install_panel
    setup_systemd_services
    setup_nginx
    setup_sudo_permissions
    configure_firewall
    start_services
    
    print_final_info
}

# Run main function
main "$@"
