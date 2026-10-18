// API client for RESQ BhuRaksha platform
const API_BASE = '/api/v1';

let authToken = localStorage.getItem('bhuraksha_token') || '';

export function setToken(token) {
  authToken = token;
  if (token) {
    localStorage.setItem('bhuraksha_token', token);
  } else {
    localStorage.removeItem('bhuraksha_token');
  }
}

export function getToken() {
  return authToken;
}

async function request(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    ...(options.headers || {})
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  if (!response.ok) {
    let errorDetail = 'API Request Failed';
    try {
      const errJson = await response.json();
      errorDetail = errJson.detail || errJson.message || JSON.stringify(errJson);
    } catch (e) {
      errorDetail = `HTTP ${response.status} ${response.statusText}`;
    }
    const err = new Error(errorDetail);
    err.status = response.status;
    throw err;
  }

  return response.json();
}

export const api = {
  // Auth
  async login(email, password) {
    const res = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    setToken(res.token);
    return res;
  },

  async getMe() {
    return request('/auth/me');
  },

  logout() {
    setToken('');
  },

  // Terrain & Sensors
  async getAOIs() {
    return request('/terrain/aoi');
  },

  async getAOIDetail(aoiId) {
    return request(`/terrain/aoi/${aoiId}`);
  },

  async getDEMGrid(aoiId, res = 64) {
    return request(`/terrain/grid/${aoiId}?res=${res}`);
  },

  async getSensors(aoiId, anomaly = false) {
    return request(`/terrain/sensors/${aoiId}?anomaly=${anomaly}`);
  },

  // Simulation
  async runSimulation(payload) {
    return request('/simulation/run', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async getSimulationTimeline(simId) {
    return request(`/simulation/${simId}/timeline`);
  },

  // Incidents & Agent Pipeline
  async createIncident(aoi = 'gangtok', scenario = 'baseline') {
    return request('/incidents', {
      method: 'POST',
      body: JSON.stringify({ aoi, scenario })
    });
  },

  async listIncidents() {
    return request('/incidents');
  },

  async getIncident(id) {
    return request(`/incidents/${id}`);
  },

  async triggerEvent(incidentId, eventType, payload = {}, idempotencyKey = '') {
    const key = idempotencyKey || `evt-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    return request(`/incidents/${incidentId}/events`, {
      method: 'POST',
      body: JSON.stringify({
        type: eventType,
        payload,
        idempotency_key: key
      })
    });
  },

  async decidePlan(incidentId, version, decision, notes = '') {
    return request(`/incidents/${incidentId}/plans/${version}/decision`, {
      method: 'POST',
      body: JSON.stringify({ decision, notes })
    });
  },

  // Field Reports
  async getReports(aoi = '') {
    return request(`/reports${aoi ? `?aoi=${aoi}` : ''}`);
  },

  async submitReport(formData) {
    const headers = authToken ? { Authorization: `Bearer ${authToken}` } : {};
    const res = await fetch(`${API_BASE}/reports`, {
      method: 'POST',
      headers,
      body: formData // multipart/form-data
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to submit' }));
      throw new Error(err.detail || 'Submit failed');
    }
    return res.json();
  },

  async verifyReport(reportId, status, notes = '') {
    return request(`/reports/${reportId}/verify?status=${status}&notes=${encodeURIComponent(notes)}`, {
      method: 'POST'
    });
  },

  // Alerts
  async getAlerts(incidentId = '') {
    return request(`/alerts${incidentId ? `?incident_id=${incidentId}` : ''}`);
  },

  async transitionAlert(alertId, targetState) {
    return request(`/alerts/${alertId}/transition`, {
      method: 'POST',
      body: JSON.stringify({ target_state: targetState })
    });
  },

  // Chat RAG Assistant
  async askMissionControl(query, incidentId = '') {
    return request('/chat/query', {
      method: 'POST',
      body: JSON.stringify({ query, incident_id: incidentId })
    });
  },

  // Audit Ledger
  async getAuditLedger(limit = 50) {
    return request(`/audit/ledger?limit=${limit}`);
  },

  async verifyAuditChain() {
    return request('/audit/verify');
  }
};
