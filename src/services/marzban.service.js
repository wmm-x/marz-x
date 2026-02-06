const axios = require('axios');
const http = require('http');
const https = require('https');
const prisma = require('../utils/prisma');

// Create shared agents with keepAlive enabled to reuse TCP connections
const httpAgent = new http.Agent({ keepAlive: true });
const httpsAgent = new https.Agent({ keepAlive: true });

class MarzbanService {
    // Auto optimization: check RAM and restart xray if needed
    async autoOptimizeServer() {
      try {
        const stats = await this.getSystemStats();
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
    const self = this;
    const client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Authorization': 'Bearer ' + this.accessToken,
        'Content-Type': 'application/json'
      },
      httpAgent,
      httpsAgent,
      timeout: 15000,
      maxRedirects: 0  // Disable redirects to prevent SSRF via redirects
    });

    // Add response interceptor for auto re-auth
    client.interceptors.response.use(
      function (response) {
        return response;
      },
      async function (error) {
        const originalRequest = error.config;

        // If 401 and not already retried
        if (error.response && error.response.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          console.log('Token expired, re-authenticating with Marzban...');

          try {
            // Re-authenticate
            const newToken = await self.refreshToken();

            if (newToken) {
              // Update the client header
              self.accessToken = newToken;
              self.client.defaults.headers['Authorization'] = 'Bearer ' + newToken;
              originalRequest.headers['Authorization'] = 'Bearer ' + newToken;

              // Retry the original request
              return self.client(originalRequest);
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

      console.log('Sending auth request to:', this.baseUrl + '/api/admin/token');

      // Use axios directly (not this.client) to avoid circular dependency,
      // but still limit redirects and use timeout for DNS rebinding protection
      const authRes = await axios.post(this.baseUrl + '/api/admin/token', params, {
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
    const res = await this.client.get('/api/system');
    return res.data;
  }

  async getInbounds() {
    const res = await this.client.get('/api/inbounds');
    return res.data;
  }

  async getHosts() {
    const res = await this.client.get('/api/hosts');
    return res.data;
  }

  async updateHosts(data) {
    const res = await this.client.put('/api/hosts', data);
    return res.data;
  }

  
  async getNodesUsage(start, end) {
    const params = {};
    if (start) params.start = start;
    if (end) params.end = end;
  
    const res = await this.client.get('/api/nodes/usage', { params: params });
    return res.data;
  }

  async getNodes() {
    const res = await this.client.get('/api/nodes');
    return res.data;
  }

  async getUsers(params) {
    const res = await this.client.get('/api/users', { params: params });
    return res.data;
  }

  async getUser(username) {
    const res = await this.client.get('/api/user/' + encodeURIComponent(username));
    return res.data;
  }

  async createUser(data) {
    const res = await this.client.post('/api/user', data);
    return res.data;
  }

  async updateUser(username, data) {
    const res = await this.client.put('/api/user/' + encodeURIComponent(username), data);
    return res.data;
  }

  async deleteUser(username) {
    const res = await this.client.delete('/api/user/' + encodeURIComponent(username));
    return res.data;
  }

  async resetUserTraffic(username) {
    const res = await this.client.post('/api/user/' + encodeURIComponent(username) + '/reset');
    return res.data;
  }

  async revokeUserSubscription(username) {
    const res = await this.client.post('/api/user/' + encodeURIComponent(username) + '/revoke_sub');
    return res.data;
  }

  async getCoreConfig() {
    const res = await this.client.get('/api/core/config');
    return res.data;
  }

  async updateCoreConfig(config) {
    const res = await this.client.put('/api/core/config', config);
    return res.data;
  }

  async restartXray() {
    const res = await this.client.post('/api/core/restart');
    return res.data;
  }
}

async function createMarzbanService(config) {
  return new MarzbanService(config);
}

module.exports = {
  MarzbanService,
  createMarzbanService
};