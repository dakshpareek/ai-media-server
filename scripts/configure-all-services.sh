#!/bin/bash

# Master Configuration Script for AI Media Server
# This script configures all services in the correct order

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

header() {
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE} $1${NC}"
    echo -e "${BLUE}================================${NC}"
}

# Function to check if services are running
check_services() {
    log "Checking service status..."
    
    local services=("ai_media_overseerr" "ai_media_radarr" "ai_media_prowlarr" "ai_media_qbittorrent")
    local healthy_services=()
    local unhealthy_services=()
    
    for service in "${services[@]}"; do
        if docker ps --filter "name=$service" --format "table {{.Status}}" | grep -q "healthy\|Up"; then
            healthy_services+=("$service")
        else
            unhealthy_services+=("$service")
        fi
    done
    
    if [ ${#unhealthy_services[@]} -gt 0 ]; then
        warning "Some services are not running properly:"
        for service in "${unhealthy_services[@]}"; do
            warning "  - $service"
        done
        return 1
    else
        log "✅ All core services are running"
        return 0
    fi
}

# Function to make scripts executable
make_scripts_executable() {
    log "Making configuration scripts executable..."
    
    chmod +x scripts/configure-qbittorrent.sh
    chmod +x scripts/configure-prowlarr.sh
    chmod +x scripts/configure-radarr.sh
    chmod +x scripts/configure-overseerr.sh
    
    log "✅ Scripts are now executable"
}

# Function to configure qBittorrent
configure_qbittorrent() {
    header "CONFIGURING QBITTORRENT"
    
    if ! ./scripts/configure-qbittorrent.sh; then
        error "❌ qBittorrent configuration failed"
        return 1
    fi
    
    log "✅ qBittorrent configuration completed"
    return 0
}

# Function to configure Prowlarr
configure_prowlarr() {
    header "CONFIGURING PROWLARR"
    
    if ! ./scripts/configure-prowlarr.sh; then
        error "❌ Prowlarr configuration failed"
        return 1
    fi
    
    log "✅ Prowlarr configuration completed"
    return 0
}

# Function to configure Radarr
configure_radarr() {
    header "CONFIGURING RADARR"
    
    if ! ./scripts/configure-radarr.sh; then
        error "❌ Radarr configuration failed"
        return 1
    fi
    
    log "✅ Radarr configuration completed"
    return 0
}

# Function to configure Overseerr
configure_overseerr() {
    header "CONFIGURING OVERSEERR"
    
    if ! ./scripts/configure-overseerr.sh; then
        error "❌ Overseerr configuration failed"
        return 1
    fi
    
    log "✅ Overseerr configuration completed"
    return 0
}

# Function to test end-to-end connectivity
test_end_to_end() {
    header "TESTING END-TO-END CONNECTIVITY"
    
    log "Testing service endpoints..."
    
    # Test each service
    local services=(
        "qBittorrent:localhost:8080"
        "Prowlarr:localhost:9696"
        "Radarr:localhost:7878"
        "Overseerr:localhost:5055"
    )
    
    for service in "${services[@]}"; do
        local name=$(echo "$service" | cut -d':' -f1)
        local host=$(echo "$service" | cut -d':' -f2)
        local port=$(echo "$service" | cut -d':' -f3)
        
        if curl -s "http://$host:$port" > /dev/null; then
            log "✅ $name is accessible"
        else
            warning "⚠️ $name is not accessible"
        fi
    done
    
    log "End-to-end testing completed"
}

# Function to display summary
display_summary() {
    header "CONFIGURATION SUMMARY"
    
    log "🎉 AI Media Server configuration completed!"
    echo
    log "Service Access URLs:"
    log "  • Overseerr (Requests):  http://localhost:5055"
    log "  • Radarr (Movies):       http://localhost:7878"
    log "  • Prowlarr (Indexers):   http://localhost:9696"
    log "  • qBittorrent (Downloads): http://localhost:8080"
    echo
    log "Default Credentials:"
    log "  • Overseerr: admin@ai-media-server.local / ai_media_2024"
    log "  • qBittorrent: admin / ai_media_2024"
    log "  • Radarr & Prowlarr: API-based access (keys saved in .env)"
    echo
    log "Workflow:"
    log "  1. Request movies in Overseerr"
    log "  2. Radarr searches via Prowlarr indexers"
    log "  3. Downloads managed by qBittorrent"
    log "  4. Movies moved to /media/movies"
    echo
    log "API Keys saved to .env file for integration"
    log "Configuration scripts can be re-run if needed"
}

# Function to handle specific service configuration
configure_single_service() {
    local service="$1"
    
    case "$service" in
        "qbittorrent")
            configure_qbittorrent
            ;;
        "prowlarr")
            configure_prowlarr
            ;;
        "radarr")
            configure_radarr
            ;;
        "overseerr")
            configure_overseerr
            ;;
        *)
            error "Unknown service: $service"
            error "Available services: qbittorrent, prowlarr, radarr, overseerr"
            exit 1
            ;;
    esac
}

# Main execution
main() {
    local target_service="$1"
    
    header "AI MEDIA SERVER - SERVICE CONFIGURATION"
    
    # Make scripts executable
    make_scripts_executable
    
    # Check if specific service was requested
    if [ -n "$target_service" ]; then
        log "Configuring specific service: $target_service"
        configure_single_service "$target_service"
        return 0
    fi
    
    # Check services are running
    if ! check_services; then
        error "❌ Some services are not running. Please ensure all containers are healthy."
        error "Run './deploy.sh status' to check container status"
        exit 1
    fi
    
    log "Starting full AI Media Server configuration..."
    echo
    
    # Configuration order matters for API key dependencies
    local failed_services=()
    
    # Step 1: Configure qBittorrent (no dependencies)
    if ! configure_qbittorrent; then
        failed_services+=("qBittorrent")
    fi
    sleep 2
    
    # Step 2: Configure Prowlarr (no dependencies)
    if ! configure_prowlarr; then
        failed_services+=("Prowlarr")
    fi
    sleep 2
    
    # Step 3: Configure Radarr (needs qBittorrent and Prowlarr API keys)
    if ! configure_radarr; then
        failed_services+=("Radarr")
    fi
    sleep 2
    
    # Step 4: Configure Overseerr (needs Radarr API key)
    if ! configure_overseerr; then
        failed_services+=("Overseerr")
    fi
    
    # Test connectivity
    test_end_to_end
    
    # Check for failures
    if [ ${#failed_services[@]} -gt 0 ]; then
        warning "⚠️ Some services failed to configure:"
        for service in "${failed_services[@]}"; do
            warning "  - $service"
        done
        warning "You may need to run individual service configurations manually"
    fi
    
    # Display summary
    display_summary
    
    log "Configuration complete! Your AI Media Server is ready to use."
}

# Help function
show_help() {
    echo "AI Media Server Configuration Script"
    echo
    echo "Usage:"
    echo "  $0                    Configure all services"
    echo "  $0 [service]          Configure specific service"
    echo
    echo "Available services:"
    echo "  qbittorrent          Configure qBittorrent download client"
    echo "  prowlarr             Configure Prowlarr indexers"
    echo "  radarr               Configure Radarr movie management"
    echo "  overseerr            Configure Overseerr request management"
    echo
    echo "Examples:"
    echo "  $0                    # Configure all services"
    echo "  $0 radarr             # Configure only Radarr"
}

# Check for help request
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    show_help
    exit 0
fi

# Run main function
main "$@" 