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
export declare class VPNManager {
    private disconnectTimer;
    private manualDisconnect;
    private readonly DISCONNECT_DELAY;
    private readonly CONNECTION_TIMEOUT;
    private readonly CONTAINER_NAME;
    constructor();
    /**
     * Get current VPN connection status
     */
    getVPNStatus(): Promise<VPNStatus>;
    /**
     * Connect to VPN with Australian server preference
     */
    connectVPN(preferredCity?: string): Promise<VPNConnectionResult>;
    /**
     * Disconnect from VPN
     */
    disconnectVPN(): Promise<VPNConnectionResult>;
    /**
     * Check if VPN needs authentication setup
     */
    checkAuthentication(): Promise<{
        authenticated: boolean;
        loginUrl?: string;
    }>;
    /**
     * Start auto-disconnect timer
     */
    private startDisconnectTimer;
    /**
     * Clear disconnect timer
     */
    private clearDisconnectTimer;
    /**
     * Reset disconnect timer (call when there's activity)
     */
    resetDisconnectTimer(): void;
    /**
     * Sleep utility
     */
    private sleep;
    /**
     * Get recommended VPN cities for different regions
     */
    getRecommendedCities(): string[];
    /**
     * Test VPN connection speed/quality
     */
    testVPNConnection(): Promise<{
        success: boolean;
        latency?: number;
        speed?: string;
    }>;
}
export {};
