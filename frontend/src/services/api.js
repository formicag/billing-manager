import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 seconds
});

// Request interceptor for adding auth tokens (if needed in future)
api.interceptors.request.use(
  (config) => {
    // Add any authentication tokens here if needed
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      // Server responded with error status
      console.error('API Error:', error.response.data);
      throw new Error(error.response.data.error || 'An error occurred');
    } else if (error.request) {
      // Request made but no response received
      console.error('Network Error:', error.request);
      throw new Error('Network error. Please check your connection.');
    } else {
      // Something else happened
      console.error('Error:', error.message);
      throw error;
    }
  }
);

// API Methods
const apiService = {
  // Health
  async checkHealth() {
    const response = await api.get('/api/health');
    return response.data;
  },

  // Services
  async getServices() {
    const response = await api.get('/api/services');
    return response.data;
  },

  async getService(serviceId) {
    const response = await api.get(`/api/services/${serviceId}`);
    return response.data;
  },

  async updateService(serviceId, data) {
    const response = await api.put(`/api/services/${serviceId}`, data);
    return response.data;
  },

  async getSupportedServices() {
    const response = await api.get('/api/services/meta/supported');
    return response.data;
  },

  // Costs
  async getCosts(params = {}) {
    const response = await api.get('/api/costs', { params });
    return response.data;
  },

  async getCostSummary(params = {}) {
    const response = await api.get('/api/costs/summary', { params });
    return response.data;
  },

  async getResourceCosts(serviceId, params = {}) {
    const response = await api.get(`/api/costs/${serviceId}/resources`, { params });
    return response.data;
  },

  async triggerCostCollection(serviceId) {
    const response = await api.post('/api/costs/collect', { serviceId });
    return response.data;
  },

  async deleteCost(costId) {
    const response = await api.delete(`/api/costs/${costId}`);
    return response.data;
  },

  // Credentials
  async getCredentials() {
    const response = await api.get('/api/credentials');
    return response.data;
  },

  async getCredential(serviceId) {
    const response = await api.get(`/api/credentials/${serviceId}`);
    return response.data;
  },

  async saveCredential(serviceId, credentials, credentialType) {
    const response = await api.post(`/api/credentials/${serviceId}`, {
      credentials,
      credentialType,
    });
    return response.data;
  },

  async revealCredential(serviceId) {
    const response = await api.post(`/api/credentials/${serviceId}/reveal`);
    return response.data;
  },

  async testCredential(serviceId, credentials) {
    const response = await api.post(`/api/credentials/${serviceId}/test`, {
      credentials,
    });
    return response.data;
  },

  async deleteCredential(serviceId) {
    const response = await api.delete(`/api/credentials/${serviceId}`);
    return response.data;
  },

  // Schedules
  async getSchedules() {
    const response = await api.get('/api/schedules');
    return response.data;
  },

  async getSchedule(serviceId) {
    const response = await api.get(`/api/schedules/${serviceId}`);
    return response.data;
  },

  async updateSchedule(serviceId, scheduleData) {
    const response = await api.put(`/api/schedules/${serviceId}`, scheduleData);
    return response.data;
  },

  async deleteSchedule(serviceId) {
    const response = await api.delete(`/api/schedules/${serviceId}`);
    return response.data;
  },

  async runSchedule(serviceId) {
    const response = await api.post(`/api/schedules/${serviceId}/run`);
    return response.data;
  },

  // Backfill
  async createBackfillJob(serviceId, startDate, endDate) {
    const response = await api.post('/api/backfill', {
      serviceId,
      startDate,
      endDate,
    });
    return response.data;
  },

  async getBackfillJobs(params = {}) {
    const response = await api.get('/api/backfill/jobs', { params });
    return response.data;
  },

  async getBackfillJob(jobId) {
    const response = await api.get(`/api/backfill/jobs/${jobId}`);
    return response.data;
  },

  async deleteBackfillJob(jobId) {
    const response = await api.delete(`/api/backfill/jobs/${jobId}`);
    return response.data;
  },

  // Budgets
  async getBudgets() {
    const response = await api.get('/api/budgets');
    return response.data;
  },

  async getBudgetsForService(serviceId) {
    const response = await api.get(`/api/budgets/${serviceId}`);
    return response.data;
  },
};

export default apiService;
