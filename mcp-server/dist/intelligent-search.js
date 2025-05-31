import { ProwlarrHealthMonitor } from './health-check.js';
import { ProwlarrSearchManager } from './search.js';
import { VPNManager } from './vpn-manager.js';
export class IntelligentSearchManager {
    healthMonitor;
    searchManager;
    vpnManager;
    HEALTH_THRESHOLD = 50; // Minimum health score required
    constructor(baseUrl, apiKey) {
        this.healthMonitor = new ProwlarrHealthMonitor(baseUrl, apiKey);
        this.searchManager = new ProwlarrSearchManager(baseUrl, apiKey);
        this.vpnManager = new VPNManager();
    }
    /**
     * Intelligent search that auto-manages VPN based on indexer health
     */
    async intelligentSearch(query, indexerIds, categories, limit = 20) {
        try {
            // console.log(`🧠 Starting intelligent search for: "${query}"`);
            // Check initial health
            // console.log('🏥 Checking indexer health...');
            const healthStatus = await this.healthMonitor.getHealthStatus();
            const initialHealthScore = this.calculateHealthScore(healthStatus);
            // console.log(`📊 Initial health score: ${initialHealthScore}%`);
            // Determine if VPN connection is needed
            const needsVPN = initialHealthScore < this.HEALTH_THRESHOLD;
            let vpnConnected = false;
            let vpnDetails = null;
            let indexersFixed = 0;
            if (needsVPN) {
                // console.log(`⚠️ Health score too low (${initialHealthScore}%). Attempting VPN connection...`);
                const vpnResult = await this.connectVPNWithFallback();
                if (vpnResult.success) {
                    // Give indexers time to recover
                    // console.log('⏳ Waiting for indexers to recover...');
                    await this.sleep(this.RECOVERY_WAIT_TIME);
                    // Check health again
                    const recoveredHealthStatus = await this.healthMonitor.getHealthStatus();
                    const newHealthScore = this.calculateHealthScore(recoveredHealthStatus);
                    indexersFixed = this.countHealthyIndexers(recoveredHealthStatus) - this.countHealthyIndexers(healthStatus);
                    // console.log(`📈 New health score: ${newHealthScore}% (fixed ${indexersFixed} indexers)`);
                    // Store result for potential reset
                    this.lastVPNResult = {
                        improved: newHealthScore > initialHealthScore,
                        initialScore: initialHealthScore,
                        newScore: newHealthScore,
                        indexersFixed
                    };
                    // Reset activity timer since we're searching
                    this.vpnManager.resetDisconnectTimer();
                    vpnConnected = true;
                    vpnDetails = vpnResult.vpnDetails;
                    if (newHealthScore < this.HEALTH_THRESHOLD) {
                        return {
                            success: false,
                            message: `⚠️ Indexers still unhealthy after VPN connection (${newHealthScore}%). Please check your configuration.`,
                            vpnConnected,
                            vpnDetails,
                            healthScore: newHealthScore,
                            indexersFixed
                        };
                    }
                }
                else {
                    // VPN connection failed, but continue with search anyway
                    this.lastVPNResult = {
                        improved: false,
                        initialScore: initialHealthScore,
                        newScore: initialHealthScore,
                        indexersFixed: 0
                    };
                }
            }
            else {
                // console.log('✅ Indexers are healthy, proceeding with search...');
                // Reset activity timer if VPN is connected
                const vpnStatus = await this.vpnManager.getVPNStatus();
                if (vpnStatus.connected) {
                    this.vpnManager.resetDisconnectTimer();
                }
            }
            // Perform the actual search
            // console.log('🔍 Executing search query...');
            const searchResults = await this.searchManager.search(query, indexerIds, categories, limit);
            if (searchResults.length === 0) {
                return {
                    success: false,
                    message: '🚫 No results found for your search query. Try different terms or check if more indexers are available.',
                    searchResults: [],
                    vpnConnected,
                    vpnDetails,
                    healthScore: await this.getCurrentHealthScore(),
                    indexersFixed
                };
            }
            // Step 5: Format results for display
            const formattedResults = this.searchManager.formatSearchResults(searchResults);
            // Step 6: Prepare success response
            const healthScore = await this.getCurrentHealthScore();
            const message = this.buildSuccessMessage(searchResults.length, vpnConnected, indexersFixed);
            return {
                success: true,
                message,
                searchResults,
                formattedResults,
                vpnConnected,
                vpnDetails,
                healthScore,
                indexersFixed
            };
        }
        catch (error) {
            console.error('❌ Intelligent search failed:', error);
            return {
                success: false,
                message: `Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                vpnConnected: await this.isVPNConnected()
            };
        }
    }
    /**
     * Ensure VPN connection is established
     */
    async connectVPNWithFallback() {
        try {
            // Check if already connected
            const currentStatus = await this.vpnManager.getVPNStatus();
            if (currentStatus.connected) {
                // console.log(`✅ VPN already connected to ${currentStatus.city}, ${currentStatus.country}`);
                return {
                    success: true,
                    vpnDetails: currentStatus
                };
            }
            // Try connecting to preferred locations
            const cities = this.vpnManager.getRecommendedCities();
            for (const city of cities) {
                // console.log(`🌏 Trying VPN connection to ${city}...`);
                const result = await this.vpnManager.connectVPN(city);
                if (result.success) {
                    // console.log(`✅ Successfully connected to ${city}`);
                    return {
                        success: true,
                        vpnDetails: result.status
                    };
                }
                else {
                    // console.log(`❌ Failed to connect to ${city}: ${result.message}`);
                }
            }
            return { success: false };
        }
        catch (error) {
            console.error('VPN connection attempt failed:', error);
            return { success: false };
        }
    }
    /**
     * Check if VPN is currently connected
     */
    async isVPNConnected() {
        try {
            const status = await this.vpnManager.getVPNStatus();
            return status.connected;
        }
        catch (error) {
            return false;
        }
    }
    /**
     * Get current health score
     */
    async getCurrentHealthScore() {
        try {
            const health = await this.healthMonitor.getHealthStatus();
            return this.calculateHealthScore(health);
        }
        catch (error) {
            return 0;
        }
    }
    /**
     * Build success message with context
     */
    buildSuccessMessage(resultCount, vpnConnected, indexersFixed) {
        let message = `🎉 Found ${resultCount} results for your search!`;
        if (vpnConnected && indexersFixed > 0) {
            message += `\n\n🔧 **Auto-fixed**: Connected VPN and restored ${indexersFixed} indexer${indexersFixed > 1 ? 's' : ''}`;
            message += `\n⏰ **VPN**: Will auto-disconnect in 10 minutes`;
        }
        else if (vpnConnected) {
            message += `\n\n🌐 **VPN**: Using existing VPN connection`;
            message += `\n⏰ **Timer**: Extended VPN session for 10 more minutes`;
        }
        return message;
    }
    /**
     * Get VPN manager instance for external use
     */
    getVPNManager() {
        return this.vpnManager;
    }
    /**
     * Sleep utility
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    /**
     * Get comprehensive status including VPN and health
     */
    async getSystemStatus() {
        try {
            const [healthStatus, vpnStatus] = await Promise.all([
                this.healthMonitor.getHealthStatus(),
                this.vpnManager.getVPNStatus()
            ]);
            return {
                timestamp: new Date().toISOString(),
                health: healthStatus,
                vpn: vpnStatus,
                ready_for_search: this.calculateHealthScore(healthStatus) >= this.HEALTH_THRESHOLD
            };
        }
        catch (error) {
            return {
                timestamp: new Date().toISOString(),
                error: error instanceof Error ? error.message : 'Unknown error',
                ready_for_search: false
            };
        }
    }
    calculateHealthScore(healthStatus) {
        // Implement the logic to calculate health score based on healthStatus
        // This is a placeholder and should be replaced with the actual implementation
        return parseInt(healthStatus.health_score.replace('%', ''));
    }
    countHealthyIndexers(healthStatus) {
        // Implement the logic to count healthy indexers based on healthStatus
        // This is a placeholder and should be replaced with the actual implementation
        return healthStatus.indexers.healthy;
    }
    lastVPNResult = {
        improved: false,
        initialScore: 0,
        newScore: 0,
        indexersFixed: 0
    };
    RECOVERY_WAIT_TIME = 5000; // Assuming a default value, actual implementation needed
}
//# sourceMappingURL=intelligent-search.js.map