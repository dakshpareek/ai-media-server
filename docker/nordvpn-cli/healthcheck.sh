#!/bin/bash

# Check if nordvpn daemon is running
if ! pgrep -x "nordvpnd" > /dev/null; then
    echo "❌ NordVPN daemon not running"
    exit 1
fi

# Check VPN connection status
status=$(nordvpn status 2>/dev/null || echo "disconnected")

if echo "$status" | grep -q "Connected"; then
    echo "✅ VPN connected"
    exit 0
else
    echo "❌ VPN not connected: $status"
    exit 1
fi 