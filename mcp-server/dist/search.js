import axios from 'axios';
export class ProwlarrSearchManager {
    baseUrl;
    apiKey;
    constructor(baseUrl, apiKey) {
        this.baseUrl = baseUrl.replace(/\/$/, '');
        this.apiKey = apiKey;
    }
    getHeaders() {
        return {
            'X-Api-Key': this.apiKey,
            'Content-Type': 'application/json'
        };
    }
    /**
     * Search for content across indexers
     */
    async search(query, indexerIds, categories, limit = 20) {
        try {
            const params = new URLSearchParams();
            params.append('query', query);
            if (indexerIds && indexerIds.length > 0) {
                params.append('indexerIds', indexerIds.join(','));
            }
            else {
                params.append('indexerIds', '-2'); // -2 = all torrents
            }
            if (categories && categories.length > 0) {
                params.append('categories', categories.join(','));
            }
            params.append('type', 'search');
            params.append('limit', limit.toString());
            const url = `${this.baseUrl}/api/v1/search?${params.toString()}`;
            const response = await axios.get(url, {
                headers: this.getHeaders(),
                timeout: 180000
            });
            return response.data || [];
        }
        catch (error) {
            console.error('Search failed:', error);
            throw new Error(`Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Grab/Download a specific release
     */
    async grabRelease(guid, indexerId) {
        try {
            const grabData = {
                guid: guid,
                indexerId: indexerId
            };
            const response = await axios.post(`${this.baseUrl}/api/v1/search`, grabData, {
                headers: this.getHeaders(),
                timeout: 180000
            });
            return {
                success: true,
                message: 'Release successfully sent to download client',
                result: response.data
            };
        }
        catch (error) {
            console.error('Grab failed:', error);
            let errorMessage = 'Unknown error';
            if (axios.isAxiosError(error)) {
                errorMessage = error.response?.data?.message || error.message;
            }
            else if (error instanceof Error) {
                errorMessage = error.message;
            }
            return {
                success: false,
                message: `Grab failed: ${errorMessage}`
            };
        }
    }
    /**
     * Get available download clients
     */
    async getDownloadClients() {
        try {
            const response = await axios.get(`${this.baseUrl}/api/v1/downloadclient`, {
                headers: this.getHeaders(),
                timeout: 180000
            });
            return response.data || [];
        }
        catch (error) {
            console.error('Failed to get download clients:', error);
            throw new Error(`Failed to get download clients: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Format search results for display with intelligent guidance
     */
    formatSearchResults(results) {
        if (!results || results.length === 0) {
            return `🚫 **No results found**

**Troubleshooting Steps:**
1. 🔍 Try a different search query or broader terms
2. 🌐 **Check VPN connection** - Use \`prowlarr_vpn_status\` to see if connected
3. 🔧 **Check indexer health** - Use \`prowlarr_health_check\` to see if indexers are working
4. 🌍 **Try different VPN location** - Some indexers work better from specific regions

**Quick Actions:**
- \`prowlarr_health_check\` - Check what's broken
- \`prowlarr_vpn_connect australia\` - Try connecting to Australia
- \`prowlarr_vpn_connect singapore\` - Or try Singapore`;
        }
        const formattedResults = results.map((result, index) => ({
            option: index + 1,
            title: result.title || 'Unknown Title',
            size: this.formatFileSize(result.size || 0),
            quality: this.extractQuality(result.title || ''),
            seeders: result.seeders || 0,
            peers: (result.leechers || 0) + (result.seeders || 0),
            indexer: result.indexer || 'Unknown',
            age: this.formatAge(result.ageHours || 0),
            downloadUrl: result.downloadUrl,
            magnetUrl: result.magnetUrl,
            guid: result.guid,
            indexerId: result.indexerId
        }));
        // Analyze search quality for intelligent guidance
        const totalResults = results.length;
        const goodResults = formattedResults.filter(r => r.seeders >= 5).length;
        const recentResults = formattedResults.filter(r => (results[r.option - 1]?.ageHours || 999) < 168).length; // < 1 week
        const qualityScore = (goodResults + recentResults) / (totalResults * 2);
        let output = `🔍 **Search Results** (${results.length} found)\n\n`;
        formattedResults.forEach((result) => {
            const seedHealth = this.getSeedHealthEmoji(result.seeders);
            const sizeIcon = this.getSizeIcon(result.size);
            output += `**${result.option}.** ${result.title}\n`;
            output += `${sizeIcon} **Size:** ${result.size} | ${seedHealth} **Seeds:** ${result.seeders} | **Peers:** ${result.peers}\n`;
            output += `🏷️ **Indexer:** ${result.indexer} | ⏰ **Age:** ${result.age}\n`;
            output += `🎬 **Quality:** ${result.quality}\n\n`;
        });
        output += '💡 **To download:** Use `prowlarr_grab_release` with option number (e.g., option: 1)\n';
        output += '📊 **Legend:** 🟢 Good seeds | 🟡 Low seeds | 🔴 No seeds | 💾 Small | 📀 Medium | 🎬 Large\n\n';
        // Add intelligent guidance based on result quality
        if (qualityScore < 0.3) {
            output += `⚠️ **Search Quality: Poor** (${Math.round(qualityScore * 100)}% good results)\n\n`;
            output += `**Suggested Actions:**\n`;
            output += `1. 🌐 **Try VPN connection** - \`prowlarr_vpn_connect australia\` or \`prowlarr_vpn_connect singapore\`\n`;
            output += `2. 🔧 **Check indexer health** - \`prowlarr_health_check\`\n`;
            output += `3. 🔄 **Try different search terms** - Be more specific or use alternative titles\n`;
            output += `4. 📍 **Try different VPN location** if already connected\n`;
        }
        else if (qualityScore < 0.6) {
            output += `⚡ **Search Quality: Fair** (${Math.round(qualityScore * 100)}% good results)\n\n`;
            output += `**Consider:** \`prowlarr_vpn_connect\` to access more indexers for better results\n`;
        }
        else {
            output += `✅ **Search Quality: Excellent** (${Math.round(qualityScore * 100)}% good results)\n`;
        }
        return output;
    }
    /**
     * Get a specific search result by option number
     */
    getResultByOption(results, option) {
        if (!results || option < 1 || option > results.length) {
            return null;
        }
        return results[option - 1];
    }
    formatFileSize(bytes) {
        if (bytes === 0)
            return '0 B';
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        const size = (bytes / Math.pow(1024, i)).toFixed(1);
        return `${size} ${sizes[i]}`;
    }
    formatAge(hours) {
        if (hours < 1)
            return '< 1h';
        if (hours < 24)
            return `${Math.round(hours)}h`;
        const days = Math.floor(hours / 24);
        if (days < 7)
            return `${days}d`;
        if (days < 30)
            return `${Math.floor(days / 7)}w`;
        if (days < 365)
            return `${Math.floor(days / 30)}mo`;
        return `${Math.floor(days / 365)}y`;
    }
    extractQuality(title) {
        const qualityMatches = [
            { pattern: /2160p|4K/i, quality: '4K UHD' },
            { pattern: /1080p/i, quality: '1080p HD' },
            { pattern: /720p/i, quality: '720p HD' },
            { pattern: /480p/i, quality: '480p SD' },
            { pattern: /HDR/i, quality: 'HDR' },
            { pattern: /BluRay|BDRip/i, quality: 'BluRay' },
            { pattern: /WEBRip|WEB-DL/i, quality: 'WEB' },
            { pattern: /DVDRip/i, quality: 'DVD' },
            { pattern: /CAM|HDCAM/i, quality: 'CAM' },
            { pattern: /HEVC|x265/i, quality: 'HEVC' },
            { pattern: /x264/i, quality: 'x264' }
        ];
        const found = qualityMatches.filter(q => q.pattern.test(title));
        return found.length > 0 ? found.map(q => q.quality).join(' / ') : 'Unknown';
    }
    getSeedHealthEmoji(seeders) {
        if (seeders >= 10)
            return '🟢';
        if (seeders >= 1)
            return '🟡';
        return '🔴';
    }
    getSizeIcon(size) {
        const sizeValue = parseFloat(size);
        const unit = size.split(' ')[1];
        if (unit === 'GB' && sizeValue >= 10)
            return '🎬';
        if (unit === 'GB' || (unit === 'MB' && sizeValue >= 500))
            return '📀';
        return '💾';
    }
}
//# sourceMappingURL=search.js.map