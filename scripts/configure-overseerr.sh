#!/bin/bash

# Overseerr Configuration Script
# This script configures Overseerr via API after initial startup

set -e

# Configuration
OVERSEERR_HOST="localhost:5055"
OVERSEERR_API_BASE="http://$OVERSEERR_HOST/api/v1"

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

# Function to wait for Overseerr to be ready
wait_for_overseerr() {
    log "Waiting for Overseerr to be ready..."
    for i in {1..60}; do
        if curl -s "$OVERSEERR_API_BASE/status" > /dev/null 2>&1; then
            log "Overseerr is ready"
            return 0
        fi
        if [ $i -eq 60 ]; then
            error "Overseerr did not become ready in time"
            return 1
        fi
        sleep 2
    done
}

# Function to check if initial setup is needed
check_initial_setup() {
    log "Checking if initial setup is required..."
    
    local status=$(curl -s "$OVERSEERR_API_BASE/status")
    if echo "$status" | grep -q '"initialized":false'; then
        log "Initial setup required"
        return 0
    else
        log "Overseerr already initialized"
        return 1
    fi
}

# Function to perform initial setup
initial_setup() {
    log "Performing initial Overseerr setup..."
    
    # Initial setup payload
    curl -s -H "Content-Type: application/json" \
        -d '{
            "username": "admin",
            "password": "ai_media_2024",
            "email": "admin@ai-media-server.local"
        }' \
        "$OVERSEERR_API_BASE/auth/local" > /dev/null
    
    log "✅ Initial setup completed"
}

# Function to login and get session
login_and_get_session() {
    log "Logging into Overseerr..."
    
    # Login to get session
    local login_response=$(curl -s -c /tmp/overseerr_cookies.txt -H "Content-Type: application/json" \
        -d '{
            "email": "admin@ai-media-server.local",
            "password": "ai_media_2024"
        }' \
        "$OVERSEERR_API_BASE/auth/local")
    
    if echo "$login_response" | grep -q '"id":'; then
        log "✅ Login successful"
        return 0
    else
        error "❌ Login failed"
        return 1
    fi
}

# Function to add Radarr service
add_radarr_service() {
    local radarr_api_key="$1"
    log "Adding Radarr service..."
    
    if [ -z "$radarr_api_key" ]; then
        warning "⚠️ Radarr API key not provided, skipping Radarr setup"
        return 1
    fi
    
    # Add Radarr service
    curl -s -b /tmp/overseerr_cookies.txt -H "Content-Type: application/json" \
        -d '{
            "name": "Radarr",
            "hostname": "radarr",
            "port": 7878,
            "apiKey": "'$radarr_api_key'",
            "useSsl": false,
            "baseUrl": "",
            "activeProfileId": 1,
            "activeDirectory": "/media/movies",
            "is4k": false,
            "minimumAvailability": "announced",
            "isDefault": true,
            "externalUrl": "http://localhost:7878",
            "syncEnabled": true,
            "preventSearch": false
        }' \
        "$OVERSEERR_API_BASE/settings/radarr" > /dev/null
    
    log "✅ Radarr service added"
}

# Function to configure general settings
configure_general_settings() {
    log "Configuring general settings..."
    
    # Configure general settings
    curl -s -b /tmp/overseerr_cookies.txt -H "Content-Type: application/json" \
        -d '{
            "applicationTitle": "AI Media Server",
            "applicationUrl": "",
            "csrfProtection": false,
            "cacheImages": true,
            "defaultPermissions": 2,
            "hideAvailable": false,
            "localLogin": true,
            "newPlexLogin": true,
            "region": "US",
            "originalLanguage": "en",
            "trustProxy": false,
            "enableImageOptimization": true
        }' \
        "$OVERSEERR_API_BASE/settings/main" > /dev/null
    
    log "✅ General settings configured"
}

# Function to configure permissions
configure_permissions() {
    log "Configuring user permissions..."
    
    # Set default permissions (admin has all permissions)
    curl -s -b /tmp/overseerr_cookies.txt -H "Content-Type: application/json" \
        -d '{
            "permissions": 2147483647
        }' \
        "$OVERSEERR_API_BASE/settings/permissions" > /dev/null
    
    log "✅ Permissions configured"
}

# Function to test Radarr connection
test_radarr_connection() {
    local radarr_api_key="$1"
    log "Testing Radarr connection..."
    
    if [ -z "$radarr_api_key" ]; then
        warning "⚠️ Cannot test Radarr connection without API key"
        return 1
    fi
    
    # Test Radarr connection
    local test_result=$(curl -s -b /tmp/overseerr_cookies.txt -H "Content-Type: application/json" \
        -d '{
            "hostname": "radarr",
            "port": 7878,
            "apiKey": "'$radarr_api_key'",
            "useSsl": false,
            "baseUrl": ""
        }' \
        "$OVERSEERR_API_BASE/settings/radarr/test")
    
    if echo "$test_result" | grep -q '"success":true'; then
        log "✅ Radarr connection test successful"
        return 0
    else
        warning "⚠️ Radarr connection test failed"
        return 1
    fi
}

# Function to get API key from settings
get_api_key() {
    log "Extracting Overseerr API key..."
    
    # Get user info which contains API key
    local user_info=$(curl -s -b /tmp/overseerr_cookies.txt "$OVERSEERR_API_BASE/auth/me")
    local api_key=$(echo "$user_info" | grep -o '"apiToken":"[^"]*"' | cut -d'"' -f4)
    
    if [ -n "$api_key" ]; then
        echo "$api_key"
        return 0
    else
        error "Could not extract API key from Overseerr"
        return 1
    fi
}

# Function to update environment file with API key
update_env_file() {
    local api_key="$1"
    log "Updating .env file with Overseerr API key..."
    
    if [ -f ".env" ]; then
        # Remove existing OVERSEERR_API_KEY line
        sed -i.bak '/^OVERSEERR_API_KEY=/d' .env
        
        # Add new API key
        echo "OVERSEERR_API_KEY=$api_key" >> .env
        
        log "✅ API key added to .env file"
    else
        warning "⚠️ .env file not found, cannot save API key"
    fi
}

# Main execution
main() {
    log "Starting Overseerr configuration..."
    
    # Wait for Overseerr to be ready
    if ! wait_for_overseerr; then
        exit 1
    fi
    
    # Check if initial setup is needed
    if check_initial_setup; then
        # Perform initial setup
        initial_setup
        sleep 5
    fi
    
    # Login and get session
    if ! login_and_get_session; then
        exit 1
    fi
    
    # Get Radarr API key from environment
    local radarr_api_key=""
    if [ -f ".env" ]; then
        radarr_api_key=$(grep "^RADARR_API_KEY=" .env | cut -d'=' -f2)
    fi
    
    # Configure general settings
    configure_general_settings
    
    # Configure permissions
    configure_permissions
    
    # Add Radarr service (if API key available)
    add_radarr_service "$radarr_api_key"
    
    # Test Radarr connection
    test_radarr_connection "$radarr_api_key"
    
    # Get and save API key
    local api_key=$(get_api_key)
    if [ -n "$api_key" ]; then
        update_env_file "$api_key"
    fi
    
    # Cleanup
    rm -f /tmp/overseerr_cookies.txt
    
    log "🎉 Overseerr configuration completed successfully!"
    log "You can now access Overseerr at: http://localhost:5055"
    log "Login: admin@ai-media-server.local / ai_media_2024"
    if [ -n "$api_key" ]; then
        log "API Key: ${api_key:0:8}...${api_key: -4}"
    fi
    log "Connected to Radarr for movie requests"
}

# Run main function
main "$@" 