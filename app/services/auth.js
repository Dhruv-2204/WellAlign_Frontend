// Mock auth scaffold for the SPA. Replace with real backend auth endpoints later.
const AUTH_USER_KEY = 'wa-auth-user';
const AUTH_TOKEN_KEY = 'wa-auth-token';

const defaultDemoUser = {
  id: 'demo-user',
  name: 'Demo User',
  email: 'demo@wellalign.app'
};

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

export function loginMock(payload = {}) {
  const user = {
    ...defaultDemoUser,
    name: payload.name || defaultDemoUser.name,
    email: payload.email || defaultDemoUser.email
  };

  const token = `mock-token-${Date.now()}`;
  state.user = user;
  state.token = token;
  persistAuth(user, token);

  return user;
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
