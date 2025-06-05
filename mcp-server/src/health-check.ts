import axios from 'axios';

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

class ProwlarrHealthMonitor {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  private async makeRequest<T>(endpoint: string): Promise<T> {
    try {
      const response = await axios.get(`${this.baseUrl}${endpoint}`, {
        headers: {
          'X-Api-Key': this.apiKey
        },
        timeout: 30000
      });
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch ${endpoint}:`, error);
      throw error;
    }
  }

  async getSystemStatus(): Promise<SystemStatus> {
    return this.makeRequest<SystemStatus>('/api/v1/system/status');
  }

  async getHealthIssues(): Promise<HealthIssue[]> {
    return this.makeRequest<HealthIssue[]>('/api/v1/health');
  }

  async getIndexerStatus(): Promise<IndexerStatus[]> {
    return this.makeRequest<IndexerStatus[]>('/api/v1/indexerstatus');
  }

  async getIndexers(): Promise<IndexerDetails[]> {
    return this.makeRequest<IndexerDetails[]>('/api/v1/indexer');
  }

  async getHealthStatus(): Promise<any> {
    try {
      const [systemStatus, healthIssues, indexerStatuses, indexers] = await Promise.all([
        this.getSystemStatus(),
        this.getHealthIssues(),
        this.getIndexerStatus(),
        this.getIndexers()
      ]);

      const enabledIndexers = indexers.filter(i => i.enable);
      const healthyIndexers = enabledIndexers.filter(indexer =>
        !indexerStatuses.some(status => status.indexerId === indexer.id)
      );
      const healthScore = indexers.length > 0 ? Math.round((healthyIndexers.length / indexers.length) * 100) : 0;

      return {
        overall_health: healthScore >= 80 ? 'healthy' : healthScore >= 50 ? 'degraded' : 'unhealthy',
        health_score: healthScore + '%',
        system: {
          app: systemStatus.appName + ' v' + systemStatus.version,
          environment: systemStatus.isDocker ? 'Docker' : 'Native',
          os: systemStatus.osName,
          database: systemStatus.databaseType,
          uptime: systemStatus.startTime,
        },
        indexers: {
          total: indexers.length,
          enabled: enabledIndexers.length,
          healthy: healthyIndexers.length,
          failed: indexerStatuses.length,
        },
        issues: healthIssues,
        failed_indexers: indexerStatuses.map(status => {
          const indexer = indexers.find(i => i.id === status.indexerId);
          return {
            name: indexer?.name || 'ID ' + status.indexerId,
            last_failure: status.mostRecentFailure,
            disabled_until: status.disabledTill,
          };
        }),
        healthy_indexers: healthyIndexers.map(indexer => ({
          name: indexer.name,
          protocol: indexer.protocol,
          privacy: indexer.privacy,
        })),
      };
    } catch (error) {
      throw new Error(`Failed to get health status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async generateHealthReport(): Promise<void> {
    console.log('🔍 Prowlarr Health Monitor');
    console.log('='.repeat(50));

    try {
      // Get all health data
      const [systemStatus, healthIssues, indexerStatuses, indexers] = await Promise.all([
        this.getSystemStatus(),
        this.getHealthIssues(),
        this.getIndexerStatus(),
        this.getIndexers()
      ]);

      // System Overview
      console.log('\n📊 System Status');
      console.log(`App: ${systemStatus.appName} v${systemStatus.version}`);
      console.log(`Environment: ${systemStatus.isDocker ? 'Docker' : 'Native'} on ${systemStatus.osName}`);
      console.log(`Database: ${systemStatus.databaseType}`);
      console.log(`Authentication: ${systemStatus.authentication}`);
      console.log(`Started: ${new Date(systemStatus.startTime).toLocaleString()}`);

      // Health Issues
      console.log('\n🚨 Health Issues');
      if (healthIssues.length === 0) {
        console.log('✅ No health issues detected');
      } else {
        healthIssues.forEach(issue => {
          const icon = issue.type === 'warning' ? '⚠️' : issue.type === 'error' ? '❌' : 'ℹ️';
          console.log(`${icon} ${issue.message}`);
          if (issue.wikiUrl) {
            console.log(`   📖 More info: ${issue.wikiUrl}`);
          }
        });
      }

      // Indexer Overview
      console.log('\n📡 Indexer Status');
      const enabledIndexers = indexers.filter(i => i.enable);
      const disabledIndexers = indexers.filter(i => !i.enable);

      console.log(`Total: ${indexers.length} | Enabled: ${enabledIndexers.length} | Disabled: ${disabledIndexers.length}`);

      // Failed Indexers
      if (indexerStatuses.length > 0) {
        console.log('\n❌ Failed Indexers');
        indexerStatuses.forEach(status => {
          const indexer = indexers.find(i => i.id === status.indexerId);
          const name = indexer ? indexer.name : `ID ${status.indexerId}`;
          console.log(`• ${name}`);
          if (status.disabledTill) {
            const disabledUntil = new Date(status.disabledTill);
            const now = new Date();
            const timeLeft = Math.ceil((disabledUntil.getTime() - now.getTime()) / (1000 * 60));
            console.log(`  Disabled for ${timeLeft} more minutes`);
          }
          if (status.mostRecentFailure) {
            console.log(`  Last failure: ${new Date(status.mostRecentFailure).toLocaleString()}`);
          }
        });
      }

      // Healthy Indexers Summary
      const healthyIndexers = enabledIndexers.filter(indexer =>
        !indexerStatuses.some(status => status.indexerId === indexer.id)
      );

      console.log('\n✅ Healthy Indexers');
      if (healthyIndexers.length === 0) {
        console.log('No healthy indexers found');
      } else {
        healthyIndexers.forEach(indexer => {
          console.log(`• ${indexer.name} (${indexer.protocol}/${indexer.privacy})`);
        });
      }

      // Quick Stats
      console.log('\n📈 Quick Stats');
      console.log(`Health Score: ${healthyIndexers.length}/${indexers.length} indexers healthy`);
      console.log(`Protocols: ${[...new Set(indexers.map(i => i.protocol))].join(', ')}`);
      console.log(`Privacy: ${[...new Set(indexers.map(i => i.privacy))].join(', ')}`);

    } catch (error) {
      console.error('❌ Failed to generate health report:', error);
    }
  }
}

// Run the health check
// async function main() {
//   const monitor = new ProwlarrHealthMonitor(
//     PROWLARR_CONFIG.baseUrl,
//     PROWLARR_CONFIG.apiKey
//   );

//   await monitor.generateHealthReport();
// }

// // Only run if this is the main module
// if (process.argv[1] === new URL(import.meta.url).pathname) {
//   main();
// }

export { ProwlarrHealthMonitor };
