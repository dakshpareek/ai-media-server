import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Updated VPNStatus interface to be more comprehensive
export interface VPNStatus {
  connected: boolean;
  city?: string;
  country?: string;
  ip?: string;
  server?: string; // e.g., us1234.nordvpn.com
  protocol?: string; // e.g., UDP, TCP
  technology?: string; // e.g., NORDLYNX, OPENVPN
  uptime?: string; // From nordvpn status output
  authenticated?: boolean; // Is the user logged into NordVPN?
  needsLogin?: boolean; // Does the user explicitly need to log in?
  loginUrl?: string; // URL for browser login if needed
  message?: string; // General status message or error
  connectionTime?: number; // Timestamp (ms) of when connectVPN last succeeded locally
}

export interface VPNConnectionResult {
  success: boolean;
  message: string;
  status?: VPNStatus; // Return the full status object
}

export class VPNManager {
  private disconnectTimer: NodeJS.Timeout | null = null;
  private manualDisconnectIntent = false;
  private readonly DISCONNECT_DELAY_MS = 10 * 60 * 1000; // 10 minutes
  private readonly CONNECTION_TIMEOUT_MS = 60000; // 60 seconds for VPN connection command
  private readonly COMMAND_TIMEOUT_MS = 30000; // 30 seconds for general commands
  private readonly NORDVPN_CONTAINER_NAME = 'nordvpn_official';

  private lastConnectTime: number | null = null; // Store timestamp of successful connect call

  constructor() {
    this.clearDisconnectTimer();
  }

  private async execInNordVPNContainer(command: string, timeout: number = this.COMMAND_TIMEOUT_MS): Promise<{ stdout: string; stderr: string }> {
    const dockerCommand = `docker exec ${this.NORDVPN_CONTAINER_NAME} ${command}`;
    // console.log(`VPNManager executing: ${dockerCommand}`);
    try {
      // Important: Use shell for complex commands if they involve pipes or NordVPN sub-commands that might not be direct executables
      // For simple 'nordvpn status', 'nordvpn connect', direct exec is fine.
      return await execAsync(dockerCommand, { timeout });
    } catch (error: any) {
      // console.error(`VPNManager: Error executing in NordVPN container ('${command}'):`, error.stderr || error.stdout || error.message);
      const stderr = error.stderr?.toString().trim() || 'N/A';
      const stdout = error.stdout?.toString().trim() || 'N/A';
      throw new Error(`NordVPN command '${command}' failed: ${error.message} (stderr: ${stderr}, stdout: ${stdout})`);
    }
  }

  private parseNordVPNStatusOutput(stdout: string): Omit<VPNStatus, 'authenticated' | 'needsLogin' | 'loginUrl' | 'message' | 'connectionTime'> {
    const status: Partial<VPNStatus> = { connected: false };

    if (stdout.includes("Status: Connected")) {
      status.connected = true;
      status.city = stdout.match(/City: (.*)/)?.[1]?.trim();
      status.country = stdout.match(/Country: (.*)/)?.[1]?.trim();
      status.ip = stdout.match(/Your new IP: (.*)/)?.[1]?.trim() || stdout.match(/Current IP: (.*)/)?.[1]?.trim();
      status.server = stdout.match(/Current server: (.*)/)?.[1]?.trim();
      status.protocol = stdout.match(/Protocol: (.*)/)?.[1]?.trim();
      status.technology = stdout.match(/Technology: (.*)/)?.[1]?.trim();
      status.uptime = stdout.match(/Uptime: (.*)/)?.[1]?.trim();
    }
    return status as VPNStatus; // Cast, knowing other fields will be added
  }

  async getVPNStatus(): Promise<VPNStatus> {
    let authenticated: boolean | undefined;
    let needsLogin: boolean | undefined;
    let loginUrl: string | undefined;
    let connectionStatusMessage: string | undefined;

    try {
      // Check account status first
      try {
        await this.execInNordVPNContainer('nordvpn account', 10000);
        authenticated = true;
        needsLogin = false;
      } catch (accountError: any) {
        const errorMsg = (accountError.message || '').toLowerCase();
        if (errorMsg.includes("you are not logged in") || errorMsg.includes("please login")) {
          authenticated = false;
          needsLogin = true;
          connectionStatusMessage = "NordVPN requires login.";
          try {
            // Attempt to get login URL if not authenticated
            const { stdout: loginCmdOutput } = await this.execInNordVPNContainer('nordvpn login --callback', 15000); // Added --callback
            loginUrl = loginCmdOutput.match(/https:\/\/[^\s'"]+/)?.[0];
             if (!loginUrl) { // Fallback if --callback fails or doesn't provide URL directly in stdout
                const { stdout: loginCmdOutputFallback } = await this.execInNordVPNContainer('nordvpn login', 15000);
                loginUrl = loginCmdOutputFallback.match(/https:\/\/[^\s'"]+/)?.[0];
            }
          } catch (loginUrlError: any) {
            // console.warn("VPNManager: Failed to get login URL:", loginUrlError.message);
          }
        } else {
          // Some other error with 'nordvpn account' - could be daemon issue
          // console.warn("VPNManager: 'nordvpn account' command failed with an unexpected error:", accountError.message);
          // Treat as unable to determine auth status, potentially problematic.
          authenticated = undefined;
          needsLogin = undefined; // Can't be sure
          connectionStatusMessage = `Error checking NordVPN account status: ${accountError.message}`;
           return { connected: false, authenticated, needsLogin, loginUrl, message: connectionStatusMessage };
        }
      }

      if (needsLogin === true) { // Explicitly check true, as it could be undefined
        return { connected: false, authenticated, needsLogin, loginUrl, message: connectionStatusMessage };
      }

      // If authenticated (or auth check didn't force a needsLogin state), get connection status
      const { stdout: statusStdout } = await this.execInNordVPNContainer('nordvpn status');
      const parsedStatus = this.parseNordVPNStatusOutput(statusStdout);

      return {
        ...parsedStatus,
        authenticated,
        needsLogin, // Should be false if we reached here
        loginUrl,   // Should be undefined if we reached here
        message: parsedStatus.connected ? "VPN Connected." : "VPN Disconnected.",
        connectionTime: parsedStatus.connected ? (this.lastConnectTime || undefined) : undefined
      };

    } catch (error: any) {
      // console.error('VPNManager: General error in getVPNStatus:', error.message);
       // Check if the error message itself indicates not logged in
      if (error.message?.toLowerCase().includes("you are not logged in")) {
        return { connected: false, authenticated: false, needsLogin: true, loginUrl, message: "NordVPN requires login (detected in general error)." };
      }
      return {
        connected: false,
        authenticated,
        needsLogin,
        loginUrl,
        message: `Error getting VPN status: ${error.message}`
      };
    }
  }

  private async applyPostConnectionSettings(): Promise<void> {
    // console.log("VPNManager: Applying post-connection settings...");
    try {
      await this.execInNordVPNContainer('nordvpn set killswitch off', 15000);
      // console.log("VPNManager: Killswitch set to off (post-connect).");

      try {
        await this.execInNordVPNContainer('nordvpn set lan-discovery on', 15000);
        // console.log("VPNManager: LAN Discovery set to on (post-connect).");
      } catch (lanError: any) {
        // console.warn("VPNManager: Failed to set LAN discovery post-connect (continuing):", lanError.message);
      }

      await this.execInNordVPNContainer('nordvpn set notify off', 15000); // Disable desktop notifications

      // --- ATTEMPT TO FIX DNS ---
      try {
        // Set DNS to Docker's internal resolver FIRST, then a public one as fallback for external.
        // NordVPN CLI might only take the first ones it can use or override completely.
        // The goal is to ensure 127.0.0.11 is used for local Docker network resolution.
        await this.execInNordVPNContainer('nordvpn set dns 127.0.0.11 1.1.1.1 1.0.0.1', 20000);
        // console.log("VPNManager: Attempted to set NordVPN DNS to 127.0.0.11 and public fallbacks.");
      } catch (nordDnsError: any) {
        // console.warn("VPNManager: Failed to set NordVPN DNS:", nordDnsError.message);
      }

      const localNetworkEnv = process.env.LOCAL_NETWORK;
      if (localNetworkEnv) {
        try {
            await this.execInNordVPNContainer(`nordvpn whitelist add subnet "${localNetworkEnv}"`, 15000);
            // console.log(`VPNManager: Whitelisted ${localNetworkEnv} (post-connect).`);
        } catch (error: any) { /* console.warn(`VPNManager: Failed to whitelist ${localNetworkEnv} (post-connect): ${error.message}`); */ }
      } else {
        // console.warn("VPNManager: LOCAL_NETWORK env var not available to mcp-server. Cannot whitelist primary LAN post-connect.");
      }

      const dockerSubnets = ["172.17.0.0/16", "172.18.0.0/16", "172.19.0.0/16", "172.20.0.0/16", "172.21.0.0/16", "172.22.0.0/16"];
      // Also add the subnet for ai-media-network if it's different and known
      const aiMediaNetworkSubnet = process.env.AI_MEDIA_NETWORK_SUBNET; // You'd need to pass this to mcp-server env
      if (aiMediaNetworkSubnet && !dockerSubnets.includes(aiMediaNetworkSubnet)) {
        dockerSubnets.push(aiMediaNetworkSubnet);
      }

      for (const subnet of dockerSubnets) {
        try {
          await this.execInNordVPNContainer(`nordvpn whitelist add subnet "${subnet}"`, 15000);
          // console.log(`VPNManager: Whitelisted Docker subnet ${subnet} (post-connect).`);
        } catch (dockerSubnetError: any) {
          // console.warn(`VPNManager: Failed to whitelist Docker subnet ${subnet} post-connect (may be ok):`, dockerSubnetError.message);
        }
      }
      // console.log("VPNManager: Post-connection settings applied.");
    } catch (error: any) {
      console.error("VPNManager: Error applying post-connection settings:", error.message);
    }
  }

  async connectVPN(preferredCity: string = ''): Promise<VPNConnectionResult> {
    this.manualDisconnectIntent = false;
    this.lastConnectTime = null;

    try {
      const initialStatus = await this.getVPNStatus();
      if (initialStatus.needsLogin === true) { // Explicit check
        return { success: false, message: initialStatus.message || "NordVPN not authenticated. Please log in first.", status: initialStatus };
      }

      if (initialStatus.connected) {
        // console.log("VPNManager: VPN reported as already connected. Re-applying LAN settings and resetting timer.");
        await this.applyPostConnectionSettings();
        this.lastConnectTime = initialStatus.connectionTime || Date.now();
        this.resetDisconnectTimer(); // Reset timer even if already connected
        return { success: true, message: "VPN already connected. LAN settings re-applied.", status: await this.getVPNStatus() };
      }

      const connectCommand = preferredCity ? `nordvpn connect "${preferredCity.replace(/"/g, '\\"')}"` : 'nordvpn connect'; // Sanitize preferredCity
      // console.log(`VPNManager: Attempting to connect with command: ${connectCommand}`);
      await this.execInNordVPNContainer(connectCommand, this.CONNECTION_TIMEOUT_MS);

      // console.log("VPNManager: Connect command sent. Waiting for stabilization (8s)...");
      await this.sleep(8000);

      const statusAfterConnectAttempt = await this.getVPNStatus();

      if (statusAfterConnectAttempt.connected) {
        // console.log("VPNManager: VPN connection confirmed. Applying post-connection LAN settings...");
        await this.applyPostConnectionSettings();

        const finalStatus = await this.getVPNStatus();
        if (!finalStatus.connected) {
            // console.warn("VPNManager: VPN disconnected after applying post-connection settings. This is unexpected.");
            throw new Error("VPN unexpectedly disconnected after post-connection settings were applied.");
        }

        this.lastConnectTime = Date.now();
        this.startDisconnectTimer();
        return {
          success: true,
          message: `Successfully connected VPN${finalStatus.city ? ` to ${finalStatus.city}` : ''}. LAN settings applied.`,
          status: finalStatus
        };
      } else {
        // console.warn("VPNManager: VPN connection verification failed after connect command.");
        let failMsg = 'VPN connection verification failed.';
        if (statusAfterConnectAttempt.message && statusAfterConnectAttempt.message !== "NordVPN requires login.") {
            failMsg += ` Status details: ${statusAfterConnectAttempt.message}`;
        } else if (statusAfterConnectAttempt.needsLogin) {
            failMsg = "NordVPN requires login (detected after connect attempt).";
        }
        throw new Error(failMsg);
      }
    } catch (error: any) {
      // console.error('VPNManager: connectVPN main catch block error:', error.message);
      // Fetch status again to return the most current state
      const currentStatusOnError = await this.getVPNStatus();
      return {
        success: false,
        message: `Failed to connect VPN: ${error.message}`,
        status: currentStatusOnError
      };
    }
  }

  async disconnectVPN(): Promise<VPNConnectionResult> {
    this.manualDisconnectIntent = true;
    this.clearDisconnectTimer();
    this.lastConnectTime = null;

    try {
      const initialStatus = await this.getVPNStatus();
      if (initialStatus.needsLogin === true) {
          return { success: false, message: initialStatus.message || "Cannot disconnect, NordVPN needs login.", status: initialStatus };
      }
      if (!initialStatus.connected) {
          // console.log("VPNManager: disconnectVPN called, but VPN was already disconnected.");
          return { success: true, message: "VPN was already disconnected.", status: initialStatus };
      }

      // console.log("VPNManager: Attempting to disconnect VPN...");
      await this.execInNordVPNContainer('nordvpn disconnect', this.COMMAND_TIMEOUT_MS); // Use general command timeout

      // console.log("VPNManager: Disconnect command sent. Waiting for stabilization (3s)...");
      await this.sleep(3000);

      const newStatus = await this.getVPNStatus();
      if (!newStatus.connected) {
        // console.log("VPNManager: VPN disconnection confirmed.");
        return {
          success: true,
          message: 'VPN disconnected successfully. Auto-disconnect timer cleared.',
          status: newStatus
        };
      } else {
        // console.warn("VPNManager: VPN disconnection verification failed; NordVPN client still reports as connected.");
        // This could be due to killswitch or auto-reconnect if not properly disabled.
        // The settings in entrypoint.sh and applyPostConnectionSettings aim to prevent this.
        throw new Error('VPN disconnection verification failed; NordVPN client still reports as connected.');
      }
    } catch (error: any) {
      // console.error('VPNManager: disconnectVPN main catch block error:', error.message);
      const currentStatusOnError = await this.getVPNStatus();
      return {
        success: false,
        message: `Failed to disconnect VPN: ${error.message}. Auto-disconnect timer cleared due to intent.`,
        status: currentStatusOnError
      };
    }
  }

  private startDisconnectTimer(): void {
    if (this.manualDisconnectIntent) {
      // console.log('VPNManager: Skipping auto-disconnect timer (manual disconnect intent active).');
      return;
    }
    this.clearDisconnectTimer();
    // console.log(`VPNManager: Setting VPN auto-disconnect timer for ${this.DISCONNECT_DELAY_MS / 1000 / 60} minutes.`);
    this.disconnectTimer = setTimeout(async () => {
      if (this.manualDisconnectIntent) {
        // console.log('VPNManager: Auto-disconnect aborted (manual disconnect intent became active).');
        return;
      }
      // console.log('VPNManager: Auto-disconnecting VPN due to inactivity...');
      await this.disconnectVPN();
    }, this.DISCONNECT_DELAY_MS);
  }

  private clearDisconnectTimer(): void {
    if (this.disconnectTimer) {
      clearTimeout(this.disconnectTimer);
      this.disconnectTimer = null;
      // console.log("VPNManager: Auto-disconnect timer cleared.");
    }
  }

  resetDisconnectTimer(): void {
    // Only reset the timer if there's an active programmatic connection
    // and no manual disconnect intent.
    if (this.lastConnectTime && !this.manualDisconnectIntent) {
        // console.log("VPNManager: Resetting auto-disconnect timer due to activity.");
        this.startDisconnectTimer();
    } else {
        // console.log("VPNManager: Not resetting timer (VPN not connected programmatically or manual disconnect intent).");
    }
  }

  getRecommendedCities(): string[] {
    return ['australia', 'singapore', 'united_states', 'canada', 'netherlands', 'switzerland', 'japan'];
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Test connection was not used by your MCP server logic, so I'm omitting it
  // for brevity unless you specifically need it.
  // async testVPNConnection(): Promise...
}
