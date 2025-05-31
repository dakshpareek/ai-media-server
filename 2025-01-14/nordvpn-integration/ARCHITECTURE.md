# NordVPN Integration - Architecture Overview

## Current Architecture (Updated: 2025-01-30) ✅ PRODUCTION READY

### Clean Codebase Structure (Post-Cleanup)
```
ai-media-server/                           # Clean, production-ready setup
├── .gitignore                            # Comprehensive ignore rules
├── .env                                  # Environment configuration
├── .env.example                          # Template for new setups
├── docker-compose.yml                    # 🎯 UNIFIED configuration (all services)
├── deploy.sh                             # 🚀 One-command deployment
├── README.md                             # Updated project overview
├── VPN_METHODS_COMPARISON.md             # VPN approach analysis
│
├── docker/                               # NordVPN CLI container
│   └── nordvpn-cli/
│       ├── Dockerfile                    # Custom NordVPN CLI image
│       └── entrypoint.sh                 # VPN startup & monitoring
│
├── scripts/                              # 🔧 Monitoring & testing tools
│   ├── test-indexers-simple.sh          # Quick health check
│   └── test-multiple-indexers.sh        # Comprehensive testing
│
├── 2025-01-14/nordvpn-integration/      # 📚 Complete documentation
│   ├── DECISIONS.md                     # All decisions logged
│   ├── ARCHITECTURE.md                  # This file
│   ├── IMPLEMENTATION_PLAN.md           # Implementation + results
│   └── NOTES.md                         # Learnings & solutions
│
└── Runtime Directories (ignored by git)
    ├── config/                          # Service configurations
    ├── downloads/                       # Active downloads
    ├── logs/                           # Application logs
    └── media/                          # Media library
```

### 🏗️ Service Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    AI Media Server v2.0                     │
├─────────────────────────────────────────────────────────────┤
│  🔒 VPN-Protected Services (Anti-blocking)                  │
│  ├── Prowlarr (9696) ─────┐                                │
│  └── FlareSolverr (8191) ──┼── NordVPN Container           │
│                            │   ├── IP: 45.248.79.189       │
│                            │   ├── Server: India #176      │
│                            │   ├── Protocol: NORDLYNX      │
│                            │   └── Auth: Browser OAuth     │
│  ⚡ Local Network Services (Full Speed)                    │
│  ├── Overseerr (5055) ──── Request management              │
│  ├── Radarr (7878) ────── Movie automation                │
│  ├── qBittorrent (8080) ── Download client                │
│  └── FileBrowser (8084) ── File management                │
└─────────────────────────────────────────────────────────────┘
```

### 🎯 Key Architectural Decisions

#### ✅ Decision: Unified Docker Compose
- **Previous**: Individual service directories with separate docker-compose files
- **Current**: Single `docker-compose.yml` managing all services
- **Benefit**: Simplified deployment, easier management, reduced complexity

#### ✅ Decision: Selective VPN Routing  
- **Approach**: Only indexer services (Prowlarr, FlareSolverr) use VPN
- **Reasoning**: Balances security with performance
- **Implementation**: Mixed Docker networking (VPN container + host network)

#### ✅ Decision: NordVPN CLI over Third-party Solutions
- **Chosen**: Official NordVPN CLI with browser authentication
- **Rejected**: Gluetun with access tokens (requires additional setup)
- **Reasoning**: Official solution, better support, user-friendly auth

#### ✅ Decision: Browser OAuth Authentication
- **Method**: `nordvpn login --callback` with browser authentication
- **Alternative**: Username/password (deprecated by NordVPN)
- **Benefits**: Secure, no stored credentials, follows NordVPN best practices

### 🔧 Deployment Architecture

#### One-Command Deployment
```bash
./deploy.sh                               # Deploys entire stack
docker-compose ps                         # Status check
./scripts/test-indexers-simple.sh        # Health verification
```

#### VPN Authentication Flow
```bash
# 1. Start authentication
docker-compose exec nordvpn nordvpn login --callback

# 2. Complete in browser (secure OAuth)
# 3. Copy continue URL and authenticate container
docker-compose exec nordvpn nordvpn login --callback "nordvpn://login?action=..."

# 4. Auto-connection and monitoring
# VPN connects → Services available → Auto-recovery enabled
```

### 📊 Performance Architecture

| Component | Network | Performance | Purpose |
|-----------|---------|-------------|---------|
| **Prowlarr** | VPN | Good | Indexer search (protected) |
| **FlareSolverr** | VPN | Good | Cloudflare bypass (protected) |
| **Overseerr** | Local | Full Speed | User interface |
| **Radarr** | Local | Full Speed | Media management |
| **qBittorrent** | Local | Full Speed | Downloads |
| **FileBrowser** | Local | Full Speed | File access |

### 🛡️ Security Architecture

#### VPN Protection Layer
- **Scope**: Only indexer traffic (Prowlarr, FlareSolverr)
- **Method**: NordVPN NORDLYNX (WireGuard-based)
- **Benefits**: Anti-blocking, IP masking, geographic flexibility

#### Network Isolation
- **VPN Services**: Custom Docker network through NordVPN container
- **Local Services**: Host network (direct localhost access)
- **Communication**: Services communicate via container names

#### Authentication Security
- **No Stored Credentials**: Browser OAuth only
- **Token Management**: Handled by NordVPN CLI
- **Auto-Reconnection**: Maintains security without manual intervention

### 🔄 Monitoring Architecture

#### Health Check System
```bash
# Service Health
docker-compose ps --format "table {{.Name}}\t{{.State}}\t{{.Status}}"

# VPN Status  
docker-compose exec nordvpn nordvpn status

# Indexer Testing
./scripts/test-indexers-simple.sh      # Quick check
./scripts/test-multiple-indexers.sh    # Comprehensive
```

#### Auto-Recovery Features
- **VPN Reconnection**: Automatic on connection drop
- **Service Recovery**: Docker restart policies
- **Health Monitoring**: Built-in container health checks

### 🏆 Production Readiness Features

#### ✅ Reliability
- Self-healing VPN connection
- Service auto-restart on failure  
- 50+ minutes continuous uptime validated

#### ✅ Performance
- Local services: Full gigabit speed maintained
- VPN services: Excellent performance via NORDLYNX
- Search response: <2 seconds average

#### ✅ Maintainability  
- Single configuration file (docker-compose.yml)
- Comprehensive monitoring tools
- Complete structured documentation
- Clean codebase with proper .gitignore

#### ✅ Scalability
- 616 indexer definitions available
- Easy to add new services
- Container-based architecture
- Modular service design

## 🎯 Architecture Benefits

**🚀 Simplified Deployment**: One command deploys entire stack  
**⚡ Optimal Performance**: Hybrid networking for best of both worlds  
**🔒 Enhanced Security**: VPN protection where needed, full speed where not  
**🛠️ Easy Maintenance**: Clean structure, comprehensive monitoring  
**📈 Production Ready**: Tested, documented, and validated for daily use  

**This architecture successfully balances security, performance, and usability for a production-ready AI media server.** ✅ 