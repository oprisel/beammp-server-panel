#!/bin/bash

# ===================================================================
# BeamMP Server + Panel - Uninstaller
# Complete removal script
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

print_header() {
    echo ""
    echo -e "${RED}=========================================${NC}"
    echo -e "${RED}  BeamMP Uninstaller${NC}"
    echo -e "${RED}=========================================${NC}"
    echo ""
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${CYAN}ℹ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✔ $1${NC}"
}

confirm_uninstall() {
    echo ""
    print_warning "This will remove:"
    echo "  - BeamMP Server and Panel services"
    echo "  - Systemd service files"
    echo "  - Nginx configuration"
    echo "  - Sudo permissions"
    echo ""
    print_info "Server files and mods/maps will be preserved (you can delete manually later)"
    echo ""
    
    read -p "$(echo -e ${RED}Are you sure you want to uninstall?${NC}) [y/N]: " CONFIRM
    
    if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
        echo "Uninstall cancelled."
        exit 0
    fi
}

stop_services() {
    echo ""
    print_info "Stopping services..."
    
    sudo systemctl stop beammp-panel 2>/dev/null || true
    sudo systemctl stop beammp-server 2>/dev/null || true
    
    print_success "Services stopped"
}

disable_services() {
    echo ""
    print_info "Disabling services..."
    
    sudo systemctl disable beammp-panel 2>/dev/null || true
    sudo systemctl disable beammp-server 2>/dev/null || true
    
    print_success "Services disabled"
}

remove_systemd() {
    echo ""
    print_info "Removing systemd services..."
    
    sudo rm -f /etc/systemd/system/beammp-panel.service
    sudo rm -f /etc/systemd/system/beammp-server.service
    sudo systemctl daemon-reload
    
    print_success "Systemd services removed"
}

remove_nginx() {
    echo ""
    print_info "Removing nginx configuration..."
    
    sudo rm -f /etc/nginx/sites-enabled/beammp-panel
    sudo rm -f /etc/nginx/sites-available/beammp-panel
    sudo systemctl reload nginx 2>/dev/null || true
    
    print_success "Nginx configuration removed"
}

remove_sudo_rules() {
    echo ""
    print_info "Removing sudo rules..."
    
    sudo rm -f /etc/sudoers.d/beammp-panel
    
    print_success "Sudo rules removed"
}

remove_logs() {
    echo ""
    print_info "Removing log files..."
    
    sudo rm -f /var/log/beammp-panel*.log
    
    print_success "Log files removed"
}

ask_delete_files() {
    echo ""
    print_warning "Server files are still in place:"
    
    # Try to detect installation path
    if [ -d "/opt/beammp" ]; then
        INSTALL_PATH="/opt/beammp"
    else
        echo ""
        read -p "$(echo -e ${CYAN}Enter installation path${NC}) [/opt/beammp]: " INSTALL_PATH
        INSTALL_PATH=${INSTALL_PATH:-/opt/beammp}
    fi
    
    if [ -d "$INSTALL_PATH" ]; then
        echo "  Path: $INSTALL_PATH"
        
        # Calculate size
        SIZE=$(du -sh "$INSTALL_PATH" 2>/dev/null | cut -f1)
        echo "  Size: $SIZE"
        
        echo ""
        read -p "$(echo -e ${RED}Delete server files and mods/maps?${NC}) [y/N]: " DELETE_FILES
        
        if [[ "$DELETE_FILES" =~ ^[Yy]$ ]]; then
            print_info "Creating backup archive..."
            BACKUP_NAME="beammp-backup-$(date +%Y%m%d_%H%M%S).tar.gz"
            tar -czf "/tmp/$BACKUP_NAME" -C "$(dirname $INSTALL_PATH)" "$(basename $INSTALL_PATH)" 2>/dev/null || true
            
            if [ -f "/tmp/$BACKUP_NAME" ]; then
                print_success "Backup created: /tmp/$BACKUP_NAME"
            fi
            
            print_info "Deleting $INSTALL_PATH..."
            sudo rm -rf "$INSTALL_PATH"
            print_success "Files deleted"
        else
            print_info "Server files preserved at: $INSTALL_PATH"
            print_info "You can delete them manually later if needed"
        fi
    else
        print_info "Installation path not found or already removed"
    fi
}

print_final() {
    echo ""
    echo -e "${GREEN}=========================================${NC}"
    echo -e "${GREEN}  Uninstall Complete${NC}"
    echo -e "${GREEN}=========================================${NC}"
    echo ""
    print_info "BeamMP services and configurations have been removed."
    echo ""
    
    if [ -f "/tmp/beammp-backup-"*".tar.gz" ]; then
        echo -e "${CYAN}Backup available in /tmp/${NC}"
        ls -lh /tmp/beammp-backup-*.tar.gz 2>/dev/null | tail -1
        echo ""
    fi
    
    print_info "Thank you for using BeamMP Complete Installer!"
    echo ""
}

# Main uninstall flow
main() {
    print_header
    
    # Check if running as root
    if [ "$EUID" -eq 0 ]; then 
        print_warning "Please do NOT run this script as root!"
        print_info "Run as regular user: ./uninstall-beammp-complete.sh"
        exit 1
    fi
    
    confirm_uninstall
    stop_services
    disable_services
    remove_systemd
    remove_nginx
    remove_sudo_rules
    remove_logs
    ask_delete_files
    print_final
}

main "$@"
