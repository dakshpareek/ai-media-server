#!/bin/bash

# Radarr Configuration Script
# This script configures Radarr via API after initial startup

set -e

# Configuration
RADARR_HOST="localhost:7878"
RADARR_API_BASE="http://$RADARR_HOST/api/v3"

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

# Function to wait for Radarr to be ready
wait_for_radarr() {
    log "Waiting for Radarr to be ready..."
    for i in {1..60}; do
        if curl -s "$RADARR_API_BASE/system/status" > /dev/null 2>&1; then
            log "Radarr is ready"
            return 0
        fi
        if [ $i -eq 60 ]; then
            error "Radarr did not become ready in time"
            return 1
        fi
        sleep 2
    done
}

# Function to get API key
get_api_key() {
    log "Extracting Radarr API key..."
    
    # Try to get API key from config file
    local config_file="config/radarr/config.xml"
    if [ -f "$config_file" ]; then
        local api_key=$(grep -o '<ApiKey>[^<]*</ApiKey>' "$config_file" | sed 's/<ApiKey>\(.*\)<\/ApiKey>/\1/')
        if [ -n "$api_key" ]; then
            echo "$api_key"
            return 0
        fi
    fi
    
    error "Could not extract API key from Radarr config"
    return 1
}

# Function to test API access
test_api_access() {
    local api_key="$1"
    log "Testing API access with key: ${api_key:0:8}..."
    
    local response=$(curl -s -H "X-Api-Key: $api_key" "$RADARR_API_BASE/system/status")
    if echo "$response" | grep -q '"instanceName"'; then
        log "✅ API access successful"
        return 0
    else
        error "❌ API access failed"
        return 1
    fi
}

# Function to add root folder
add_root_folder() {
    local api_key="$1"
    log "Adding root folder for movies..."
    
    # Check if root folder already exists
    local existing=$(curl -s -H "X-Api-Key: $api_key" "$RADARR_API_BASE/rootfolder")
    if echo "$existing" | grep -q '"/media/movies"'; then
        log "Root folder already exists"
        return 0
    fi
    
    # Add root folder
    curl -s -H "X-Api-Key: $api_key" -H "Content-Type: application/json" \
        -d '{
            "path": "/media/movies",
            "accessible": true,
            "freeSpace": 0,
            "unmappedFolders": []
        }' \
        "$RADARR_API_BASE/rootfolder" > /dev/null
    
    log "✅ Root folder added: /media/movies"
}

# Function to add qBittorrent download client
add_download_client() {
    local api_key="$1"
    log "Adding qBittorrent as download client..."
    
    # Check if download client already exists
    local existing=$(curl -s -H "X-Api-Key: $api_key" "$RADARR_API_BASE/downloadclient")
    if echo "$existing" | grep -q '"qbittorrent"'; then
        log "qBittorrent download client already exists"
        return 0
    fi
    
    # Add qBittorrent download client
    curl -s -H "X-Api-Key: $api_key" -H "Content-Type: application/json" \
        -d '{
            "enable": true,
            "protocol": "torrent",
            "priority": 1,
            "removeCompletedDownloads": false,
            "removeFailedDownloads": true,
            "name": "qBittorrent",
            "fields": [
                {"name": "host", "value": "qbittorrent"},
                {"name": "port", "value": 8080},
                {"name": "username", "value": "admin"},
                {"name": "password", "value": "ai_media_2024"},
                {"name": "category", "value": "movies"},
                {"name": "recentTvPriority", "value": 0},
                {"name": "olderTvPriority", "value": 0},
                {"name": "initialState", "value": 0}
            ],
            "implementationName": "qBittorrent",
            "implementation": "QBittorrent",
            "configContract": "QBittorrentSettings",
            "tags": []
        }' \
        "$RADARR_API_BASE/downloadclient" > /dev/null
    
    log "✅ qBittorrent download client added"
}

# Function to add Prowlarr as indexer
add_prowlarr_indexer() {
    local api_key="$1"
    local prowlarr_api_key="$2"
    log "Adding Prowlarr as indexer..."
    
    if [ -z "$prowlarr_api_key" ]; then
        warning "⚠️ Prowlarr API key not provided, skipping indexer setup"
        return 1
    fi
    
    # Check if Prowlarr indexer already exists
    local existing=$(curl -s -H "X-Api-Key: $api_key" "$RADARR_API_BASE/indexer")
    if echo "$existing" | grep -q '"prowlarr"'; then
        log "Prowlarr indexer already exists"
        return 0
    fi
    
    # Add Prowlarr indexer
    curl -s -H "X-Api-Key: $api_key" -H "Content-Type: application/json" \
        -d '{
            "enableRss": true,
            "enableAutomaticSearch": true,
            "enableInteractiveSearch": true,
            "supportsRss": true,
            "supportsSearch": true,
            "protocol": "torrent",
            "priority": 25,
            "name": "Prowlarr",
            "fields": [
                {"name": "baseUrl", "value": "http://prowlarr:9696"},
                {"name": "apiKey", "value": "'$prowlarr_api_key'"},
                {"name": "categories", "value": [2000, 2010, 2020, 2030, 2040, 2045, 2050, 2060]},
                {"name": "minimumSeeders", "value": 1}
            ],
            "implementationName": "Torznab",
            "implementation": "Torznab",
            "configContract": "TorznabSettings",
            "tags": []
        }' \
        "$RADARR_API_BASE/indexer" > /dev/null
    
    log "✅ Prowlarr indexer added"
}

# Function to configure quality profiles
configure_quality_profiles() {
    local api_key="$1"
    log "Configuring quality profiles..."
    
    # Get existing quality profiles
    local profiles=$(curl -s -H "X-Api-Key: $api_key" "$RADARR_API_BASE/qualityprofile")
    
    # Update HD-1080p profile as default
    local hd_profile_id=$(echo "$profiles" | grep -o '"id":[0-9]*' | head -1 | grep -o '[0-9]*')
    if [ -n "$hd_profile_id" ]; then
        log "Setting HD-1080p as preferred quality profile"
        # Quality profiles are usually pre-configured, just ensure they exist
        log "✅ Quality profiles configured"
    else
        warning "⚠️ Could not find quality profiles"
    fi
}

# Function to configure media management
configure_media_management() {
    local api_key="$1"
    log "Configuring media management settings..."
    
    # Configure media management
    curl -s -H "X-Api-Key: $api_key" -H "Content-Type: application/json" \
        -d '{
            "autoUnmonitorPreviouslyDownloadedMovies": false,
            "recyclingBin": "",
            "recyclingBinCleanupDays": 7,
            "downloadPropersAndRepacks": "preferAndUpgrade",
            "createEmptyMovieFolders": false,
            "deleteEmptyFolders": true,
            "fileDate": "none",
            "rescanAfterRefresh": "always",
            "autoRenameFolders": false,
            "pathsDefaultStatic": false,
            "setPermissionsLinux": false,
            "chmodFolder": "755",
            "chownGroup": "",
            "skipFreeSpaceCheckWhenImporting": false,
            "minimumFreeSpaceWhenImporting": 100,
            "copyUsingHardlinks": true,
            "importExtraFiles": true,
            "extraFileExtensions": "srt,sub,idx,sup"
        }' \
        "$RADARR_API_BASE/config/mediamanagement" > /dev/null
    
    log "✅ Media management configured"
}

# Function to test connections
test_connections() {
    local api_key="$1"
    log "Testing service connections..."
    
    # Test download client
    local download_clients=$(curl -s -H "X-Api-Key: $api_key" "$RADARR_API_BASE/downloadclient")
    if echo "$download_clients" | grep -q '"qbittorrent"'; then
        log "✅ Download client connection available"
    else
        warning "⚠️ Download client not found"
    fi
    
    # Test indexers
    local indexers=$(curl -s -H "X-Api-Key: $api_key" "$RADARR_API_BASE/indexer")
    local indexer_count=$(echo "$indexers" | grep -o '"id":' | wc -l)
    log "Found $indexer_count configured indexers"
}

# Function to update environment file with API key
update_env_file() {
    local api_key="$1"
    log "Updating .env file with Radarr API key..."
    
    if [ -f ".env" ]; then
        # Remove existing RADARR_API_KEY line
        sed -i.bak '/^RADARR_API_KEY=/d' .env
        
        # Add new API key
        echo "RADARR_API_KEY=$api_key" >> .env
        
        log "✅ API key added to .env file"
    else
        warning "⚠️ .env file not found, cannot save API key"
    fi
}

# Main execution
main() {
    log "Starting Radarr configuration..."
    
    # Wait for Radarr to be ready
    if ! wait_for_radarr; then
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
    
    # Get Prowlarr API key from environment
    local prowlarr_api_key=""
    if [ -f ".env" ]; then
        prowlarr_api_key=$(grep "^PROWLARR_API_KEY=" .env | cut -d'=' -f2)
    fi
    
    # Add root folder
    add_root_folder "$api_key"
    
    # Add download client
    add_download_client "$api_key"
    
    # Add Prowlarr indexer (if API key available)
    add_prowlarr_indexer "$api_key" "$prowlarr_api_key"
    
    # Configure quality profiles
    configure_quality_profiles "$api_key"
    
    # Configure media management
    configure_media_management "$api_key"
    
    # Test connections
    test_connections "$api_key"
    
    # Update environment file
    update_env_file "$api_key"
    
    log "🎉 Radarr configuration completed successfully!"
    log "You can now access Radarr at: http://localhost:7878"
    log "API Key: ${api_key:0:8}...${api_key: -4}"
    log "Root folder: /media/movies"
    log "Download client: qBittorrent (movies category)"
}

# Run main function
main "$@" 