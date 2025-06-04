import { setTimeout } from 'timers/promises';

export interface TorrentInfo {
  hash: string;
  name: string;
  size: number;
  progress: number;
  dlspeed: number;
  upspeed: number;
  eta: number;
  state: string;
  category: string;
  tags: string;
  added_on: number;
  completed: number;
  downloaded: number;
  uploaded: number;
  ratio: number;
  save_path: string;
}

export interface TransferInfo {
  dl_info_speed: number;
  dl_info_data: number;
  up_info_speed: number;
  up_info_data: number;
  dl_rate_limit: number;
  up_rate_limit: number;
  dht_nodes: number;
  connection_status: string;
}

export interface AppPreferences {
  save_path: string;
  temp_path_enabled: boolean;
  temp_path: string;
  dl_limit: number;
  up_limit: number;
  max_active_downloads: number;
  max_active_torrents: number;
  max_active_uploads: number;
  queueing_enabled: boolean;
  [key: string]: any;
}

export class QBittorrentError extends Error {
  constructor(
    public type: 'AUTH' | 'NETWORK' | 'API' | 'SYSTEM',
    public statusCode?: number,
    message?: string,
    public details?: any
  ) {
    super(message || `qBittorrent ${type} error`);
    this.name = 'QBittorrentError';
  }
}

export class QBittorrentClient {
  private sessionId: string | null = null;
  private sessionExpiry: number = 0;
  private readonly sessionTimeout: number;

  constructor(
    private readonly baseUrl: string,
    private readonly username: string,
    private readonly password: string,
    sessionTimeout: number = 3600
  ) {
    this.sessionTimeout = sessionTimeout * 1000; // Convert to milliseconds
  }

  /**
   * Authenticate with qBittorrent and store session cookie
   */
  private async authenticate(): Promise<void> {
    try {
      console.log('🔐 Authenticating with qBittorrent...');
      
      const response = await fetch(`${this.baseUrl}/api/v2/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Referer': this.baseUrl,
          'Origin': this.baseUrl
        },
        body: `username=${encodeURIComponent(this.username)}&password=${encodeURIComponent(this.password)}`
      });

      if (response.status === 403) {
        throw new QBittorrentError('AUTH', 403, 'Invalid username or password');
      }

      if (!response.ok) {
        throw new QBittorrentError('NETWORK', response.status, `Authentication failed: ${response.statusText}`);
      }

      // Extract SID cookie from response
      const setCookieHeader = response.headers.get('set-cookie');
      if (!setCookieHeader) {
        throw new QBittorrentError('AUTH', 200, 'No session cookie received');
      }

      const sidMatch = setCookieHeader.match(/SID=([^;]+)/);
      if (!sidMatch) {
        throw new QBittorrentError('AUTH', 200, 'Invalid session cookie format');
      }

      this.sessionId = sidMatch[1];
      this.sessionExpiry = Date.now() + this.sessionTimeout;
      console.log('✅ Successfully authenticated with qBittorrent');
      
    } catch (error) {
      console.error('❌ qBittorrent authentication failed:', error);
      if (error instanceof QBittorrentError) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : 'Unknown authentication error';
      throw new QBittorrentError('NETWORK', undefined, `Authentication error: ${errorMessage}`, error);
    }
  }

  /**
   * Check if session is valid and re-authenticate if needed
   */
  private async ensureAuthenticated(): Promise<void> {
    if (!this.sessionId || Date.now() >= this.sessionExpiry) {
      await this.authenticate();
    }
  }

  /**
   * Make authenticated API request with retry logic
   */
  private async apiRequest<T>(
    endpoint: string, 
    options: RequestInit = {}, 
    retries = 1
  ): Promise<T> {
    await this.ensureAuthenticated();

    const url = `${this.baseUrl}/api/v2${endpoint}`;
    const requestOptions: RequestInit = {
      ...options,
      headers: {
        'Cookie': `SID=${this.sessionId}`,
        'Referer': this.baseUrl,
        ...options.headers
      }
    };

    try {
      console.log(`🌐 qBittorrent API: ${options.method || 'GET'} ${endpoint}`);
      
      const response = await fetch(url, requestOptions);

      // Handle authentication errors
      if (response.status === 403) {
        if (retries > 0) {
          console.log('🔄 Session expired, re-authenticating...');
          this.sessionId = null; // Force re-authentication
          await this.ensureAuthenticated();
          return this.apiRequest<T>(endpoint, options, retries - 1);
        }
        throw new QBittorrentError('AUTH', 403, 'Authentication failed after retry');
      }

      // Handle other errors
      if (!response.ok) {
        let errorMessage = `API request failed: ${response.statusText}`;
        try {
          const errorText = await response.text();
          if (errorText) {
            errorMessage += ` - ${errorText}`;
          }
        } catch (e) {
          // Ignore error text parsing failures
        }

        switch (response.status) {
          case 404:
            throw new QBittorrentError('API', 404, 'Resource not found');
          case 409:
            throw new QBittorrentError('API', 409, 'Conflict or invalid operation');
          case 400:
            throw new QBittorrentError('API', 400, 'Bad request');
          default:
            throw new QBittorrentError('API', response.status, errorMessage);
        }
      }

      // Parse response
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json() as T;
      } else {
        return await response.text() as T;
      }

    } catch (error) {
      if (error instanceof QBittorrentError) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : 'Unknown network error';
      throw new QBittorrentError('NETWORK', undefined, `Network error: ${errorMessage}`, error);
    }
  }

  /**
   * Test connection to qBittorrent
   */
  async healthCheck(): Promise<{ 
    connected: boolean; 
    version?: string; 
    webApiVersion?: string; 
    error?: string 
  }> {
    try {
      const [version, webApiVersion] = await Promise.all([
        this.apiRequest<string>('/app/version'),
        this.apiRequest<string>('/app/webapiVersion')
      ]);

      return {
        connected: true,
        version: version.trim(),
        webApiVersion: webApiVersion.trim()
      };
    } catch (error) {
      const errorMessage = error instanceof QBittorrentError 
        ? error.message 
        : error instanceof Error 
          ? `Unexpected error: ${error.message}`
          : 'Unknown error occurred';
      
      return {
        connected: false,
        error: errorMessage
      };
    }
  }

  /**
   * Get list of all torrents with optional filtering
   */
  async getTorrents(options: {
    filter?: 'all' | 'downloading' | 'seeding' | 'completed' | 'paused' | 'active' | 'inactive';
    category?: string;
    tag?: string;
    sort?: string;
    reverse?: boolean;
    limit?: number;
    offset?: number;
  } = {}): Promise<TorrentInfo[]> {
    const params = new URLSearchParams();
    
    if (options.filter) params.append('filter', options.filter);
    if (options.category) params.append('category', options.category);
    if (options.tag) params.append('tag', options.tag);
    if (options.sort) params.append('sort', options.sort);
    if (options.reverse) params.append('reverse', 'true');
    if (options.limit) params.append('limit', options.limit.toString());
    if (options.offset) params.append('offset', options.offset.toString());

    const queryString = params.toString();
    const endpoint = `/torrents/info${queryString ? `?${queryString}` : ''}`;
    
    return this.apiRequest<TorrentInfo[]>(endpoint);
  }

  /**
   * Add torrent from URL or magnet link
   */
  async addTorrent(options: {
    urls?: string;
    savepath?: string;
    category?: string;
    tags?: string;
    paused?: boolean;
    skipChecking?: boolean;
    rootFolder?: boolean;
    rename?: string;
    upLimit?: number;
    dlLimit?: number;
    sequentialDownload?: boolean;
    firstLastPiecePrio?: boolean;
  }): Promise<void> {
    const formData = new URLSearchParams();
    
    if (options.urls) formData.append('urls', options.urls);
    if (options.savepath) formData.append('savepath', options.savepath);
    if (options.category) formData.append('category', options.category);
    if (options.tags) formData.append('tags', options.tags);
    if (options.paused !== undefined) formData.append('paused', options.paused.toString());
    if (options.skipChecking) formData.append('skip_checking', 'true');
    if (options.rootFolder !== undefined) formData.append('root_folder', options.rootFolder.toString());
    if (options.rename) formData.append('rename', options.rename);
    if (options.upLimit) formData.append('upLimit', options.upLimit.toString());
    if (options.dlLimit) formData.append('dlLimit', options.dlLimit.toString());
    if (options.sequentialDownload) formData.append('sequentialDownload', 'true');
    if (options.firstLastPiecePrio) formData.append('firstLastPiecePrio', 'true');

    await this.apiRequest('/torrents/add', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formData
    });
  }

  /**
   * Control torrents (pause, resume, delete)
   */
  async controlTorrents(action: 'pause' | 'resume' | 'delete', hashes: string | string[], deleteFiles = false): Promise<void> {
    const hashString = Array.isArray(hashes) ? hashes.join('|') : hashes;
    const formData = new URLSearchParams();
    formData.append('hashes', hashString);
    
    if (action === 'delete') {
      formData.append('deleteFiles', deleteFiles.toString());
    }

    await this.apiRequest(`/torrents/${action}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formData
    });
  }

  /**
   * Get global transfer information
   */
  async getTransferInfo(): Promise<TransferInfo> {
    return this.apiRequest<TransferInfo>('/transfer/info');
  }

  /**
   * Logout and invalidate session
   */
  async logout(): Promise<void> {
    if (this.sessionId) {
      try {
        await this.apiRequest('/auth/logout', { method: 'POST' });
      } catch (error) {
        console.warn('Logout warning:', error);
      } finally {
        this.sessionId = null;
        this.sessionExpiry = 0;
      }
    }
  }
} 