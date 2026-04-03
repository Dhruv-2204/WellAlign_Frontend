// --------- UI elements ----------
// Wrapper functions to safely get DOM elements (may not exist immediately in Vue apps)
function getUIElement(id) {
  return document.getElementById(id);
}

let video = null;
let canvas = null;
let ctx = null;
let startBtn = null;
let stopBtn = null;
let baselineBtn = null;
let resetBtn = null;
let tolRange = null;
let soundBtn = null;
let overlayBtn = null;
let statusLabel = null;
let baselineLabel = null;
let tolLabel = null;
let sizeStat = null;
let baseStat = null;
let stateStat = null;
let alertOverlay = null;
let ackBtn = null;
let pauseBtn = null;
let soundLabel = null;
let notifyBtn = null;

// Initialize UI elements when needed
function initializeUIElements() {
  video = getUIElement("video");
  canvas = getUIElement("canvas");
  if (canvas) ctx = canvas.getContext("2d");
  startBtn = getUIElement("startBtn");
  stopBtn = getUIElement("stopBtn");
  baselineBtn = getUIElement("baselineBtn");
  resetBtn = getUIElement("resetBtn");
  tolRange = getUIElement("tol");
  soundBtn = getUIElement("soundBtn");
  overlayBtn = getUIElement("overlayBtn");
  statusLabel = getUIElement("statusLabel");
  baselineLabel = getUIElement("baselineLabel");
  tolLabel = getUIElement("tolLabel");
  sizeStat = getUIElement("sizeStat");
  baseStat = getUIElement("baseStat");
  stateStat = getUIElement("stateStat");
  alertOverlay = getUIElement("alertOverlay");
  ackBtn = getUIElement("ackBtn");
  pauseBtn = getUIElement("pauseBtn");
  soundLabel = getUIElement("soundLabel");
  notifyBtn = getUIElement("notifyBtn");
}

// --------- App state ----------
let camera = null;
let running = false;
let baselineSize = null;
let tolerancePct = 20;
let soundOn = true;
let overlayOn = true;
let pausedUntil = 0;

// MediaPipe models
let faceMesh = null;
let pose = null;

// Global posture data export for Vue components
window.postureData = {
  landmarks: null,
  poseWorks: false,
  lastUpdate: null
};

// Callback hook for Vue components to listen to posture updates
window.onPostureUpdate = (postureMetrics) => {
  // Default no-op callback - can be overridden by Vue components
};

// Global metrics state for Vue components
window.__metrics = {
  headPositionWidth: 68,
  headPositionColor: 'var(--warn)',
  headPosition: 'Forward +12deg',
  headPositionGradient: 'linear-gradient(90deg,var(--warn),#f9d06a)',
  shoulderWidth: 88,
  shoulderColor: 'var(--accent)',
  shoulderAlignment: 'Good',
  spineWidth: 80,
  spineColor: 'var(--accent2)',
  spineCurvature: 'Neutral',
  spineGradient: 'linear-gradient(90deg,var(--accent2),#6af9e0)'
};

// audio
let audioCtx = null;
let lastBeep = 0;
const BEEP_COOLDOWN_MS = 3000;

// ack silence
let ackSilenceUntil = 0;

// focus tracking
let windowFocused = document.hasFocus();
window.addEventListener("focus", () => {
  windowFocused = true;
  resetTitle();
  audioCtx?.resume?.();
});
window.addEventListener("blur", () => {
  windowFocused = false;
});

// iframe check (CodePen editor)
const IN_IFRAME = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

// --------- Service Worker notifications ----------
let swReg = null;
async function ensureSW() {
  if (!("serviceWorker" in navigator)) return null;
  if (IN_IFRAME) return null; // most iframes block SW
  if (swReg) return swReg;

  // make a tiny SW on the fly
  const code = `
    self.addEventListener('install', e => self.skipWaiting());
    self.addEventListener('activate', e => self.clients.claim());
    self.addEventListener('notificationclick', e => {
      e.notification.close();
      e.waitUntil(self.clients.matchAll({type:'window'}).then(clients=>{
        if (clients.length) return clients[0].focus();
        return self.clients.openWindow('./');
      }));
    });
  `;
  try {
    const blob = new Blob([code], { type: "text/javascript" });
    const url = URL.createObjectURL(blob);
    swReg = await navigator.serviceWorker.register(url, { scope: "./" });
    return swReg;
  } catch (e) {
    console.warn("SW register failed:", e);
    return null;
  }
}

// Ask permission + test toast
notifyBtn?.addEventListener("click", async () => {
  if (!("Notification" in window)) {
    alert("Notifications not supported");
    return;
  }
  if (IN_IFRAME) {
    alert("Open in Full Page / your own site to enable notifications.");
    return;
  }
  let perm = Notification.permission;
  if (perm === "default") perm = await Notification.requestPermission();
  if (perm !== "granted") {
    alert("Notifications blocked in browser settings.");
    return;
  }
  const reg = await ensureSW();
  try {
    if (reg?.showNotification) {
      reg.showNotification("Posture alerts enabled", {
        body: "You will get alerts even in background.",
        requireInteraction: false,
        silent: false
      });
    } else {
      new Notification("Posture alerts enabled", {
        body: "Background alerts active.",
        silent: false
      });
    }
    setStatus("Notifications enabled");
  } catch (e) {
    console.warn("Test notification error:", e);
    alert("Notification error: " + e.message);
  }
});

let lastNotify = 0;
const NOTIFY_COOLDOWN_MS = 8000;
async function notifyTooClose() {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  // comment next line if you also want a toast while the tab is focused
  if (document.hasFocus()) return;

  const t = Date.now();
  if (t - lastNotify < NOTIFY_COOLDOWN_MS) return;
  lastNotify = t;

  try {
    const reg = await ensureSW();
    const opts = {
      body: "Please lean back to your baseline distance.",
      requireInteraction: true, // keeps the OS toast until user dismisses
      silent: false
      // icon: 'https://your-domain/icon.png'
    };
    if (reg?.showNotification)
      reg.showNotification("Too close to the screen", opts);
    else new Notification("Too close to the screen", opts);
  } catch (e) {
    console.warn("notify error:", e);
  }
}

// --------- Title flash fallback ----------
let titleInterval = null;
const BASE_TITLE = document.title || "Posture & Distance Alert";
function flashTitle(msg) {
  if (titleInterval) return;
  let on = false;
  titleInterval = setInterval(() => {
    document.title = on ? `ALERT: ${msg}` : BASE_TITLE;
    on = !on;
  }, 1200);
}
function resetTitle() {
  if (titleInterval) {
    clearInterval(titleInterval);
    titleInterval = null;
  }
  document.title = BASE_TITLE;
}

// --------- helpers ----------
function fitCanvas() {
  if (!canvas || !video) return;
  canvas.width = video.videoWidth || 1380;
  canvas.height = video.videoHeight || 820;
}
function setStatus(t) {
  if (statusLabel) statusLabel.textContent = t;
}
function setState(t) {
  if (stateStat) stateStat.textContent = t;
}
function updateUI() {
  if (baselineLabel) baselineLabel.textContent = baselineSize
    ? Math.round(baselineSize) + " px"
    : "not set";
  if (tolLabel) tolLabel.textContent = tolerancePct + "%";
  if (soundLabel) soundLabel.textContent = soundOn ? "On" : "Muted";
}
function now() {
  return Date.now();
}

function beep() {
  // Browsers may mute background audio; rely on OS toast for guaranteed sound.
  if (!soundOn) return;
  const t = now();
  if (t - lastBeep < BEEP_COOLDOWN_MS) return;
  lastBeep = t;
  if (!audioCtx)
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  audioCtx.resume?.();
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = "sine";
  o.frequency.value = 880;
  g.gain.setValueAtTime(0.0001, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.15, audioCtx.currentTime + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.25);
  o.connect(g).connect(audioCtx.destination);
  o.start();
  o.stop(audioCtx.currentTime + 0.26);
}

function showOverlay(show) {
  if (!alertOverlay) return;
  if (!overlayOn) {
    alertOverlay.classList.remove("visible");
    return;
  }
  alertOverlay.classList.toggle("visible", !!show);
}

function faceBoxHeight(landmarks) {
  if (!canvas) return 0;
  let minY = 1,
    maxY = 0;
  for (const lm of landmarks) {
    if (lm.y < minY) minY = lm.y;
    if (lm.y > maxY) maxY = lm.y;
  }
  return Math.max(0, (maxY - minY) * canvas.height);
}

function drawFace(landmarks) {
  if (!ctx || !canvas) return;
  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  let minX = 1,
    minY = 1,
    maxX = 0,
    maxY = 0;
  for (const lm of landmarks) {
    if (lm.x < minX) minX = lm.x;
    if (lm.y < minY) minY = lm.y;
    if (lm.x > maxX) maxX = lm.x;
    if (lm.y > maxY) maxY = lm.y;
  }
  const x = minX * canvas.width;
  const y = minY * canvas.height;
  const w = (maxX - minX) * canvas.width;
  const h = (maxY - minY) * canvas.height;
  ctx.strokeStyle = "rgba(92,179,255,0.9)";
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = "rgba(92,179,255,0.9)";
  ctx.beginPath();
  ctx.arc(x + w / 2, y + h / 3, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// --------- posture logic ----------
function calculatePostureMetrics(landmarks) {
  // Calculate face orientation and posture
  // Landmarks indices: 10=Face center, 152/378=eyes, 159/386=bottom
  
  const leftEye = landmarks[33];   // Left eye
  const rightEye = landmarks[263]; // Right eye
  const noseTip = landmarks[4];    // Nose tip
  const chin = landmarks[152];     // Chin
  
  // Head Position (horizontal tilt)
  const eyeAngle = Math.atan2(
    rightEye.y - leftEye.y,
    rightEye.x - leftEye.x
  ) * (180 / Math.PI);
  
  const headTilt = Math.round(eyeAngle);
  const headPositionWidth = Math.max(40, Math.min(95, 70 + Math.abs(headTilt) / 2));
  const headPositionColor = Math.abs(headTilt) > 15 ? 'var(--warn)' : 'var(--accent)';
  const headPosition = headTilt > 5 ? `Forward +${headTilt}deg` : 
                      headTilt < -5 ? `Back ${Math.abs(headTilt)}deg` : 'Neutral';
  
  // Shoulder Alignment (simplified, based on face width)
  const faceWidth = Math.abs(landmarks[454].x - landmarks[234].x);
  const shoulderWidth = Math.max(75, Math.min(100, 75 + faceWidth * 30));
  const shoulderColor = shoulderWidth > 90 ? 'var(--accent)' : 'var(--warn)';
  const shoulderAlignment = shoulderWidth > 90 ? 'Good' : 'Needs Adjustment';
  
  // Spine Curvature (based on chin-to-nose distance)
  const spineDistance = Math.abs(chin.y - noseTip.y);
  const spineWidth = Math.max(60, Math.min(95, 70 + spineDistance * 50));
  const spineColor = spineWidth > 75 ? 'var(--accent2)' : 'var(--warn)';
  const spineCurvature = spineWidth > 75 ? 'Neutral' : 'Slouching';
  
  return {
    headPositionWidth,
    headPositionColor,
    headPosition,
    headPositionGradient: `linear-gradient(90deg,${headPositionColor},#f9d06a)`,
    shoulderWidth,
    shoulderColor,
    shoulderAlignment,
    spineWidth,
    spineColor,
    spineCurvature,
    spineGradient: `linear-gradient(90deg,${spineColor},#6af9e0)`
  };
}

function updateMetricsUI(metrics) {
  Object.assign(window.__metrics, metrics);
  // Trigger Vue component update
  window.dispatchEvent(new CustomEvent('metricsUpdated', { detail: metrics }));
}

function handleFace(landmarks) {
  const size = faceBoxHeight(landmarks);
  sizeStat.textContent = Math.round(size).toString();

  // Update posture metrics
  const metrics = calculatePostureMetrics(landmarks);
  updateMetricsUI(metrics);

  if (!baselineSize) {
    setState("baseline not set");
    showOverlay(false);
    return;
  }

  baseStat.textContent = Math.round(baselineSize).toString();
  const limit = baselineSize * (1 + tolerancePct / 100);
  const isTooClose = size > limit;

  const t = now();
  const underAckSilence = t < ackSilenceUntil;
  const underPause = t < pausedUntil;

  if (underPause) {
    setState("paused");
    showOverlay(false);
    return;
  }

  if (isTooClose && !underAckSilence) {
    setState("too close");
    showOverlay(true);
    beep(); // may be muted in bg
    notifyTooClose(); // guaranteed OS toast in bg (outside iframe)
    flashTitle("You’re too close");
  } else {
    setState("ok");
    showOverlay(false);
    resetTitle();
  }
}

// --------- MediaPipe setup ----------
async function initFaceMesh() {
  faceMesh = new FaceMesh({
    locateFile: (file) =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
  });
  faceMesh.setOptions({
    maxNumFaces: 1,
    refineLandmarks: false,
    minDetectionConfidence: 0.6,
    minTrackingConfidence: 0.6 

  });
  faceMesh.onResults((results) => {
    if (!running) return;
    if (
      !results.multiFaceLandmarks ||
      results.multiFaceLandmarks.length === 0
    ) {
      setStatus("No face detected");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    setStatus("Tracking");
    fitCanvas();
    const landmarks = results.multiFaceLandmarks[0];
    drawFace(landmarks);
    handleFace(landmarks);
  });
}

async function initPose() {
  try {
    // Check if Pose class is available
    if (typeof Pose === 'undefined') {
      console.warn('Pose class not available - script may not have loaded');
      return null;
    }
    
    pose = new Pose({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
    });
    pose.setOptions({
      modelComplexity: 1, // 0=light, 1=full (full body detection)
      smoothLandmarks: true,
      enableSegmentation: false,
      smoothSegmentation: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });
    
    pose.onResults((results) => {
      if (!running) return;
      
      // Extract pose landmarks and export to window
      if (results.poseLandmarks && results.poseLandmarks.length > 0) {
        window.postureData.landmarks = results.poseLandmarks;
        window.postureData.lastUpdate = Date.now();
        window.postureData.poseWorks = true;
        
        // Trigger callback for Vue components
        if (typeof window.onPostureUpdate === 'function') {
          console.log('[mediapipe.onPose] Invoking window.onPostureUpdate with', results.poseLandmarks.length, 'landmarks');
          window.onPostureUpdate(results.poseLandmarks);
        } else {
          console.warn('[mediapipe.onPose] window.onPostureUpdate is not a function');
        }
      } else {
        window.postureData.poseWorks = false;
        console.warn('[mediapipe.onPose] No poseLandmarks in results');
      }
    });
    
    return pose;
  } catch (error) {
    console.warn('Pose model initialization failed:', error);
    return null;
  }
}

// Ensure both models are loaded before camera starts
async function initializeMediaPipeModels() {
  try {
    await initFaceMesh();
    await initPose();
  } catch (error) {
    console.error('MediaPipe initialization error:', error);
    setStatus('MediaPipe initialization failed');
  }
}

async function startCamera() {
  try {
    console.log('[startCamera] Starting camera initialization');
    // Initialize UI elements and models
    initializeUIElements();
    console.log('[startCamera] UI elements initialized. window.onPostureUpdate is', typeof window.onPostureUpdate);
    
    // Initialize MediaPipe models if not already done
    if (!faceMesh || !pose) {
      setStatus("Loading MediaPipe models...");
      console.log('[startCamera] Initializing MediaPipe models');
      await initializeMediaPipeModels();
      console.log('[startCamera] MediaPipe models initialized successfully');
    }
    
    // Make sure we have video element
    if (!video) {
      console.error('Video element not found in DOM');
      setStatus("Video element not found");
      return;
    }
    
    // Request camera permission with error handling
    try {
      camera = new Camera(video, {
        onFrame: async () => {
          if (faceMesh && running) {
            await faceMesh.send({ image: video });
          }
          if (pose && running) {
            await pose.send({ image: video });
          }
        },
        width: 1380,
        height: 820
      });
      
      console.log('[startCamera] Camera object created. Starting camera...');
      await camera.start();
      console.log('[startCamera] Camera started successfully');
      running = true;
      console.log('[startCamera] Running flag set to true');
      setStatus("Camera started - Detecting pose");
    } catch (cameraError) {
      if (cameraError.name === 'NotAllowedError') {
        setStatus("Camera access denied. Check permissions.");
        console.error('Camera permission denied:', cameraError);
      } else if (cameraError.name === 'NotFoundError') {
        setStatus("No camera device found.");
        console.error('No camera found:', cameraError);
      } else {
        setStatus("Camera initialization failed: " + cameraError.message);
        console.error('Camera error:', cameraError);
      }
      running = false;
      return;
    }
  } catch (error) {
    console.error('startCamera error:', error);
    setStatus("Failed to start camera");
    running = false;
  }
}

async function stopCamera() {
  running = false;
  
  try {
    if (camera) {
      await camera.stop();
      camera = null;
    }
    
    // Stop all camera tracks
    if (video && video.srcObject && typeof video.srcObject.getTracks === "function") {
      video.srcObject.getTracks().forEach((track) => {
        track.stop();
      });
    }
    
    // Reset video element
    if (video) {
      video.pause();
      video.srcObject = null;
    }
    
    // Clear canvas and UI
    if (ctx && canvas) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    
    showOverlay(false);
    resetTitle();
    setState("idle");
    
    // Reset posture data
    window.postureData.landmarks = null;
    window.postureData.poseWorks = false;
    
    setStatus("Stopped");
  } catch (error) {
    console.error('stopCamera error:', error);
    setStatus("Error stopping camera");
  }
  
  // Notify Vue that camera was stopped
  if (window.__notifyCameraStopped) {
    window.__notifyCameraStopped();
  }
}

// --------- events ----------
// Only attach event listeners if buttons exist in DOM
function attachButtonListeners() {
  if (startBtn) startBtn.addEventListener("click", startCamera);
  if (stopBtn) stopBtn.addEventListener("click", stopCamera);
  
  if (baselineBtn) {
    baselineBtn.addEventListener("click", () => {
      const val = parseFloat(sizeStat?.textContent);
      if (Number.isFinite(val)) {
        baselineSize = val;
        updateUI();
        setStatus("Baseline set");
      }
    });
  }
  
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      baselineSize = null;
      if (baseStat) baseStat.textContent = "—";
      setStatus("Baseline cleared");
      updateUI();
    });
  }
  
  if (tolRange) {
    tolRange.addEventListener("input", (e) => {
      tolerancePct = parseInt(e.target.value, 10);
      updateUI();
    });
  }
  
  if (soundBtn) {
    soundBtn.addEventListener("click", () => {
      soundOn = !soundOn;
      updateUI();
      audioCtx?.resume?.();
    });
  }
  
  if (overlayBtn) {
    overlayBtn.addEventListener("click", () => {
      overlayOn = !overlayOn;
      if (!overlayOn) showOverlay(false);
      updateUI();
    });
  }
  
  if (ackBtn) {
    ackBtn.addEventListener("click", () => {
      ackSilenceUntil = now() + 12000;
      showOverlay(false);
    });
  }
  
  if (pauseBtn) {
    pauseBtn.addEventListener("click", () => {
      pausedUntil = now() + 5 * 60 * 1000;
      showOverlay(false);
      setStatus("Paused for 5 minutes");
    });
  }
}

// Attach listeners when DOM is ready or when startCamera is called
window.attachMediaPipeListeners = attachButtonListeners;

// --------- window exports ----------
// Export functions so Vue components can call them
window.startCamera = startCamera;
window.stopCamera = stopCamera;

// Export Pose landmarks data structure
// Access via: window.postureData.landmarks (33-point pose array)
// Example usage:
//   const landmarks = window.postureData.landmarks;
//   if (landmarks) {
//     const leftShoulder = landmarks[11];
//     const rightShoulder = landmarks[12];
//   }

// Register callback for real-time posture updates
// Vue components can set this to receive pose landmarks every frame:
//   window.onPostureUpdate = (poseData) => { ... }

// init
updateUI();
setStatus("Click \"Start Camera\" to begin");

