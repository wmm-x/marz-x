const axios = require('axios');
const prisma = require('../utils/prisma');
const http = require('http');
const https = require('https');

// Cache to store MarzbanService instances
const serviceCache = new Map();

class MarzbanService {
  constructor(config) {
    this.config = config;
    this.baseUrl = config.endpointUrl.replace(/\/+$/, '');
    this.accessToken = config.encryptedAccessToken;
    this.client = this.createClient();
  }

  createClient() {
    var self = this;
    var client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Authorization': 'Bearer ' + this.accessToken,
        'Content-Type': 'application/json'
      },
      timeout: 15000,
      // Enable keep-alive to reuse connections
      httpAgent: new http.Agent({ keepAlive: true }),
      httpsAgent: new https.Agent({ keepAlive: true })
    });

    // Add response interceptor for auto re-auth
    client.interceptors.response.use(
      function (response) {
        return response;
      },
      async function (error) {
        var originalRequest = error.config;

        // If 401 and not already retried
        if (error.response && error.response.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          console.log('Token expired, re-authenticating with Marzban...');

          try {
            // Re-authenticate
            var newToken = await self.refreshToken();

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
      console.log('Password length:', this.config.encryptedPassword ? this.config.encryptedPassword.length : 0);
      console.log('Password preview:', this.config.encryptedPassword ? this.config.encryptedPassword.substring(0, 5) + '...' : 'EMPTY');

      var params = new URLSearchParams();
      params.append('username', this.config.marzbanUsername);
      params.append('password', this.config.encryptedPassword);

      console.log('Sending auth request to:', this.baseUrl + '/api/admin/token');

      var authRes = await axios.post(this.baseUrl + '/api/admin/token', params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 10000
      });

      if (authRes.data && authRes.data.access_token) {
        var newToken = authRes.data.access_token;

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
    // This calls the real /api/hosts endpoint on your Marzban server
    var res = await this.client.get('/api/hosts');
    return res.data;
  }

  // Add inside the MarzbanService class
  async updateHosts(data) {
    // Marzban uses PUT for updating hosts
    var res = await this.client.put('/api/hosts', data);
    return res.data;
  }

  
  async getNodesUsage(start, end) {
    var params = {};
    if (start) params.start = start;
    if (end) params.end = end;
    
    // Calls the Marzban endpoint: /api/nodes/usage?start=...&end=...
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
  // Check if we have a valid cached instance
  if (serviceCache.has(config.id)) {
    const cachedService = serviceCache.get(config.id);

    // Check if config has been updated (e.g. token refresh, url change)
    // We assume 'updatedAt' is available and reliable
    const configUpdatedAt = new Date(config.updatedAt).getTime();
    const cachedUpdatedAt = new Date(cachedService.config.updatedAt).getTime();

    if (configUpdatedAt === cachedUpdatedAt) {
      return cachedService;
    }
  }

  // Create new instance and cache it
  const service = new MarzbanService(config);
  serviceCache.set(config.id, service);

  return service;
}

module.exports = {
  MarzbanService: MarzbanService,
  createMarzbanService: createMarzbanService
};