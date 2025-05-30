# AI-Powered Media Server - Notes & Learnings

## 🔑 API Endpoints & Integration Points

### Overseerr API (`/api/v1/`)
- **POST** `/request` - Create new media request
- **GET** `/request` - List all requests  
- **GET** `/request/{id}` - Get specific request
- **POST** `/request/{id}/approve` - Approve request
- **GET** `/movie/{id}` - Get movie details

### Radarr API (`/api/v3/`)
- **GET** `/movie` - List all movies
- **POST** `/movie` - Add new movie
- **GET** `/movie/{id}` - Get movie details
- **DELETE** `/movie/{id}` - Remove movie
- **GET** `/queue` - Get download queue
- **GET** `/history` - Get download history

### Prowlarr API (`/api/v1/`)
- **GET** `/indexer` - List configured indexers
- **GET** `/search` - Search across indexers
- **POST** `/indexer/test` - Test indexer connection
- **GET** `/indexerstats` - Get indexer statistics

### qBittorrent API (`/api/v2/`)
- **GET** `/torrents/info` - Get torrent list
- **POST** `/torrents/add` - Add new torrent
- **POST** `/torrents/delete` - Delete torrents
- **GET** `/torrents/properties` - Get torrent properties
- **POST** `/torrents/setCategory` - Set torrent category

---

## 🧠 MCP Server Integration Ideas

### Natural Language Processing Examples
```javascript
// Input: "Download the latest Marvel movie in 4K"
{
  action: "request_movie",
  query: "latest Marvel movie",
  quality: "4K",
  priority: "normal"
}

// Input: "What's downloading right now?"
{
  action: "get_status",
  type: "downloads"
}

// Input: "Cancel that Spider-Man download"
{
  action: "cancel_download",
  query: "Spider-Man"
}
```

### Conversation Flow Design
1. **Intent Recognition**: Parse user request for action and parameters
2. **Context Gathering**: Get additional info if needed ("Which year?", "Which quality?")
3. **Action Execution**: Make API calls to appropriate services
4. **Status Monitoring**: Track progress and provide updates
5. **Result Reporting**: Confirm completion and provide access info

### Smart Features
- **Quality Intelligence**: Learn user preferences over time
- **Storage Management**: Check available space before large downloads
- **Schedule Awareness**: Delay large downloads during peak hours
- **Duplicate Detection**: Avoid downloading content already in library

---

## 🛠️ Technical Implementation Notes

### Docker Networking
```yaml
# All services use the same external network
networks:
  media_network:
    external: true

# Services can communicate using container names as hostnames
# Example: http://radarr:7878/api/v3/movie
```

### Environment Variable Strategy
```bash
# Root .env file
CONFIG_PATH=/absolute/path/to/media-server
PUID=1000
PGID=1000
TZ=America/New_York

# Service-specific variables
RADARR_API_KEY=generated_during_setup
PROWLARR_API_KEY=generated_during_setup
OVERSEERR_API_KEY=generated_during_setup
```

### Volume Mounting Patterns
```yaml
volumes:
  # Configuration persistence
  - ${CONFIG_PATH}/radarr:/config
  
  # Media library (read/write for Radarr)
  - ${CONFIG_PATH}/media:/media
  
  # Downloads (read/write for qBittorrent)
  - ${CONFIG_PATH}/downloads:/downloads
```

---

## 🔍 Research & References

### MCP Protocol Resources
- [MCP Specification](https://modelcontextprotocol.io/docs) - Official protocol documentation
- [MCP SDK Examples](https://github.com/modelcontextprotocol/servers) - Reference implementations
- [Claude MCP Integration](https://docs.anthropic.com/en/docs/build-with-claude/mcp) - Claude-specific MCP usage

### Media Server APIs
- [Radarr API Documentation](https://radarr.video/docs/api/) - Complete API reference
- [Overseerr API Docs](https://api-docs.overseerr.dev/) - Request management API
- [qBittorrent Web API](https://github.com/qbittorrent/qBittorrent/wiki/WebUI-API-(qBittorrent-4.1)) - Download client API

### Docker & Networking
- [Docker Compose Networking](https://docs.docker.com/compose/networking/) - Service communication
- [Cloudflared Tunnels](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/) - Secure access setup

---

## 💡 Future Enhancement Ideas

### Advanced AI Features
- **Content Recommendation Engine**: Analyze viewing history and suggest new content
- **Quality Optimization**: Automatically select best quality based on available storage and bandwidth
- **Smart Scheduling**: Download popular content during off-peak hours
- **Batch Processing**: Handle multiple requests efficiently ("Download all Marvel movies from 2020-2024")

### User Experience Improvements
- **Voice Integration**: Add voice command support via speech-to-text
- **Mobile App**: Native mobile interface for requests and monitoring
- **Social Features**: Allow family/friends to suggest content
- **Notification System**: Real-time updates on download progress

### System Enhancements
- **Load Balancing**: Multiple indexers and download clients for redundancy
- **Caching Layer**: Redis cache for API responses and search results
- **Analytics Dashboard**: Usage statistics and performance metrics
- **Backup Automation**: Automated configuration and database backups

---

## 🐛 Known Issues & Solutions

### Common Setup Problems
- **Port Conflicts**: Ensure no other services use the same ports
- **Permission Issues**: Set correct PUID/PGID for file access
- **Network Connectivity**: Verify all services can communicate via Docker network
- **API Key Management**: Generate and securely store all required API keys

### Performance Considerations
- **Search Throttling**: Implement delays between indexer searches to avoid rate limiting
- **Storage Monitoring**: Set up alerts for low disk space
- **Memory Usage**: Monitor container memory usage, especially for search-heavy operations
- **Database Maintenance**: Regular cleanup of old logs and completed downloads

### Security Best Practices
- **API Authentication**: Never expose APIs without proper authentication
- **Tunnel Configuration**: Use strong passwords and proper SSL configuration
- **File Permissions**: Ensure proper file system permissions for security
- **Update Management**: Regular updates for all services and base images

---

## 📊 Monitoring & Metrics

### Key Performance Indicators
- **Request Fulfillment Rate**: Percentage of successful movie requests
- **Average Download Time**: Time from request to completion
- **Indexer Success Rate**: Which indexers provide the best results
- **Storage Utilization**: Disk usage and growth patterns
- **API Response Times**: Performance of inter-service communication

### Health Checks
```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:7878/api/v3/system/status"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

### Logging Strategy
- **Centralized Logging**: All services send logs to central location
- **Log Levels**: Configure appropriate verbosity for production vs development
- **Log Rotation**: Prevent log files from consuming excessive disk space
- **Error Alerting**: Automated notifications for critical errors 