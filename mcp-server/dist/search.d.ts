export interface SearchResult {
    guid: string;
    title: string;
    size: number;
    infoUrl?: string;
    downloadUrl?: string;
    magnetUrl?: string;
    indexer: string;
    indexerId: number;
    publishDate: string;
    categories: number[];
    seeders?: number;
    leechers?: number;
    downloadVolumeFactor?: number;
    uploadVolumeFactor?: number;
    categoryDesc?: string;
    protocol: string;
    privacy?: string;
    age: number;
    ageHours: number;
    ageMinutes: number;
    fileName?: string;
    indexerFlags?: string[];
    imdbId?: number;
    tmdbId?: number;
    tvdbId?: number;
    tvMazeId?: number;
    sortTitle?: string;
}
interface DownloadClient {
    id: number;
    name: string;
    implementation: string;
    host: string;
    port: number;
    enable: boolean;
    priority: number;
    protocol: string;
}
interface GrabResponse {
    success: boolean;
    message?: string;
    result?: SearchResult;
}
export declare class ProwlarrSearchManager {
    private baseUrl;
    private apiKey;
    constructor(baseUrl: string, apiKey: string);
    private getHeaders;
    /**
     * Search for content across indexers
     */
    search(query: string, indexerIds?: number[], categories?: number[], limit?: number): Promise<SearchResult[]>;
    /**
     * Grab/Download a specific release
     */
    grabRelease(guid: string, indexerId: number): Promise<GrabResponse>;
    /**
     * Get available download clients
     */
    getDownloadClients(): Promise<DownloadClient[]>;
    /**
     * Format search results for display with intelligent guidance
     */
    formatSearchResults(results: SearchResult[]): string;
    /**
     * Get a specific search result by option number
     */
    getResultByOption(results: SearchResult[], option: number): SearchResult | null;
    private formatFileSize;
    private formatAge;
    private extractQuality;
    private getSeedHealthEmoji;
    private getSizeIcon;
}
export {};
