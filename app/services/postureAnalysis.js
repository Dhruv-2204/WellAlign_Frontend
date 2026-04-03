/**
 * Posture Analysis Engine
 * Detects posture issues from MediaPipe Pose/FaceMesh landmarks
 * Provides real-time posture classification and severity scoring
 * With 5-7 second hold-duration tracking to avoid false positives
 */

// --------- Landmark Indices (MediaPipe Pose 33-point model) ----------
const LANDMARKS = {
  // Face keypoints
  NOSE: 0,
  LEFT_EYE: 2,
  RIGHT_EYE: 5,
  LEFT_EAR: 3,
  RIGHT_EAR: 6,
  
  // Upper body
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  
  // Lower body (for reference)
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  
  // Spine/neck approximations (extrapolated midpoints)
  // Chest midpoint: (LEFT_SHOULDER + RIGHT_SHOULDER) / 2
  // Pelvis midpoint: (LEFT_HIP + RIGHT_HIP) / 2
};

// --------- Configuration ----------
const CONFIG = {
  // Hold duration thresholds (milliseconds)
  HOLD_THRESHOLD_MIN: 5000,  // 5 seconds minimum
  HOLD_THRESHOLD_MAX: 7000,  // 7 seconds maximum (use random between)
  
  // Severity thresholds
  FORWARD_HEAD_THRESHOLD: 5,      // cm forward from shoulder center
  HEAD_TILT_THRESHOLD: 15,        // degrees
  HEAD_VERTICAL_TILT_THRESHOLD: 20, // degrees
  SHOULDER_ASYMMETRY_THRESHOLD: 8, // percentage
  SLOUCH_THRESHOLD: 12,           // degrees of spine curvature
  
  // Confidence thresholds
  MIN_LANDMARK_CONFIDENCE: 0.5,
};

// --------- State tracking ----------
let issueHoldTimers = {
  forwardHead: null,
  headTilt: null,
  verticalTilt: null,
  shoulderAsymmetry: null,
  slouching: null
};

let issueStartTimes = {
  forwardHead: null,
  screenDistance: null,
  headTilt: null,
  verticalTilt: null,
  shoulderAsymmetry: null,
  slouching: null
};

let requiredHoldDuration = getRandomHoldDuration();
let runtimePreferences = {
  holdDurationMs: null
};

function getConfiguredHoldDuration() {
  if (Number.isFinite(runtimePreferences.holdDurationMs)) {
    return runtimePreferences.holdDurationMs;
  }
  return getRandomHoldDuration();
}

let faceDistanceBaseline = null;
let baselineSteadyStart = null;
let baselineSamples = [];
let lastFaceSize = null;

function getFaceSizeFromPose(landmarks) {
  const leftEar = landmarks[LANDMARKS.LEFT_EAR];
  const rightEar = landmarks[LANDMARKS.RIGHT_EAR];

  if (!isValidLandmark(leftEar) || !isValidLandmark(rightEar)) {
    return null;
  }

  // Ear-to-ear distance acts as a stable proxy for face size in frame.
  return Math.abs(rightEar.x - leftEar.x);
}

function updateFaceDistanceBaseline(faceSize) {
  const now = Date.now();
  const STEADY_WINDOW_MS = 5000;
  const STEADY_VARIATION = 0.03; // 3%

  if (!Number.isFinite(faceSize) || faceSize <= 0) {
    return;
  }

  if (faceDistanceBaseline !== null) {
    lastFaceSize = faceSize;
    return;
  }

  if (!Number.isFinite(lastFaceSize)) {
    lastFaceSize = faceSize;
    baselineSteadyStart = now;
    baselineSamples = [faceSize];
    return;
  }

  const deltaRatio = Math.abs(faceSize - lastFaceSize) / Math.max(lastFaceSize, 0.0001);
  if (deltaRatio <= STEADY_VARIATION) {
    if (!baselineSteadyStart) baselineSteadyStart = now;
    baselineSamples.push(faceSize);

    if (now - baselineSteadyStart >= STEADY_WINDOW_MS && baselineSamples.length >= 20) {
      const avg = baselineSamples.reduce((sum, val) => sum + val, 0) / baselineSamples.length;
      faceDistanceBaseline = avg;
    }
  } else {
    baselineSteadyStart = now;
    baselineSamples = [faceSize];
  }

  lastFaceSize = faceSize;
}

function analyzeFaceDistanceFromScreen(landmarks) {
  const faceSize = getFaceSizeFromPose(landmarks);
  updateFaceDistanceBaseline(faceSize);

  if (!Number.isFinite(faceSize) || faceSize <= 0) {
    return {
      detected: false,
      severity: 0,
      value: 0,
      baselineReady: false,
      isTooClose: false
    };
  }

  if (!Number.isFinite(faceDistanceBaseline) || faceDistanceBaseline <= 0) {
    return {
      detected: false,
      severity: 0,
      value: 0,
      baselineReady: false,
      isTooClose: false
    };
  }

  const closerPercent = ((faceSize - faceDistanceBaseline) / faceDistanceBaseline) * 100;
  const isTooClose = closerPercent > 15;
  const severity = Math.max(0, Math.min(100, (Math.max(0, closerPercent) / 35) * 100));

  return {
    detected: isTooClose,
    severity,
    value: closerPercent,
    baselineReady: true,
    isTooClose
  };
}

function getRandomHoldDuration() {
  return CONFIG.HOLD_THRESHOLD_MIN + 
    Math.random() * (CONFIG.HOLD_THRESHOLD_MAX - CONFIG.HOLD_THRESHOLD_MIN);
}

// --------- Private helper functions ----------

/**
 * Calculate distance between two landmarks
 */
function distance(p1, p2) {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  const dz = (p1.z || 0) - (p2.z || 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Calculate angle between three points
 */
function angleBetweenPoints(A, B, C) {
  // Vector BA
  const BA = { x: A.x - B.x, y: A.y - B.y };
  // Vector BC
  const BC = { x: C.x - B.x, y: C.y - B.y };
  
  // Dot product and magnitudes
  const dot = BA.x * BC.x + BA.y * BC.y;
  const magBA = Math.sqrt(BA.x * BA.x + BA.y * BA.y);
  const magBC = Math.sqrt(BC.x * BC.x + BC.y * BC.y);
  
  if (magBA === 0 || magBC === 0) return 0;
  
  // Angle in radians, then convert to degrees
  const cosAngle = dot / (magBA * magBC);
  const clampedCos = Math.max(-1, Math.min(1, cosAngle));
  return Math.acos(clampedCos) * (180 / Math.PI);
}

/**
 * Get horizontal angle from two points
 */
function getHorizontalAngle(p1, p2) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.atan2(dy, dx) * (180 / Math.PI);
}

/**
 * Validate landmark confidence and availability
 */
function isValidLandmark(landmark) {
  return landmark && landmark.visibility >= CONFIG.MIN_LANDMARK_CONFIDENCE;
}

// --------- Posture metric calculations ----------

/**
 * Detect forward head posture
 * Forward head occurs when nose is significantly ahead of shoulder position
 */
function analyzeForwardHead(landmarks) {
  const nose = landmarks[LANDMARKS.NOSE];
  const leftShoulder = landmarks[LANDMARKS.LEFT_SHOULDER];
  const rightShoulder = landmarks[LANDMARKS.RIGHT_SHOULDER];
  
  if (!isValidLandmark(nose) || !isValidLandmark(leftShoulder) || !isValidLandmark(rightShoulder)) {
    return { detected: false, severity: 0, value: 0 };
  }
  
  // Get shoulder midpoint and forward projection (x-axis)
  const shoulderMidX = (leftShoulder.x + rightShoulder.x) / 2;
  const shoulderMidY = (leftShoulder.y + rightShoulder.y) / 2;
  
  // Estimate body scale (shoulder width)
  const shoulderWidth = Math.abs(rightShoulder.x - leftShoulder.x);
  
  // Forward head distance (normalized by shoulder width)
  const forwardDistance = (shoulderMidX - nose.x) * shoulderWidth * 100; // Scale to cm-like units
  
  // Forward head detected if nose is ahead of shoulders
  const detected = forwardDistance > CONFIG.FORWARD_HEAD_THRESHOLD;
  const severity = Math.max(0, Math.min(100, (forwardDistance / 15) * 100)); // Normalize to 0-100
  
  return { detected, severity, value: forwardDistance };
}

/**
 * Detect head tilt (left/right rotation)
 */
function analyzeHeadTilt(landmarks) {
  const leftEye = landmarks[LANDMARKS.LEFT_EYE];
  const rightEye = landmarks[LANDMARKS.RIGHT_EYE];
  
  if (!isValidLandmark(leftEye) || !isValidLandmark(rightEye)) {
    return { detected: false, severity: 0, value: 0 };
  }
  
  // Calculate angle of eye line relative to horizontal
  const tiltAngle = getHorizontalAngle(rightEye, leftEye);
  const absTilt = Math.abs(tiltAngle);
  
  const detected = absTilt > CONFIG.HEAD_TILT_THRESHOLD;
  const severity = Math.max(0, Math.min(100, (absTilt / 30) * 100)); // Normalize to 0-100
  
  return { detected, severity, value: absTilt };
}

/**
 * Detect head vertical tilt (chin up/down)
 */
function analyzeVerticalTilt(landmarks) {
  const nose = landmarks[LANDMARKS.NOSE];
  const leftEar = landmarks[LANDMARKS.LEFT_EAR];
  const rightEar = landmarks[LANDMARKS.RIGHT_EAR];
  
  if (!isValidLandmark(nose) || !isValidLandmark(leftEar) || !isValidLandmark(rightEar)) {
    return { detected: false, severity: 0, value: 0 };
  }
  
  // Vertical tilt: angle from ears to nose
  const earMidY = (leftEar.y + rightEar.y) / 2;
  const verticalTilt = Math.abs(nose.y - earMidY) * 100; // Scale to degrees-like units
  
  const detected = verticalTilt > CONFIG.HEAD_VERTICAL_TILT_THRESHOLD;
  const severity = Math.max(0, Math.min(100, (verticalTilt / 35) * 100));
  
  return { detected, severity, value: verticalTilt };
}

/**
 * Detect shoulder asymmetry (uneven shoulders)
 */
function analyzeShoulderAsymmetry(landmarks) {
  const leftShoulder = landmarks[LANDMARKS.LEFT_SHOULDER];
  const rightShoulder = landmarks[LANDMARKS.RIGHT_SHOULDER];
  
  if (!isValidLandmark(leftShoulder) || !isValidLandmark(rightShoulder)) {
    return { detected: false, severity: 0, value: 0 };
  }
  
  // Height difference between shoulders (y-coordinate)
  const heightDiff = Math.abs(leftShoulder.y - rightShoulder.y);
  
  // Shoulder width for normalization
  const shoulderWidth = Math.abs(rightShoulder.x - leftShoulder.x);
  
  // Calculate asymmetry percentage
  const asymmetryPercentage = (heightDiff / shoulderWidth) * 100;
  
  const detected = asymmetryPercentage > CONFIG.SHOULDER_ASYMMETRY_THRESHOLD;
  const severity = Math.max(0, Math.min(100, (asymmetryPercentage / 20) * 100));
  
  return { detected, severity, value: asymmetryPercentage };
}

/**
 * Detect slouching (chest/spine curvature)
 */
function analyzeSlouching(landmarks) {
  const leftShoulder = landmarks[LANDMARKS.LEFT_SHOULDER];
  const rightShoulder = landmarks[LANDMARKS.RIGHT_SHOULDER];
  const leftHip = landmarks[LANDMARKS.LEFT_HIP];
  const rightHip = landmarks[LANDMARKS.RIGHT_HIP];
  
  if (!isValidLandmark(leftShoulder) || !isValidLandmark(rightShoulder) ||
      !isValidLandmark(leftHip) || !isValidLandmark(rightHip)) {
    return { detected: false, severity: 0, value: 0 };
  }
  
  // Calculate chest midpoint and hip midpoint
  const chestX = (leftShoulder.x + rightShoulder.x) / 2;
  const chestY = (leftShoulder.y + rightShoulder.y) / 2;
  const hipX = (leftHip.x + rightHip.x) / 2;
  const hipY = (leftHip.y + rightHip.y) / 2;
  
  // Calculate spine angle (vertical alignment)
  const spineVertical = Math.abs(chestY - hipY);
  const spineHorizontal = Math.abs(chestX - hipX);
  
  // Slouching detected if spine leans forward
  const slouchAngle = Math.atan2(spineHorizontal, spineVertical) * (180 / Math.PI);
  
  const detected = slouchAngle > CONFIG.SLOUCH_THRESHOLD;
  const severity = Math.max(0, Math.min(100, (slouchAngle / 30) * 100));
  
  return { detected, severity, value: slouchAngle };
}

/**
 * Track hold duration for an issue
 * Returns true only after sustained poor posture for required duration
 */
function trackIssueDuration(issueKey, isDetected) {
  const now = Date.now();
  
  if (isDetected) {
    // Start or continue tracking
    if (!issueStartTimes[issueKey]) {
      issueStartTimes[issueKey] = now;
    }
    
    const elapsedTime = now - issueStartTimes[issueKey];
    return elapsedTime >= requiredHoldDuration;
  } else {
    // Reset tracking
    issueStartTimes[issueKey] = null;
    return false;
  }
}

// --------- Public API ----------

/**
 * Analyze posture from MediaPipe landmarks
 * @param {Array} landmarks - MediaPipe Pose landmarks (33 points)
 * @returns {Object} Posture analysis object
 */
export function analyzePosture(landmarks) {
  if (!landmarks || landmarks.length < 25) {
    return {
      status: 'NO_DATA',
      classification: 'UNKNOWN',
      overallSeverity: 0,
      issues: [],
      timestamp: Date.now()
    };
  }
  
  // Analyze all posture metrics
  const forwardHead = analyzeForwardHead(landmarks);
  const headTilt = analyzeHeadTilt(landmarks);
  const verticalTilt = analyzeVerticalTilt(landmarks);
  const shoulderAsymmetry = analyzeShoulderAsymmetry(landmarks);
  const slouching = analyzeSlouching(landmarks);
  const faceDistance = analyzeFaceDistanceFromScreen(landmarks);
  
  // Track hold durations
  const forwardHeadFlagged = trackIssueDuration('forwardHead', forwardHead.detected);
  const headTiltFlagged = trackIssueDuration('headTilt', headTilt.detected);
  const verticalTiltFlagged = trackIssueDuration('verticalTilt', verticalTilt.detected);
  const shoulderAsymmetryFlagged = trackIssueDuration('shoulderAsymmetry', shoulderAsymmetry.detected);
  const slouchingFlagged = trackIssueDuration('slouching', slouching.detected);
  const screenDistanceFlagged = trackIssueDuration('screenDistance', faceDistance.detected);
  
  // Compile flagged issues (only after hold duration)
  const flaggedIssues = [];
  
  if (forwardHeadFlagged) {
    flaggedIssues.push({
      type: 'FORWARD_HEAD',
      severity: forwardHead.severity,
      value: forwardHead.value.toFixed(2)
    });
  }

  if (screenDistanceFlagged) {
    flaggedIssues.push({
      type: 'SCREEN_TOO_CLOSE',
      severity: faceDistance.severity,
      value: faceDistance.value.toFixed(2)
    });
  }
  
  if (headTiltFlagged) {
    flaggedIssues.push({
      type: 'HEAD_TILT',
      severity: headTilt.severity,
      value: headTilt.value.toFixed(2)
    });
  }
  
  if (verticalTiltFlagged) {
    flaggedIssues.push({
      type: 'VERTICAL_TILT',
      severity: verticalTilt.severity,
      value: verticalTilt.value.toFixed(2)
    });
  }
  
  if (shoulderAsymmetryFlagged) {
    flaggedIssues.push({
      type: 'SHOULDER_ASYMMETRY',
      severity: shoulderAsymmetry.severity,
      value: shoulderAsymmetry.value.toFixed(2)
    });
  }
  
  if (slouchingFlagged) {
    flaggedIssues.push({
      type: 'SLOUCHING',
      severity: slouching.severity,
      value: slouching.value.toFixed(2)
    });
  }
  
  // Calculate overall severity
  const overallSeverity = flaggedIssues.length > 0
    ? Math.round(flaggedIssues.reduce((sum, issue) => sum + issue.severity, 0) / flaggedIssues.length)
    : 0;
  
  // Classify posture
  const classification = flaggedIssues.length === 0 ? 'GOOD' : 
                         overallSeverity > 60 ? 'CRITICAL' :
                         overallSeverity > 40 ? 'POOR' : 'WARNING';
  
  return {
    status: 'SUCCESS',
    classification,
    overallSeverity,
    issues: flaggedIssues,
    detailedMetrics: {
      forwardHead,
      faceDistance,
      headTilt,
      verticalTilt,
      shoulderAsymmetry,
      slouching
    },
    holdDurationMs: requiredHoldDuration,
    timestamp: Date.now()
  };
}

/**
 * Reset all hold-duration trackers
 * Call this at the start of a new session
 */
export function resetPostureTracking(options = {}) {
  const holdSeconds = Number(options.holdDurationSeconds);
  if (Number.isFinite(holdSeconds)) {
    const clamped = Math.max(3, Math.min(10, holdSeconds));
    runtimePreferences.holdDurationMs = clamped * 1000;
  } else {
    runtimePreferences.holdDurationMs = null;
  }

  issueStartTimes = {
    forwardHead: null,
    screenDistance: null,
    headTilt: null,
    verticalTilt: null,
    shoulderAsymmetry: null,
    slouching: null
  };
  faceDistanceBaseline = null;
  baselineSteadyStart = null;
  baselineSamples = [];
  lastFaceSize = null;
  requiredHoldDuration = getConfiguredHoldDuration();
}

/**
 * Get current hold duration required for issue flagging
 */
export function getHoldDuration() {
  return requiredHoldDuration;
}

/**
 * Get timestamp when an issue started being detected
 */
export function getIssueStartTime(issueKey) {
  return issueStartTimes[issueKey];
}

/**
 * Export landmark indices for external use
 */
export const LANDMARK_INDICES = LANDMARKS;

/**
 * Export configuration for tuning
 */
export const POSTURE_CONFIG = CONFIG;
