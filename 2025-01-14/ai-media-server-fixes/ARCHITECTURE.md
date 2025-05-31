# AI Media Server - Fixed Architecture Overview

## Current Architecture (Updated: 2025-01-14)

### Core Components
- **NordVPN Container**: Official CLI container providing VPN tunnel
- **Prowlarr**: Indexer management (VPN protected, port 9696)
- **qBittorrent**: Download client (VPN protected, port 8080)
- **MCP Server**: Model Context Protocol server for Cursor IDE integration (VPN protected)
- **FlareSolverr**: CloudFlare bypass service (VPN protected)
- **Radarr**: Movie management (local network, port 7878)
- **Overseerr**: Request management (local network, port 5055)
- **FileBrowser**: File management (local network, port 8081)

### Network Architecture
```
┌─────────────────┐    ┌─────────────────┐
│   Cursor IDE    │────│  SSH + Docker   │
│  (Local Mac)    │    │  (Remote Server)│
└─────────────────┘    └─────────────────┘
                                │
                        ┌──────────────────┐
                        │   Docker Stack   │
                        └──────────────────┘
                                │
                    ┌───────────┴───────────┐
            ┌──────────────┐        ┌──────────────┐
            │ VPN Network  │        │Local Network │
            │              │        │              │
            │• Prowlarr    │        │• Radarr      │
            │• qBittorrent │        │• Overseerr   │
            │• MCP Server  │        │• FileBrowser │
            │• FlareSolverr│        │              │
            └──────────────┘        └──────────────┘
```

### Fixed Issues
1. **Environment Configuration**: Complete .env file with all required variables
2. **Git Tracking**: All Docker build contexts properly tracked
3. **MCP Integration**: Ready for stdio communication via Docker exec

## Integration Points (Referenced from DECISIONS.md)

### Environment Variables (2025-01-14 14:30)
- **NordVPN**: NORDVPN_USER, NORDVPN_PASS required for VPN functionality
- **Prowlarr**: PROWLARR_API_KEY for MCP server communication
- **Ports**: Configurable service ports with sensible defaults
- **User/Group**: PUID/PGID for proper file permissions

### Docker Build Context (2025-01-14 14:35)
- **NordVPN CLI**: `docker/nordvpn-cli/` contains Dockerfile, entrypoint.sh, healthcheck.sh
- **MCP Server**: `mcp-server/` contains TypeScript source and package.json

### MCP Communication (2025-01-14 14:45)
- **Protocol**: stdio transport (not HTTP)
- **Command**: `docker exec -i ai_media_mcp_server npm run mcp`
- **Tools**: VPN management, Prowlarr search, intelligent search with auto-VPN 