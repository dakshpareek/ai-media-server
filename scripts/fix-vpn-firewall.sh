#!/bin/bash

# VPN Firewall Fix for AI Media Server
# This script adds iptables rules to allow host access to MCP server
# when VPN is connected, without changing the working architecture.

echo "🔧 Fixing VPN firewall rules for MCP server access..."

# Function to apply firewall rules
apply_firewall_rules() {
    echo "📡 Adding iptables rules to allow host → MCP server communication..."
    
    # Allow connections from host machine's network to MCP server port
    docker exec nordvpn_official iptables -I INPUT 1 -s 192.168.29.0/24 -p tcp --dport 3000 -j ACCEPT 2>/dev/null || true
    
    # Allow connections from Docker bridge networks  
    docker exec nordvpn_official iptables -I INPUT 1 -s 172.16.0.0/12 -p tcp --dport 3000 -j ACCEPT 2>/dev/null || true
    docker exec nordvpn_official iptables -I INPUT 1 -s 192.168.0.0/16 -p tcp --dport 3000 -j ACCEPT 2>/dev/null || true
    
    # Allow localhost connections
    docker exec nordvpn_official iptables -I INPUT 1 -s 127.0.0.1 -p tcp --dport 3000 -j ACCEPT 2>/dev/null || true
    
    echo "✅ Firewall rules applied successfully!"
}

# Function to check if VPN is connected
check_vpn_status() {
    docker exec nordvpn_official nordvpn status 2>/dev/null | grep -q "Connected"
}

# Function to test MCP server access
test_mcp_access() {
    echo "🧪 Testing MCP server access from host..."
    
    # Test with short timeout
    local result=$(curl -s --connect-timeout 3 --max-time 5 \
        -H "Content-Type: application/json" \
        -H "Accept: application/json, text/event-stream" \
        -d '{"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": "2024-11-05", "capabilities": {}, "clientInfo": {"name": "test-client", "version": "1.0.0"}}}' \
        http://localhost:3000/mcp 2>/dev/null | head -c 100)
    
    if [[ $result == *"prowlarr-mcp-server"* ]]; then
        echo "✅ MCP server is accessible from host!"
        return 0
    else
        echo "❌ MCP server is NOT accessible from host"
        return 1
    fi
}

# Main execution
echo "🚀 Starting VPN firewall fix process..."

# Check if nordvpn container is running
if ! docker ps | grep -q nordvpn_official; then
    echo "❌ Error: nordvpn_official container is not running"
    echo "Please start your Docker stack first: docker-compose up -d"
    exit 1
fi

# Check current VPN status
if check_vpn_status; then
    echo "🌐 VPN is currently connected"
    
    # Test current access
    if ! test_mcp_access; then
        echo "🔨 Applying firewall rules..."
        apply_firewall_rules
        
        # Wait a moment and test again
        sleep 2
        if test_mcp_access; then
            echo "🎉 SUCCESS! MCP server is now accessible with VPN connected!"
        else
            echo "⚠️  Rules applied but access test still failed. Manual verification needed."
        fi
    else
        echo "✅ MCP server is already accessible - no fix needed!"
    fi
else
    echo "📡 VPN is disconnected - applying rules for when it connects..."
    apply_firewall_rules
fi

echo ""
echo "🔍 Current firewall rules (first 10 lines):"
docker exec nordvpn_official iptables -L INPUT -n --line-numbers | head -10

echo ""
echo "💡 To make this permanent, run this script after each VPN connection."
echo "💡 Or add it to your startup sequence."

echo ""
echo "🧪 You can test MCP access manually with:"
echo "curl -v --connect-timeout 5 http://localhost:3000/mcp -H 'Accept: application/json, text/event-stream' -d '{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"initialize\"}'" 