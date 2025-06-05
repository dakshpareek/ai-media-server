#!/bin/bash
set -e

echo "🔐 Starting NordVPN CLI Container"
echo "================================="

# Start NordVPN daemon in the background
echo "📡 Starting NordVPN daemon..."
nordvpnd
# Give the daemon a few seconds to initialize
sleep 10 # Increased sleep time

# Check daemon status
echo "🔍 Checking daemon status..."
if ! pgrep -x "nordvpnd" > /dev/null; then
    echo "❌ NordVPN daemon failed to start. Check logs."
    # Keep container running for debugging, or exit 1
    echo "Container will stay up for debugging. Check 'docker logs nordvpn_official'."
    tail -f /dev/null
fi
echo "✅ NordVPN daemon is running (Version: $(nordvpn version | head -n 1))"

# Check if already authenticated
if nordvpn account >/dev/null 2>&1; then
    echo "✅ Already authenticated to NordVPN."
else
    echo ""
    echo "🔑 NordVPN Authentication Required"
    echo "----------------------------------"
    echo "NordVPN requires browser-based authentication."
    echo "The container will now attempt to generate a login URL."
    echo "Please copy the URL from the output below and open it in your browser to log in."
    echo ""

    # Initiate browser login and capture the URL
    echo "🔗 Generating login URL..."
    # Try to get the login URL. Output might vary.
    LOGIN_COMMAND_OUTPUT=$(nordvpn login --callback 2>&1 || nordvpn login 2>&1) # Try with and without callback
    echo "${LOGIN_COMMAND_OUTPUT}" # Print the full output for the user

    LOGIN_URL=$(echo "${LOGIN_COMMAND_OUTPUT}" | grep -oP 'https?://[^\s\'"]+' | head -n 1)

    if [[ -n "$LOGIN_URL" ]]; then
        echo ""
        echo "👉👉👉 Please open this URL in your browser to log in: ${LOGIN_URL}"
    else
        echo "⚠️ Could not automatically extract login URL. Please check the output above from 'nordvpn login'."
    fi
    echo ""
    echo "⏳ Waiting for authentication to complete in your browser..."
    echo "   This container will check authentication status periodically."
    echo "   If stuck, you can manually run 'docker exec -it nordvpn_official nordvpn login' again from host."

    # Wait for authentication (check every 15 seconds for up to 10 minutes)
    ATTEMPTS=0
    MAX_ATTEMPTS=40 # 10 minutes
    while ! nordvpn account >/dev/null 2>&1; do
        ATTEMPTS=$((ATTEMPTS + 1))
        if [ $ATTEMPTS -gt $MAX_ATTEMPTS ]; then
            echo "⏰ Authentication timeout after 10 minutes."
            echo "   Please ensure you have completed the browser login."
            echo "   You can try 'docker exec -it nordvpn_official nordvpn login' again if needed."
            # Decide whether to keep running or exit
            # For a server, probably keep running so user can fix it.
            break
        fi
        echo "   Still waiting for browser authentication... (attempt $ATTEMPTS/$MAX_ATTEMPTS) - $(date)"
        sleep 15
    done

    if nordvpn account >/dev/null 2>&1; then
        echo "✅ Authentication successful!"
    else
        echo "⚠️ Authentication still not complete after waiting period."
    fi
fi

# Apply settings if authenticated (This part runs on start if already auth'd, or after successful login loop)
if nordvpn account >/dev/null 2>&1; then
    echo ""
    echo "⚙️ Applying NordVPN settings (if authenticated)..."
    nordvpn set technology "${TECHNOLOGY:-NordLynx}" || echo "⚠️ Technology setting failed (current: $(nordvpn settings | grep Technology | awk '{print $2}'))."
    nordvpn set killswitch off || echo "⚠️ Kill Switch disable failed (current: $(nordvpn settings | grep Kill | awk '{print $3}'))."
    # Consider `nordvpn set autoconnect off` if MCP server fully manages connections.
    # nordvpn set autoconnect off australia # Example: set a default city but don't connect
    # nordvpn set notify off # Disable desktop notifications

    if [[ -n "$NETWORK" ]]; then
        echo "🏠 Whitelisting local network (from env \$NETWORK): $NETWORK"
        nordvpn whitelist add subnet "$NETWORK" || echo "⚠️ Whitelisting $NETWORK failed (already whitelisted or error)."
    else
        echo "⚠️ LOCAL_NETWORK (env var NETWORK) not set. Cannot whitelist LAN."
    fi
    # Whitelist Docker's default bridge network
    nordvpn whitelist add subnet 172.17.0.0/16 || echo "⚠️ Whitelisting Docker default bridge (172.17.0.0/16) failed."
    # Whitelist common Docker user-defined network ranges. Add more if your Docker uses others.
    # You can find your actual network subnet for 'ai-media-network' by running 'docker network inspect ai-media-network' on the host.
    # Example: if ai-media-network is 172.20.0.0/16, add that.
    # For now, adding a few common ones:
    declare -a DOCKER_SUBNETS=("172.18.0.0/16" "172.19.0.0/16" "172.20.0.0/16" "172.21.0.0/16" "172.22.0.0/16")
    for subnet in "${DOCKER_SUBNETS[@]}"; do
        nordvpn whitelist add subnet "$subnet" || echo "⚠️ Whitelisting Docker network $subnet failed (may be ok if already whitelisted or doesn't exist)."
    done


    # Initial connection based on CONNECT env var (optional)
    if [[ -n "$CONNECT" ]]; then
        echo "🌍 Auto-connecting to (from env \$CONNECT): $CONNECT, as per entrypoint config."
        nordvpn connect "$CONNECT" || echo "⚠️ Initial auto-connection to $CONNECT failed. Will proceed without connection."
        sleep 5 # Give connection time to establish
        nordvpn status # Show status after attempt
    else
        echo "ℹ️ No default connection target (CONNECT env var was empty or not set)."
        echo "💡 VPN is NOT automatically connected by this entrypoint script."
        echo "   The MCP server is expected to manage VPN connections (connect/disconnect tools)."
    fi
    echo "✅ NordVPN settings applied."
else
    echo "⚠️ Not authenticated. VPN settings skipped. VPN cannot be used until login is complete."
fi

echo ""
echo "🎉 NordVPN CLI container setup process complete."
echo "   Prowlarr & FlareSolverr will use VPN when it's connected via MCP server tools."
echo "   MCP Server should now be able to control VPN connection state."

# Keep the container running and periodically log current status for easier debugging
# This loop is mostly for observational purposes.
# Actual connect/disconnect should be driven by mcp-server.
LAST_STATUS_CHECK_TS=0
STATUS_CHECK_INTERVAL=300 # 5 minutes

while true; do
    CURRENT_TS=$(date +%s)
    if (( CURRENT_TS - LAST_STATUS_CHECK_TS > STATUS_CHECK_INTERVAL )); then
        if nordvpn account >/dev/null 2>&1; then
            # Get concise status without spamming logs too much
            VPN_CLI_STATUS_LINE=$(nordvpn status | grep "Status:")
            if [[ -n "$VPN_CLI_STATUS_LINE" ]]; then
                echo "ℹ️ $(date): NordVPN Status: ${VPN_CLI_STATUS_LINE}"
            else
                echo "⚠️ $(date): Could not get NordVPN status line (is it connected?)."
            fi
        else
            echo "🔑 $(date): NordVPN is not logged in. Please complete browser authentication."
        fi
        LAST_STATUS_CHECK_TS=$CURRENT_TS
    fi
    sleep 60 # Sleep for a minute before checking time for next status log
done
