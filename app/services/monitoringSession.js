import {
  createSession,
  recordSnapshot,
  finalizeSession,
  saveSessionToStorage,
  getSessionHistory,
  generateSessionReport
} from './postureHistory.js';

const MONITORING_SESSION_KEY = 'wa-monitoring-session';
const SNAPSHOT_INTERVAL_MS = 100; // Record every 100ms

// --------- Reactive State ----------
const state = Vue.reactive({
  // UI state
  isMonitoring: false,
  lastSession: null,
  initialized: false,
  
  // Session recording state
  currentSession: null,
  sessionMode: 'live', // 'live' or 'timed'
  timedSessionDuration: 300, // seconds (5 minutes default)
  sessionTimeRemaining: 300, // seconds remaining in timed session
  isSessionActive: false,
  
  // Recording parameters
  recordingEnabled: true,
  snapshotBuffer: [] // Buffer for batching snapshots
});

// --------- Session Recording State ----------
let snapshotIntervalId = null;
let timerIntervalId = null;

// --------- Initialization ----------

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

// --------- UI State Management ----------

export function setMonitoringActive(isActive) {
  initMonitoringSession();
  state.isMonitoring = Boolean(isActive);
  persistState();
}

export function setLastMonitoringSession(session) {
  initMonitoringSession();
  const durationSeconds = Number.isFinite(session?.durationSeconds)
    ? session.durationSeconds
    : Number.isFinite(session?.duration)
      ? session.duration
      : 0;

  const goodPercentage = Number.isFinite(session?.summary?.goodPercentage)
    ? session.summary.goodPercentage
    : Number.isFinite(session?.score)
      ? session.score
      : 0;

  state.lastSession = {
    duration: session?.durationFormatted || formatDuration(durationSeconds),
    score: goodPercentage,
    endedAt: session?.endedAt || session?.completedAt || new Date().toISOString(),
    summary: session?.summary || { goodPercentage: goodPercentage, badPercentage: Math.max(0, 100 - goodPercentage) }
  };
  persistState();
}

export function useMonitoringSession() {
  initMonitoringSession();
  return state;
}

function persistState() {
  localStorage.setItem(
    MONITORING_SESSION_KEY,
    JSON.stringify({
      isMonitoring: state.isMonitoring,
      lastSession: state.lastSession
    })
  );
}

// --------- Session Recording Management ----------

/**
 * Start a new monitoring session
 * @param {string} mode - 'live' or 'timed'
 * @param {number} duration - Duration in seconds (for timed mode)
 * @returns {Object} Created session object
 */
export function startRecordingSession(mode = 'live', duration = 300) {
  // Cleanup any existing session
  if (state.currentSession) {
    endRecordingSession();
  }

  // Create new session
  state.currentSession = createSession(mode, mode === 'timed' ? duration : null);
  setMonitoringActive(true);
  state.sessionMode = mode;
  state.timedSessionDuration = duration;
  state.sessionTimeRemaining = duration;
  state.isSessionActive = true;
  state.snapshotBuffer = [];

  // Start snapshot recording
  startSnapshotRecording();

  // Start timer for timed sessions
  if (mode === 'timed') {
    startSessionTimer(duration);
  }

  console.log(`✓ Recording session started: ${state.currentSession.id} (${mode})`);
  return state.currentSession;
}

/**
 * Record a posture snapshot to the current session
 * @param {Object} postureMetrics - Posture analysis from postureAnalysis.js
 */
export function recordPostureSnapshot(postureMetrics) {
  console.log('[recordPostureSnapshot] Called with metrics:', postureMetrics);
  
  if (!state.currentSession) {
    console.warn('[recordPostureSnapshot] FAILED: no current session');
    return;
  }

  if (!state.isSessionActive) {
    console.warn('[recordPostureSnapshot] FAILED: session not active', { isSessionActive: state.isSessionActive });
    return;
  }

  if (!state.recordingEnabled) {
    console.warn('[recordPostureSnapshot] FAILED: recording disabled', { recordingEnabled: state.recordingEnabled });
    return;
  }

  if (!postureMetrics) {
    console.warn('[recordPostureSnapshot] FAILED: no posture metrics');
    return;
  }

  // Ensure metrics have required fields
  if (!postureMetrics.classification || postureMetrics.overallSeverity === undefined) {
    console.warn('[recordPostureSnapshot] FAILED: invalid metrics structure', {
      hasClassification: !!postureMetrics.classification,
      classification: postureMetrics.classification,
      overallSeverity: postureMetrics.overallSeverity
    });
    return;
  }

  console.log('[recordPostureSnapshot] Validation passed. Recording snapshot.');
  // Add snapshot to current session
  recordSnapshot(state.currentSession, postureMetrics);
}

/**
 * End the current monitoring session and save it
 * @returns {Object} Finalized and saved session
 */
export function endRecordingSession() {
  if (!state.currentSession) {
    console.warn('No active session to end');
    return null;
  }

  // Stop recording timers
  stopSnapshotRecording();
  stopSessionTimer();

  // Finalize session
  const finalizedSession = finalizeSession(state.currentSession);

  // Save to persistent storage
  saveSessionToStorage(finalizedSession);

  // Generate report for UI display
  const report = generateSessionReport(finalizedSession);

  console.log(`✓ Recording session ended: ${finalizedSession.id}`);
  console.log('Session Report:', report);

  // Update state
  setMonitoringActive(false);
  setLastMonitoringSession({
    durationSeconds: finalizedSession.duration,
    durationFormatted: formatDuration(finalizedSession.duration),
    score: finalizedSession.summary?.goodPercentage || 0,
    endedAt: finalizedSession.completedAt,
    completedAt: finalizedSession.completedAt,
    summary: finalizedSession.summary
  });
  state.currentSession = null;
  state.isSessionActive = false;
  state.sessionTimeRemaining = 0;

  return finalizedSession;
}

/**
 * Get the current active session
 */
export function getCurrentSession() {
  return state.currentSession;
}

/**
 * Get session history (up to 2 past sessions)
 */
export function getSessionHistoryList() {
  return getSessionHistory();
}

/**
 * Check if a session is currently recording
 */
export function isRecordingActive() {
  return state.isSessionActive && state.currentSession !== null;
}

// --------- Snapshot Recording Timer ----------

function startSnapshotRecording() {
  if (snapshotIntervalId) {
    clearInterval(snapshotIntervalId);
  }

  snapshotIntervalId = setInterval(() => {
    if (state.currentSession && state.isSessionActive && state.recordingEnabled) {
      // Snapshots are recorded via recordPostureSnapshot() calls
      // This interval just ensures periodic opportunities
      // The actual recording trigger comes from MediaPipe updates
    }
  }, SNAPSHOT_INTERVAL_MS);
}

function stopSnapshotRecording() {
  if (snapshotIntervalId) {
    clearInterval(snapshotIntervalId);
    snapshotIntervalId = null;
  }
}

// --------- Session Timer (for timed mode) ----------

function startSessionTimer(duration) {
  if (timerIntervalId) {
    clearInterval(timerIntervalId);
  }

  state.sessionTimeRemaining = duration;

  timerIntervalId = setInterval(() => {
    state.sessionTimeRemaining -= 1;

    // Auto-end session when time runs out
    if (state.sessionTimeRemaining <= 0) {
      console.log('Timed session duration complete - auto-ending');
      endRecordingSession();
      stopSessionTimer();
    }
  }, 1000);
}

function stopSessionTimer() {
  if (timerIntervalId) {
    clearInterval(timerIntervalId);
    timerIntervalId = null;
  }
}

// --------- Session Configuration ----------

/**
 * Set timed session duration
 * @param {number} seconds - Duration in seconds
 */
export function setTimedSessionDuration(seconds) {
  const validSeconds = Math.max(5 * 60, Math.min(45 * 60, seconds)); // Clamp to 5-45 min
  state.timedSessionDuration = validSeconds;
  if (!state.isSessionActive) {
    state.sessionTimeRemaining = validSeconds;
  }
}

/**
 * Enable/disable recording
 */
export function setRecordingEnabled(enabled) {
  state.recordingEnabled = Boolean(enabled);
}

// --------- Session Cleanup ----------

/**
 * Clean up resources when component unmounts
 */
export function cleanupSession() {
  stopSnapshotRecording();
  stopSessionTimer();
  
  // Auto-end active session
  if (state.isSessionActive && state.currentSession) {
    endRecordingSession();
  }
}

function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Math.floor(totalSeconds || 0));
  const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}