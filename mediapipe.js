// --------- UI elements ----------
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const baselineBtn = document.getElementById("baselineBtn");
const resetBtn = document.getElementById("resetBtn");
const tolRange = document.getElementById("tol");
const soundBtn = document.getElementById("soundBtn");
const overlayBtn = document.getElementById("overlayBtn");
const statusLabel = document.getElementById("statusLabel");
const baselineLabel = document.getElementById("baselineLabel");
const tolLabel = document.getElementById("tolLabel");
const sizeStat = document.getElementById("sizeStat");
const baseStat = document.getElementById("baseStat");
const stateStat = document.getElementById("stateStat");
const alertOverlay = document.getElementById("alertOverlay");
const ackBtn = document.getElementById("ackBtn");
const pauseBtn = document.getElementById("pauseBtn");
const soundLabel = document.getElementById("soundLabel");
const notifyBtn = document.getElementById("notifyBtn");

// --------- App state ----------
let camera = null;
let running = false;
let baselineSize = null;
let tolerancePct = 20;
let soundOn = true;
let overlayOn = true;
let pausedUntil = 0;

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
  canvas.width = video.videoWidth || 1380;
  canvas.height = video.videoHeight || 820;
}
function setStatus(t) {
  statusLabel.textContent = t;
}
function setState(t) {
  stateStat.textContent = t;
}
function updateUI() {
  baselineLabel.textContent = baselineSize
    ? Math.round(baselineSize) + " px"
    : "not set";
  tolLabel.textContent = tolerancePct + "%";
  soundLabel.textContent = soundOn ? "On" : "Muted";
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
  if (!overlayOn) {
    alertOverlay.classList.remove("visible");
    return;
  }
  alertOverlay.classList.toggle("visible", !!show);
}

function faceBoxHeight(landmarks) {
  let minY = 1,
    maxY = 0;
  for (const lm of landmarks) {
    if (lm.y < minY) minY = lm.y;
    if (lm.y > maxY) maxY = lm.y;
  }
  return Math.max(0, (maxY - minY) * canvas.height);
}

function drawFace(landmarks) {
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
function handleFace(landmarks) {
  const size = faceBoxHeight(landmarks);
  sizeStat.textContent = Math.round(size).toString();

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
let faceMesh = null;
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

async function startCamera() {
  if (!faceMesh) await initFaceMesh();
  camera = new Camera(video, {
    onFrame: async () => {
      await faceMesh.send({ image: video });
    },
    width: 1380,
    height: 820
  });
  await camera.start();
  running = true;
  setStatus("Camera started");
}
async function stopCamera() {
  running = false;
  if (camera) {
    await camera.stop();
    camera = null;
  }
  const stream = video.srcObject;
  if (stream && typeof stream.getTracks === "function") {
    stream.getTracks().forEach((track) => track.stop());
  }
  video.pause();
  video.srcObject = null;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  showOverlay(false);
  resetTitle();
  setState("idle");
  setStatus("Stopped");
  // Notify Vue that camera was stopped so UI state syncs.
  if (window.__notifyCameraStopped) {
    window.__notifyCameraStopped();
  }
}

// --------- events ----------
startBtn.addEventListener("click", startCamera);
stopBtn.addEventListener("click", stopCamera);
baselineBtn.addEventListener("click", () => {
  const val = parseFloat(sizeStat.textContent);
  if (Number.isFinite(val)) {
    baselineSize = val;
    updateUI();
    setStatus("Baseline set");
  }
});
resetBtn.addEventListener("click", () => {
  baselineSize = null;
  baseStat.textContent = "—";
  setStatus("Baseline cleared");
  updateUI();
});
tolRange.addEventListener("input", (e) => {
  tolerancePct = parseInt(e.target.value, 10);
  updateUI();
});
soundBtn.addEventListener("click", () => {
  soundOn = !soundOn;
  updateUI();
  audioCtx?.resume?.();
});
overlayBtn.addEventListener("click", () => {
  overlayOn = !overlayOn;
  if (!overlayOn) showOverlay(false);
  updateUI();
});
ackBtn.addEventListener("click", () => {
  ackSilenceUntil = now() + 12000;
  showOverlay(false);
});
pauseBtn.addEventListener("click", () => {
  pausedUntil = now() + 5 * 60 * 1000;
  showOverlay(false);
  setStatus("Paused for 5 minutes");
});

// init
updateUI();
setStatus("Click \"Start Camera\" to begin");

