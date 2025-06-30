# Prowlarr & qBittorrent MCP Enhanced Media Management Suite

This project provides a Dockerized media management suite featuring Prowlarr for indexer management and qBittorrent for downloads, all enhanced with a Model Context Protocol (MCP) server. The MCP server enables advanced interaction and automation capabilities, including intelligent search with on-demand NordVPN management for Prowlarr.

## Features

*   **Dockerized Services:** Easy deployment and management with Docker Compose.
*   **Prowlarr:** Manages your Usenet and Torrent indexers. UI accessible from LAN.
*   **qBittorrent:** Reliable torrent client. WebUI accessible from LAN.
*   **FlareSolverr:** Bypasses Cloudflare challenges for indexers. UI/API accessible from LAN.
*   **NordVPN Integration:**
    *   Prowlarr and FlareSolverr traffic is routed through NordVPN when the VPN is connected.
    *   MCP server tools to control NordVPN connection state (connect, disconnect, status).
    *   Automatic application of LAN accessibility settings (kill switch off, subnet whitelisting) after each successful VPN connection to maintain access to published UIs.
    *   Auto-disconnects VPN after a period of inactivity (default 10 minutes).
*   **MCP Server (`prowlarr-mcp-server`):**
    *   Provides tools to interact with Prowlarr (health checks, indexer lists, search, grab releases).
    *   Provides tools to interact with qBittorrent (health checks, list torrents, add torrents, control torrents, transfer info).
    *   Manages NordVPN connection state.
    *   Accessible via HTTP for integration with LLMs or other MCP clients.
*   **FileBrowser:** Web-based file management for your downloads, media, and configuration files.

## Project Structure

```
.
├── docker-compose.yml     # Main Docker Compose configuration
├── .env                   # Environment variables (YOU MUST CREATE AND CONFIGURE THIS)
├── mcp-server/            # Node.js MCP Server application
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   └── src/               # TypeScript source code for MCP server
├── docker/
│   └── nordvpn-cli/       # Docker configuration for NordVPN CLI container
│       ├── Dockerfile
│       ├── entrypoint.sh
│       └── healthcheck.sh
└── scripts/               # Optional utility scripts
    └── test-mcp.sh        # Example MCP testing script
```

## Prerequisites

*   Docker and Docker Compose installed on your host machine.
*   A NordVPN account.
*   Access to a terminal or command line.

## Setup Instructions

**1. Prepare Project Files**

Ensure all project files are in place as per the structure above. If cloned from Git, you're set.

**2. Create and Configure the `.env` File**

In the project root, create a file named `.env`. Copy the content below into it and **edit it with your actual credentials and preferences.**

```dotenv
# General Settings
TZ=UTC
PUID=1000
PGID=1000
LOCAL_NETWORK=192.168.1.0/24 # IMPORTANT: Set this to your actual LAN subnet (e.g., 192.168.0.0/24)

# NordVPN Credentials & Settings
NORDVPN_USER=your_nordvpn_username
NORDVPN_PASS=your_nordvpn_password # Note: Browser login is primary, these might be fallback/unused by CLI.
NORDVPN_TECH=NordLynx # Or OpenVPN_UDP, OpenVPN_TCP
# NORDVPN_CONNECT= # Optional: Default city/country for NordVPN to connect to on initial startup (e.g., "United States", "australia")

# Prowlarr Settings
PROWLARR_VERSION=latest
CONFIG_PROWLARR=./config/prowlarr
PROWLARR_API_KEY=your_prowlarr_api_key_here # GET THIS FROM PROWLARR UI AFTER FIRST RUN (Step 5)
PORT_PROWLARR=9696 # Port for Prowlarr UI access from host

# FlareSolverr Settings
PORT_FLARESOLVERR=8191 # Port for FlareSolverr UI/API access from host

# qBittorrent Settings
QBITTORRENT_VERSION=latest
CONFIG_QBITTORRENT=./config/qbittorrent
PORT_QBITTORRENT=8080 # Port for qBittorrent WebUI
QBITTORRENT_USERNAME=admin
QBITTORRENT_PASSWORD=yoursecureqbittorrentpassword # IMPORTANT: CHANGE THIS!

# MCP Server Settings
MCP_PORT=3000 # Port for MCP Server API
# If set, every HTTP request to /mcp must include this key
#   X-API-Key: YOUR_KEY   ––or––   Authorization: Bearer YOUR_KEY
MCP_API_KEY=your_strong_mcp_api_key
QBITTORRENT_SESSION_TIMEOUT=3600 # qBittorrent API session timeout in seconds for MCP client

# FileBrowser Settings
FILEBROWSER_VERSION=latest
CONFIG_FILEBROWSER=./config/filebrowser
PORT_FILEBROWSER=8081

# Directory Paths (relative to project root where docker-compose.yml is located)
DOWNLOADS_PATH=./downloads
MEDIA_PATH=./media
CONFIG_PATH=./config # For FileBrowser to view app configs
LOGS_PATH=./logs     # For FileBrowser to view app logs
```

**Key `.env` configurations to verify:**
*   `LOCAL_NETWORK`: Your home/local network's subnet (e.g., `192.168.1.0/24`). This is vital for LAN access to UIs when VPN is active.
*   `NORDVPN_USER`: Your NordVPN username.
*   `PROWLARR_API_KEY`: You'll obtain this from the Prowlarr WebUI later.
*   `QBITTORRENT_PASSWORD`: **Change the default password!**

**3. Build Docker Images and Start Services**

Open a terminal in the project root directory:

```bash
docker-compose build
docker-compose up -d
```
This builds the `nordvpn_official` and `mcp-server` images and starts all services.

**4. NordVPN Browser Authentication (CRITICAL INITIAL STEP)**

The `nordvpn_official` container requires a one-time browser-based authentication after its first start (and if your session expires).
*   Monitor the logs of the `nordvpn_official` container:
    ```bash
    docker logs -f nordvpn_official
    ```
*   The `entrypoint.sh` script will attempt to initiate the login. Look for a URL like `https://...nordaccount.com/login/...`.
*   Copy this URL into a web browser (on any device) and complete the NordVPN login.
*   The container logs should eventually confirm "Authentication successful!" and apply settings.
    *   If you miss the URL or need to re-trigger it, run: `docker exec -it nordvpn_official nordvpn login` and follow the new URL.

**5. Prowlarr: Get API Key & Basic Configuration**

*   Access Prowlarr WebUI: `http://<your_host_ip>:${PORT_PROWLARR}` (e.g., `http://localhost:9696`).
*   **Get API Key:** Navigate to `Settings` -> `General`. Under "Security", copy the `API Key`.
*   **Update `.env`:** Paste this API key into your `.env` file for `PROWLARR_API_KEY`.
*   **Restart `mcp-server`** to pick up the new API key:
    ```bash
    docker-compose restart mcp-server
    ```
*   **Configure Indexers:** In Prowlarr, add and configure your desired indexers.

**6. Prowlarr: Configure Download Clients**

In Prowlarr UI (`Settings` -> `Download Clients`):
*   **Add FlareSolverr:**
    *   `+` -> `FlareSolverr`
    *   Name: `FlareSolverr` (or similar)
    *   Host: `localhost` (Prowlarr and FlareSolverr share NordVPN's network namespace)
    *   Port: `8191` (as per `PORT_FLARESOLVERR` in `.env`)
    *   Test and Save.
*   **Add qBittorrent:**
    *   `+` -> `qBittorrent`
    *   Name: `qBittorrent` (or similar)
    *   Host: `qbittorrent` (This is the Docker service name)
    *   Port: `${PORT_QBITTORRENT}` (e.g., `8080`)
    *   Username: Your qBittorrent username (from `.env`)
    *   Password: Your qBittorrent password (from `.env`)
    *   Test and Save.

**7. System Ready!**

Your media management suite should now be operational.

## Using the MCP Server

*   **MCP Endpoint:** `http://<your_host_ip>:${MCP_PORT}/mcp` (e.g., `http://localhost:3000/mcp`)
*   Use an MCP-compatible client (like the provided `scripts/test-mcp.sh` or an LLM integration) to interact with the server.

**Key MCP Tools:**
*   `prowlarr_vpn_status`: Check NordVPN connection status (authentication, connected, IP, location).
*   `prowlarr_health_check`: Get Prowlarr system and indexer health status.
*   `prowlarr_vpn_connect` (args: `{"city": "your_city_or_country"}`): Connects NordVPN. LAN access settings are automatically re-applied.
*   `prowlarr_search` (args: `{"query": "search_term", "limit": 20}`): Searches Prowlarr.
*   `prowlarr_grab_release` (args: `{"option": 1}`): Grabs a release from previous search results and sends it to qBittorrent via Prowlarr.
*   `qbittorrent_get_torrents`: Lists torrents in qBittorrent.
*   `prowlarr_vpn_disconnect`: Disconnects NordVPN.

Refer to `mcp-server/src/mcp-server.ts` for the full list of tools and their input schemas.

## Service Access URLs

(Replace `<your_host_ip>` with `localhost` if running Docker locally, or your Docker host's IP if accessing from another machine on your LAN)

*   **Prowlarr:** `http://<your_host_ip>:${PORT_PROWLARR}` (Default: `http://<your_host_ip>:9696`)
*   **qBittorrent:** `http://<your_host_ip>:${PORT_QBITTORRENT}` (Default: `http://<your_host_ip>:8080`)
*   **FlareSolverr:** `http://<your_host_ip>:${PORT_FLARESOLVERR}` (Default: `http://<your_host_ip>:8191`)
*   **MCP Server:** `http://<your_host_ip>:${MCP_PORT}/mcp` (Default: `http://<your_host_ip>:3000/mcp`)
*   **FileBrowser:** `http://<your_host_ip>:${PORT_FILEBROWSER}` (Default: `http://<your_host_ip>:8081`)

## Important Operational Details

*   **NordVPN Login:** A manual browser step is required for initial NordVPN authentication.
*   **VPN Management:** The MCP server's `prowlarr_vpn_connect`/`disconnect` tools manage the VPN. It auto-disconnects after 10 minutes of inactivity (timer is reset by relevant MCP tool usage like search/grab).
*   **LAN Accessibility:** The system is designed to maintain LAN access to published UIs (Prowlarr, qBittorrent, etc.) even when the VPN is active inside the `nordvpn_official` container. This is achieved by `VPNManager` re-applying `killswitch off` and subnet whitelisting after each connection. Ensure `LOCAL_NETWORK` in `.env` is accurate.
*   **Data Persistence:** Configuration for Prowlarr, qBittorrent, FileBrowser is stored in the `./config` directory. Downloads are in `./downloads`. Logs are in `./logs`. These persist across container restarts.
*   **Updates:** To update container images (e.g., Prowlarr, qBittorrent), change the `*_VERSION` tag in your `.env` file (if using specific versions) or use `latest`. Then run:
    ```bash
    docker-compose pull
    docker-compose up -d --force-recreate <service_name_to_update>
    ```
    Or recreate all: `docker-compose up -d --force-recreate`

## Troubleshooting

*   **Container Logs:** The first place to check for errors:
    ```bash
    docker logs <container_name>
    # Examples:
    # docker logs nordvpn_official
    # docker logs ai_media_mcp_server
    # docker logs ai_media_prowlarr
    ```
*   **Prowlarr 401 Unauthorized:** Ensure `PROWLARR_API_KEY` in `.env` exactly matches the key in Prowlarr UI (Settings -> General -> Security). Restart `mcp-server` after updating `.env`.
*   **Cannot Access UIs (e.g., Prowlarr) when VPN is connected:**
    1.  Verify `LOCAL_NETWORK` in `.env` is correct.
    2.  Check `nordvpn_official` logs to see if `killswitch off` and `whitelist add subnet ${LOCAL_NETWORK}` commands were applied by `VPNManager` after connection.
    3.  Manually exec into `nordvpn_official` and run `nordvpn settings` to check current state.
*   **Name Resolution Failures (e.g., Prowlarr can't reach qBittorrent):**
    *   This was addressed by having `VPNManager` attempt to set `nordvpn set dns 127.0.0.11 ...` after connecting.
    *   If it recurs, exec into `nordvpn_official` (when VPN is on) and test `cat /etc/resolv.conf` and `nslookup qbittorrent`.
*   **General Docker Issues:**
    *   `docker-compose ps`: Check status of all containers.
    *   `docker network inspect ai-media-network`: Inspect network configuration.

## Future Considerations

*   **Cloudflare Tunnel:** For secure remote access without router port forwarding.
*   **qBittorrent via VPN:** The current setup has qBittorrent traffic using the host's network. For advanced privacy, qBittorrent could be configured to route its traffic through the VPN (e.g., via SOCKS5 proxy or network interface binding, which is more complex).

docker run cloudflare/cloudflared:latest tunnel --no-autoupdate run --token eyJhIjoiMDkwNWM3MGE5NzRhYzc0NjFkYTlmZTg3ZDc3MzI3ZWEiLCJ0IjoiZDRiYzhiODgtOGZhYy00MWZlLTkxYmUtMzE4ODg4YTlhMzE2IiwicyI6Ik1UUmlZek13WVRJdE9XWmpNaTAwT0RnMUxUa3dOR0l0Tm1ZeVlUZzRPV1JrTlRrMiJ9
