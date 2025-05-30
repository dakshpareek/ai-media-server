#!/bin/bash

set -e

echo "🚀 AI Media Server Deployment with NordVPN CLI"
echo "==============================================="
echo ""

# Check if .env exists
if [[ ! -f .env ]]; then
    echo "❌ .env file not found!"
    echo "💡 Copy .env.example to .env and configure your settings"
    exit 1
fi

# Check for required environment variables
echo "🔍 Checking environment configuration..."
if ! grep -q "NORDVPN_USER=" .env || ! grep -q "NORDVPN_PASS=" .env; then
    echo "❌ NordVPN credentials not configured in .env"
    echo "💡 Add NORDVPN_USER and NORDVPN_PASS to your .env file"
    exit 1
fi

echo "✅ Environment configuration looks good"
echo ""

# Build containers
echo "🔨 Building containers..."
docker-compose build

echo ""
echo "🚀 Starting AI Media Server with NordVPN protection..."
docker-compose up -d

echo ""
echo "⏳ Waiting for services to start..."
sleep 10

# Check service status
echo ""
echo "📊 Service Status:"
echo "=================="
docker-compose ps

echo ""
echo "🔐 VPN Authentication Required!"
echo "==============================="
echo ""
echo "📱 To complete NordVPN authentication:"
echo "   1. Watch the logs: docker-compose logs nordvpn -f"
echo "   2. Look for an authentication URL"
echo "   3. Open the URL in your browser"
echo "   4. Log in with your NordVPN credentials"
echo ""
echo "🌐 Once authenticated, your services will be available at:"
echo "   • Overseerr:     http://localhost:5055"
echo "   • Radarr:        http://localhost:7878"
echo "   • Prowlarr:      http://localhost:9696 (via VPN)"
echo "   • qBittorrent:   http://localhost:8080"
echo "   • FileBrowser:   http://localhost:8084"
echo "   • FlareSolverr:  http://localhost:8191 (via VPN)"
echo ""
echo "🎉 Deployment complete!"
echo "💡 Run 'docker-compose logs nordvpn -f' to see VPN authentication status" 