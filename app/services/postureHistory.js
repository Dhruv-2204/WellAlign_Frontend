/**
 * Posture History Service
 * Manages persistent storage of session history (up to 2 past sessions)
 * Provides session retrieval, statistics generation, and report formatting
 */

const STORAGE_KEY = 'wa-posture-sessions';
const MAX_STORED_SESSIONS = 2;

// --------- Session Structure Helper ----------

/**
 * Create a new session object
 */
export function createSession(mode = 'live', timedDuration = null) {
  return {
    id: generateSessionId(),
    startTime: Date.now(),
    endTime: null,
    duration: 0, // seconds
    mode, // 'live' or 'timed'
    timedDuration: timedDuration || null, // seconds (only for timed mode)
    snapshots: [], // Array of posture measurements
    summary: {
      issueFlags: {}, // count of each issue type detected
      totalGoodTime: 0, // milliseconds
      totalBadTime: 0, // milliseconds
      goodPercentage: 0,
      badPercentage: 0
    },
    createdAt: new Date().toISOString(),
    completedAt: null
  };
}

/**
 * Generate unique session ID
 */
function generateSessionId() {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// --------- Session Recording ----------

/**
 * Record a posture snapshot to a session
 * @param {Object} session - Session object
 * @param {Object} postureMetrics - Posture analysis result from postureAnalysis.js
 */
export function recordSnapshot(session, postureMetrics) {
  if (!session) return;

  const snapshot = {
    timestamp: Date.now(),
    postures: {
      classification: postureMetrics.classification || 'UNKNOWN',
      overallSeverity: postureMetrics.overallSeverity || 0,
      issues: postureMetrics.issues || []
    },
    quality: calculateQuality(postureMetrics)
  };

  session.snapshots.push(snapshot);
  return snapshot;
}

/**
 * Calculate quality score (0-100) based on posture metrics
 */
function calculateQuality(postureMetrics) {
  if (!postureMetrics) return 0;
  
  // Quality inversely correlates with severity
  const quality = Math.max(0, 100 - (postureMetrics.overallSeverity || 0));
  return Math.round(quality);
}

/**
 * Finalize a session and compute summary statistics
 * @param {Object} session - Session object to finalize
 */
export function finalizeSession(session) {
  if (!session) return null;

  const now = Date.now();
  session.endTime = now;
  session.duration = Math.round((now - session.startTime) / 1000); // Convert to seconds
  session.completedAt = new Date().toISOString();

  // Compute summary statistics from snapshots
  computeSessionSummary(session);

  return session;
}

/**
 * Compute session summary statistics
 */
function computeSessionSummary(session) {
  if (!session.snapshots || session.snapshots.length === 0) {
    session.summary = {
      issueFlags: {},
      totalGoodTime: 0,
      totalBadTime: 0,
      goodPercentage: 0,
      badPercentage: 0
    };
    return;
  }

  const issueFlags = {};
  let goodSnapshots = 0;
  let badSnapshots = 0;

  // Aggregate snapshot data
  session.snapshots.forEach((snapshot) => {
    const classification = snapshot.postures.classification;

    // Count good vs bad posture
    if (classification === 'GOOD') {
      goodSnapshots++;
    } else if (classification !== 'UNKNOWN') {
      badSnapshots++;

      // Count issue types
      snapshot.postures.issues.forEach((issue) => {
        issueFlags[issue.type] = (issueFlags[issue.type] || 0) + 1;
      });
    }
  });

  const totalSnapshots = goodSnapshots + badSnapshots;
  const goodPercentage = totalSnapshots > 0 ? Math.round((goodSnapshots / totalSnapshots) * 100) : 0;
  const badPercentage = 100 - goodPercentage;

  // Time calculations (rough estimate based on snapshot count)
  const estimatedTimePerSnapshot = session.duration / totalSnapshots;
  const totalGoodTime = Math.round(goodSnapshots * estimatedTimePerSnapshot);
  const totalBadTime = Math.round(badSnapshots * estimatedTimePerSnapshot);

  session.summary = {
    issueFlags,
    totalGoodTime,
    totalBadTime,
    goodPercentage,
    badPercentage,
    snapshotCount: session.snapshots.length
  };
}

// --------- Storage Management ----------

/**
 * Save session to localStorage
 * Keeps only the 2 most recent sessions
 */
export function saveSessionToStorage(session) {
  if (!session) return false;

  try {
    // Get existing sessions
    const existingSessions = getSessionHistory() || [];

    // Add new session
    existingSessions.unshift(session); // Add to beginning (most recent first)

    // Keep only 2 most recent sessions
    const sessionsToStore = existingSessions.slice(0, MAX_STORED_SESSIONS);

    // Save to localStorage
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionsToStore));

    return true;
  } catch (error) {
    console.error('Failed to save session to storage:', error);
    return false;
  }
}

/**
 * Get session history from localStorage
 * @returns {Array} Array of stored sessions (up to 2)
 */
export function getSessionHistory() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];

    const sessions = JSON.parse(stored);
    return Array.isArray(sessions) ? sessions : [];
  } catch (error) {
    console.error('Failed to retrieve session history:', error);
    return [];
  }
}

/**
 * Get most recent session
 */
export function getLastSession() {
  const history = getSessionHistory();
  return history.length > 0 ? history[0] : null;
}

/**
 * Clear all session history
 */
export function clearSessionHistory() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch (error) {
    console.error('Failed to clear session history:', error);
    return false;
  }
}

// --------- Session Report Generation ----------

/**
 * Generate comprehensive session report
 */
export function generateSessionReport(session) {
  if (!session) return null;

  const duration = formatDuration(session.duration);
  const startDate = new Date(session.startTime).toLocaleString();
  const endDate = new Date(session.endTime).toLocaleString();

  const reportIssues = generateIssueReport(session.summary.issueFlags, session.snapshots.length);

  return {
    id: session.id,
    title: `${session.mode === 'timed' ? 'Timed' : 'Live'} Session Report`,
    startDate,
    endDate,
    mode: session.mode,
    duration,
    durationSeconds: session.duration,
    summary: {
      goodPosturePercentage: session.summary.goodPercentage,
      badPosturePercentage: session.summary.badPercentage,
      totalMeasurements: session.snapshots.length,
      issuesDetected: Object.keys(session.summary.issueFlags).length
    },
    issues: reportIssues,
    sessionQuality: calculateSessionQuality(session),
    recommendations: generateRecommendations(session.summary.issueFlags)
  };
}

/**
 * Generate detailed issue breakdown
 */
function generateIssueReport(issueFlags, totalSnapshots) {
  const issues = [];

  const issueDescriptions = {
    FORWARD_HEAD: {
      name: 'Forward Head Posture',
      description: 'Head positioned forward relative to shoulders',
      advice: 'Keep your head aligned over your shoulders. Imagine a string pulling from the crown of your head.',
      exercises: [
        { name: 'Chin Tucks', url: 'https://www.example.com/chin-tucks' },
        { name: 'Neck Strengthening', url: 'https://www.example.com/neck-strength' }
      ]
    },
    HEAD_TILT: {
      name: 'Head Tilt',
      description: 'Head is tilted to one side',
      advice: 'Maintain level head alignment. Keep your ears aligned with your shoulders.',
      exercises: [
        { name: 'Neck Alignment Drill', url: 'https://www.example.com/neck-alignment' },
        { name: 'Posture Mirror Work', url: 'https://www.example.com/mirror-work' }
      ]
    },
    VERTICAL_TILT: {
      name: 'Vertical Head Tilt',
      description: 'Chin is pointing too far up or down',
      advice: 'Keep your gaze parallel to the ground. Adjust screen height to eye level.',
      exercises: [
        { name: 'Eye Level Exercise', url: 'https://www.example.com/eye-level' },
        { name: 'Workstation Setup', url: 'https://www.example.com/workstation' }
      ]
    },
    SHOULDER_ASYMMETRY: {
      name: 'Uneven Shoulders',
      description: 'One shoulder is higher than the other',
      advice: 'Relax shoulders away from ears. Keep them level and equidistant from the floor.',
      exercises: [
        { name: 'Shoulder Level Check', url: 'https://www.example.com/shoulder-level' },
        { name: 'Relaxation Techniques', url: 'https://www.example.com/relaxation' }
      ]
    },
    SLOUCHING: {
      name: 'Slouching / Poor Spine Alignment',
      description: 'Chest and spine are curved forward excessively',
      advice: 'Engage your core and sit up tall. Imagine your spine as a straight line from neck to tailbone.',
      exercises: [
        { name: 'Core Strengthening', url: 'https://www.example.com/core-strength' },
        { name: 'Back Posture Work', url: 'https://www.example.com/back-posture' }
      ]
    }
  };

  Object.entries(issueFlags).forEach(([issueType, count]) => {
    const description = issueDescriptions[issueType] || {
      name: issueType.replace(/_/g, ' '),
      description: 'Posture issue detected',
      advice: 'Work on maintaining proper posture alignment.',
      exercises: []
    };

    const percentage = totalSnapshots > 0 ? Math.round((count / totalSnapshots) * 100) : 0;

    issues.push({
      type: issueType,
      name: description.name,
      detectionCount: count,
      percentage,
      description: description.description,
      advice: description.advice,
      exercises: description.exercises
    });
  });

  // Sort by detection count (most frequent first)
  issues.sort((a, b) => b.detectionCount - a.detectionCount);

  return issues;
}

/**
 * Calculate overall session quality score (0-100)
 */
function calculateSessionQuality(session) {
  if (!session.snapshots || session.snapshots.length === 0) return 0;

  const avgQuality = session.snapshots.reduce((sum, snap) => sum + snap.quality, 0) / session.snapshots.length;
  return Math.round(avgQuality);
}

/**
 * Generate personalized recommendations based on detected issues
 */
function generateRecommendations(issueFlags) {
  const recommendations = [];

  const issueCount = Object.keys(issueFlags).length;

  if (issueCount === 0) {
    return [
      'Excellent posture! Keep up the great work.',
      'Continue these habits for long-term spine health.',
      'Take regular breaks to prevent fatigue.'
    ];
  }

  if (issueFlags.FORWARD_HEAD) {
    recommendations.push('Schedule chin tuck exercises 3x daily for 10 reps each.');
    recommendations.push('Consider raising your screen to eye level to reduce forward head strain.');
  }

  if (issueFlags.SLOUCHING) {
    recommendations.push('Strengthen your core muscles with daily exercises.');
    recommendations.push('Set reminders to check your posture every 30 minutes.');
  }

  if (issueFlags.SHOULDER_ASYMMETRY) {
    recommendations.push('Practice shoulder level awareness during the day.');
    recommendations.push('Try relaxation and stretching exercises for balanced shoulder tension.');
  }

  if (issueFlags.HEAD_TILT) {
    recommendations.push('Use a mirror to practice maintaining level head alignment.');
  }

  if (issueFlags.VERTICAL_TILT) {
    recommendations.push('Ensure your monitor is positioned at eye level.');
    recommendations.push('Practice keeping your gaze horizontal for better neck alignment.');
  }

  return recommendations;
}

/**
 * Format duration in seconds to human-readable format
 */
function formatDuration(seconds) {
  if (!seconds || seconds < 0) return '0s';

  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes < 60) {
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

// --------- Utility Functions ----------

/**
 * Get statistics across all stored sessions
 */
export function getAggregateStats() {
  const history = getSessionHistory();

  if (history.length === 0) {
    return {
      totalSessions: 0,
      totalDuration: 0,
      averageGoodPosturePercentage: 0,
      totalMeasurements: 0
    };
  }

  let totalDuration = 0;
  let totalGoodPercentage = 0;
  let totalMeasurements = 0;

  history.forEach((session) => {
    totalDuration += session.duration || 0;
    totalGoodPercentage += session.summary.goodPercentage || 0;
    totalMeasurements += session.snapshots.length || 0;
  });

  return {
    totalSessions: history.length,
    totalDuration: Math.round(totalDuration),
    averageGoodPosturePercentage: Math.round(totalGoodPercentage / history.length),
    totalMeasurements,
    averageMeasurementsPerSession: Math.round(totalMeasurements / history.length)
  };
}

/**
 * Export session as JSON for download
 */
export function exportSessionAsJSON(session) {
  const json = JSON.stringify(session, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `posture-session-${session.id}.json`;
  link.click();
  
  URL.revokeObjectURL(url);
}
