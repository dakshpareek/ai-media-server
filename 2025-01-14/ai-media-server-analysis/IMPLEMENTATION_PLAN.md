# AI Media Server - Implementation Plan (TDD)

## Current Phase: Hybrid Configuration Approach ✅

### **✅ COMPLETED: Core Automation & API Integration**

#### **Phase 1: qBittorrent Setup - ✅ COMPLETED**
- [x] ~~Automated credential setup: admin / ai_media_2024~~
- [x] ~~Download categories: movies, tv, music~~
- [x] ~~Download paths: /downloads with /downloads/incomplete~~
- [x] ~~API integration tested and working~~

#### **Phase 2: Service Discovery & API Management - ✅ COMPLETED**
- [x] **API Key Extraction**: Successfully extracted working API keys from all services
  - Prowlarr: 44b56a79a82d4295a367713457e6b074 ✅
  - Radarr: a2758fa8e5bc4418936817baa313ccf8 ✅
- [x] **Environment Integration**: All API keys saved to .env file
- [x] **Service Connectivity**: All APIs tested and verified working
- [x] **Basic Configuration**: Radarr configured with root folder and download client

#### **Phase 3: Radarr Foundation - ✅ COMPLETED**
- [x] **Root Folder**: /media/movies configured
- [x] **Download Client**: qBittorrent connected and configured
- [x] **API Access**: Verified and working
- [x] **Ready for Integration**: Prepared for Prowlarr indexer connection

### **Current Status: Ready for Web-Based Configuration**

Our hybrid approach has successfully automated the complex backend configuration while leaving the intuitive frontend configuration for manual setup:

**✅ Automated (Complex Backend)**:
- API key extraction and management
- Service-to-service authentication
- Basic connectivity and folders
- Credential management

**⚠️ Manual (Intuitive Frontend)**:
- Indexer selection and configuration
- User account creation
- Service integration verification
- Quality profile preferences

### **Immediate Actions Required (Next 30 minutes)**

#### **Phase 4: Manual Web Interface Configuration**

**Step 1: Prowlarr Indexer Setup** (5 minutes)
- [ ] **Access**: http://localhost:9696
- [ ] **Add Indexers**: Select 2-3 public indexers
  - 1337x (movies)
  - YTS (movies)
  - EZTV (TV shows)
- [ ] **Test Connectivity**: Verify green checkmarks

**Step 2: Radarr Integration** (5 minutes)
- [ ] **Access**: http://localhost:7878
- [ ] **Add Indexer**: Settings → Indexers → Add → Torznab
  - Name: Prowlarr
  - URL: http://prowlarr:9696
  - API Key: `44b56a79a82d4295a367713457e6b074`
- [ ] **Test Connection**: Verify green checkmark

**Step 3: Overseerr Setup** (10 minutes)
- [ ] **Access**: http://localhost:5055
- [ ] **Initial Setup**: Create admin account if needed
- [ ] **Connect Radarr**: Settings → Services → Radarr
  - Host: radarr
  - Port: 7878
  - API Key: `a2758fa8e5bc4418936817baa313ccf8`
- [ ] **Test Integration**: Verify connection successful

**Step 4: End-to-End Testing** (10 minutes)
- [ ] **Request Test Movie**: Use Overseerr to request a popular movie
- [ ] **Verify Workflow**: 
  - Movie appears in Radarr
  - Search initiated via Prowlarr
  - Download starts in qBittorrent
  - File moved to /media/movies

### **Configuration Reference**

#### **Web Interface Access**
```
Overseerr:   http://localhost:5055  (request management)
Radarr:      http://localhost:7878  (movie management)  
Prowlarr:    http://localhost:9696  (indexer management)
qBittorrent: http://localhost:8080  (download management)
```

#### **Integration Credentials**
```
qBittorrent:
  Username: admin
  Password: ai_media_2024

API Keys (for service integration):
  Prowlarr: 44b56a79a82d4295a367713457e6b074
  Radarr:   a2758fa8e5bc4418936817baa313ccf8
```

#### **Expected Workflow After Setup**
```
1. User requests movie in Overseerr
2. Overseerr sends request to Radarr
3. Radarr searches indexers via Prowlarr
4. Best torrent sent to qBittorrent
5. Download completed to /media/movies
6. Radarr organizes and renames file
```

### **Success Criteria**
- [ ] All services accessible via web interfaces
- [ ] Prowlarr has 2-3 working indexers
- [ ] Radarr connected to Prowlarr and qBittorrent
- [ ] Overseerr connected to Radarr
- [ ] Test movie request completes end-to-end workflow

### **Rollback Plan**
If manual configuration fails:
```bash
# Individual service restart
docker restart ai_media_[service_name]

# Full service restart
./deploy.sh restart

# Re-run automation for specific service
./scripts/configure-all-services.sh [service_name]
```

### **Major Achievement: Hybrid Configuration Success**

We've successfully implemented a **hybrid configuration approach** that:

1. **Automates the Complex**: API keys, authentication, basic connectivity
2. **Simplifies the Intuitive**: User-friendly web interface configuration
3. **Reduces Setup Time**: From hours to ~30 minutes
4. **Maintains Flexibility**: Users can customize indexers and preferences
5. **Ensures Reliability**: Core plumbing automated, user choices preserved

This approach provides the best of both worlds: automated infrastructure with user-controlled preferences.

## References
- Current architecture: ARCHITECTURE.md
- Decisions log: DECISIONS.md  
- Troubleshooting notes: NOTES.md 