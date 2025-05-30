#!/bin/bash

# qBittorrent Configuration Script
# This script configures qBittorrent via API after initial startup

set -e

# Configuration
QB_HOST="localhost:8080"
QB_USERNAME="admin"
QB_NEW_PASSWORD="ai_media_2024"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}" >&2
}

warning() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

# Function to get temporary password from logs
get_temp_password() {
    local temp_pass=$(docker logs ai_media_qbittorrent 2>&1 | grep "temporary password" | tail -1 | sed -n 's/.*temporary password is provided for this session: \([A-Za-z0-9]*\).*/\1/p')
    echo "$temp_pass"
}

# Function to login with temporary password
login_with_temp_password() {
    local temp_pass="$1"
    log "Attempting login with temporary password: $temp_pass"
    
    local response=$(curl -s -c /tmp/qb_cookies.txt -d "username=$QB_USERNAME&password=$temp_pass" -X POST "http://$QB_HOST/api/v2/auth/login")
    
    if [ "$response" = "Ok." ]; then
        log "Successfully logged in with temporary password"
        return 0
    else
        error "Failed to login with temporary password"
        return 1
    fi
}

# Function to set new password
set_new_password() {
    log "Setting new password..."
    
    local response=$(curl -s -b /tmp/qb_cookies.txt -d "json={\"web_ui_password\":\"$QB_NEW_PASSWORD\"}" -X POST "http://$QB_HOST/api/v2/app/setPreferences")
    
    if [ -z "$response" ]; then
        log "Password updated successfully"
        return 0
    else
        error "Failed to update password: $response"
        return 1
    fi
}

# Function to configure download paths and categories
configure_settings() {
    log "Configuring download settings..."
    
    # Set download paths and other preferences
    local settings='{
        "save_path": "/downloads/",
        "temp_path": "/downloads/incomplete/",
        "temp_path_enabled": true,
        "create_subfolder_enabled": true,
        "start_paused_enabled": false,
        "auto_delete_mode": 0,
        "preallocate_all": false,
        "incomplete_files_ext": false
    }'
    
    curl -s -b /tmp/qb_cookies.txt -d "json=$settings" -X POST "http://$QB_HOST/api/v2/app/setPreferences"
    
    log "Download settings configured"
}

# Function to create categories
create_categories() {
    log "Creating download categories..."
    
    # Create categories for different media types
    curl -s -b /tmp/qb_cookies.txt -d "category=movies&savePath=/downloads/movies" -X POST "http://$QB_HOST/api/v2/torrents/createCategory"
    curl -s -b /tmp/qb_cookies.txt -d "category=tv&savePath=/downloads/tv" -X POST "http://$QB_HOST/api/v2/torrents/createCategory"
    curl -s -b /tmp/qb_cookies.txt -d "category=music&savePath=/downloads/music" -X POST "http://$QB_HOST/api/v2/torrents/createCategory"
    
    log "Categories created: movies, tv, music"
}

# Function to test final configuration
test_new_credentials() {
    log "Testing new credentials..."
    
    local response=$(curl -s -c /tmp/qb_cookies_new.txt -d "username=$QB_USERNAME&password=$QB_NEW_PASSWORD" -X POST "http://$QB_HOST/api/v2/auth/login")
    
    if [ "$response" = "Ok." ]; then
        log "✅ New credentials work correctly!"
        log "Username: $QB_USERNAME"
        log "Password: $QB_NEW_PASSWORD"
        return 0
    else
        error "❌ New credentials failed"
        return 1
    fi
}

# Main execution
main() {
    log "Starting qBittorrent configuration..."
    
    # Wait for qBittorrent to be ready
    log "Waiting for qBittorrent to be ready..."
    for i in {1..30}; do
        if curl -s "http://$QB_HOST" > /dev/null 2>&1; then
            log "qBittorrent is ready"
            break
        fi
        if [ $i -eq 30 ]; then
            error "qBittorrent did not become ready in time"
            exit 1
        fi
        sleep 2
    done
    
    # Get temporary password
    local temp_pass=$(get_temp_password)
    if [ -z "$temp_pass" ]; then
        error "Could not find temporary password in logs"
        exit 1
    fi
    
    # Login with temporary password
    if ! login_with_temp_password "$temp_pass"; then
        exit 1
    fi
    
    # Set new password
    if ! set_new_password; then
        exit 1
    fi
    
    # Configure settings
    configure_settings
    
    # Create categories
    create_categories
    
    # Test new credentials
    if ! test_new_credentials; then
        exit 1
    fi
    
    log "🎉 qBittorrent configuration completed successfully!"
    log "You can now access qBittorrent at: http://localhost:8080"
    log "Username: $QB_USERNAME"
    log "Password: $QB_NEW_PASSWORD"
}

# Run main function
main "$@" 