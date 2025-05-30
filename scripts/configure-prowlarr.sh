#!/bin/bash

# Prowlarr Configuration Script
# This script configures Prowlarr via API after initial startup

set -e

# Configuration
PROWLARR_HOST="localhost:9696"
PROWLARR_API_BASE="http://$PROWLARR_HOST/api/v1"

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

# Function to wait for Prowlarr to be ready
wait_for_prowlarr() {
    log "Waiting for Prowlarr to be ready..."
    for i in {1..60}; do
        if curl -s "$PROWLARR_API_BASE/system/status" > /dev/null 2>&1; then
            log "Prowlarr is ready"
            return 0
        fi
        if [ $i -eq 60 ]; then
            error "Prowlarr did not become ready in time"
            return 1
        fi
        sleep 2
    done
}

# Function to get API key
get_api_key() {
    log "Extracting Prowlarr API key..."
    
    # Try to get API key from config file
    local config_file="config/prowlarr/config.xml"
    if [ -f "$config_file" ]; then
        local api_key=$(grep -o '<ApiKey>[^<]*</ApiKey>' "$config_file" | sed 's/<ApiKey>\(.*\)<\/ApiKey>/\1/')
        if [ -n "$api_key" ]; then
            echo "$api_key"
            return 0
        fi
    fi
    
    error "Could not extract API key from Prowlarr config"
    return 1
}

# Function to test API access
test_api_access() {
    local api_key="$1"
    log "Testing API access with key: ${api_key:0:8}..."
    
    local response=$(curl -s -H "X-Api-Key: $api_key" "$PROWLARR_API_BASE/system/status")
    if echo "$response" | grep -q '"instanceName"'; then
        log "✅ API access successful"
        return 0
    else
        error "❌ API access failed"
        return 1
    fi
}

# Function to add public indexers
add_indexers() {
    local api_key="$1"
    log "Adding public indexers..."
    
    # Add 1337x indexer
    log "Adding 1337x indexer..."
    curl -s -H "X-Api-Key: $api_key" -H "Content-Type: application/json" \
        -d '{
            "name": "1337x",
            "implementation": "Torznab",
            "settings": {
                "baseUrl": "https://1337x.to/",
                "multiLanguages": [],
                "requiredFlags": []
            },
            "protocol": "torrent",
            "priority": 25,
            "enable": true,
            "tags": []
        }' \
        "$PROWLARR_API_BASE/indexers" > /dev/null
    
    # Add YTS indexer
    log "Adding YTS indexer..."
    curl -s -H "X-Api-Key: $api_key" -H "Content-Type: application/json" \
        -d '{
            "name": "YTS",
            "implementation": "YTS",
            "settings": {
                "baseUrl": "https://yts.mx/",
                "multiLanguages": [],
                "requiredFlags": []
            },
            "protocol": "torrent",
            "priority": 20,
            "enable": true,
            "tags": []
        }' \
        "$PROWLARR_API_BASE/indexers" > /dev/null
    
    # Add EZTV indexer
    log "Adding EZTV indexer..."
    curl -s -H "X-Api-Key: $api_key" -H "Content-Type: application/json" \
        -d '{
            "name": "EZTV",
            "implementation": "EZTV",
            "settings": {
                "baseUrl": "https://eztv.re/",
                "multiLanguages": [],
                "requiredFlags": []
            },
            "protocol": "torrent",
            "priority": 20,
            "enable": true,
            "tags": []
        }' \
        "$PROWLARR_API_BASE/indexers" > /dev/null
    
    log "Indexers added successfully"
}

# Function to configure basic settings
configure_settings() {
    local api_key="$1"
    log "Configuring basic settings..."
    
    # Configure general settings
    curl -s -H "X-Api-Key: $api_key" -H "Content-Type: application/json" \
        -d '{
            "logLevel": "info",
            "enableSsl": false,
            "port": 9696,
            "urlBase": "",
            "instanceName": "Prowlarr",
            "applicationUrl": "",
            "enableAutomaticSearch": true,
            "enableInteractiveSearch": true
        }' \
        "$PROWLARR_API_BASE/config/host" > /dev/null
    
    log "Basic settings configured"
}

# Function to test indexer connectivity
test_indexers() {
    local api_key="$1"
    log "Testing indexer connectivity..."
    
    local indexers=$(curl -s -H "X-Api-Key: $api_key" "$PROWLARR_API_BASE/indexer")
    local indexer_count=$(echo "$indexers" | jq length 2>/dev/null || echo "0")
    
    log "Found $indexer_count configured indexers"
    
    if [ "$indexer_count" -gt 0 ]; then
        log "✅ Indexers configured successfully"
        return 0
    else
        warning "⚠️ No indexers found"
        return 1
    fi
}

# Function to update environment file with API key
update_env_file() {
    local api_key="$1"
    log "Updating .env file with Prowlarr API key..."
    
    if [ -f ".env" ]; then
        # Remove existing PROWLARR_API_KEY line
        sed -i.bak '/^PROWLARR_API_KEY=/d' .env
        
        # Add new API key
        echo "PROWLARR_API_KEY=$api_key" >> .env
        
        log "✅ API key added to .env file"
    else
        warning "⚠️ .env file not found, cannot save API key"
    fi
}

# Main execution
main() {
    log "Starting Prowlarr configuration..."
    
    # Wait for Prowlarr to be ready
    if ! wait_for_prowlarr; then
        exit 1
    fi
    
    # Wait a bit more for full initialization
    sleep 10
    
    # Get API key
    local api_key=$(get_api_key)
    if [ -z "$api_key" ]; then
        exit 1
    fi
    
    # Test API access
    if ! test_api_access "$api_key"; then
        exit 1
    fi
    
    # Configure basic settings
    configure_settings "$api_key"
    
    # Add indexers
    add_indexers "$api_key"
    
    # Test indexers
    test_indexers "$api_key"
    
    # Update environment file
    update_env_file "$api_key"
    
    log "🎉 Prowlarr configuration completed successfully!"
    log "You can now access Prowlarr at: http://localhost:9696"
    log "API Key: ${api_key:0:8}...${api_key: -4}"
    log "Configured indexers: 1337x, YTS, EZTV"
}

# Run main function
main "$@" 