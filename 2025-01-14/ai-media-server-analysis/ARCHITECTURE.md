# AI Media Server - Architecture Overview

## Current Architecture (Updated: 2025-01-14 15:30)

### **VPN-Integrated Microservices Architecture**

```
┌─────────────────────────────────────────────────────────────┐
│                    DOCKER NETWORK                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────┐    ┌─────────────────────────────────┐ │
│  │   VPN GATEWAY   │    │      LOCAL SERVICES             │ │
│  │   (Gluetun)     │    │                                 │ │
│  │                 │    │  ┌─────────────────────────────┐ │ │
│  │ ┌─────────────┐ │    │  │ Radarr (Movies)     :7878  │ │ │
│  │ │ Prowlarr    │ │    │  │ Overseerr (Requests):5055  │ │ │
│  │ │ :9696       │ │    │  │ qBittorrent (DL)    :8080  │ │ │
│  │ └─────────────┘ │    │  │ FileBrowser (Files) :8081  │ │ │
│  │                 │    │  └─────────────────────────────┘ │ │
│  │ ┌─────────────┐ │    └─────────────────────────────────┐ │
│  │ │FlareSolverr │ │                                      │ │
│  │ │ :8191       │ │                                      │ │
│  │ └─────────────┘ │                                      │ │
│  │                 │                                      │ │
│  │    NordVPN      │                                      │ │
│  │   Connection    │                                      │ │
│  └─────────────────┘                                      │ │
│           │                                               │ │
└───────────┼───────────────────────────────────────────────┘ │
            │                                                 │
            ▼                                                 │
    ┌─────────────────┐                                      │
    │   INTERNET      │                                      │
    │   INDEXERS      │                                      │
    │                 │                                      │
    │  • 1337x        │◄─────────────────────────────────────┘
    │  • YTS          │
    │  • EZTV         │
    │  • Others       │
    └─────────────────┘
```

### **Service Categories**

#### **🔒 VPN-Protected Services (Critical for Indexing)**
- **VPN Gateway (Gluetun)**: NordVPN connection with US P2P servers
- **Prowlarr**: Indexer management (protected from blocking)
- **FlareSolverr**: CloudFlare bypass service

#### **🏠 Local Network Services (Performance Optimized)**
- **Radarr**: Movie management and automation
- **Overseerr**: User-friendly request interface
- **qBittorrent**: Download client (already configured)
- **FileBrowser**: File and media management

### **Data Flow Architecture**

```
User Request → Overseerr → Radarr → Prowlarr (VPN) → Indexers
                    ↓         ↓         ↓
                Media DB → qBittorrent ← Search Results
                    ↓
                File Organization → Media Library
```

### **Security & Network Design**

1. **Network Segmentation**: VPN services isolated from local services
2. **Traffic Routing**: Only indexer traffic through VPN
3. **Performance**: Media services on local network for speed
4. **Protection**: Indexers protected from ISP/site blocking

## Key Design Decisions

### **VPN Strategy**: Gluetun with NordVPN
- **Why**: More reliable than bubuntux/nordvpn
- **Configuration**: US P2P optimized servers
- **Services**: Only Prowlarr + FlareSolverr
- **Benefits**: Prevents indexer blocking while maintaining performance

### **Service Communication**
- **network_mode: "service:vpn"**: Shared network namespace
- **Health checks**: Ensure VPN is connected before starting dependent services
- **API Integration**: Services communicate via internal Docker networking

### **Port Management**
- **VPN Gateway**: Exposes ports 9696 (Prowlarr) and 8191 (FlareSolverr)
- **Local Services**: Direct port mapping for performance
- **No Conflicts**: Clean separation between VPN and local services

## Previous Architecture (Deprecated)

- **Manual Configuration** approach (see DECISIONS.md on 2025-01-14 10:01)
- **Non-VPN Setup** (blocked indexers, see DECISIONS.md on 2025-01-14 15:20) 