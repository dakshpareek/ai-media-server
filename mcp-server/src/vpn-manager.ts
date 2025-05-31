import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface VPNStatus {
  connected: boolean;
  city?: string;
  country?: string;
  ip?: string;
  connectionTime?: Date;
  authenticated?: boolean;
  needsLogin?: boolean;
}

interface VPNConnectionResult {
  success: boolean;
  message: string;
  status?: VPNStatus;
}

export class VPNManager {
  private disconnectTimer: NodeJS.Timeout | null = null;
  private manualDisconnect = false;  // Track if user manually disconnected
  private readonly DISCONNECT_DELAY = 10 * 60 * 1000; // 10 minutes
  private readonly CONNECTION_TIMEOUT = 30000; // 30 seconds
  private readonly CONTAINER_NAME = 'nordvpn_official'; // Correct container name
  
  constructor() {
    // Clean up any existing timer on initialization
    this.clearDisconnectTimer();
  }

  /**
   * Get current VPN connection status
   */
  async getVPNStatus(): Promise<VPNStatus> {
    try {
      // Call nordvpn status from the nordvpn container
      const { stdout: vpnDetails } = await execAsync('docker exec nordvpn_official nordvpn status');

      // Check if user is authenticated
      if (vpnDetails.includes('You are not logged in')) {
        return { 
          connected: false, 
          authenticated: false, 
          needsLogin: true 
        };
      }

      const isConnected = vpnDetails.includes('Status: Connected');
      
      if (!isConnected) {
        return { 
          connected: false, 
          authenticated: true, 
          needsLogin: false 
        };
      }

      // Extract connection details
      const cityMatch = vpnDetails.match(/City: (.+)/);
      const countryMatch = vpnDetails.match(/Country: (.+)/);
      const ipMatch = vpnDetails.match(/Your new IP: (.+)/);

      return {
        connected: true,
        authenticated: true,
        needsLogin: false,
        city: cityMatch?.[1]?.trim(),
        country: countryMatch?.[1]?.trim(),
        ip: ipMatch?.[1]?.trim(),
        connectionTime: new Date()
      };
    } catch (error) {
      console.error('Failed to get VPN status:', error);
      return { connected: false, needsLogin: false };
    }
  }

  /**
   * Connect to VPN with Australian server preference
   */
  async connectVPN(preferredCity: string = 'australia'): Promise<VPNConnectionResult> {
    try {
      // Check if authenticated
      const status = await this.getVPNStatus();
      if (status.needsLogin) {
        return {
          success: false,
          message: 'NordVPN not authenticated. Please authenticate via browser login.'
        };
      }
      
      // Try to connect to preferred location via nordvpn container
      const { stdout, stderr } = await execAsync(`docker exec nordvpn_official nordvpn connect ${preferredCity}`, { 
        timeout: this.CONNECTION_TIMEOUT 
      });
      
      // Wait a moment for connection to stabilize
      await this.sleep(3000);
      
      // Verify connection
      const newStatus = await this.getVPNStatus();
      
      if (newStatus.connected) {
        // Clear manual disconnect flag - user explicitly connected
        this.manualDisconnect = false;
        
        // Clear any existing timer and start new disconnect timer
        this.startDisconnectTimer();
        
        return {
          success: true,
          message: `Successfully connected to VPN in ${newStatus.city}, ${newStatus.country}`,
          status: newStatus
        };
      } else {
        throw new Error('VPN connection verification failed');
      }
      
    } catch (error) {
      return {
        success: false,
        message: `Failed to connect VPN: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Disconnect from VPN
   */
  async disconnectVPN(): Promise<VPNConnectionResult> {
    try {
      const { stdout } = await execAsync('docker exec nordvpn_official nordvpn disconnect');
      
      // Set manual disconnect flag to prevent auto-reconnection
      this.manualDisconnect = true;
      
      // Clear disconnect timer
      this.clearDisconnectTimer();
      
      // Verify disconnection
      const status = await this.getVPNStatus();
      
      if (!status.connected) {
        return {
          success: true,
          message: 'VPN disconnected successfully - will not auto-reconnect',
          status
        };
      } else {
        throw new Error('VPN disconnection verification failed');
      }
      
    } catch (error) {
      return {
        success: false,
        message: `Failed to disconnect VPN: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Check if VPN needs authentication setup
   */
  async checkAuthentication(): Promise<{ authenticated: boolean; loginUrl?: string }> {
    try {
      const status = await this.getVPNStatus();
      
      if (status.needsLogin) {
        // Try to get login URL from nordvpn container
        const { stdout } = await execAsync('docker exec nordvpn_official nordvpn login');
        const urlMatch = stdout.match(/https:\/\/[^\s]+/);
        
        return {
          authenticated: false,
          loginUrl: urlMatch?.[0]
        };
      }
      
      return { authenticated: true };
    } catch (error) {
      return { authenticated: false };
    }
  }

  /**
   * Start auto-disconnect timer
   */
  private startDisconnectTimer(): void {
    // Don't set timer if user manually disconnected
    if (this.manualDisconnect) {
      console.log('⏸️ Skipping auto-disconnect timer - user manually disconnected');
      return;
    }
    
    this.clearDisconnectTimer();
    
    // console.log(`⏰ Setting VPN auto-disconnect for ${this.DISCONNECT_DELAY / 1000 / 60} minutes`);
    
    this.disconnectTimer = setTimeout(async () => {
      // Don't auto-disconnect if user manually disconnected
      if (this.manualDisconnect) {
        console.log('⏸️ Skipping auto-disconnect - user manually disconnected');
        return;
      }
      
      // console.log('⏰ Auto-disconnecting VPN due to inactivity...');
      await this.disconnectVPN();
    }, this.DISCONNECT_DELAY);
  }

  /**
   * Clear disconnect timer
   */
  private clearDisconnectTimer(): void {
    if (this.disconnectTimer) {
      clearTimeout(this.disconnectTimer);
      this.disconnectTimer = null;
    }
  }

  /**
   * Reset disconnect timer (call when there's activity)
   */
  resetDisconnectTimer(): void {
    // Don't reset timer if user manually disconnected
    if (this.manualDisconnect) {
      return;
    }
    
    if (this.disconnectTimer) {
      this.startDisconnectTimer();
    }
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get recommended VPN cities for different regions
   */
  getRecommendedCities(): string[] {
    return [
      'australia',
      'sydney', 
      'melbourne',
      'perth',
      'singapore',
      'tokyo',
      'hong_kong'
    ];
  }

  /**
   * Test VPN connection speed/quality
   */
  async testVPNConnection(): Promise<{ success: boolean; latency?: number; speed?: string }> {
    try {
      const status = await this.getVPNStatus();
      if (!status.connected) {
        return { success: false };
      }

      // Simple latency test using ping from nordvpn container
      const { stdout } = await execAsync('docker exec nordvpn_official ping -c 3 8.8.8.8');
      const latencyMatch = stdout.match(/time=(\d+\.?\d*)/);
      const latency = latencyMatch ? parseFloat(latencyMatch[1]) : undefined;

      return {
        success: true,
        latency,
        speed: latency && latency < 100 ? 'fast' : latency && latency < 300 ? 'medium' : 'slow'
      };
    } catch (error) {
      return { success: false };
    }
  }
} 