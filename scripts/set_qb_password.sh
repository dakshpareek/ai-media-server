#!/bin/bash

# qBittorrent Configuration Script
# This script configures qBittorrent via its API after initial startup.
# It sets the username and new password, configures download settings, and creates categories.
#
# IMPORTANT:
#   • Ensure qBittorrent is running in a Docker container with the name specified in CONTAINER_NAME.
#   • Make sure to run this script after initial startup.
#   • The script will use Docker logs to fetch the temporary password, or will prompt you if not found.
#
# Usage:
#   ./set_qb_password.sh

set -e

# Configuration
QB_HOST="localhost:8080"
QB_USERNAME="admin"
QB_NEW_PASSWORD="ai_media_2024"
CONTAINER_NAME="ai_media_qbittorrent"

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

# Function to get temporary password from docker logs
get_temp_password() {
    local temp_pass
    temp_pass=$(docker logs "$CONTAINER_NAME" 2>&1 | grep -i "temporary password" | tail -1 | sed -n 's/.*temporary password is provided for this session: \([A-Za-z0-9]*\).*/\1/p')
    echo "$temp_pass"
}

# Prompt user to manually input temporary password if auto-retrieval fails
prompt_for_temp_password() {
    read -p "Enter temporary password manually: " manual_pass
    echo "$manual_pass"
}

# Function to login with a given password and store cookies
login() {
    local pass="$1"
    log "Attempting login with password: $pass"
    local response
    response=$(curl -s -c /tmp/qb_cookies.txt -d "username=${QB_USERNAME}&password=${pass}" -X POST "http://${QB_HOST}/api/v2/auth/login")
    if [ "$response" = "Ok." ]; then
        log "Successfully logged in"
        return 0
    else
        error "Login failed with password: $pass"
        return 1
    fi
}

# Function to set new password via API
set_new_password() {
    log "Setting new password..."
    local response
    # Setting the new password using JSON payload.
    response=$(curl -s -b /tmp/qb_cookies.txt -d "json={\"web_ui_password\":\"${QB_NEW_PASSWORD}\"}" -X POST "http://${QB_HOST}/api/v2/app/setPreferences")
    if [ -z "$response" ]; then
        log "Password updated successfully"
        return 0
    else
        error "Failed to update password: ${response}"
        return 1
    fi
}

# Function to configure download settings
configure_settings() {
    log "Configuring download settings..."
    local settings
    settings='{
        "save_path": "/downloads/",
        "temp_path": "/downloads/incomplete/",
        "temp_path_enabled": true,
        "create_subfolder_enabled": true,
        "start_paused_enabled": false,
        "auto_delete_mode": 0,
        "preallocate_all": false,
        "incomplete_files_ext": false
    }'
    curl -s -b /tmp/qb_cookies.txt -d "json=${settings}" -X POST "http://${QB_HOST}/api/v2/app/setPreferences" >/dev/null
    log "Download settings configured."
}

# Function to create download categories
create_categories() {
    log "Creating download categories..."
    curl -s -b /tmp/qb_cookies.txt -d "category=movies&savePath=/downloads/movies" -X POST "http://${QB_HOST}/api/v2/torrents/createCategory" >/dev/null
    curl -s -b /tmp/qb_cookies.txt -d "category=tv&savePath=/downloads/tv" -X POST "http://${QB_HOST}/api/v2/torrents/createCategory" >/dev/null
    curl -s -b /tmp/qb_cookies.txt -d "category=music&savePath=/downloads/music" -X POST "http://${QB_HOST}/api/v2/torrents/createCategory" >/dev/null
    log "Categories created: movies, tv, music."
}

# Function to test new credentials
test_new_credentials() {
    log "Testing new credentials..."
    local response
    response=$(curl -s -c /tmp/qb_cookies_new.txt -d "username=${QB_USERNAME}&password=${QB_NEW_PASSWORD}" -X POST "http://${QB_HOST}/api/v2/auth/login")
    if [ "$response" = "Ok." ]; then
        log "✅ New credentials work correctly!"
        log "Username: ${QB_USERNAME}"
        log "Password: ${QB_NEW_PASSWORD}"
        return 0
    else
        error "❌ New credentials failed."
        return 1
    fi
}

main() {
    log "Starting qBittorrent configuration..."

    # Wait until qBittorrent is ready
    log "Waiting for qBittorrent to be ready at http://${QB_HOST} ..."
    for i in {1..30}; do
        if curl -s "http://${QB_HOST}" > /dev/null 2>&1; then
            log "qBittorrent is ready."
            break
        fi
        if [ $i -eq 30 ]; then
            error "qBittorrent did not become ready in time."
            exit 1
        fi
        sleep 2
    done

    # Retrieve temporary password from logs
    local temp_pass
    temp_pass=$(get_temp_password)
    if [ -z "$temp_pass" ]; then
        warning "Could not retrieve temporary password from logs."
        temp_pass=$(prompt_for_temp_password)
    fi

    if [ -z "$temp_pass" ]; then
        error "No temporary password provided. Exiting."
        exit 1
    fi

    # Login using the temporary password
    if ! login "$temp_pass"; then
        exit 1
    fi

    # Set new password
    if ! set_new_password; then
        exit 1
    fi

    # Configure additional settings and create categories
    configure_settings
    create_categories

    # Test new credentials
    if ! test_new_credentials; then
        exit 1
    fi

    log "🎉 qBittorrent configuration completed successfully!"
    log "Access qBittorrent at: http://${QB_HOST}"
    log "Username: ${QB_USERNAME}"
    log "Password: ${QB_NEW_PASSWORD}"

    # Cleanup temporary cookie files
    rm -f /tmp/qb_cookies.txt /tmp/qb_cookies_new.txt
}

main "$@"
