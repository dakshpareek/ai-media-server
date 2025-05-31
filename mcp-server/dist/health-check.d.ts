interface IndexerStatus {
    indexerId: number;
    disabledTill?: string;
    mostRecentFailure?: string;
    initialFailure?: string;
}
interface HealthIssue {
    source: string;
    type: string;
    message: string;
    wikiUrl?: string;
}
interface SystemStatus {
    appName: string;
    version: string;
    isProduction: boolean;
    isDocker: boolean;
    osName: string;
    startTime: string;
    databaseType: string;
    authentication: string;
}
interface IndexerDetails {
    id: number;
    name: string;
    enable: boolean;
    protocol: string;
    privacy: string;
    supportsSearch: boolean;
    supportsRss: boolean;
}
declare class ProwlarrHealthMonitor {
    private baseUrl;
    private apiKey;
    constructor(baseUrl: string, apiKey: string);
    private makeRequest;
    getSystemStatus(): Promise<SystemStatus>;
    getHealthIssues(): Promise<HealthIssue[]>;
    getIndexerStatus(): Promise<IndexerStatus[]>;
    getIndexers(): Promise<IndexerDetails[]>;
    getHealthStatus(): Promise<any>;
    generateHealthReport(): Promise<void>;
}
export { ProwlarrHealthMonitor };
