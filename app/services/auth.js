// Authentication service - connects to real backend API
import { getApiBaseUrl } from './api.js';

const AUTH_USER_KEY = 'wa-auth-user';
const AUTH_TOKEN_KEY = 'wa-auth-token';

const state = Vue.reactive({
  user: null,
  token: null,
  initialized: false
});

function persistAuth(user, token) {
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  localStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function initAuth() {
  if (state.initialized) return;

  try {
    const savedUser = localStorage.getItem(AUTH_USER_KEY);
    const savedToken = localStorage.getItem(AUTH_TOKEN_KEY);

    state.user = savedUser ? JSON.parse(savedUser) : null;
    state.token = savedToken || null;
  } catch {
    state.user = null;
    state.token = null;
  }

  state.initialized = true;
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

    // Store in state and localStorage
    state.user = user;
    state.token = token;
    persistAuth(user, token);

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
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));

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
  localStorage.removeItem(AUTH_USER_KEY);
  localStorage.removeItem(AUTH_TOKEN_KEY);
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
