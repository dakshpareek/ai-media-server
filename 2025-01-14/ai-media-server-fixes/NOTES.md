# AI Media Server Fixes - Notes & Learnings

## Issues Resolved (2025-01-14)

### Missing .env File
- **Problem**: Docker Compose failing with missing environment variables
- **Root Cause**: .env file was not present, all services expecting configuration
- **Solution**: Created comprehensive .env with all required variables
- **Lesson**: Always ensure environment files exist before Docker deployment

### Git Tracking Verification
- **Problem**: Suspected missing docker build context files
- **Investigation**: Checked git tracking of docker/nordvpn-cli directory
- **Finding**: Files were properly tracked, issue was elsewhere
- **Lesson**: Verify actual root cause before assuming git tracking issues

### Environment Variables Completeness
- **Problem**: Needed comprehensive environment configuration
- **Solution**: Added all variables from docker-compose.yml analysis
- **Categories**: VPN credentials, ports, API keys, paths, versions
- **Lesson**: Parse docker-compose.yml thoroughly for all required variables

## Key Technical Insights

### MCP Integration Architecture
- **Protocol**: Uses stdio transport, not HTTP
- **Communication**: `docker exec -i ai_media_mcp_server npm run mcp`
- **Tools Available**: VPN management, Prowlarr search, intelligent search
- **Network**: MCP server runs in VPN network for protected access

### Docker Network Design
- **VPN Services**: nordvpn, prowlarr, qbittorrent, mcp-server, flaresolverr
- **Local Services**: radarr, overseerr, filebrowser
- **Reasoning**: Torrent/indexer services need VPN protection, management services don't

### Security Considerations
- **Credentials**: .env file properly gitignored
- **Template**: .env.example provides secure template
- **API Keys**: Prowlarr API key configurable
- **Permissions**: PUID/PGID for proper file access

## Future Improvements

### Error Handling
- Add container health checks for all services
- Implement retry logic for VPN connection failures
- Add monitoring for container resource usage

### Documentation
- Create setup video guide
- Add troubleshooting section
- Document common error scenarios

### Automation
- Create setup script for initial configuration
- Add backup/restore scripts for configurations
- Implement log rotation and cleanup

## Debugging Commands

### Container Status
```bash
docker-compose ps
docker-compose logs [service_name]
docker exec nordvpn_official nordvpn status
```

### Network Testing
```bash
docker exec prowlarr ping google.com
docker exec ai_media_mcp_server curl http://localhost:9696/ping
```

### File Permissions
```bash
ls -la config/ downloads/ media/ logs/
docker exec prowlarr id
```

## References & Links
- [NordVPN CLI Documentation](https://support.nordvpn.com/General-info/1047409322/NordVPN-Linux-app.htm)
- [Prowlarr API Documentation](https://github.com/Prowlarr/Prowlarr/wiki/API-Guide)
- [Model Context Protocol Specification](https://modelcontextprotocol.io/docs/concepts/transports) 