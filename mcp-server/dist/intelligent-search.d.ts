import { SearchResult } from './search.js';
import { VPNManager } from './vpn-manager.js';
interface IntelligentSearchResult {
    success: boolean;
    message: string;
    searchResults?: SearchResult[];
    formattedResults?: string;
    vpnConnected?: boolean;
    vpnDetails?: any;
    healthScore?: number;
    indexersFixed?: number;
}
export declare class IntelligentSearchManager {
    private healthMonitor;
    private searchManager;
    private vpnManager;
    private readonly HEALTH_THRESHOLD;
    constructor(baseUrl: string, apiKey: string);
    /**
     * Intelligent search that auto-manages VPN based on indexer health
     */
    intelligentSearch(query: string, indexerIds?: number[], categories?: number[], limit?: number): Promise<IntelligentSearchResult>;
    /**
     * Ensure VPN connection is established
     */
    private connectVPNWithFallback;
    /**
     * Check if VPN is currently connected
     */
    private isVPNConnected;
    /**
     * Get current health score
     */
    private getCurrentHealthScore;
    /**
     * Build success message with context
     */
    private buildSuccessMessage;
    /**
     * Get VPN manager instance for external use
     */
    getVPNManager(): VPNManager;
    /**
     * Sleep utility
     */
    private sleep;
    /**
     * Get comprehensive status including VPN and health
     */
    getSystemStatus(): Promise<any>;
    private calculateHealthScore;
    private countHealthyIndexers;
    private lastVPNResult;
    private RECOVERY_WAIT_TIME;
}
export {};
