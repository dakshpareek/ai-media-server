# AI-Powered Media Server - Decision Log

## ✅ Current Agreed Decisions (Updated: 2025-01-28)

- **Architecture**: Microservices with Docker containers, unified by `media_network`
- **Core Stack**: Overseerr + Radarr + Prowlarr + qBittorrent + FileBrowser
- **AI Integration**: Custom MCP Server for LLM communication
- **Reverse Proxy**: Cloudflared tunnels for secure external access
- **Deployment**: Docker Compose modular setup for easy replication
- **Data Management**: Persistent volumes with environment-based configuration
- **Security**: API key management, user approval workflows

---

## 📌 Decision History

### 📅 2025-01-28 14:30
- **Decision**: AI-first media server with MCP protocol integration
- **Reasoning**: Enable natural language media requests through LLMs, future-proof automation
- **Key Components**: 
  - Overseerr for request management and UI
  - Radarr for movie automation and collection management
  - Prowlarr for unified indexer management
  - qBittorrent as download client with web API
  - FileBrowser for file system access

### 📅 2025-01-28 14:45
- **Decision**: Modular Docker Compose structure
- **Reasoning**: Each service in separate compose file for maintainability, shared network for communication
- **Structure**: 
  ```
  media-server/
  ├── docker-compose.yml (main network + cloudflared)
  ├── qbittorrent/docker-compose.yml
  ├── radarr/docker-compose.yml
  ├── prowlarr/docker-compose.yml
  ├── overseerr/docker-compose.yml
  ├── filebrowser/docker-compose.yml
  └── mcp-server/docker-compose.yml (future)
  ```

### 📅 2025-01-28 14:50
- **Decision**: Environment variable centralization
- **Reasoning**: Consistent configuration management, easy deployment replication
- **Implementation**: Root `.env` file with service-specific overrides where needed 