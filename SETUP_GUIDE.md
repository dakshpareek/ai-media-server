# AI Media Server - Complete Setup Guide

## 🚀 Quick Start (Fixed Version)

Your AI Media Server code has been fixed and is ready for deployment! Here's what was resolved:

### ✅ Issues Fixed
1. **Missing .env file** - Created with all required environment variables
2. **Git tracking verified** - All Docker build contexts are properly tracked
3. **MCP server confirmed** - All TypeScript source files exist and ready
4. **Documentation created** - Structured docs in `2025-01-14/ai-media-server-fixes/`

## 📋 Pre-Deployment Checklist

### 1. Update Environment Variables
**CRITICAL**: Edit the `.env` file with your actual credentials:

```bash
# Edit these lines in .env file:
NORDVPN_USER=your_actual_nordvpn_email@domain.com
NORDVPN_PASS=your_actual_nordvpn_password
```

### 2. Get Prowlarr API Key (After First Run)
After Prowlarr starts, get the API key from:
- Web UI: `http://your-server:9696`
- Settings → General → API Key
- Update `.env` file: `PROWLARR_API_KEY=your_actual_api_key`

## 🚢 Deployment Steps

### Step 1: Push to Remote Server
```bash
# Commit and push the fixes
git add .
git commit -m "Fix: Add missing .env file and documentation"
git push origin main
```

### Step 2: Deploy on Remote Server
```bash
# SSH into your remote server
ssh your-server

# Navigate to project directory
cd ai-media-server

# Pull latest changes
git pull origin main

# Update .env with real credentials
nano .env

# Deploy the stack
docker-compose up -d

# Check container status
docker-compose ps
```

### Step 3: Verify VPN Connection
```bash
# Check VPN status
docker exec nordvpn_official nordvpn status

# Check VPN IP
docker exec nordvpn_official curl ifconfig.me
```

### Step 4: Test MCP Server
```bash
# Test MCP server accessibility
docker exec -i ai_media_mcp_server npm run mcp

# Should respond with MCP protocol initialization
```

## 🔧 Configure Claude Desktop

Add this to your Claude Desktop MCP configuration:

```json
{
  "mcpServers": {
    "ai-media-server": {
      "command": "ssh",
      "args": [
        "your-server",
        "docker exec -i ai_media_mcp_server npm run mcp"
      ]
    }
  }
}
```

## 🧪 Testing the System

### 1. VPN Management
```bash
# In Claude Desktop, test these MCP tools:
# - prowlarr_vpn_status
# - prowlarr_vpn_connect
# - prowlarr_vpn_disconnect
```

### 2. Search & Download
```bash
# Test Prowlarr search:
# - prowlarr_search (query: "batman")
# - prowlarr_intelligent_search (auto-connects VPN)
# - prowlarr_grab_release (download content)
```

### 3. Web UIs
- **Prowlarr**: `http://your-server:9696`
- **qBittorrent**: `http://your-server:8080`
- **Radarr**: `http://your-server:7878`
- **Overseerr**: `http://your-server:5055`
- **FileBrowser**: `http://your-server:8081`

## 🔍 Troubleshooting

### Container Issues
```bash
# Check logs
docker-compose logs nordvpn
docker-compose logs mcp-server
docker-compose logs prowlarr

# Restart specific service
docker-compose restart nordvpn
```

### VPN Issues
```bash
# Check VPN connection
docker exec nordvpn_official nordvpn status

# Reconnect VPN
docker exec nordvpn_official nordvpn connect
```

### MCP Issues
```bash
# Test MCP server directly
docker exec -i ai_media_mcp_server npm run mcp

# Check MCP server logs
docker-compose logs mcp-server
```

## 📁 Project Structure
```
ai-media-server/
├── .env                    # Environment variables (created)
├── .env.example           # Template (created)
├── docker-compose.yml     # Main stack definition
├── docker/
│   └── nordvpn-cli/      # NordVPN container (verified)
├── mcp-server/
│   └── src/              # MCP server source (verified)
└── 2025-01-14/
    └── ai-media-server-fixes/  # Documentation (created)
```

## 🎯 Success Criteria

Your system is working correctly when:

1. ✅ All Docker containers are running
2. ✅ VPN connection is established
3. ✅ MCP server responds to stdio commands
4. ✅ Prowlarr can search indexers
5. ✅ qBittorrent can download content
6. ✅ Manual VPN disconnect doesn't auto-reconnect

## 📚 Documentation

Detailed documentation is available in:
- `2025-01-14/ai-media-server-fixes/DECISIONS.md` - All decisions made
- `2025-01-14/ai-media-server-fixes/ARCHITECTURE.md` - System architecture
- `2025-01-14/ai-media-server-fixes/IMPLEMENTATION_PLAN.md` - Deployment plan
- `2025-01-14/ai-media-server-fixes/NOTES.md` - Technical insights and debugging

## 🆘 Need Help?

If you encounter issues:
1. Check the troubleshooting section above
2. Review the logs with `docker-compose logs [service]`
3. Verify your `.env` file has correct credentials
4. Ensure all required ports are available

Your AI Media Server is now ready for deployment! 🎉 