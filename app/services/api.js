import { getAuthToken } from './auth.js';

// Central API client for the SPA.
// Keeps base URL, auth headers, and request parsing in one place.
const API_BASE_URL_STORAGE_KEY = 'wa-api-base-url';
const DEFAULT_API_BASE_URL = 'http://localhost:3000/api';

function normalizeBaseUrl(url) {
  return String(url || '').replace(/\/+$/, '');
}

let apiBaseUrl = normalizeBaseUrl(
  localStorage.getItem(API_BASE_URL_STORAGE_KEY) || window.WA_API_BASE_URL || DEFAULT_API_BASE_URL
);

export function getApiBaseUrl() {
  return apiBaseUrl;
}

export function setApiBaseUrl(nextBaseUrl) {
  apiBaseUrl = normalizeBaseUrl(nextBaseUrl) || DEFAULT_API_BASE_URL;
  localStorage.setItem(API_BASE_URL_STORAGE_KEY, apiBaseUrl);
}

function withQuery(path, query = {}) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') return;
    params.append(key, String(value));
  });

  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

async function request(path, options = {}) {
  const token = getAuthToken();

  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    },
    ...options
  });

  if (!response.ok) {
    const text = await response.text();
    const error = new Error(text || `Request failed: ${response.status}`);
    error.status = response.status;
    throw error;
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json();
  }

  return response.text();
}

async function requestWithFallback(paths, optionsFactory) {
  let lastError = null;

  for (const path of paths) {
    try {
      const options = typeof optionsFactory === 'function' ? optionsFactory(path) : optionsFactory;
      return await request(path, options);
    } catch (err) {
      lastError = err;
      // Continue probing only when route does not exist.
      if (err && err.status === 404) {
        continue;
      }
      throw err;
    }
  }

  throw lastError || new Error('No compatible endpoint found');
}

export const api = {
  get(path) {
    return request(path, { method: 'GET' });
  },
  post(path, body) {
    return request(path, { method: 'POST', body: JSON.stringify(body) });
  },
  put(path, body) {
    return request(path, { method: 'PUT', body: JSON.stringify(body) });
  },
  del(path) {
    return request(path, { method: 'DELETE' });
  },

  // Domain helpers to keep view components simple and consistent.
  health: {
    ping() {
      return request('/health', { method: 'GET' });
    }
  },

  exerciseLibrary: {
    list() {
      return request('/exercises', { method: 'GET' });
    },
    search(queryText) {
      return request(withQuery('/exercises/search', { q: queryText }), { method: 'GET' });
    },
    updateAvailability(exerciseId, availability) {
      return request(`/exercises/${exerciseId}`, {
        method: 'PUT',
        body: JSON.stringify({ availability })
      });
    }
  },

  plans: {
    list() {
      return request('/plans', { method: 'GET' });
    },
    create(planPayload) {
      return request('/plans', {
        method: 'POST',
        body: JSON.stringify(planPayload)
      });
    },
    update(planId, planPayload) {
      return request(`/plans/${planId}`, {
        method: 'PUT',
        body: JSON.stringify(planPayload)
      });
    }
  },

  monitoringSessions: {
    list() {
      return request('/sessions', { method: 'GET' });
    },
    create(payload) {
      return request('/sessions', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    }
  },

  assessments: {
    list() {
      return request('/assessments', { method: 'GET' });
    },
    create(payload) {
      return request('/assessments', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    }
  },

  account: {
    getMe() {
      return requestWithFallback(
        ['/auth/me', '/users/me', '/users/profile', '/auth/profile'],
        { method: 'GET' }
      );
    },
    updateProfile(payload) {
      return requestWithFallback(
        ['/auth/me', '/users/me', '/users/profile', '/auth/profile'],
        (path) => ({
          method: path.includes('/profile') ? 'PATCH' : 'PUT',
          body: JSON.stringify(payload)
        })
      );
    },
    getSettings() {
      return requestWithFallback(
        ['/settings', '/users/settings', '/auth/settings'],
        { method: 'GET' }
      );
    },
    updateSettings(payload) {
      return requestWithFallback(
        ['/settings', '/users/settings', '/auth/settings'],
        (path) => ({
          method: path.includes('/settings') ? 'PUT' : 'PATCH',
          body: JSON.stringify(payload)
        })
      );
    },
    changePassword(oldPassword, newPassword) {
      return requestWithFallback(
        ['/auth/change-password', '/users/change-password', '/auth/password', '/users/password'],
        (path) => ({
          method: path.includes('change-password') ? 'POST' : 'PATCH',
          body: JSON.stringify({ oldPassword, newPassword })
        })
      );
    },
    deleteAccount() {
      return requestWithFallback(
        ['/auth/me', '/users/me', '/users/profile', '/auth/profile'],
        { method: 'DELETE' }
      );
    }
  }
};
