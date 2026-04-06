// Authentication service - connects to real backend API
// NOTE: Auth state is memory-only. On page reload, users must re-login.
// All tokens and user data are cleared to enforce DB-backed sessions.
import { getApiBaseUrl } from './api.js';

const state = Vue.reactive({
  user: null,
  token: null,
  initialized: true  // Always initialized (no localStorage to load)
});

export function clearSession() {
  state.user = null;
  state.token = null;
}

export function initAuth(reset = false) {
  if (reset) {
    clearSession();
  }
  // No localStorage loading - state stays as initialized
}

/**
 * Register a new user
 * @param {string} name - User full name
 * @param {string} email - User email
 * @param {string} password - User password (min 8 chars)
 * @returns {Promise<{success: boolean, user?: {}, message?: string}>}
 */
export async function registerBackend(name, email, password) {
  try {
    const apiBaseUrl = getApiBaseUrl();
    const response = await fetch(`${apiBaseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        message: data.message || 'Registration failed',
        errors: data.errors
      };
    }

    return {
      success: true,
      message: 'Registration successful! Please login.'
    };
  } catch (error) {
    console.error('Registration error:', error);
    return {
      success: false,
      message: error.message || 'Registration failed'
    };
  }
}

/**
 * Login with email and password
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<{success: boolean, user?: {id, name, email}, token?: string, message?: string}>}
 */
export async function loginBackend(email, password) {
  try {
    const apiBaseUrl = getApiBaseUrl();
    const response = await fetch(`${apiBaseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        message: data.message || 'Login failed',
        errors: data.errors
      };
    }

    // Extract user and token from response
    const user = data.data?.user || data.data;
    const token = data.data?.token;

    if (!user || !token) {
      return {
        success: false,
        message: 'Invalid response from server'
      };
    }

    state.user = user;
    state.token = token;

    return {
      success: true,
      user,
      token,
      message: 'Login successful'
    };
  } catch (error) {
    console.error('Login error:', error);
    return {
      success: false,
      message: error.message || 'Login failed'
    };
  }
}

/**
 * Fetch current user info
 * @returns {Promise<{success: boolean, user?: {}, message?: string}>}
 */
export async function getMe() {
  try {
    const apiBaseUrl = getApiBaseUrl();
    const token = state.token;

    if (!token) {
      return { success: false, message: 'Not authenticated' };
    }

    const response = await fetch(`${apiBaseUrl}/auth/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        message: data.message || 'Failed to fetch user'
      };
    }

    const user = data.data || data;
    state.user = user;

    return {
      success: true,
      user
    };
  } catch (error) {
    console.error('Get user error:', error);
    return {
      success: false,
      message: error.message || 'Failed to fetch user'
    };
  }
}

export function logout() {
  state.user = null;
  state.token = null;
}

export function isAuthenticated() {
  return Boolean(state.token);
}

export function getAuthToken() {
  return state.token;
}

export function useAuth() {
  return state;
}

export function updateAuthUser(partialUser = {}) {
  if (!state.user) return;
  state.user = {
    ...state.user,
    ...partialUser
  };
}
