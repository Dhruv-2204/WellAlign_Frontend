import { checkBackendHealth } from '../services/backendHealth.js';
import { useStatusToast } from '../utils/useStatusToast.js';
import { useMonitoringSession, setMonitoringActive, setLastMonitoringSession } from '../services/monitoringSession.js';

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === 'true') {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error(`Failed to load: ${src}`)), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    script.dataset.src = src;
    script.addEventListener('load', () => {
      script.dataset.loaded = 'true';
      resolve();
    }, { once: true });
    script.addEventListener('error', () => reject(new Error(`Failed to load: ${src}`)), { once: true });
    document.body.appendChild(script);
  });
}

async function ensureMediaPipeScripts() {
  if (!window.__monitoringScriptsPromise) {
    window.__monitoringScriptsPromise = (async () => {
      await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js');
      await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/control_utils/control_utils.js');
      await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js');
      await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js');
      await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js');
      await loadScript('mediapipe.js');
    })();
  }
  return window.__monitoringScriptsPromise;
}

export const MonitoringView = {
  setup() {
    const { ref, computed, onMounted, onBeforeUnmount, onActivated, onDeactivated } = Vue;

    const backendStatus = ref('Preparing monitoring services...');
    const monitoringState = useMonitoringSession();
    const isMonitoring = ref(false);
    const sessionDuration = ref('45:32');
    const sessionScore = ref(82);
    const headPositionWidth = ref(68);
    const headPositionColor = ref('var(--warn)');
    const headPosition = ref('Forward +12deg');
    const headPositionGradient = ref('linear-gradient(90deg,var(--warn),#f9d06a)');
    const shoulderWidth = ref(88);
    const shoulderColor = ref('var(--accent)');
    const shoulderAlignment = ref('Good');
    const spineWidth = ref(80);
    const spineColor = ref('var(--accent2)');
    const spineCurvature = ref('Neutral');
    const spineGradient = ref('linear-gradient(90deg,var(--accent2),#6af9e0)');
    const postureSummary = ref({ good: 82, forward: 12, slouch: 6 });
    const monitoringStatusLabel = computed(() => (monitoringState.isMonitoring ? 'ON' : 'OFF'));
    const lastSession = computed(() => monitoringState.lastSession);
    const {
      showToast,
      toastTitle,
      toastMessage,
      toastColor,
      showStatusToast,
      hideStatusToast
    } = useStatusToast(5000);

    let metricsInterval = null;
    let sessionInterval = null;
    let elapsed = 2700;

    // Define metrics listener at setup level so it can be cleaned up in onBeforeUnmount
    const metricsListener = (event) => {
      const metrics = event.detail;
      headPositionWidth.value = metrics.headPositionWidth;
      headPositionColor.value = metrics.headPositionColor;
      headPosition.value = metrics.headPosition;
      headPositionGradient.value = metrics.headPositionGradient;
      shoulderWidth.value = metrics.shoulderWidth;
      shoulderColor.value = metrics.shoulderColor;
      shoulderAlignment.value = metrics.shoulderAlignment;
      spineWidth.value = metrics.spineWidth;
      spineColor.value = metrics.spineColor;
      spineCurvature.value = metrics.spineCurvature;
      spineGradient.value = metrics.spineGradient;
    };

    function syncMonitoringState(active) {
      isMonitoring.value = active;
      setMonitoringActive(active);
    }

    function recordLastSession() {
      setLastMonitoringSession({
        duration: sessionDuration.value,
        score: sessionScore.value,
        endedAt: new Date().toISOString(),
        summary: postureSummary.value
      });
    }

    function formatSessionEndedAt(value) {
      if (!value) return 'N/A';
      const dt = new Date(value);
      if (Number.isNaN(dt.getTime())) return 'N/A';
      return dt.toLocaleString();
    }

    function startLocalIntervals() {
      if (!metricsInterval) {
        metricsInterval = setInterval(() => {
          if (!isMonitoring.value) return;
          const idx = Math.floor(Math.random() * 5);
          const head = [65, 70, 75, 68, 72];
          const shoulder = [85, 88, 90, 85, 88];
          const spine = [78, 82, 80, 85, 79];
          headPositionWidth.value = head[idx];
          shoulderWidth.value = shoulder[idx];
          spineWidth.value = spine[idx];
        }, 2000);
      }

      if (!sessionInterval) {
        sessionInterval = setInterval(() => {
          if (!isMonitoring.value) return;
          elapsed += 1;
          const h = String(Math.floor(elapsed / 3600)).padStart(2, '0');
          const m = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
          const s = String(elapsed % 60).padStart(2, '0');
          sessionDuration.value = `${h}:${m}:${s}`;
        }, 1000);
      }
    }

    function stopLocalIntervals() {
      if (metricsInterval) {
        clearInterval(metricsInterval);
        metricsInterval = null;
      }
      if (sessionInterval) {
        clearInterval(sessionInterval);
        sessionInterval = null;
      }
    }

    function toggleSession() {
      const starting = !isMonitoring.value;
      syncMonitoringState(starting);
      if (starting) {
        window.startCamera?.();
        showStatusToast('Session Started', 'Live monitoring is now active. Keep good posture!', 'var(--accent)');
      } else {
        window.stopCamera?.();
        recordLastSession();
        showStatusToast('Session Ended', 'Monitoring session ended. View your report on Progress.', 'var(--muted)');
      }
    }

    onMounted(async () => {
      await ensureMediaPipeScripts();
      backendStatus.value = await checkBackendHealth({
        successMessage: 'Monitoring services ready',
        unavailableMessage: 'Monitoring view loaded (backend unavailable)'
      });

      isMonitoring.value = monitoringState.isMonitoring;
      window.__notifyCameraStopped = () => {
        syncMonitoringState(false);
      };

      // Listen for realtime metrics updates from mediapipe.js
      window.addEventListener('metricsUpdated', metricsListener);

      const startBtnEl = document.getElementById('startBtn');
      const stopBtnEl = document.getElementById('stopBtn');
      startBtnEl?.addEventListener('click', async () => {
        syncMonitoringState(true);
        await window.startCamera?.();
        showStatusToast('Camera Started', 'Live monitoring is now active.', 'var(--accent)');
      });
      stopBtnEl?.addEventListener('click', async () => {
        await window.stopCamera?.();
        syncMonitoringState(false);
        recordLastSession();
        showStatusToast('Camera Stopped', 'Monitoring session ended.', 'var(--muted)');
      });

      startLocalIntervals();
    });

    onActivated(() => {
      startLocalIntervals();
    });

    onDeactivated(() => {
      stopLocalIntervals();
      if (isMonitoring.value) {
        recordLastSession();
      }
      window.stopCamera?.();
      syncMonitoringState(false);
    });

    onBeforeUnmount(() => {
      stopLocalIntervals();
      if (isMonitoring.value) {
        recordLastSession();
      }
      window.stopCamera?.();
      syncMonitoringState(false);
      if (window.__notifyCameraStopped) {
        window.__notifyCameraStopped = null;
      }
      // Clean up metrics listener
      window.removeEventListener('metricsUpdated', metricsListener);
    });

    return {
      isMonitoring,
      backendStatus,
      sessionDuration,
      sessionScore,
      headPositionWidth,
      headPositionColor,
      headPosition,
      headPositionGradient,
      shoulderWidth,
      shoulderColor,
      shoulderAlignment,
      spineWidth,
      spineColor,
      spineCurvature,
      spineGradient,
      postureSummary,
      monitoringStatusLabel,
      lastSession,
      showToast,
      toastTitle,
      toastMessage,
      toastColor,
      toggleSession,
      formatSessionEndedAt,
      hideStatusToast
    };
  },
  template: `
    <div class="w-full delay-[50ms]">
      <app-card>
        <div class="flex items-center justify-between">
          <div>
            <h2 class="font-[Syne] text-[1.8rem] font-extrabold mb-2">Live Monitoring Session</h2>
            <p class="text-[var(--muted)] text-[0.95rem]">Real-time posture detection with MediaPipe</p>
            <p class="text-[0.75rem] mt-2">Current Status: <span class="font-semibold" :class="monitoringStatusLabel === 'ON' ? 'text-[var(--accent)]' : 'text-[var(--muted)]'">{{ monitoringStatusLabel }}</span></p>
            <p class="text-[0.75rem] text-[var(--muted)] mt-2">{{ backendStatus }}</p>
          </div>
          <button @click="toggleSession" :class="['btn-calibrate', 'btn-emphasis', isMonitoring ? 'btn-emphasis-danger' : 'btn-emphasis-accent']" class="px-6 py-3 w-auto mt-0">
            {{ isMonitoring ? 'Stop Session' : 'Start Session' }}
          </button>
        </div>
      </app-card>
    </div>

    <div class="monitoring-grid">
      <div class="flex flex-col gap-5">
        <div class="card delay-[100ms]">
          <div class="section-header">
            <div class="flex items-center gap-2.5">
              <div class="section-title">Camera Feed</div>
              <div v-if="isMonitoring" class="flex items-center gap-1 text-[0.7rem] text-[var(--muted)]">
                <div class="pulse-dot"></div>
                Live
              </div>
            </div>
          </div>

          <div class="camera-feed relative overflow-hidden rounded-[0.9rem] bg-[var(--surface2)]">
            <div class="camera-corners"><span></span><span></span><span></span><span></span></div>
            <div class="scanline"></div>

            <video id="video" playsinline class="object-contain"></video>
            <canvas id="canvas" class="pointer-events-none"></canvas>

            <div id="alertOverlay" class="overlay absolute inset-0 flex items-center justify-center bg-[rgba(239,68,68,0.12)] backdrop-blur-sm rounded-[0.9rem] opacity-0 transition-opacity duration-200 pointer-events-none">
              <div class="card bg-[var(--surface)] border border-[var(--border)] p-4 rounded-xl min-w-[16rem] text-center">
                <div class="row flex items-center justify-center gap-2 mb-2">
                  <div class="status-dot dot-bad w-[10px] h-[10px] rounded-full bg-[var(--danger)]"></div>
                  <strong>You are too close to the screen</strong>
                </div>
                <p class="help text-[var(--muted)] text-[0.85rem]">Lean back to your baseline distance. You can also acknowledge to silence briefly.</p>
                <div class="row flex justify-center gap-2 mt-1.5">
                  <button id="ackBtn" class="btn-calibrate btn-emphasis btn-emphasis-accent">OK</button>
                  <button id="pauseBtn" class="btn-calibrate bg-[var(--surface2)] text-[var(--text)]">Pause 5 min</button>
                </div>
              </div>
            </div>
          </div>

          <div class="flex flex-wrap gap-2 mt-3 text-[0.85rem]">
            <span class="badge badge-muted flex items-center gap-1">Status: <span id="statusLabel">Initializing...</span></span>
            <span class="badge badge-muted flex items-center gap-1">Baseline: <span id="baselineLabel">not set</span></span>
            <span class="badge badge-muted flex items-center gap-1">Tolerance: <span id="tolLabel">20%</span></span>
            <span class="badge badge-muted flex items-center gap-1">Sound: <span id="soundLabel">On</span></span>
          </div>
        </div>

        <div class="card delay-[150ms]">
          <div class="section-header">
            <div class="section-title">Real-time Metrics</div>
          </div>

          <div class="flex flex-col gap-3">
            <div>
              <div class="flex justify-between text-[0.8rem] mb-2">
                <span class="text-[var(--muted)]">Head Position</span>
                <span :style="{ color: headPositionColor }">{{ headPosition }}</span>
              </div>
              <div class="posture-bar">
                <div class="posture-bar-fill" :style="{ width: headPositionWidth + '%', background: headPositionGradient }"></div>
              </div>
            </div>

            <div>
              <div class="flex justify-between text-[0.8rem] mb-2">
                <span class="text-[var(--muted)]">Shoulder Alignment</span>
                <span :style="{ color: shoulderColor }">{{ shoulderAlignment }}</span>
              </div>
              <div class="posture-bar">
                <div class="posture-bar-fill" :style="{ width: shoulderWidth + '%' }"></div>
              </div>
            </div>

            <div>
              <div class="flex justify-between text-[0.8rem] mb-2">
                <span class="text-[var(--muted)]">Spine Curvature</span>
                <span :style="{ color: spineColor }">{{ spineCurvature }}</span>
              </div>
              <div class="posture-bar">
                <div class="posture-bar-fill" :style="{ width: spineWidth + '%', background: spineGradient }"></div>
              </div>
            </div>
          </div>
        </div>

        <div class="card delay-[200ms]">
          <div class="section-header">
            <div class="section-title">Session Statistics</div>
          </div>

          <div class="grid grid-cols-2 gap-4 mb-4">
            <div class="bg-[var(--surface2)] p-4 rounded-xl border border-[var(--border)]">
              <div class="card-label">Duration</div>
              <div class="card-value text-[1.6rem]">{{ sessionDuration }}</div>
            </div>
            <div class="bg-[var(--surface2)] p-4 rounded-xl border border-[var(--border)]">
              <div class="card-label">Current Score</div>
              <div class="card-value text-[1.6rem] text-[var(--accent)]">{{ sessionScore }}%</div>
            </div>
          </div>

          <div class="flex flex-col gap-2 text-[0.85rem]">
            <div class="flex justify-between p-2 bg-[var(--surface2)] rounded-md">
              <span class="text-[var(--muted)]">Good Posture</span>
              <span class="text-[var(--accent)] font-semibold">{{ postureSummary.good }}%</span>
            </div>
            <div class="flex justify-between p-2 bg-[var(--surface2)] rounded-md">
              <span class="text-[var(--muted)]">Forward Head</span>
              <span class="text-[var(--warn)] font-semibold">{{ postureSummary.forward }}%</span>
            </div>
            <div class="flex justify-between p-2 bg-[var(--surface2)] rounded-md">
              <span class="text-[var(--muted)]">Slouching</span>
              <span class="text-[var(--danger)] font-semibold">{{ postureSummary.slouch }}%</span>
            </div>
          </div>

          <div class="mt-4 bg-[var(--surface2)] p-4 rounded-xl border border-[var(--border)]">
            <div class="section-title mb-3">Last Session Stats</div>
            <div v-if="lastSession" class="flex flex-col gap-2 text-[0.85rem]">
              <div class="flex justify-between"><span class="text-[var(--muted)]">Ended</span><span>{{ formatSessionEndedAt(lastSession.endedAt) }}</span></div>
              <div class="flex justify-between"><span class="text-[var(--muted)]">Duration</span><span>{{ lastSession.duration }}</span></div>
              <div class="flex justify-between"><span class="text-[var(--muted)]">Score</span><span class="text-[var(--accent)] font-semibold">{{ lastSession.score }}%</span></div>
            </div>
            <p v-else class="text-[0.85rem] text-[var(--muted)]">No previous monitoring session recorded yet.</p>
          </div>
        </div>
      </div>

      <div class="right-col">
        <div class="card delay-[100ms]">
          <div class="section-header">
            <div class="section-title">Controls</div>
          </div>

          <div class="flex flex-col gap-3">
            <div class="flex gap-2 flex-wrap justify-end">
              <button id="startBtn" class="btn-calibrate btn-emphasis btn-emphasis-accent">Start Camera</button>
              <button id="stopBtn" class="btn-calibrate btn-emphasis btn-emphasis-danger">Stop</button>
            </div>
            <div class="flex gap-2 flex-wrap justify-end">
              <button id="baselineBtn" class="btn-calibrate btn-emphasis btn-emphasis-teal">Set Baseline</button>
              <button id="resetBtn" class="btn-calibrate bg-[var(--surface2)] text-[var(--text)]">Reset Baseline</button>
            </div>
            <div class="flex items-center gap-3 flex-wrap">
              <label for="tol" class="help text-[var(--muted)] text-[0.85rem] min-w-[10rem]">Tolerance (%)</label>
              <input id="tol" type="range" min="5" max="50" value="20" class="flex-1 min-w-[10rem]" />
            </div>
            <div class="flex gap-2 flex-wrap justify-end">
              <button id="soundBtn" class="btn-calibrate bg-[var(--surface2)] text-[var(--text)]">Toggle Sound</button>
              <button id="overlayBtn" class="btn-calibrate bg-[var(--surface2)] text-[var(--text)]">On-Screen Alerts</button>
              <button id="notifyBtn" class="btn-calibrate bg-[var(--surface2)] text-[var(--text)]">Notifications</button>
            </div>
            <div class="flex flex-col gap-2 text-[0.9rem]">
              <div class="bg-[var(--surface2)] p-3 rounded-lg border border-[var(--border)]">
                <div class="card-label">Face size (px)</div>
                <div class="card-value font-['JetBrains_Mono',_monospace]" id="sizeStat">-</div>
              </div>
              <div class="bg-[var(--surface2)] p-3 rounded-lg border border-[var(--border)]">
                <div class="card-label">Baseline size</div>
                <div class="card-value font-['JetBrains_Mono',_monospace]" id="baseStat">-</div>
              </div>
              <div class="bg-[var(--surface2)] p-3 rounded-lg border border-[var(--border)]">
                <div class="card-label">State</div>
                <div class="card-value font-['JetBrains_Mono',_monospace]" id="stateStat">idle</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showToast" class="alert-toast">
      <div class="toast-header">
        <div class="toast-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M15 17H5l1.4-1.4A2 2 0 0 0 7 14.2V11a5 5 0 1 1 10 0v3.2a2 2 0 0 0 .6 1.4L19 17h-4"/><path stroke-linecap="round" stroke-linejoin="round" d="M10 19a2 2 0 0 0 4 0"/></svg></div>
        <div class="toast-title" :style="{ color: toastColor }">{{ toastTitle }}</div>
      </div>
      <div class="toast-body">
        {{ toastMessage }}
      </div>
      <div class="toast-actions">
        <button class="toast-btn ghost" @click="hideStatusToast">Dismiss</button>
      </div>
    </div>
  `
};
