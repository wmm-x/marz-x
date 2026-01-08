import axios from 'axios';

// 1. Automatically determine the API URL.
// If VITE_API_URL is set in .env, use it.
// Otherwise, if running on localhost, use localhost:5000.
// Otherwise (production), use the current domain with /api.
const getBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:5000/api';
  }
  // In production, assume the API is served from the same domain under /api
  // or you can hardcode your server IP here: 'http://YOUR_SERVER_IP:5000/api'
  return '/api'; 
};

const API_URL = getBaseUrl();

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // Prevent redirect loop if already on login
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  login: (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  me: () => api.get('/auth/me'),
  changePassword: (data) => api.post('/auth/change-password', data),
  updateProfile: (data) => api.put('/auth/profile', data),
};

// Marzban Config API
export const marzbanApi = {
  connect: (data) => api.post('/marzban/connect', data),
  getConfigs: () => api.get('/marzban/configs'),
  updateConfig: (id, data) => api.put(`/marzban/configs/${id}`, data),
  deleteConfig: (id) => api.delete(`/marzban/configs/${id}`),
  getSystemStats: (configId) => api.get(`/marzban/configs/${configId}/system`),
  getInbounds: (configId) => api.get(`/marzban/configs/${configId}/inbounds`),
  getNodes: (configId) => api.get(`/marzban/configs/${configId}/nodes`),
  restartXray: (configId) => api.post(`/marzban/configs/${configId}/restart-xray`),
  getNodesUsage: (configId, start, end) => api.get(`/marzban/configs/${configId}/nodes-usage?start=${start}&end=${end}`),
  getCoreConfig: (configId) => api.get(`/marzban/configs/${configId}/core-config`),
  updateCoreConfig: (configId, data) => api.put(`/marzban/configs/${configId}/core-config`, data),
  getHosts: (configId) => api.get(`/marzban/configs/${configId}/hosts`),
  updateHosts: (configId, data) => api.put(`/marzban/configs/${configId}/hosts`, data),
};

// Users API
export const usersApi = {
  getUsers: (configId, params) => api.get(`/users/${configId}`, { params }),
  getUser: (configId, username) => api.get(`/users/${configId}/${encodeURIComponent(username)}`),
  createUser: (configId, data) => api.post(`/users/${configId}`, data),
  updateUser: (configId, username, data) => api.put(`/users/${configId}/${encodeURIComponent(username)}`, data),
  deleteUser: (configId, username) => api.delete(`/users/${configId}/${encodeURIComponent(username)}`),
  resetTraffic: (configId, username) => api.post(`/users/${configId}/${encodeURIComponent(username)}/reset`),
  revokeSubscription: (configId, username) => api.post(`/users/${configId}/${encodeURIComponent(username)}/revoke`),
};

export default api;