const axios = require('axios');
const { decrypt } = require('../utils/encryption');

class MarzbanService {
  constructor(baseUrl) {
    this. baseUrl = baseUrl. replace(/\/$/, '');
    this.accessToken = null;
  }

  setToken(token) {
    this.accessToken = token;
  }

  getToken() {
    return this.accessToken;
  }

  async authenticate(username, password) {
    const formData = new URLSearchParams();
    formData. append('username', username);
    formData.append('password', password);
    formData.append('grant_type', 'password');

    const response = await axios. post(
      `${this.baseUrl}/api/admin/token`,
      formData,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    this.accessToken = response.data.access_token;
    return response.data;
  }

  async request(endpoint, options = {}) {
    if (!this.accessToken) {
      throw new Error('Not authenticated');
    }

    const response = await axios({
      url: `${this.baseUrl}${endpoint}`,
      method: options.method || 'GET',
      data: options.data,
      params: options.params,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    return response.data;
  }

  // ==================== System ====================
  async getSystemStats() {
    return this.request('/api/system');
  }

  async getInbounds() {
    return this.request('/api/inbounds');
  }

  // ==================== Core ====================
  async getCoreStats() {
    return this.request('/api/core');
  }

  async updateUser(username, data) {
  return this.request('/api/user/' + encodeURIComponent(username), { 
    method: 'PUT', 
    data: data 
  });
}

  async restartCore() {
    return this.request('/api/core/restart', { method: 'POST' });
  }

  // ==================== Users ====================
  async getUsers(params = {}) {
    const query = new URLSearchParams();
    if (params.offset !== undefined) query.set('offset', params. offset);
    if (params.limit !== undefined) query.set('limit', params. limit);
    if (params. status) query.set('status', params.status);
    if (params. search) query.set('search', params. search);

    const queryString = query.toString();
    return this.request(`/api/users${queryString ? `?${queryString}` : ''}`);
  }

  async getUser(username) {
    return this.request(`/api/user/${encodeURIComponent(username)}`);
  }

  async createUser(data) {
    return this.request('/api/user', {
      method: 'POST',
      data,
    });
  }

  async updateUser(username, data) {
    return this.request(`/api/user/${encodeURIComponent(username)}`, {
      method: 'PUT',
      data,
    });
  }

  async deleteUser(username) {
    return this.request(`/api/user/${encodeURIComponent(username)}`, {
      method: 'DELETE',
    });
  }

  async resetUserTraffic(username) {
    return this.request(`/api/user/${encodeURIComponent(username)}/reset`, {
      method:  'POST',
    });
  }

  async revokeUserSubscription(username) {
    return this. request(`/api/user/${encodeURIComponent(username)}/revoke_sub`, {
      method: 'POST',
    });
  }

  // ==================== Nodes ====================
  async getNodes() {
    return this.request('/api/nodes');
  }

  async getNode(nodeId) {
    return this.request(`/api/node/${nodeId}`);
  }

  async reconnectNode(nodeId) {
    return this.request(`/api/node/${nodeId}/reconnect`, { method: 'POST' });
  }

  // ==================== Admin ====================
  async getCurrentAdmin() {
    return this.request('/api/admin');
  }
}

// Factory function to create service from stored config
async function createMarzbanService(config) {
  const service = new MarzbanService(config. endpointUrl);

  // Try existing token first
  if (config.encryptedAccessToken) {
    try {
      const token = decrypt(config.encryptedAccessToken);
      service.setToken(token);
      // Verify token works
      await service.getSystemStats();
      return service;
    } catch (error) {
      // Token expired, re-authenticate
      console.log('Token expired, re-authenticating...');
    }
  }

  // Re-authenticate with stored credentials
  const password = decrypt(config.encryptedPassword);
  await service.authenticate(config.marzbanUsername, password);
  return service;
}

module.exports = { MarzbanService, createMarzbanService };