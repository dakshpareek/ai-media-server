# AI-Powered Media Server - Architecture Overview

## Current Architecture (Updated: 2025-01-28)

### **System Design Philosophy**
- **Microservices**: Each component runs in isolated Docker containers
- **API-First**: All services expose REST APIs for integration
- **Event-Driven**: Services communicate through APIs and shared data
- **AI-Ready**: Designed for MCP server integration and LLM interaction

### **Core Service Layer**

#### **Request Management**
- **Overseerr** (`overseerr:5055`)
  - Media request interface and approval workflow
  - User management and permissions
  - Integration hub for Radarr/Sonarr

#### **Automation Layer**
- **Radarr** (`radarr:7878`)
  - Movie collection management
  - Quality profile enforcement
  - Download monitoring and post-processing

#### **Search & Indexing**
- **Prowlarr** (`prowlarr:9696`)
  - Unified indexer management
  - Search result aggregation
  - API proxy for multiple trackers

#### **Download Management**
- **qBittorrent** (`qbittorrent:8080`)
  - Torrent download client
  - Web interface and API
  - Category-based organization

#### **File Management**
- **FileBrowser** (`filebrowser:8081`)
  - Web-based file system access
  - Direct file manipulation
  - Preview and sharing capabilities

### **Integration Layer**

#### **Network Architecture**
```
External Internet
       ↓
Cloudflared Tunnel
       ↓
Docker Network (media_network)
       ↓
┌─────────────────────────────────────┐
│  Service Mesh (Internal APIs)      │
│  ┌─────────┐ ┌─────────┐ ┌───────┐ │
│  │Overseerr│ │ Radarr  │ │Prowlar│ │
│  │  :5055  │ │ :7878   │ │ :9696 │ │
│  └─────────┘ └─────────┘ └───────┘ │
│  ┌─────────┐ ┌─────────────────────┐ │
│  │qBittorr │ │   FileBrowser       │ │
│  │ :8080   │ │      :8081          │ │
│  └─────────┘ └─────────────────────┘ │
└─────────────────────────────────────┘
       ↓
Shared Storage Volumes
```

### **Data Flow Architecture**

#### **Standard Media Request Flow**
```
1. User Request → Overseerr UI
2. Overseerr → Radarr (add movie)
3. Radarr → Prowlarr (search indexers)
4. Prowlarr → Multiple Indexers (search)
5. Radarr → qBittorrent (download best match)
6. qBittorrent → Download completion
7. Radarr → Post-processing & organization
8. FileBrowser → Access completed files
```

#### **Future AI-Enhanced Flow**
```
1. LLM Request → MCP Server
2. MCP Server → Parse natural language
3. MCP Server → Overseerr API (create request)
4. [Standard flow continues...]
5. MCP Server → Monitor progress
6. MCP Server → Report status to LLM
```

### **Security & Access**

#### **Internal Communication**
- Services communicate via Docker network
- API keys for service-to-service authentication
- No external ports exposed (except through Cloudflared)

#### **External Access**
- Cloudflared tunnels provide secure HTTPS access
- Each service accessible via subdomain
- Authentication handled by individual services

### **Data Persistence**

#### **Volume Strategy**
```
/media-server/
├── config/          # Service configurations
│   ├── radarr/
│   ├── prowlarr/
│   ├── overseerr/
│   └── qbittorrent/
├── downloads/       # Active downloads
├── media/          # Organized media library
│   └── movies/
└── logs/           # Service logs
```

---

## Future Enhancements

### **MCP Server Integration**
- Custom Node.js/Python service
- RESTful API bridge to media services
- Natural language processing capabilities
- Real-time status monitoring

### **Advanced AI Features**
- Intelligent quality selection
- Content recommendation engine
- Automated approval workflows
- Smart download scheduling 