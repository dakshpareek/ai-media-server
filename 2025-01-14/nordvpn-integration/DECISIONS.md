# NordVPN Integration - Decision Log

## ✅ Current Agreed Decisions (Updated: 2025-01-14)

- **VPN Solution**: Official NordVPN CLI with browser authentication
- **Authentication Method**: Interactive browser authentication (not username/password)
- **Protected Services**: Prowlarr + FlareSolverr only
- **Local Services**: Overseerr, Radarr, qBittorrent, FileBrowser (better performance)
- **Technology**: NordLynx (WireGuard-based, fastest)

---

## 📌 Decision History

### 📅 2025-01-14 14:30
- **Decision**: Use Official NordVPN CLI container instead of Gluetun
- **Reasoning**: 
  - Works with existing user credentials (no tokens needed)
  - Official support from NordVPN
  - Modern browser authentication
  - Production-ready with auto-reconnection
- **Previous Decision**: Gluetun + Access Token approach

### 📅 2025-01-14 14:45
- **Decision**: Implement interactive browser authentication
- **Reasoning**: 
  - NordVPN CLI deprecated username/password authentication
  - Browser auth is secure and modern
  - Works seamlessly with existing credentials
- **Previous Decision**: Direct username/password authentication

### 📅 2025-01-14 15:00
- **Decision**: Protect only Prowlarr and FlareSolverr via VPN
- **Reasoning**: 
  - Indexers need protection from blocking
  - CloudFlare bypass requires VPN
  - Other services work better on local network for performance
- **Previous Decision**: All services through VPN

### 📅 2025-01-14 15:15
- **Decision**: Clean up alternative solutions and make this production-ready
- **Reasoning**: 
  - User confirmed browser authentication works
  - Option B proven to be the better solution
  - Simplify deployment and maintenance
- **Previous Decision**: Keep multiple options available 