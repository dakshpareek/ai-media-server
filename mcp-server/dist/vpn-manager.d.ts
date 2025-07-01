export interface VPNStatus {
    connected: boolean;
    city?: string;
    country?: string;
    ip?: string;
    server?: string;
    protocol?: string;
    technology?: string;
    uptime?: string;
    authenticated?: boolean;
    needsLogin?: boolean;
    loginUrl?: string;
    message?: string;
    connectionTime?: number;
}
export interface VPNConnectionResult {
    success: boolean;
    message: string;
    status?: VPNStatus;
}
export declare class VPNManager {
    private disconnectTimer;
    private manualDisconnectIntent;
    private readonly DISCONNECT_DELAY_MS;
    private readonly CONNECTION_TIMEOUT_MS;
    private readonly COMMAND_TIMEOUT_MS;
    private readonly NORDVPN_CONTAINER_NAME;
    private lastConnectTime;
    constructor();
    private execInNordVPNContainer;
    private parseNordVPNStatusOutput;
    getVPNStatus(): Promise<VPNStatus>;
    private applyPostConnectionSettings;
    connectVPN(preferredCity?: string): Promise<VPNConnectionResult>;
    disconnectVPN(): Promise<VPNConnectionResult>;
    private startDisconnectTimer;
    private clearDisconnectTimer;
    resetDisconnectTimer(): void;
    getRecommendedCities(): string[];
    private sleep;
}
