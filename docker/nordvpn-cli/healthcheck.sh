#!/bin/bash
set -e

# Check if nordvpnd is running
if ! pgrep -x "nordvpnd" > /dev/null; then
    echo "❌ NordVPN daemon (nordvpnd) not running."
    exit 1
fi

# The container is "healthy" if the daemon is running.
# Login status and VPN connection status are managed/checked by applications/user.
echo "✅ NordVPN daemon running. Container is operational for CLI commands."
exit 0
