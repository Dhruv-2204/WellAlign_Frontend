const MONITORING_SESSION_KEY = 'wa-monitoring-session';

const state = Vue.reactive({
  isMonitoring: false,
  lastSession: null,
  initialized: false
});

function persistState() {
  localStorage.setItem(
    MONITORING_SESSION_KEY,
    JSON.stringify({
      isMonitoring: state.isMonitoring,
      lastSession: state.lastSession
    })
  );
}

export function initMonitoringSession() {
  if (state.initialized) return;

  try {
    const raw = localStorage.getItem(MONITORING_SESSION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      state.isMonitoring = Boolean(parsed?.isMonitoring);
      state.lastSession = parsed?.lastSession || null;
    }
  } catch {
    state.isMonitoring = false;
    state.lastSession = null;
  }

  state.initialized = true;
}

export function setMonitoringActive(isActive) {
  initMonitoringSession();
  state.isMonitoring = Boolean(isActive);
  persistState();
}

export function setLastMonitoringSession(session) {
  initMonitoringSession();
  state.lastSession = {
    duration: session?.duration || '00:00:00',
    score: Number.isFinite(session?.score) ? session.score : 0,
    endedAt: session?.endedAt || new Date().toISOString(),
    summary: session?.summary || { good: 0, forward: 0, slouch: 0 }
  };
  persistState();
}

export function useMonitoringSession() {
  initMonitoringSession();
  return state;
}