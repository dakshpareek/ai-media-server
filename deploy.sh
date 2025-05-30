#!/bin/bash

# AI-Powered Media Server Deployment Script
# This script helps you deploy and manage all media server services

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env"
COMPOSE_FILES=(
    "docker-compose.yml"
    "qbittorrent/docker-compose.yml"
    "prowlarr/docker-compose.yml"
    "radarr/docker-compose.yml"
    "overseerr/docker-compose.yml"
    "filebrowser/docker-compose.yml"
)

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}" >&2
}

warning() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

info() {
    echo -e "${BLUE}[INFO] $1${NC}"
}

# Function to check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check if Docker is installed
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    # Check if Docker Compose is installed
    if ! command -v docker-compose &> /dev/null; then
        error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    # Check if Docker daemon is running
    if ! docker info &> /dev/null; then
        error "Docker daemon is not running. Please start Docker first."
        exit 1
    fi
    
    log "Prerequisites check passed!"
}

# Function to setup environment
setup_environment() {
    log "Setting up environment..."
    
    if [ ! -f "$ENV_FILE" ]; then
        if [ -f "${SCRIPT_DIR}/ai-media-server.env.example" ]; then
            info "Copying example environment file..."
            cp "${SCRIPT_DIR}/ai-media-server.env.example" "$ENV_FILE"
            warning "Please edit $ENV_FILE with your configuration before continuing!"
            warning "Make sure to set CONFIG_PATH to the absolute path of this directory."
            exit 1
        else
            error "Environment file not found and no example available!"
            exit 1
        fi
    fi
    
    # Source environment file
    set -a  # automatically export all variables
    source "$ENV_FILE"
    set +a
    
    # Validate required variables
    if [ -z "$CONFIG_PATH" ]; then
        error "CONFIG_PATH is not set in $ENV_FILE"
        exit 1
    fi
    
    log "Environment setup complete!"
}

# Function to create directories
create_directories() {
    log "Creating required directories..."
    
    mkdir -p "$CONFIG_PATH"/{config,downloads,media/movies,logs}/{radarr,prowlarr,overseerr,qbittorrent,filebrowser}
    mkdir -p "$CONFIG_PATH"/cloudflared
    
    # Set proper permissions
    if [ "$PUID" ] && [ "$PGID" ]; then
        chown -R "$PUID:$PGID" "$CONFIG_PATH" 2>/dev/null || warning "Could not set ownership. You may need to run with sudo."
    fi
    
    log "Directories created successfully!"
}

# Function to create Docker network
create_network() {
    log "Creating Docker network..."
    
    NETWORK_NAME=${NETWORK_NAME:-media_network}
    
    if ! docker network ls | grep -q "$NETWORK_NAME"; then
        docker network create "$NETWORK_NAME"
        log "Network '$NETWORK_NAME' created successfully!"
    else
        info "Network '$NETWORK_NAME' already exists."
    fi
}

# Function to deploy services
deploy_services() {
    log "Deploying AI Media Server services..."
    
    cd "$SCRIPT_DIR"
    
    # Deploy main infrastructure first (network + cloudflared)
    info "Deploying main infrastructure..."
    docker-compose --env-file "$ENV_FILE" -f docker-compose.yml up -d
    
    # Deploy core services
    for compose_file in "${COMPOSE_FILES[@]:1}"; do
        if [ -f "$compose_file" ]; then
            service_name=$(dirname "$compose_file")
            if [ "$service_name" = "." ]; then
                service_name=$(basename "$compose_file" .yml)
            fi
            
            info "Deploying $service_name..."
            docker-compose --env-file "$ENV_FILE" -f "$compose_file" up -d
            
            # Wait a bit between services to avoid overwhelming the system
            sleep 5
        else
            warning "Compose file $compose_file not found, skipping..."
        fi
    done
    
    log "All services deployed successfully!"
}

# Function to show service status
show_status() {
    log "Checking service status..."
    
    echo -e "\n${BLUE}=== Service Status ===${NC}"
    docker ps --filter "label=ai-media-server.service" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    
    echo -e "\n${BLUE}=== Service URLs ===${NC}"
    echo "qBittorrent:  http://localhost:${PORT_QBITTORRENT:-8080}"
    echo "Prowlarr:     http://localhost:${PORT_PROWLARR:-9696}"
    echo "Radarr:       http://localhost:${PORT_RADARR:-7878}"
    echo "Overseerr:    http://localhost:${PORT_OVERSEERR:-5055}"
    echo "FileBrowser:  http://localhost:${PORT_FILEBROWSER:-8081}"
}

# Function to stop services
stop_services() {
    log "Stopping AI Media Server services..."
    
    cd "$SCRIPT_DIR"
    
    for compose_file in "${COMPOSE_FILES[@]}"; do
        if [ -f "$compose_file" ]; then
            info "Stopping services in $compose_file..."
            docker-compose --env-file "$ENV_FILE" -f "$compose_file" down
        fi
    done
    
    log "All services stopped!"
}

# Function to show logs
show_logs() {
    local service=${1:-}
    
    if [ -z "$service" ]; then
        log "Showing logs for all services..."
        docker logs ai_media_qbittorrent --tail=50 &
        docker logs ai_media_prowlarr --tail=50 &
        docker logs ai_media_radarr --tail=50 &
        docker logs ai_media_overseerr --tail=50 &
        docker logs ai_media_filebrowser --tail=50 &
        wait
    else
        log "Showing logs for $service..."
        docker logs "ai_media_$service" --tail=100 -f
    fi
}

# Function to show help
show_help() {
    echo -e "${BLUE}AI-Powered Media Server Deployment Script${NC}"
    echo ""
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  deploy     Deploy all media server services"
    echo "  start      Start all services (alias for deploy)"
    echo "  stop       Stop all services"
    echo "  restart    Restart all services"
    echo "  status     Show service status and URLs"
    echo "  logs       Show logs for all services"
    echo "  logs <service>  Show logs for specific service (qbittorrent, radarr, etc.)"
    echo "  update     Pull latest images and restart services"
    echo "  clean      Stop services and remove containers (keeps data)"
    echo "  help       Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 deploy          # Deploy the entire media server"
    echo "  $0 status          # Check service status"
    echo "  $0 logs radarr     # Show Radarr logs"
    echo "  $0 restart         # Restart all services"
}

# Main script logic
main() {
    local command=${1:-help}
    
    case "$command" in
        "deploy"|"start")
            check_prerequisites
            setup_environment
            create_directories
            create_network
            deploy_services
            echo ""
            show_status
            echo ""
            log "🎉 AI Media Server deployment complete!"
            info "Next steps:"
            info "1. Configure each service through their web interfaces"
            info "2. Set up API keys and service connections"
            info "3. Configure Cloudflared for external access"
            ;;
        "stop")
            setup_environment
            stop_services
            ;;
        "restart")
            setup_environment
            stop_services
            sleep 5
            create_network
            deploy_services
            show_status
            ;;
        "status")
            show_status
            ;;
        "logs")
            show_logs "$2"
            ;;
        "update")
            setup_environment
            info "Pulling latest images..."
            cd "$SCRIPT_DIR"
            for compose_file in "${COMPOSE_FILES[@]}"; do
                if [ -f "$compose_file" ]; then
                    docker-compose --env-file "$ENV_FILE" -f "$compose_file" pull
                fi
            done
            log "Images updated! Run 'restart' to apply updates."
            ;;
        "clean")
            setup_environment
            warning "This will stop and remove all containers but keep your data."
            read -p "Are you sure? (y/N): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                stop_services
                info "Removing containers..."
                docker container prune -f
                log "Cleanup complete!"
            fi
            ;;
        "help"|*)
            show_help
            ;;
    esac
}

# Run main function with all arguments
main "$@" 