#!/bin/bash

# AI Media Server Setup Validation Script
# Run this before deploying to catch common issues early

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env"

echo -e "${BLUE}🔍 AI Media Server Setup Validation${NC}\n"

# Check 1: Environment file
echo -n "Environment file... "
if [ -f "$ENV_FILE" ]; then
    echo -e "${GREEN}✓${NC}"
    source "$ENV_FILE" 2>/dev/null || echo -e "${YELLOW}⚠ Warning: Could not source env file${NC}"
else
    echo -e "${RED}✗ Missing ai-media-server.env${NC}"
    echo "  → Copy from ai-media-server.env.example and configure"
    exit 1
fi

# Check 2: CONFIG_PATH
echo -n "CONFIG_PATH validation... "
if [ -n "$CONFIG_PATH" ] && [ -d "$CONFIG_PATH" ]; then
    echo -e "${GREEN}✓ $CONFIG_PATH${NC}"
else
    echo -e "${RED}✗ CONFIG_PATH not set or invalid${NC}"
    echo "  → Set CONFIG_PATH to absolute path in $ENV_FILE"
    exit 1
fi

# Check 3: Docker
echo -n "Docker installation... "
if command -v docker &> /dev/null; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗ Docker not found${NC}"
    echo "  → Install Docker: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check 4: Docker Compose
echo -n "Docker Compose installation... "
if command -v docker-compose &> /dev/null; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗ Docker Compose not found${NC}"
    echo "  → Install Docker Compose: https://docs.docker.com/compose/install/"
    exit 1
fi

# Check 5: Docker daemon
echo -n "Docker daemon... "
if docker info &> /dev/null; then
    echo -e "${GREEN}✓ Running${NC}"
else
    echo -e "${RED}✗ Not running${NC}"
    echo "  → Start Docker daemon"
    exit 1
fi

# Check 6: Available disk space
echo -n "Disk space... "
AVAILABLE=$(df "$CONFIG_PATH" | awk 'NR==2 {print $4}')
AVAILABLE_GB=$((AVAILABLE / 1024 / 1024))
if [ "$AVAILABLE_GB" -gt 20 ]; then
    echo -e "${GREEN}✓ ${AVAILABLE_GB}GB available${NC}"
else
    echo -e "${YELLOW}⚠ Only ${AVAILABLE_GB}GB available${NC}"
    echo "  → Recommended: 50GB+ for proper operation"
fi

# Check 7: Network connectivity
echo -n "Internet connectivity... "
if ping -c 1 8.8.8.8 &> /dev/null; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗ No internet connection${NC}"
    echo "  → Check network connection"
    exit 1
fi

# Check 8: Port availability
echo -n "Port availability... "
PORTS=(5055 7878 8080 8081 9696)
PORTS_OK=true
for port in "${PORTS[@]}"; do
    if lsof -i :$port &> /dev/null; then
        echo -e "${YELLOW}⚠ Port $port in use${NC}"
        PORTS_OK=false
    fi
done
if $PORTS_OK; then
    echo -e "${GREEN}✓ All ports available${NC}"
fi

# Check 9: User permissions
echo -n "User permissions... "
if [ -w "$CONFIG_PATH" ]; then
    echo -e "${GREEN}✓ Can write to CONFIG_PATH${NC}"
else
    echo -e "${RED}✗ Cannot write to CONFIG_PATH${NC}"
    echo "  → Check permissions: chmod 755 $CONFIG_PATH"
fi

# Check 10: PUID/PGID
echo -n "User/Group IDs... "
CURRENT_UID=$(id -u)
CURRENT_GID=$(id -g)
if [ "$PUID" = "$CURRENT_UID" ] && [ "$PGID" = "$CURRENT_GID" ]; then
    echo -e "${GREEN}✓ PUID=$PUID PGID=$PGID${NC}"
else
    echo -e "${YELLOW}⚠ PUID/PGID mismatch${NC}"
    echo "  → Current: UID=$CURRENT_UID GID=$CURRENT_GID"
    echo "  → In env: PUID=$PUID PGID=$PGID"
    echo "  → Update PUID/PGID in $ENV_FILE"
fi

echo -e "\n${BLUE}📋 Configuration Summary${NC}"
echo "CONFIG_PATH: $CONFIG_PATH"
echo "PUID/PGID: $PUID/$PGID"
echo "Timezone: $TZ"
echo "Network: $NETWORK_NAME"

if [ -n "$CF_DOMAIN" ]; then
    echo "Cloudflare Domain: $CF_DOMAIN"
else
    echo -e "${YELLOW}Cloudflare Domain: Not configured${NC}"
fi

echo -e "\n${BLUE}🚀 Next Steps${NC}"
echo "1. Review any warnings above"
echo "2. Run: ./deploy.sh deploy"
echo "3. Configure services through web interfaces"
echo "4. Test the complete pipeline"

echo -e "\n${GREEN}✅ Setup validation complete!${NC}" 