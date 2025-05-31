#!/bin/bash

set -e

echo "🔐 Starting NordVPN CLI Container for AI Media Server"
echo "==================================================="

# Start NordVPN daemon
echo "📡 Starting NordVPN daemon..."
nordvpnd &
sleep 10

# Check daemon status
echo "🔍 Checking daemon status..."
if ! pgrep -x "nordvpnd" > /dev/null; then
    echo "❌ Daemon failed to start"
    exit 1
fi

echo "✅ Daemon is running (Version: $(nordvpn version | head -1))"

# Check if already authenticated
if nordvpn account >/dev/null 2>&1; then
    echo "✅ Already authenticated - skipping login"
else
    echo ""
    echo "🔑 Interactive browser authentication required"
    echo "📱 Opening authentication URL..."
    echo ""
    
    # Run login and capture the URL
    echo "🎫 Generating authentication URL..."
    nordvpn login | grep -E "(Continue in the browser|https://)" || echo "⚠️  Please check output above for authentication URL"
    
    echo ""
    echo "📋 Waiting for authentication to complete..."
    echo "💡 Open the URL above in your browser and log in with your NordVPN credentials"
    
    # Wait for authentication (check every 15 seconds for up to 10 minutes)
    for i in {1..40}; do
        if nordvpn account >/dev/null 2>&1; then
            echo "✅ Authentication successful!"
            break
        fi
        
        if [ $i -eq 40 ]; then
            echo "⏰ Authentication timeout. Container will continue running."
            echo "💡 You can authenticate later - the container will automatically detect it"
            break
        fi
        
        echo "   Waiting for authentication... ($i/40) - $(date)"
        sleep 15
    done
fi

# Configure VPN settings if authenticated
if nordvpn account >/dev/null 2>&1; then
    echo ""
    echo "⚙️  Configuring VPN settings..."
    
    # Set technology
    echo "🔧 Setting technology to: ${TECHNOLOGY:-NordLynx}"
    nordvpn set technology "${TECHNOLOGY:-NordLynx}" || echo "⚠️  Technology setting failed"
    
    # Allow local network
    if [[ -n "$NETWORK" ]]; then
        echo "🏠 Allowing local network: $NETWORK"
        nordvpn whitelist add subnet "$NETWORK" || echo "⚠️  Network whitelist failed"
    fi
    
    # Connect to VPN
    echo "🌍 Connecting to VPN..."
    if [[ -n "$CONNECT" ]]; then
        nordvpn connect "$CONNECT" || echo "❌ Initial connection failed - will retry"
    else
        nordvpn connect || echo "❌ Initial connection failed - will retry"
    fi
    
    # Wait for connection
    sleep 10
    
    # Verify connection
    echo "✅ Checking VPN status..."
    nordvpn status
    
    echo ""
    echo "🌐 External IP check:"
    curl -s --max-time 10 ifconfig.me || echo "Could not verify external IP"
    echo ""
    
else
    echo "⚠️  Not authenticated - VPN connection skipped"
fi

echo ""
echo "🎉 NordVPN CLI container ready!"
echo "🔗 AI Media Server services:"
echo "   • Prowlarr (VPN): http://localhost:9696"
echo "   • FlareSolverr (VPN): http://localhost:8191"
echo "   • Other services: Running on local network"

# Main monitoring loop
while true; do
    # Check authentication status
    if nordvpn account >/dev/null 2>&1; then
        # Check VPN connection
        if nordvpn status | grep -q "Connected"; then
            echo "✅ $(date): VPN connected and healthy"
        else
            echo "⚠️  $(date): VPN disconnected - attempting reconnect..."
            if [[ -n "$CONNECT" ]]; then
                nordvpn connect "$CONNECT" || echo "❌ Reconnection failed"
            else
                nordvpn connect || echo "❌ Reconnection failed"
            fi
        fi
    else
        echo "⚠️  $(date): Not authenticated - please complete browser login"
        echo "💡 Run: nordvpn login (and follow the URL)"
    fi
    
    sleep 60
done 