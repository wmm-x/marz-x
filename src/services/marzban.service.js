const axios = require('axios');
const http = require('http');
const https = require('https');
const prisma = require('../utils/prisma');
const { validateUrl } = require('../utils/urlValidator');

// Shared agents for connection pooling
const httpAgent = new http.Agent({ keepAlive: true });
const httpsAgent = new https.Agent({ keepAlive: true });

class MarzbanService {
    // Auto optimization: check RAM and restart xray if needed
    async autoOptimizeServer(stats = null) {
      try {
        // Use existing stats if provided to avoid redundant API call
        if (!stats) {
          stats = await this.getSystemStats();
        }
       // console.log('[AutoOptimize] /api/system stats:', JSON.stringify(stats));
        if (
          stats &&
          typeof stats.mem_used === 'number' &&
          typeof stats.mem_total === 'number' &&
          stats.mem_total > 0
        ) {
          const usagePercent = (stats.mem_used / stats.mem_total) * 100;
          console.log(`[AutoOptimize] RAM usage: ${stats.mem_used} / ${stats.mem_total} = ${usagePercent.toFixed(2)}%`);
          if (usagePercent > 10) {
            console.log('[AutoOptimize] RAM usage above 10%, restarting xray...');
            await this.restartXray();
            return { optimized: true, usagePercent };
          }
          return { optimized: false, usagePercent };
        } else {
          console.error('[AutoOptimize] RAM stats not available or invalid:', stats);
          throw new Error('RAM stats not available or invalid');
        }
      } catch (err) {
        console.error('[AutoOptimize] Error:', err.message);
        return { error: err.message };
      }
    }
  constructor(config) {
    this.config = config;
    this.baseUrl = config.endpointUrl.replace(/\/+$/, '');
    this.accessToken = config.encryptedAccessToken;
    this.client = this.createClient();
  }

  createClient() {
    const client = axios.create({
      baseURL: this.baseUrl,
      httpAgent: httpAgent,
      httpsAgent: httpsAgent,
      headers: {
        'Authorization': 'Bearer ' + this.accessToken,
        'Content-Type': 'application/json'
      },
      timeout: 15000,
      maxRedirects: 0  // Disable redirects to prevent SSRF via redirects
    });

    // Add response interceptor for auto re-auth
    client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        // If 401 and not already retried
        if (error.response && error.response.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          console.log('Token expired, re-authenticating with Marzban...');

          try {
            // Re-authenticate
            const newToken = await this.refreshToken();

            if (newToken) {
              // Update the client header
              this.accessToken = newToken;
              this.client.defaults.headers['Authorization'] = 'Bearer ' + newToken;
              originalRequest.headers['Authorization'] = 'Bearer ' + newToken;

              // Retry the original request
              return this.client(originalRequest);
            }
          } catch (refreshError) {
            console.error('Failed to refresh token:', refreshError.message);
            throw error;
          }
        }

        throw error;
      }
    );

    return client;
  }

  async refreshToken() {
    try {
      console.log('=== REFRESH TOKEN DEBUG ===');
      console.log('Server:', this.config.name);
      console.log('URL:', this.baseUrl);
      console.log('Username:', this.config.marzbanUsername);

      const params = new URLSearchParams();
      params.append('username', this.config.marzbanUsername);
      params.append('password', this.config.encryptedPassword);

      // Construct URL safely using URL API
      // Base URL is already cleaned in constructor, but let's parse it safely
      const targetUrl = new URL(this.baseUrl);
      // Append path safely avoiding double slashes or missing slashes
      targetUrl.pathname = targetUrl.pathname.replace(/\/$/, '') + '/api/admin/token';

      console.log('Sending auth request to:', targetUrl.toString());

      const validation = validateUrl(targetUrl.toString());
      if (!validation.valid) {
        throw new Error(`Invalid Token URL: ${validation.error}`);
      }

      // Use axios directly (not this.client) to avoid circular dependency,
      // but still limit redirects and use timeout for DNS rebinding protection
      // Use validated URL string and shared agents for connection pooling
      const authRes = await axios.post(validation.url.toString(), params, {
        httpAgent,
        httpsAgent,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 10000,
        maxRedirects: 0  // Prevent redirects to protect against SSRF
      });

      if (authRes.data && authRes.data.access_token) {
        const newToken = authRes.data.access_token;

        await prisma.marzbanConfig.update({
          where: { id: this.config.id },
          data: { encryptedAccessToken: newToken }
        });

        console.log('Token refreshed successfully! ');
        return newToken;
      }

      return null;
    } catch (error) {
      console.error('=== TOKEN REFRESH FAILED ===');
      console.error('Error:', error.message);
      if (error.response) {
        console.error('Status:', error.response.status);
        console.error('Data:', error.response.data);
      }
      throw error;
    }
  }

  async getSystemStats() {
    var res = await this.client.get('/api/system');
    return res.data;
  }

  async getInbounds() {
    var res = await this.client.get('/api/inbounds');
    return res.data;
  }

  async getHosts() {
    var res = await this.client.get('/api/hosts');
    return res.data;
  }

  async updateHosts(data) {
    var res = await this.client.put('/api/hosts', data);
    return res.data;
  }

  
  async getNodesUsage(start, end) {
    var params = {};
    if (start) params.start = start;
    if (end) params.end = end;
  
    var res = await this.client.get('/api/nodes/usage', { params: params });
    return res.data;
  }

  async getNodes() {
    var res = await this.client.get('/api/nodes');
    return res.data;
  }

  async getUsers(params) {
    var res = await this.client.get('/api/users', { params: params });
    return res.data;
  }

  async getUser(username) {
    var res = await this.client.get('/api/user/' + encodeURIComponent(username));
    return res.data;
  }

  async createUser(data) {
    var res = await this.client.post('/api/user', data);
    return res.data;
  }

  async updateUser(username, data) {
    var res = await this.client.put('/api/user/' + encodeURIComponent(username), data);
    return res.data;
  }

  async deleteUser(username) {
    var res = await this.client.delete('/api/user/' + encodeURIComponent(username));
    return res.data;
  }

  async resetUserTraffic(username) {
    var res = await this.client.post('/api/user/' + encodeURIComponent(username) + '/reset');
    return res.data;
  }

  async revokeUserSubscription(username) {
    var res = await this.client.post('/api/user/' + encodeURIComponent(username) + '/revoke_sub');
    return res.data;
  }

  async getCoreConfig() {
    var res = await this.client.get('/api/core/config');
    return res.data;
  }

  async updateCoreConfig(config) {
    var res = await this.client.put('/api/core/config', config);
    return res.data;
  }

  async restartXray() {
    var res = await this.client.post('/api/core/restart');
    return res.data;
  }
}

async function createMarzbanService(config) {
  return new MarzbanService(config);
}

module.exports = {
  MarzbanService: MarzbanService,
  createMarzbanService: createMarzbanService
};