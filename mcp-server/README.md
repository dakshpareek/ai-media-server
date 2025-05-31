# Prowlarr MCP Server

An MCP (Model Context Protocol) server that integrates with Prowlarr to enable AI assistants to search for content and manage downloads through a standardized interface.

## Features

- 🔍 **Smart Search**: Search across all your configured indexers with intelligent result formatting
- 📥 **One-Click Downloads**: Grab releases directly to your download client with simple option selection
- 🏥 **Health Monitoring**: Comprehensive health checks for your Prowlarr system and indexers
- 📊 **Indexer Management**: View and manage your configured indexers
- 🤖 **AI-Friendly**: Optimized for use with Claude Desktop, Cursor IDE, and other MCP-compatible AI tools

## Tools Available

### `prowlarr_health_check`
Get comprehensive health status of your Prowlarr instance including:
- System information and uptime
- Indexer health scores
- Failed indexers with error details
- Healthy indexers summary
- Overall health assessment

### `prowlarr_search`
Search for content across your indexers with smart formatting:
- **Parameters:**
  - `query` (required): Search term (e.g., "batman", "breaking bad s01e01")
  - `indexerIds` (optional): Specific indexer IDs to search
  - `categories` (optional): Category filters (2000=movies, 5000=TV)
  - `limit` (optional): Max results to return (default: 20)
- **Returns**: Beautifully formatted results with option numbers for easy selection

### `prowlarr_grab_release`
Download a release from your last search results:
- **Parameters:**
  - `option` (required): Option number from search results (1, 2, 3...)
- **Returns**: Success/failure status with download confirmation

### `prowlarr_get_indexers`
List all configured indexers:
- **Parameters:**
  - `enabledOnly` (optional): Only show enabled indexers (default: false)
- **Returns**: Detailed indexer information

### `prowlarr_get_download_clients`
List available download clients:
- **Returns**: All configured download clients with connection details

## Quick Start Workflow

### 1. Search for Content
```
AI: I want to find the latest Batman movie

MCP Tool: prowlarr_search
Parameters: {"query": "batman 2024", "categories": [2000], "limit": 10}

Result: 
🔍 Search Results (8 found)

1. The Batman (2024) 2160p UHD BluRay x265-GROUP
📀 Size: 15.2 GB | 🟢 Seeds: 45 | Peers: 52
🏷️ Indexer: 1337x | ⏰ Age: 2d
🎬 Quality: 4K UHD / BluRay / HEVC

2. The Batman (2024) 1080p WEB-DL x264-GROUP  
📀 Size: 8.1 GB | 🟢 Seeds: 23 | Peers: 28
🏷️ Indexer: EZTV | ⏰ Age: 1d
🎬 Quality: 1080p HD / WEB / x264

💡 To download: Use prowlarr_grab_release with option number
📊 Legend: 🟢 Good seeds | 🟡 Low seeds | 🔴 No seeds
```

### 2. Download Your Choice
```
AI: I'll take option 2, the 1080p version

MCP Tool: prowlarr_grab_release
Parameters: {"option": 2}

Result:
✅ Successfully grabbed release!

Title: The Batman (2024) 1080p WEB-DL x264-GROUP
Indexer: EZTV
Size: 8.1 GB

Release successfully sent to download client
```

## Installation

1. Clone this repository
2. Install dependencies:
```bash
npm install
```

3. Set up environment variables (optional):
```bash
export PROWLARR_URL=http://localhost:9696
export PROWLARR_API_KEY=your_api_key_here
```

4. Build the project:
```bash
npm run build
```

5. Run the MCP server:
```bash
npm run mcp
```

## Configuration

The server auto-detects your Prowlarr configuration or uses these defaults:
- **URL**: `http://localhost:9696`
- **API Key**: `44b56a79a82d4295a367713457e6b074`

Override via environment variables:
```bash
PROWLARR_URL=http://your-prowlarr:9696
PROWLARR_API_KEY=your-actual-api-key
```

## Integration with AI Assistants

### Claude Desktop
Add to your `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "prowlarr": {
      "command": "node",
      "args": ["--loader", "ts-node/esm", "/path/to/mcp-server/src/mcp-server.ts"],
      "env": {
        "PROWLARR_URL": "http://localhost:9696",
        "PROWLARR_API_KEY": "your_api_key"
      }
    }
  }
}
```

### Cursor IDE
This server is designed to work seamlessly with Cursor's MCP integration for enhanced development workflows.

## Example Use Cases

1. **Content Discovery**: "Find the latest Marvel movies in 4K"
2. **Quality Selection**: "Search for Breaking Bad season 1 in 1080p"
3. **Quick Downloads**: "Get me the highest quality version of that show"
4. **System Monitoring**: "Check if all my indexers are working"
5. **Troubleshooting**: "Why aren't my downloads starting?"

## API Categories

Common category IDs for filtering:
- `2000` - Movies
- `5000` - TV Shows
- `3000` - Music
- `7000` - Books
- `8000` - Games

## Health Scores

The health check provides scores based on indexer availability:
- **80-100%**: 🟢 Healthy - Most indexers working well
- **50-79%**: 🟡 Degraded - Some indexers having issues
- **0-49%**: 🔴 Unhealthy - Many indexers failing

## Error Handling

The server provides detailed error messages for common issues:
- Invalid search queries
- Network connectivity problems
- API authentication failures
- Download client issues
- Missing search results

## Development

### Project Structure
```
mcp-server/
├── src/
│   ├── mcp-server.ts      # Main MCP server
│   ├── search.ts          # Search & download logic
│   ├── health-check.ts    # Health monitoring
│   └── index.ts          # Entry point
├── package.json
├── tsconfig.json
└── README.md
```

### Scripts
- `npm run build` - Compile TypeScript
- `npm run mcp` - Run MCP server
- `npm run dev` - Development mode
- `node test-search.js` - Test search functionality

## Troubleshooting

### Common Issues

1. **Connection Failed**
   - Check Prowlarr is running on the configured URL
   - Verify API key is correct
   - Ensure no firewall blocking access

2. **No Search Results** 
   - Check if indexers are enabled and healthy
   - Verify search terms are not too specific
   - Try different categories

3. **Download Fails**
   - Ensure download client is configured and running
   - Check download client has space available
   - Verify indexer supports the selected torrent

### Logs
The server logs to stderr for debugging:
```bash
npm run mcp 2>debug.log
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

- GitHub Issues: Report bugs and feature requests
- Discord: Join our community for help and discussions

---

**Made with ❤️ for the *arr community and AI enthusiasts** 