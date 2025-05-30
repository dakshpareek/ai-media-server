# AI Media Server - Architecture Overview

## Current Architecture (Updated: 2025-01-14)

### **System Status: Partially Deployed ⚠️**

```
┌─────────────────────────────────────────────────────────────┐
│                     AI Media Server                        │
├─────────────────────────────────────────────────────────────┤
│  🤖 Future: MCP Server ←→ LLM (Claude, GPT, etc.)        │  [NOT IMPLEMENTED]
├─────────────────────────────────────────────────────────────┤
│  📋 Overseerr (Request Management)        ✅ RUNNING       │
│  🎬 Radarr (Movie Automation)             ⚠️ UNHEALTHY    │
│  🔍 Prowlarr (Indexer Management)         ✅ RUNNING       │
│  ⬇️  qBittorrent (Download Client)         ✅ RUNNING       │
│  📁 FileBrowser (File Management)         ❌ NOT STARTED  │
├─────────────────────────────────────────────────────────────┤
│  🌐 Cloudflared (Secure External Access)  ❌ RESTARTING   │
│  🐳 Docker Network (Service Communication) ✅ ESTABLISHED │
└─────────────────────────────────────────────────────────────┘
```

### **Deployed Services**

| Service | Status | Port | Container ID | Health |
|---------|--------|------|--------------|---------|
| **Overseerr** | ✅ Running | 5055 | fb71f5ed81b6 | Healthy |
| **Radarr** | ⚠️ Running | 7878 | 5ee958a6a80a | Unhealthy |
| **Prowlarr** | ✅ Running | 9696 | b15e2202abb3 | Healthy |
| **qBittorrent** | ✅ Running | 8080 | 7cef55cdcddb | Healthy |
| **FileBrowser** | ❌ Not Started | 8081 | - | - |
| **Cloudflared** | ❌ Restarting | - | 2f80e19d5598 | Failing |

### **Configuration State**

- **Environment**: ✅ Properly configured (.env file exists with correct paths)
- **Permissions**: ✅ PUID=501, PGID=20 (matching system user)
- **Storage Structure**: ✅ All required directories created
- **Network**: ✅ Docker network `media_network` established
- **API Keys**: ❌ Not yet configured (empty in .env)

### **File System Structure**

```
/Users/dakshpareek/personal-projects/ai-media-server/
├── config/          ✅ Service configurations
│   ├── overseerr/   ✅ Active
│   ├── radarr/      ✅ Active
│   ├── prowlarr/    ✅ Active
│   ├── qbittorrent/ ✅ Active
│   └── filebrowser/ ✅ Created
├── downloads/       ✅ Download staging area
├── media/           ✅ Organized media library
├── logs/            ✅ Service logs
└── cloudflared/     ⚠️ Tunnel configuration issues
```

## Reasoning

- **Microservices Architecture**: Enables independent scaling and maintenance of each component
- **Containerization**: Ensures consistent deployment and isolation
- **Data Persistence**: Host-mounted volumes preserve configuration and media across container restarts
- **Network Isolation**: Custom Docker network enables secure inter-service communication

## Issues Identified

1. **Radarr Unhealthy**: Likely configuration or dependency issue
2. **Cloudflared Failing**: Tunnel authentication or configuration problem
3. **FileBrowser Missing**: Service not included in current deployment
4. **API Keys Empty**: Services not yet interconnected

## References
- Architecture decisions: DECISIONS.md (2025-01-14)
- Implementation needs: IMPLEMENTATION_PLAN.md 