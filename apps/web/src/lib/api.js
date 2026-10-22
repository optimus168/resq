import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export const API_BASE = '/api/v1';
export const API = API_BASE;

function buildUrl(url, params) {
  let full = url;
  if (!full.startsWith('http')) {
    if (full.startsWith('/api/v1')) {
      // already has prefix
    } else if (full.startsWith('/api')) {
      full = full.replace('/api', '/api/v1');
    } else {
      full = `${API_BASE}${full.startsWith('/') ? full : '/' + full}`;
    }
  }
  if (params && Object.keys(params).length > 0) {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) q.append(k, v);
    }
    full += (full.includes('?') ? '&' : '?') + q.toString();
  }
  return full;
}

async function request(url, method = 'GET', body = null, options = {}) {
  const fullUrl = buildUrl(url, options.params);
  const token = localStorage.getItem('br_token') || localStorage.getItem('bhuraksha_token');
  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  let reqBody = body;
  if (body && !(body instanceof FormData) && typeof body === 'object') {
    headers['Content-Type'] = 'application/json';
    reqBody = JSON.stringify(body);
  }

  const res = await fetch(fullUrl, {
    method,
    headers,
    body: reqBody
  });

  if (!res.ok) {
    let errorData = null;
    try {
      errorData = await res.json();
    } catch {
      errorData = { detail: `HTTP ${res.status}: ${res.statusText}` };
    }
    const err = new Error(errorData?.detail || errorData?.message || res.statusText);
    err.response = { status: res.status, data: errorData };
    throw err;
  }

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const data = await res.json();
    return { data };
  }
  const text = await res.text();
  return { data: text };
}

export const http = {
  get: (url, opts) => request(url, 'GET', null, opts),
  post: (url, body, opts) => request(url, 'POST', body, opts),
  put: (url, body, opts) => request(url, 'PUT', body, opts),
  delete: (url, opts) => request(url, 'DELETE', null, opts)
};

export function errMsg(e) {
  const d = e?.response?.data?.detail;
  if (!d) return e?.message || 'Something went wrong';
  if (typeof d === 'string') return d;
  if (Array.isArray(d)) return d.map(x => x?.msg || JSON.stringify(x)).join(' ');
  return String(d);
}

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const t = localStorage.getItem('br_token') || localStorage.getItem('bhuraksha_token');
    if (!t) {
      http.post('/auth/login', { email: 'collector@bhuraksha.demo', password: 'Approve@RESQ26' })
        .then(r => {
          localStorage.setItem('br_token', r.data.token);
          localStorage.setItem('bhuraksha_token', r.data.token);
          setUser(r.data.user);
        })
        .catch(() => setUser(false));
      return;
    }
    http.get('/auth/me')
      .then(r => setUser(r.data))
      .catch(() => {
        localStorage.removeItem('br_token');
        localStorage.removeItem('bhuraksha_token');
        setUser(false);
      });
  }, []);

  const login = useCallback(async (email, password) => {
    const { data } = await http.post('/auth/login', { email, password });
    localStorage.setItem('br_token', data.token);
    localStorage.setItem('bhuraksha_token', data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('br_token');
    localStorage.removeItem('bhuraksha_token');
    setUser(false);
    http.post('/auth/logout').catch(() => {});
  }, []);

  return React.createElement(
    AuthCtx.Provider,
    { value: { user, setUser, login, logout } },
    children
  );
}

export const useAuth = () => useContext(AuthCtx);

export const canApprove = (u) => u && ['approver', 'admin'].includes(u.role);
export const canOperate = (u) => u && ['approver', 'admin', 'operator'].includes(u.role);

const IncCtx = createContext(null);

export function IncidentProvider({ children }) {
  const [incidentId, setIncidentIdState] = useState(localStorage.getItem('br_incident') || null);

  const setIncidentId = (id) => {
    if (id) {
      localStorage.setItem('br_incident', id);
    } else {
      localStorage.removeItem('br_incident');
    }
    setIncidentIdState(id);
  };

  return React.createElement(
    IncCtx.Provider,
    { value: { incidentId, setIncidentId } },
    children
  );
}

export const useIncidentId = () => useContext(IncCtx);

export function decodeB64(s) {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
