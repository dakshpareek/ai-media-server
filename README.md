# 🤖 AI-Powered Media Server

**An intelligent, automated media server with LLM integration via MCP (Model Context Protocol)**

Transform your media consumption with natural language requests: *"Download the latest Marvel movie in 4K"* and watch as your AI assistant handles the entire pipeline automatically.

---

## 🌟 **What Makes This Special?**

This isn't just another media server—it's the **future of content automation**:

- 🧠 **AI-First Design**: Natural language movie requests via LLM integration
- 🔄 **Complete Automation**: Request → Search → Download → Organize
- 🐳 **Docker Native**: Easy deployment and replication
- 🌐 **Cloud Ready**: Secure external access via Cloudflared
- 📡 **MCP Protocol**: Built for next-generation AI assistants

---

## 🏗️ **Architecture Overview**

```
┌─────────────────────────────────────────────────────────────┐
│                     AI Media Server                        │
├─────────────────────────────────────────────────────────────┤
│  🤖 Future: MCP Server ←→ LLM (Claude, GPT, etc.)        │
├─────────────────────────────────────────────────────────────┤
│  📋 Overseerr (Request Management)                         │
│  🎬 Radarr (Movie Automation)                              │
│  🔍 Prowlarr (Indexer Management)                          │
│  ⬇️  qBittorrent (Download Client)                         │
│  📁 FileBrowser (File Management)                          │
├─────────────────────────────────────────────────────────────┤
│  🌐 Cloudflared (Secure External Access)                   │
│  🐳 Docker Network (Service Communication)                 │
└─────────────────────────────────────────────────────────────┘
```

### **Component Overview**

| Service | Purpose | Port | API Endpoint |
|---------|---------|------|--------------|
| **Overseerr** | Request management & approval | 5055 | `/api/v1/` |
| **Radarr** | Movie automation & library | 7878 | `/api/v3/` |
| **Prowlarr** | Indexer management & search | 9696 | `/api/v1/` |
| **qBittorrent** | Download client | 8080 | `/api/v2/` |
| **FileBrowser** | File management | 8081 | `/api/` |

---

## 🚀 **Quick Start**

### **Prerequisites**
- Docker & Docker Compose
- 20GB+ free disk space
- Internet connection for indexers

### **1. Clone & Configure**
```bash
# If starting fresh in your media-server directory
cd /path/to/your/media-server

# Copy environment template
cp .env.example ai-media-server.env

# Edit configuration (IMPORTANT!)
nano ai-media-server.env
```

**⚠️ Critical: Update these values in `ai-media-server.env`:**
```bash
CONFIG_PATH=/absolute/path/to/your/media-server
CF_DOMAIN=yourdomain.com
PUID=1000  # Your user ID (run 'id' to check)
PGID=1000  # Your group ID
```

### **2. Deploy Everything**
```bash
# One command deployment!
./deploy.sh deploy
```

### **3. Access Services**
Once deployed, access your services at:
- **Overseerr**: http://localhost:5055 (Request movies here)
- **Radarr**: http://localhost:7878 (Movie management)
- **Prowlarr**: http://localhost:9696 (Search configuration)
- **qBittorrent**: http://localhost:8080 (Downloads)
- **FileBrowser**: http://localhost:8081 (File access)

---

## ⚙️ **Configuration Guide**

### **Phase 1: Core Services Setup (30 minutes)**

#### **1. qBittorrent Configuration**
```
URL: http://localhost:8080
Default Login: admin / adminpass

Setup Steps:
1. Change default password
2. Go to Tools → Options → Web UI
3. Enable "Bypass authentication for clients on localhost"
4. Set Categories: movies, tv, music
5. Configure download paths
```

#### **2. Prowlarr Configuration**
```
URL: http://localhost:9696

Setup Steps:
1. Complete initial setup wizard
2. Add indexers (Settings → Indexers)
   - Public: 1337x, RARBG, ThePirateBay
   - Private: Add your tracker accounts
3. Test indexers (should show green checkmarks)
4. Note the API Key (Settings → General)
```

#### **3. Radarr Configuration**
```
URL: http://localhost:7878

Setup Steps:
1. Add root folder: /media/movies
2. Add download client (qBittorrent):
   - Host: qbittorrent
   - Port: 8080
   - Category: movies
3. Add indexer (Prowlarr):
   - Host: prowlarr
   - Port: 9696
   - API Key: [from Prowlarr]
4. Configure quality profiles
5. Test connections
```

#### **4. Overseerr Configuration**
```
URL: http://localhost:5055

Setup Steps:
1. Complete initial setup
2. Connect to Radarr:
   - Host: radarr
   - Port: 7878
   - API Key: [from Radarr]
3. Configure user permissions
4. Set up approval workflows
5. Test by requesting a movie
```

### **Phase 2: Service Integration (15 minutes)**

Test the complete pipeline:
1. **Request**: Go to Overseerr, search for a movie
2. **Approve**: Approve the request (or set auto-approve)
3. **Monitor**: Watch Radarr pick it up automatically
4. **Search**: Prowlarr searches configured indexers
5. **Download**: qBittorrent starts downloading
6. **Organize**: Radarr moves completed files to library
7. **Access**: FileBrowser shows organized movies

---

## 🛠️ **Management Commands**

The deployment script provides easy management:

```bash
# Service Management
./deploy.sh status    # Check all services
./deploy.sh stop      # Stop all services
./deploy.sh restart   # Restart everything
./deploy.sh update    # Update to latest images

# Monitoring
./deploy.sh logs              # All service logs
./deploy.sh logs radarr       # Specific service logs

# Maintenance
./deploy.sh clean     # Remove containers (keep data)
```

---

## 🌐 **External Access Setup**

### **Cloudflared Tunnel Configuration**

1. **Install Cloudflared** (on host machine):
```bash
# macOS
brew install cloudflared

# Linux
wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb
```

2. **Authenticate with Cloudflare**:
```bash
cloudflared tunnel login
```

3. **Create Tunnel**:
```bash
cloudflared tunnel create ai-media-server
```

4. **Configure DNS and Ingress**: Update your `.env` file with tunnel UUID and configure `cloudflared/config.yml`

---

## 🤖 **Future: MCP Server Integration**

The system is designed for **Phase 2** MCP server integration:

### **Planned AI Features**
- **Natural Language Requests**: *"Download the latest Christopher Nolan movie"*
- **Intelligent Preferences**: *"I prefer 4K releases with HDR"*
- **Status Monitoring**: *"What's downloading right now?"*
- **Smart Recommendations**: *"Suggest movies similar to Inception"*

### **MCP Server Architecture**
```javascript
// Example MCP interaction
{
  "request": "Download the latest Marvel movie in 4K",
  "parsed": {
    "action": "request_movie",
    "query": "latest Marvel movie",
    "quality": "4K",
    "priority": "normal"
  },
  "execution": [
    "Search TMDB for latest Marvel releases",
    "Create Overseerr request with 4K quality",
    "Monitor download progress",
    "Report completion status"
  ]
}
```

---

## 📊 **Monitoring & Maintenance**

### **Health Checks**
All services include health checks:
```bash
docker ps --filter "label=ai-media-server.service"
```

### **Storage Management**
Monitor disk usage:
```bash
du -sh ./downloads ./media ./config ./logs
```

### **Backup Strategy**
Critical data to backup:
- `./config/` - All service configurations
- `./media/` - Your media library
- Environment files and API keys

---

## 🛡️ **Security Best Practices**

1. **API Keys**: Store securely, rotate regularly
2. **Network Access**: Use Cloudflared, avoid direct port exposure
3. **User Permissions**: Configure proper Overseerr user roles
4. **File Permissions**: Ensure correct PUID/PGID settings
5. **Updates**: Regular security updates for all services

---

## 🔧 **Troubleshooting**

### **Common Issues**

**Services won't start:**
```bash
# Check Docker daemon
docker info

# Check network
docker network ls | grep media_network

# Check logs
./deploy.sh logs [service]
```

**Permission errors:**
```bash
# Check PUID/PGID in .env file
id

# Fix ownership
sudo chown -R $USER:$USER ./config ./downloads ./media
```

**API connections failing:**
```bash
# Test internal networking
docker exec ai_media_radarr ping prowlarr
docker exec ai_media_radarr curl http://qbittorrent:8080
```

### **Service-Specific Issues**

| Issue | Service | Solution |
|-------|---------|----------|
| Can't add movies | Radarr | Check Prowlarr connection and indexers |
| Downloads not starting | qBittorrent | Verify Radarr download client config |
| Requests not working | Overseerr | Confirm Radarr API key and connection |
| Files not organizing | Radarr | Check root folder and file permissions |

---

## 📈 **Performance Optimization**

### **Resource Requirements**
- **Minimum**: 4GB RAM, 2 CPU cores, 100GB storage
- **Recommended**: 8GB RAM, 4 CPU cores, 1TB+ storage
- **Network**: Stable internet, VPN recommended for privacy

### **Optimization Tips**
1. **SSD Storage**: Use SSD for Docker volumes and configs
2. **Network Tuning**: Configure qBittorrent connection limits
3. **Indexer Management**: Use quality indexers, avoid rate limits
4. **Download Scheduling**: Configure download hours in qBittorrent

---

## 🎯 **Roadmap**

### **Phase 1: Core Infrastructure** ✅
- [x] Docker-based deployment
- [x] Service integration
- [x] Web interfaces
- [x] Automated pipeline

### **Phase 2: AI Integration** 🚧
- [ ] MCP server development
- [ ] Natural language processing
- [ ] LLM client integration
- [ ] Conversation workflows

### **Phase 3: Advanced Features** 📋
- [ ] Mobile app
- [ ] Voice commands
- [ ] ML-based recommendations
- [ ] Multi-user management

---

## 🤝 **Contributing**

We welcome contributions! Areas where help is needed:

1. **MCP Server Development** - Python/Node.js developers
2. **Documentation** - Usage guides and troubleshooting
3. **Testing** - Multi-platform deployment testing
4. **Features** - New integrations and automations

---

## 📄 **License & Credits**

This project builds upon excellent open-source software:
- [Radarr](https://radarr.video/) - Movie collection management
- [Prowlarr](https://prowlarr.com/) - Indexer management
- [Overseerr](https://overseerr.dev/) - Request management
- [qBittorrent](https://www.qbittorrent.org/) - Download client
- [FileBrowser](https://filebrowser.org/) - File management

---

## 💡 **Support**

- **Documentation**: See `./2025-01-28/ai-media-server/` for detailed docs
- **Issues**: Check troubleshooting section first
- **Community**: Share your MCP integration ideas!

---

**🎬 Ready to revolutionize your media server with AI? Start with `./deploy.sh deploy`!** 