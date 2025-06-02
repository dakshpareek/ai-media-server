#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { CallToolRequestSchema, isInitializeRequest, JSONRPCMessage, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { randomUUID } from "crypto";
import express from 'express';
import { ProwlarrHealthMonitor } from "./health-check.js";
import { IntelligentSearchManager } from "./intelligent-search.js";
import { ProwlarrSearchManager } from "./search.js";

// Configuration
const PROWLARR_CONFIG = {
  baseUrl: process.env.PROWLARR_URL || 'http://localhost:9696',
  apiKey: process.env.PROWLARR_API_KEY || '44b56a79a82d4295a367713457e6b074'
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
  return {
    tools: [
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
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
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
              text: JSON.stringify(healthData, null, 2),  guidance,
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
          statusText = `✅ **Connected**\n`;
          statusText = `📍 **Location:** ${vpnStatus.city}, ${vpnStatus.country}\n`;
          statusText = `🌍 **IP:** ${vpnStatus.ip}\n`;
          if (vpnStatus.connectionTime) {
            statusText = `⏰ **Connected Since:** ${vpnStatus.connectionTime.toLocaleString()}\n`;
          }
          statusText = `\n⏳ **Auto-disconnect:** Will disconnect after 10 minutes of inactivity`;
        } else {
          statusText = `❌ **Disconnected**\n`;
          statusText = `💡 **Tip:** VPN will auto-connect when needed for searches`;
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

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
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

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("🧠 Prowlarr Intelligent MCP Server v2.0 running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
