#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { CallToolRequestSchema, isInitializeRequest, JSONRPCMessage, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { randomUUID } from "crypto";
import express from 'express';
import { ProwlarrHealthMonitor } from "./health-check.js";
import { IntelligentSearchManager } from "./intelligent-search.js";
import { QBittorrentClient } from "./qbittorrent-client.js";
import { ProwlarrSearchManager } from "./search.js";

// Configuration
const PROWLARR_CONFIG = {
  baseUrl: process.env.PROWLARR_URL || 'http://localhost:9696',
  apiKey: process.env.PROWLARR_API_KEY || '44b56a79a82d4295a367713457e6b074'
};

const QBITTORRENT_CONFIG = {
  baseUrl: process.env.QBITTORRENT_URL || 'http://localhost:8080',
  username: process.env.QBITTORRENT_USERNAME || 'admin',
  password: process.env.QBITTORRENT_PASSWORD || 'adminpass',
  sessionTimeout: parseInt(process.env.QBITTORRENT_SESSION_TIMEOUT || '3600')
};

// Initialize the health monitor, search manager, and intelligent search
const healthMonitor = new ProwlarrHealthMonitor(
  PROWLARR_CONFIG.baseUrl,
  PROWLARR_CONFIG.apiKey
);

const searchManager = new ProwlarrSearchManager(
  PROWLARR_CONFIG.baseUrl,
  PROWLARR_CONFIG.apiKey
);

const intelligentSearchManager = new IntelligentSearchManager(
  PROWLARR_CONFIG.baseUrl,
  PROWLARR_CONFIG.apiKey
);

// Store last search results for download selection
let lastSearchResults: any[] = [];

// qBittorrent client variable (initialized in main)
let qbittorrentClient: QBittorrentClient;

// Start the server
async function main() {
  // Initialize qBittorrent client (moved inside main to prevent startup issues)
  qbittorrentClient = new QBittorrentClient(
    QBITTORRENT_CONFIG.baseUrl,
    QBITTORRENT_CONFIG.username,
    QBITTORRENT_CONFIG.password,
    QBITTORRENT_CONFIG.sessionTimeout
  );

  // Create the server
  const server = new Server(
    {
      name: "prowlarr-mcp-server",
      version: "2.0.0",
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    }
  );

  // Determine transport mode
  const isHttpMode = process.argv.includes('--http');
  const isStdioMode = process.argv.includes('--stdio') || (!isHttpMode && process.argv[1].includes('mcp-server.js'));

  console.log(`🧠 Prowlarr MCP Server v2.0.0 starting in ${isStdioMode ? 'stdio' : 'HTTP'} mode...`);

  // Create transport based on mode
  if (isStdioMode) {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.log('🔌 Connected via stdio transport');
  } else {
    const app = express();
    app.use(express.json());

    // ---- CORS + pre-flight middleware ----
    const ALLOWED_ORIGINS =
      (process.env.ALLOWED_ORIGINS || 'http://localhost:4343').split(',');

    app.use((req, res, next) => {
      // 1. Allow the calling origin (if whitelisted)
      const origin = req.headers.origin;
      if (origin && (ALLOWED_ORIGINS.includes('*') || ALLOWED_ORIGINS.includes(origin))) {
        res.setHeader('Access-Control-Allow-Origin', origin);
      }

      // 2. Tell the browser which headers & methods are OK
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, X-API-Key, Authorization, MCP-Session-Id'
      );
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

      // 3. Let Chatbox read the custom session header
      res.setHeader('Access-Control-Expose-Headers', 'MCP-Session-Id');

      // 4. Short-circuit OPTIONS pre-flight
      if (req.method === 'OPTIONS') return res.sendStatus(204);

      next();
    });
    // --------------------------------------

    // --- API-Key Authentication & CORS Middleware -------------------------
    //
    // 1. Lets OPTIONS pre-flight requests through (adds the necessary CORS
    //    headers and returns 204 No-Content).
    // 2. For all other methods, validates the API key provided in either
    //    `X-API-Key` or `Authorization: Bearer <key>` header.
    // 3. Emits detailed, timestamped logs for *every* auth attempt so that
    //    future debugging can pinpoint which client/IP sent what.
    //
    app.use((req, res, next) => {
      const ts = new Date().toISOString();
      const configuredKey = process.env.MCP_API_KEY?.trim();

      // ----- 0. Ensure a server key exists --------------------------------
      if (!configuredKey) {
        console.error(`[${ts}] 🚫  No MCP_API_KEY set – rejecting all traffic`);
        return res.status(401).json({
          error: 'Unauthorized: server requires MCP_API_KEY to be configured'
        });
      }

      // ----- 1. Skip auth for CORS pre-flight -----------------------------
      if (req.method === 'OPTIONS') {
        console.info(`[${ts}] 🛫  OPTIONS pre-flight accepted from ${req.ip}`);
        return res.sendStatus(204);
      }

      // ----- 2. Extract & verify key --------------------------------------
      const headerKey = req.header('x-api-key') || req.header('authorization') || '';
      const extractedKey = headerKey.toLowerCase().startsWith('bearer ')
        ? headerKey.slice(7).trim()
        : headerKey.trim();

      if (extractedKey === configuredKey) {
        console.info(`[${ts}] ✅  Auth success from ${req.ip} → ${req.method} ${req.originalUrl}`);
        return next();
      }

      console.warn(`[${ts}] 🚫  Auth fail from ${req.ip} – key missing/invalid`);
      return res.status(401).json({ error: 'Unauthorized: invalid or missing API key' });
    });

    app.get('/mcp/ping', (req, res) => {
      res.json({ status: 'OK' });
    });

    // Store transports by session ID
    const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

    app.all('/mcp', async (req: any, res: any) => {
      const sessionId = req.headers['mcp-session-id'] as string | undefined;
      let transport: StreamableHTTPServerTransport;

      if (sessionId && transports[sessionId]) {
        transport = transports[sessionId];
      } else if (!sessionId && isInitializeRequest(req.body)) {
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (sessionId) => {
            transports[sessionId] = transport;
          }
        });
        transport.onerror = (error: Error) => {
          console.error("SSE transport error detected:", error.message);
          if (error.message.includes("terminated")) {
            console.warn("SSE stream terminated. Reconnecting in 5 seconds...");
            setTimeout(() => {
              console.info("Reconnecting SSE stream...");
            }, 5000);
          }
        };

        transport.onclose = () => {
          if (transport.sessionId) {
            delete transports[transport.sessionId];
          }
        };

        await server.connect(transport);

        // Add heartbeat to keep the connection alive.
        const heartbeatInterval = 25000; // 25 seconds
        setInterval(() => {
          try {
            const pingMessage: JSONRPCMessage = {
              jsonrpc: "2.0" as "2.0",
              id: randomUUID() as string,
              method: "ping"
            };
            transport.send(pingMessage);
            console.log("💓 Sent heartbeat ping");
          } catch (error) {
            console.error("Heartbeat error:", error);
          }
        }, heartbeatInterval);
      } else {
        res.status(400).json({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Bad Request: No valid session ID provided',
          },
          id: null,
        });
        return;
      }

      await transport.handleRequest(req, res, req.body);
    });

    const PORT = parseInt(process.env.MCP_PORT || '3000', 10);
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🌐 MCP Streamable HTTP Server listening on port ${PORT}`);
      console.log(`🔌 Ready for remote connections`);
    });
  }

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    console.log('🔧 ListToolsRequestSchema handler called');
    try {
      const tools = [
        {
          name: "prowlarr_health_check",
          description: "Get comprehensive health status of Prowlarr indexers and system",
          inputSchema: {
            type: "object",
            properties: {},
            required: [],
          },
        },
        {
          name: "prowlarr_get_indexers",
          description: "Get list of all configured indexers",
          inputSchema: {
            type: "object",
            properties: {
              enabledOnly: {
                type: "boolean",
                description: "Only return enabled indexers",
                default: false,
              },
            },
            required: [],
          },
        },
        /*
        {
          name: "prowlarr_intelligent_search",
          description: "🧠 Smart search that auto-manages VPN connections based on indexer health. This is the recommended search method that will automatically connect VPN if needed.",
          inputSchema: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "Search query (e.g., 'batman', 'breaking bad s01e01')",
              },
              indexerIds: {
                type: "array",
                items: { type: "number" },
                description: "Optional: specific indexer IDs to search. Leave empty to search all torrents.",
              },
              categories: {
                type: "array",
                items: { type: "number" },
                description: "Optional: category IDs (e.g., 2000 for movies, 5000 for TV)",
              },
              limit: {
                type: "number",
                description: "Maximum number of results to return",
                default: 20,
              },
            },
            required: ["query"],
          },
        },
        */
        {
          name: "prowlarr_search",
          description: "Basic search for content across indexers (without VPN auto-management). Use prowlarr_intelligent_search for better results.",
          inputSchema: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "Search query (e.g., 'batman', 'breaking bad s01e01')",
              },
              indexerIds: {
                type: "array",
                items: { type: "number" },
                description: "Optional: specific indexer IDs to search. Leave empty to search all torrents.",
              },
              categories: {
                type: "array",
                items: { type: "number" },
                description: "Optional: category IDs (e.g., 2000 for movies, 5000 for TV)",
              },
              limit: {
                type: "number",
                description: "Maximum number of results to return",
                default: 20,
              },
            },
            required: ["query"],
          },
        },
        {
          name: "prowlarr_grab_release",
          description: "Download/grab a release from the last search results by option number",
          inputSchema: {
            type: "object",
            properties: {
              option: {
                type: "number",
                description: "The option number from the search results (e.g., 1, 2, 3...)",
              },
            },
            required: ["option"],
          },
        },
        {
          name: "prowlarr_get_download_clients",
          description: "Get list of available download clients",
          inputSchema: {
            type: "object",
            properties: {},
            required: [],
          },
        },
        {
          name: "prowlarr_vpn_status",
          description: "Get current VPN connection status and details",
          inputSchema: {
            type: "object",
            properties: {},
            required: [],
          },
        },
        {
          name: "prowlarr_vpn_connect",
          description: "Manually connect to VPN with optional city preference",
          inputSchema: {
            type: "object",
            properties: {
              city: {
                type: "string",
                description: "Preferred city/country (e.g., 'australia', 'sydney', 'singapore')",
                default: "australia",
              },
            },
            required: [],
          },
        },
        {
          name: "prowlarr_vpn_disconnect",
          description: "Manually disconnect from VPN",
          inputSchema: {
            type: "object",
            properties: {},
            required: [],
          },
        },
        {
          name: "prowlarr_system_status",
          description: "Get comprehensive system status including health, VPN, and readiness for searching",
          inputSchema: {
            type: "object",
            properties: {},
            required: [],
          },
        },
        // qBittorrent Tools
        {
          name: "qbittorrent_health_check",
          description: "Test connection to qBittorrent and get system health status",
          inputSchema: {
            type: "object",
            properties: {},
            required: [],
          },
        },
        {
          name: "qbittorrent_get_torrents",
          description: "Get list of all torrents with optional filtering and sorting",
          inputSchema: {
            type: "object",
            properties: {
              filter: {
                type: "string",
                description: "Filter torrents by state",
                enum: ["all", "downloading", "seeding", "completed", "paused", "active", "inactive"],
                default: "all"
              },
              category: {
                type: "string",
                description: "Filter by category name"
              },
              tag: {
                type: "string",
                description: "Filter by tag name"
              },
              sort: {
                type: "string",
                description: "Sort field (e.g., 'name', 'size', 'progress', 'dlspeed')"
              },
              reverse: {
                type: "boolean",
                description: "Reverse sort order",
                default: false
              },
              limit: {
                type: "number",
                description: "Maximum number of torrents to return",
                default: 50
              }
            },
            required: [],
          },
        },
        {
          name: "qbittorrent_add_torrent",
          description: "Add torrent from magnet link or HTTP URL",
          inputSchema: {
            type: "object",
            properties: {
              urls: {
                type: "string",
                description: "Torrent URLs or magnet links (multiple URLs separated by newlines)"
              },
              savepath: {
                type: "string",
                description: "Custom download path"
              },
              category: {
                type: "string",
                description: "Category to assign to torrent"
              },
              tags: {
                type: "string",
                description: "Tags to assign (comma separated)"
              },
              paused: {
                type: "boolean",
                description: "Add torrent in paused state",
                default: false
              },
              skipChecking: {
                type: "boolean",
                description: "Skip hash checking",
                default: false
              },
              sequentialDownload: {
                type: "boolean",
                description: "Enable sequential download",
                default: false
              },
              firstLastPiecePrio: {
                type: "boolean",
                description: "Prioritize first and last pieces",
                default: false
              }
            },
            required: ["urls"],
          },
        },
        {
          name: "qbittorrent_control_torrents",
          description: "Control torrents (pause, resume, delete) by hash or name",
          inputSchema: {
            type: "object",
            properties: {
              action: {
                type: "string",
                description: "Action to perform",
                enum: ["pause", "resume", "delete"]
              },
              hashes: {
                type: "string",
                description: "Torrent hashes (pipe separated) or 'all' for all torrents"
              },
              deleteFiles: {
                type: "boolean",
                description: "Delete files when deleting torrent",
                default: false
              }
            },
            required: ["action", "hashes"],
          },
        },
        {
          name: "qbittorrent_get_transfer_info",
          description: "Get global transfer statistics (speeds, limits, connection status)",
          inputSchema: {
            type: "object",
            properties: {},
            required: [],
          },
        },
      ];

      return {
        tools: tools,
      };
    } catch (error) {
      console.error("Error processing ListToolsRequestSchema:", error);
      return {
        tools: [],
      };
    }
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    console.log("Received callTool request:", JSON.stringify(request.params, null, 2));
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case 'prowlarr_health_check': {
          const healthData = await healthMonitor.getHealthStatus();

          // Create intelligent guidance based on health status
          let guidance = '';
          const healthScore = parseInt(healthData.health_score);
          const failedIndexers = healthData.failed_indexers.length;

          if (healthScore < 50) {
            guidance = `\n\n🚨 **Critical Health Issues Detected!**\n\n`;
            guidance = `**Immediate Actions Needed:**\n`;
            guidance = `1. 🌐 **Try VPN connection** - Many indexers may be geo-blocked\n`;
            guidance = `   - \`prowlarr_vpn_connect australia\` - Try Australia first\n`;
            guidance = `   - \`prowlarr_vpn_connect singapore\` - Or try Singapore\n`;
            guidance = `2. 🔄 **Wait and retry** - Some indexers auto-recover after cooldown\n`;
            guidance = `3. 📡 **Check specific indexers** - Some may need reconfiguration\n\n`;
            guidance = `**Next Steps:**\n`;
            guidance = `- Run \`prowlarr_search\` with VPN connected to test improvement\n`;
            guidance = `- Use \`prowlarr_vpn_status\` to verify VPN connection\n`;
          } else if (healthScore < 80) {
            guidance = `\n\n⚠️ **Some Health Issues Found**\n\n`;
            guidance = `**Suggested Actions:**\n`;
            guidance = `1. 🌐 **Consider VPN** - \`prowlarr_vpn_connect\` may help with failed indexers\n`;
            guidance = `2. 🔍 **Test search** - \`prowlarr_search batman\` to see if results improve\n`;
            guidance = `3. ⏰ **Wait for recovery** - Some indexers may be temporarily down\n`;
          } else {
            guidance = `\n\n✅ **System Health: Excellent!**\n\n`;
            guidance = `Your indexers are working well. Ready for searching!\n`;
            guidance = `- Try: \`prowlarr_search [your query]\` to find content\n`;
          }

          if (failedIndexers > 0) {
            guidance = `\n**${failedIndexers} indexers currently failing** - VPN connection often resolves geo-blocking issues.\n`;
          }

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(healthData, null, 2) + guidance,
              },
            ],
          };
        }

        case 'prowlarr_get_indexers': {
          const enabledOnly = args?.enabledOnly as boolean || false;
          const indexers = await healthMonitor.getIndexers();

          const filteredIndexers = enabledOnly
            ? indexers.filter(indexer => indexer.enable)
            : indexers;

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(filteredIndexers, null, 2),
              },
            ],
          };
        }

        /*
        case 'prowlarr_intelligent_search': {
          const query = args?.query as string;
          const indexerIds = args?.indexerIds as number[] | undefined;
          const categories = args?.categories as number[] | undefined;
          const limit = (args?.limit as number) || 20;

          if (!query) {
            throw new Error('Search query is required');
          }

          const searchResult = await intelligentSearchManager.intelligentSearch(query, indexerIds, categories, limit);

          if (searchResult.success && searchResult.searchResults) {
            // Store results for later grab operations
            lastSearchResults = searchResult.searchResults;
          }

          return {
            content: [
              {
                type: 'text',
                text: searchResult.formattedResults || searchResult.message,
              },
            ],
          };
        }
        */

        case 'prowlarr_search': {
          const query = args?.query as string;
          const indexerIds = args?.indexerIds as number[] | undefined;
          const categories = args?.categories as number[] | undefined;
          const limit = (args?.limit as number) || 20;

          if (!query) {
            throw new Error('Search query is required');
          }

          const searchResults = await searchManager.search(query, indexerIds, categories, limit);

          // Store results for later grab operations
          lastSearchResults = searchResults;

          const formattedOutput = searchManager.formatSearchResults(searchResults);

          return {
            content: [
              {
                type: 'text',
                text: formattedOutput,
              },
            ],
          };
        }

        case 'prowlarr_grab_release': {
          const option = args?.option as number;

          if (!option || option < 1) {
            throw new Error('Valid option number is required (e.g., 1, 2, 3...)');
          }

          if (!lastSearchResults || lastSearchResults.length === 0) {
            throw new Error('No search results available. Please run a search first.');
          }

          const selectedResult = searchManager.getResultByOption(lastSearchResults, option);

          if (!selectedResult) {
            throw new Error(`Option ${option} not found. Please choose a number between 1 and ${lastSearchResults.length}.`);
          }

          // Reset VPN timer if connected (user is actively downloading)
          const vpnManager = intelligentSearchManager.getVPNManager();
          vpnManager.resetDisconnectTimer();

          const grabResult = await searchManager.grabRelease(selectedResult.guid, selectedResult.indexerId);

          if (grabResult.success) {
            return {
              content: [
                {
                  type: 'text',
                  text: `✅ **Successfully grabbed release!**\n\n**Title:** ${selectedResult.title}\n**Indexer:** ${selectedResult.indexer}\n**Size:** ${searchManager['formatFileSize'](selectedResult.size || 0)}\n\n${grabResult.message}\n\n⏰ **VPN Timer:** Extended for 10 more minutes due to download activity`,
                },
              ],
            };
          } else {
            return {
              content: [
                {
                  type: 'text',
                  text: `❌ **Failed to grab release**\n\n**Error:** ${grabResult.message}\n\n**Title:** ${selectedResult.title}\n**Indexer:** ${selectedResult.indexer}`,
                },
              ],
            };
          }
        }

        case 'prowlarr_get_download_clients': {
          const downloadClients = await searchManager.getDownloadClients();

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(downloadClients, null, 2),
              },
            ],
          };
        }

        case 'prowlarr_vpn_status': {
          const vpnManager = intelligentSearchManager.getVPNManager();
          const vpnStatus = await vpnManager.getVPNStatus();

          let statusText = '🌐 **VPN Status**\n\n';
          if (vpnStatus.connected) {
            statusText += `✅ **Connected**\n`;
            statusText += `📍 **Location:** ${vpnStatus.city}, ${vpnStatus.country}\n`;
            statusText += `🌍 **IP:** ${vpnStatus.ip}\n`;
            if (vpnStatus.connectionTime) {
              statusText += `⏰ **Connected Since:** ${vpnStatus.connectionTime.toLocaleString()}\n`;
            }
            statusText += `\n⏳ **Auto-disconnect:** Will disconnect after 10 minutes of inactivity`;
          } else {
            statusText += `❌ **Disconnected**\n`;
            statusText += `💡 **Tip:** VPN will auto-connect when needed for searches`;
          }

          return {
            content: [
              {
                type: 'text',
                text: statusText,
              },
            ],
          };
        }

        case 'prowlarr_vpn_connect': {
          const city = (args?.city as string) || 'australia';
          const vpnManager = intelligentSearchManager.getVPNManager();

          const result = await vpnManager.connectVPN(city);

          return {
            content: [
              {
                type: 'text',
                text: result.success
                  ? `✅ **VPN Connected Successfully!**\n\n${result.message}\n\n⏰ **Auto-disconnect:** Will disconnect in 10 minutes`
                  : `❌ **VPN Connection Failed**\n\n${result.message}`,
              },
            ],
          };
        }

        case 'prowlarr_vpn_disconnect': {
          const vpnManager = intelligentSearchManager.getVPNManager();
          const result = await vpnManager.disconnectVPN();

          return {
            content: [
              {
                type: 'text',
                text: result.success
                  ? `✅ **VPN Disconnected Successfully!**\n\n${result.message}`
                  : `❌ **VPN Disconnection Failed**\n\n${result.message}`,
              },
            ],
          };
        }

        case 'prowlarr_system_status': {
          const systemStatus = await intelligentSearchManager.getSystemStatus();

          // Add intelligent guidance based on system status
          let guidance = '\n\n🧠 **Intelligent System Analysis**\n\n';

          if (systemStatus.vpn_connected) {
            guidance = `✅ **VPN Connected** - Ready for global indexer access\n`;
            guidance = `📍 **Location:** ${systemStatus.vpn_city}, ${systemStatus.vpn_country}\n\n`;
          } else {
            guidance = `⚠️ **VPN Disconnected** - Limited to local indexers\n`;
            guidance = `💡 **Recommendation:** \`prowlarr_vpn_connect\` for better results\n\n`;
          }

          if (systemStatus.health_score) {
            const score = parseInt(systemStatus.health_score);
            if (score < 50) {
              guidance = `🚨 **Health Critical (${score}%)** - Immediate action needed!\n`;
              guidance = `**Recommended Workflow:**\n`;
              guidance = `1. \`prowlarr_vpn_connect australia\` - Connect to VPN\n`;
              guidance = `2. \`prowlarr_health_check\` - Verify improvement\n`;
              guidance = `3. \`prowlarr_search batman\` - Test search quality\n`;
            } else if (score < 80) {
              guidance = `⚡ **Health Fair (${score}%)** - Could be improved\n`;
              guidance = `**Try:** \`prowlarr_vpn_connect\` to boost indexer availability\n`;
            } else {
              guidance = `✅ **Health Excellent (${score}%)** - System running optimally!\n`;
              guidance = `**Ready for:** \`prowlarr_search [your query]\`\n`;
            }
          }

          guidance = `\n**Available Actions:**\n`;
          guidance = `- \`prowlarr_search [query]\` - Search for content\n`;
          guidance = `- \`prowlarr_health_check\` - Detailed health analysis\n`;
          guidance = `- \`prowlarr_vpn_connect [location]\` - Improve access\n`;
          guidance = `- \`prowlarr_vpn_status\` - Check VPN details\n`;

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(systemStatus, null, 2),  guidance,
              },
            ],
          };
        }

        // qBittorrent Tools
        case 'qbittorrent_health_check': {
          const healthStatus = await qbittorrentClient.healthCheck();

          let guidance = '';
          if (healthStatus.connected) {
            guidance = `\n\n✅ **qBittorrent Health: Connected**\n\n`;
            guidance += `**Version:** ${healthStatus.version}\n`;
            guidance += `**WebAPI Version:** ${healthStatus.webApiVersion}\n\n`;
            guidance += `Ready to manage torrents!\n`;
            guidance += `- Try: \`qbittorrent_get_torrents\` to list current torrents\n`;
            guidance += `- Try: \`qbittorrent_add_torrent\` to add new torrents\n`;
          } else {
            guidance = `\n\n❌ **qBittorrent Health: Disconnected**\n\n`;
            guidance += `**Error:** ${healthStatus.error}\n\n`;
            guidance += `**Troubleshooting:**\n`;
            guidance += `1. Check if qBittorrent is running and accessible\n`;
            guidance += `2. Verify credentials and network connectivity\n`;
            guidance += `3. Ensure qBittorrent WebUI is enabled\n`;
          }

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(healthStatus, null, 2) + guidance,
              },
            ],
          };
        }

        case 'qbittorrent_get_torrents': {
          const options = {
            filter: args?.filter as 'all' | 'downloading' | 'seeding' | 'completed' | 'paused' | 'active' | 'inactive',
            category: args?.category as string,
            tag: args?.tag as string,
            sort: args?.sort as string,
            reverse: args?.reverse as boolean,
            limit: (args?.limit as number) || 50
          };

          const torrents = await qbittorrentClient.getTorrents(options);

          // Format the response for better readability
          const formattedTorrents = torrents.map((torrent, index) => ({
            index: index + 1,
            name: torrent.name,
            state: torrent.state,
            progress: `${(torrent.progress * 100).toFixed(1)}%`,
            size: `${(torrent.size / 1024 / 1024 / 1024).toFixed(2)} GB`,
            dlspeed: `${(torrent.dlspeed / 1024 / 1024).toFixed(2)} MB/s`,
            upspeed: `${(torrent.upspeed / 1024 / 1024).toFixed(2)} MB/s`,
            category: torrent.category || 'None',
            hash: torrent.hash
          }));

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(formattedTorrents, null, 2),
              },
            ],
          };
        }

        case 'qbittorrent_add_torrent': {
          const options = {
            urls: args?.urls as string,
            savepath: args?.savepath as string,
            category: args?.category as string,
            tags: args?.tags as string,
            paused: args?.paused as boolean,
            skipChecking: args?.skipChecking as boolean,
            sequentialDownload: args?.sequentialDownload as boolean,
            firstLastPiecePrio: args?.firstLastPiecePrio as boolean
          };

          if (!options.urls) {
            throw new Error('Torrent URLs or magnet links are required');
          }

          await qbittorrentClient.addTorrent(options);

          return {
            content: [
              {
                type: 'text',
                text: `✅ **Torrent added successfully!**\n\nTorrent has been queued for download.`,
              },
            ],
          };
        }

        case 'qbittorrent_control_torrents': {
          const action = args?.action as 'pause' | 'resume' | 'delete';
          const hashes = args?.hashes as string;
          const deleteFiles = args?.deleteFiles as boolean || false;

          if (!action || !hashes) {
            throw new Error('Action and hashes are required');
          }

          await qbittorrentClient.controlTorrents(action, hashes, deleteFiles);

          const actionText = action === 'pause' ? 'paused' : action === 'resume' ? 'resumed' : 'deleted';

          return {
            content: [
              {
                type: 'text',
                text: `✅ **Torrents ${actionText} successfully!**`,
              },
            ],
          };
        }

        case 'qbittorrent_get_transfer_info': {
          const transferInfo = await qbittorrentClient.getTransferInfo();

          // Format transfer info for better readability
          const formattedInfo = {
            download_speed: `${(transferInfo.dl_info_speed / 1024 / 1024).toFixed(2)} MB/s`,
            upload_speed: `${(transferInfo.up_info_speed / 1024 / 1024).toFixed(2)} MB/s`,
            downloaded_session: `${(transferInfo.dl_info_data / 1024 / 1024 / 1024).toFixed(2)} GB`,
            uploaded_session: `${(transferInfo.up_info_data / 1024 / 1024 / 1024).toFixed(2)} GB`,
            download_limit: transferInfo.dl_rate_limit === 0 ? 'Unlimited' : `${(transferInfo.dl_rate_limit / 1024 / 1024).toFixed(2)} MB/s`,
            upload_limit: transferInfo.up_rate_limit === 0 ? 'Unlimited' : `${(transferInfo.up_rate_limit / 1024 / 1024).toFixed(2)} MB/s`,
            dht_nodes: transferInfo.dht_nodes,
            connection_status: transferInfo.connection_status,
            raw_data: transferInfo
          };

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(formattedInfo, null, 2),
              },
            ],
          };
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      console.error("Error processing callTool request:", error);
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`,
          },
        ],
      };
    }
  });

  // All initialization complete
  console.log('🎯 MCP Server fully initialized with all tools registered');
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
