import { checkBackendHealth } from '../services/backendHealth.js';
import { useStatusToast } from '../utils/useStatusToast.js';
import { startRecordingSession, recordPostureSnapshot, endRecordingSession, getSessionHistoryList } from '../services/monitoringSession.js';
import { analyzePosture, resetPostureTracking, getHoldDuration } from '../services/postureAnalysis.js';
import { generateDetailedReport } from '../services/postureAdvice.js';
import { PostureReport } from '../components/PostureReport.js';
import { api } from '../services/api.js';
import { analyzeMonitoringSessionWithGemini } from '../services/geminiService.js';
import { enrichSearchesWithVideos } from '../services/youtubeService.js';

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
  components: {
    PostureReport
  },
  setup() {
    const { ref, computed, onMounted, onBeforeUnmount } = Vue;
    const { useRoute } = VueRouter;
    const route = useRoute();

    // View Mode State
    const viewMode = ref('setup'); // 'setup' | 'monitoring' | 'report-view'
    const selectedDuration = ref(15); // minutes (5, 10, 15, 30, 45) or null for unlimited
    const postureHoldSeconds = ref(5); // 3-10 seconds
    const enabledAlerts = ref({
      screenDistance: false,
      shoulderAsymmetry: false,
      headTilt: false
    });
    const showOnScreenAlerts = ref(false);
    const timedSessionTotalSeconds = ref(null);
    
    // Monitoring State
    const isSessionActive = ref(false);
    const sessionStartTime = ref(null);
    const sessionElapsedTime = ref('00:00:00');
    const sessionCountdownTime = ref('00:15:00');
    const isLoading = ref(false);
    const backendStatus = ref('Preparing monitoring services...');

    // Real-time Posture Metrics
    const liveMetrics = ref({
      headForwardAngle: 0,
      headTiltAngle: 0,
      shoulderAsymmetry: 0,
      faceDistancePercent: 0,
      faceDistanceBaselineReady: false,
      verticalAlign: 0,
      slouchingScore: 0,
      positionQuality: 0,
      overallSeverity: 0
    });

    // Issues with hold-duration tracking
    const detectedIssues = ref([]);
    const issueHoldDurations = ref({}); // { issueKey: timeRemaining }

    const realtimeMetricRows = computed(() => {
      const goodPosture = Math.max(0, Math.min(100, liveMetrics.value.positionQuality || 0));
      const headTilt = Math.max(0, Math.round(liveMetrics.value.headTiltAngle || 0));
      const shoulderAsymmetry = Math.max(0, Math.round(liveMetrics.value.shoulderAsymmetry || 0));
      const faceDistancePercent = Math.round(liveMetrics.value.faceDistancePercent || 0);
      const faceDistanceAlarm = Math.max(0, faceDistancePercent);

      const headTiltQuality = Math.max(5, 100 - Math.min(100, Math.round((headTilt / 25) * 100)));
      const shoulderQuality = Math.max(5, 100 - Math.min(100, Math.round((shoulderAsymmetry / 20) * 100)));
      const distanceQuality = Math.max(5, 100 - Math.min(100, Math.round((faceDistanceAlarm / 35) * 100)));
      const distanceBarWidth = liveMetrics.value.faceDistanceBaselineReady
        ? distanceQuality
        : 5;
      const distanceText = liveMetrics.value.faceDistanceBaselineReady
        ? (faceDistancePercent > 0 ? `+${faceDistancePercent}% closer` : `${faceDistancePercent}%`)
        : 'Calibrating...';

      return [
        {
          key: 'goodPosture',
          label: 'Good Posture',
          valueText: `${goodPosture}%`,
          width: goodPosture,
          color: 'var(--accent)',
          gradient: 'linear-gradient(90deg,var(--accent2),var(--accent))'
        },
        {
          key: 'headTilt',
          label: 'Head Tilt',
          valueText: `${headTilt}deg`,
          width: headTiltQuality,
          color: headTilt <= 12 ? 'var(--accent)' : 'var(--warn)',
          gradient: headTilt <= 12
            ? 'linear-gradient(90deg,var(--accent),#34d399)'
            : 'linear-gradient(90deg,var(--warn),#fbbf24)'
        },
        {
          key: 'shoulderAsymmetry',
          label: 'Shoulder Asymmetry',
          valueText: `${shoulderAsymmetry}%`,
          width: shoulderQuality,
          color: shoulderAsymmetry <= 8 ? 'var(--accent)' : 'var(--warn)',
          gradient: shoulderAsymmetry <= 8
            ? 'linear-gradient(90deg,var(--accent2),var(--accent))'
            : 'linear-gradient(90deg,var(--warn),#f59e0b)'
        },
        {
          key: 'faceDistance',
          label: 'Face Distance',
          valueText: distanceText,
          width: distanceBarWidth,
          color: faceDistanceAlarm <= 15 ? 'var(--accent2)' : 'var(--warn)',
          gradient: faceDistanceAlarm <= 15
            ? 'linear-gradient(90deg,var(--accent2),#5eead4)'
            : 'linear-gradient(90deg,var(--warn),#fbbf24)'
        }
      ];
    });

    const activeScreenAlerts = computed(() => {
      const alerts = [];

      if (enabledAlerts.value.screenDistance && liveMetrics.value.faceDistanceBaselineReady && (liveMetrics.value.faceDistancePercent || 0) > 15) {
        alerts.push('Too close to screen');
      }

      const issueTypeToKey = {
        HEAD_TILT: 'headTilt',
        SHOULDER_ASYMMETRY: 'shoulderAsymmetry'
      };

      detectedIssues.value.forEach((issue) => {
        const alertKey = issueTypeToKey[issue.type];
        if (alertKey && enabledAlerts.value[alertKey]) {
          alerts.push(issue.title);
        }
      });

      return Array.from(new Set(alerts));
    });

    // Post-Session Report
    const generatedReport = ref(null);
    const previousSessionReports = ref([]);
    const geminiSessionAnalysis = ref(null);
    const geminiVideoGroups = ref([]);
    
    // Status and Toast
    const {
      showToast,
      toastTitle,
      toastMessage,
      toastColor,
      showStatusToast,
      hideStatusToast
    } = useStatusToast(5000);

    // Current Session Object
    let currentSession = null;
    let recordingIntervalId = null;
    let timerIntervalId = null;

    const sessionLabel = computed(() => Number.isFinite(selectedDuration.value)
      ? `${selectedDuration.value} minute timed session`
      : 'Unlimited session (manual stop)');

    function unwrapData(response) {
      if (!response || typeof response !== 'object') return response;
      if (response.success && response.data !== undefined) return response.data;
      return response.data !== undefined ? response.data : response;
    }

    async function persistAndAnalyzeSession(finalSession, report) {
      if (!finalSession || !report) return;

      const startedAt = finalSession.startTime
        ? new Date(finalSession.startTime).toISOString()
        : new Date().toISOString();
      const endedAt = finalSession.endTime
        ? new Date(finalSession.endTime).toISOString()
        : new Date().toISOString();
      const alertKeys = Object.keys(finalSession.summary?.issueFlags || {});

      const created = await api.monitoringSessions.create({
        startedAt,
        endedAt,
        durationSec: Number(finalSession.duration) || 0,
        score: Number(report.overallScore) || 0,
        alerts: alertKeys
      });

      const savedSession = unwrapData(created) || {};
      const sessionId = savedSession._id || null;
      if (!sessionId) return;

      const geminiResult = await analyzeMonitoringSessionWithGemini(sessionId);
      const videoGroups = await enrichSearchesWithVideos(geminiResult.youtubeSearches || [], 3);

      geminiSessionAnalysis.value = geminiResult;
      geminiVideoGroups.value = videoGroups;
    }

    // ========== SESSION SETUP ==========
    function startSession() {
      resetPostureTracking({
        holdDurationSeconds: postureHoldSeconds.value
      });

      // Reset tracking
      sessionStartTime.value = Date.now();
      sessionElapsedTime.value = '00:00:00';
      const durationSeconds = Number.isFinite(selectedDuration.value) ? selectedDuration.value * 60 : null;
      timedSessionTotalSeconds.value = durationSeconds;
      sessionCountdownTime.value = formatTimeRemaining(durationSeconds);
      detectedIssues.value = [];
      issueHoldDurations.value = {};
      isSessionActive.value = true;
      viewMode.value = 'monitoring';

      // Setup posture recording FIRST (set callback before camera starts)
      startPostureRecording();

      // Start recording session (creates internal session object)
      const sessionMode = Number.isFinite(durationSeconds) ? 'timed' : 'live';
      currentSession = startRecordingSession(sessionMode, durationSeconds);

      // Start timers
      startTimers();

      // NOW start camera (callback already ready)
      window.setOverlayEnabled?.(showOnScreenAlerts.value);
      window.startCamera?.();
      showStatusToast('Session Started', 'Posture monitoring is active.', 'var(--accent)');
    }

    // ========== REAL-TIME POSTURE MONITORING ==========
    function startPostureRecording() {
      // Listen to MediaPipe pose updates
      window.onPostureUpdate = (poseLandmarks) => {
        console.log('[MonitoringView.onPostureUpdate] Called with', poseLandmarks ? poseLandmarks.length + ' landmarks' : 'no landmarks');
        if (!isSessionActive.value) {
          console.warn('[MonitoringView.onPostureUpdate] Session not active, skipping');
          return;
        }

        try {
          // Analyze posture from landmarks
          const analysis = analyzePosture(poseLandmarks);
          console.log('[MonitoringView.onPostureUpdate] Analysis result:', {
            classification: analysis.overallSeverity,
            issues: analysis.issues ? analysis.issues.length : 0,
            hasMetrics: !!analysis.detailedMetrics
          });
          
          // Update live metrics
          const metrics = analysis.detailedMetrics || {};
          liveMetrics.value = {
            headForwardAngle: Math.round(metrics.forwardHead?.value ?? 0),
            headTiltAngle: Math.round(metrics.headTilt?.value ?? 0),
            shoulderAsymmetry: Math.round(metrics.shoulderAsymmetry?.value ?? 0),
            faceDistancePercent: Math.round(metrics.faceDistance?.value ?? 0),
            faceDistanceBaselineReady: Boolean(metrics.faceDistance?.baselineReady),
            verticalAlign: Math.round(metrics.verticalTilt?.value ?? 0),
            slouchingScore: Math.round(metrics.slouching?.value ?? 0),
            positionQuality: Math.max(0, 100 - Math.round(analysis.overallSeverity || 0)),
            overallSeverity: Math.round(analysis.overallSeverity || 0)
          };

          // Update detected issues with hold-duration info
          detectedIssues.value = analysis.issues.map(issue => {
            const holdDuration = getHoldDuration();
            return {
              ...issue,
              key: issue.type,
              title: issue.type.replace(/_/g, ' ').toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase()),
              description: 'Sustained posture deviation detected',
              holdDuration: holdDuration,
              isFlagged: true
            };
          });

          // Record snapshot to current session (monitoringSession.js manages internal state)
          console.log('[MonitoringView.onPostureUpdate] Calling recordPostureSnapshot');
          recordPostureSnapshot(analysis);
          console.log('[MonitoringView.onPostureUpdate] recordPostureSnapshot returned successfully');

        } catch (error) {
          console.error('Error analyzing posture:', error);
        }
      };
    }

    function stopPostureRecording() {
      window.onPostureUpdate = null;
    }

    // ========== TIMER MANAGEMENT ==========
    function startTimers() {
      timerIntervalId = setInterval(() => {
        if (!isSessionActive.value) return;

        const now = Date.now();
        const elapsed = Math.floor((now - sessionStartTime.value) / 1000);
        sessionElapsedTime.value = formatTimeSeconds(elapsed);

        // Update countdown for fixed-duration sessions
        if (Number.isFinite(timedSessionTotalSeconds.value)) {
          const timeRemaining = timedSessionTotalSeconds.value - elapsed;
          sessionCountdownTime.value = formatTimeSeconds(Math.max(0, timeRemaining));

          // Auto-end session when time is up
          if (timeRemaining <= 0) {
            endSession();
          }
        }
      }, 100);
    }

    function formatTimeSeconds(seconds) {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = seconds % 60;
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    function formatTimeRemaining(seconds) {
      if (!seconds) return '--:--:--';
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = seconds % 60;
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    // ========== SESSION ENDING & REPORTING ==========
    async function endSession() {
      if (!isSessionActive.value) return;

      isSessionActive.value = false;
      stopPostureRecording();

      if (timerIntervalId) {
        clearInterval(timerIntervalId);
        timerIntervalId = null;
      }

      // Stop camera
      window.stopCamera?.();

      // Show loading state
      isLoading.value = true;
      viewMode.value = 'report-view';
      showStatusToast('Analyzing Posture', 'Generating your personalized report...', 'var(--accent)');

      // Finalize session in service
      const finalSession = await endRecordingSession();

      // Generate report
      setTimeout(() => {
        try {
          if (!finalSession) {
            throw new Error('Session finalization failed - no session returned');
          }
          
          if (!finalSession.snapshots || finalSession.snapshots.length === 0) {
            console.warn('Warning: No snapshots recorded during session. Session may have been too short or no pose detected.');
          }
          
          const report = generateDetailedReport(finalSession);
          
          if (!report || report.error) {
            throw new Error(report?.error || 'Report generation failed - unknown error');
          }
          
          generatedReport.value = report;
          const history = getSessionHistoryList();
          previousSessionReports.value = history
            .slice(1)
            .map((session) => ({ report: generateDetailedReport(session) }))
            .filter((item) => item.report && item.report.status === 'SUCCESS');

          persistAndAnalyzeSession(finalSession, report)
            .then(() => {
              showStatusToast('AI Session Review Ready', 'Gemini validated your session and generated guidance.', 'var(--accent)');
            })
            .catch((err) => {
              console.error('Failed to persist/analyze session:', err);
              showStatusToast('AI Session Review Unavailable', 'Session report is ready, but AI review is currently unavailable.', 'var(--warn)');
            });
          
          isLoading.value = false;
          hideStatusToast();
          showStatusToast('Report Ready', 'Your posture analysis is complete.', 'var(--accent)');
        } catch (error) {
          console.error('Error generating report:', error);
          console.error('Session data:', finalSession);
          isLoading.value = false;
          showStatusToast('Report Error', error.message || 'Failed to generate report. Try again.', 'var(--danger)');
        }
      }, 1500);
    }

    function downloadReport() {
      if (!generatedReport.value) return;

      const reportText = `
POSTURE ANALYSIS REPORT
Generated: ${new Date().toLocaleString()}
Session Mode: ${Number.isFinite(selectedDuration.value) ? `Timed (${selectedDuration.value} min)` : 'Unlimited'}
Duration: ${sessionElapsedTime.value}

=== OVERALL ASSESSMENT ===
Overall Score: ${generatedReport.value.overallScore}/100
Posture Quality: ${generatedReport.value.postureTimeDistribution.GOOD}% Good

Time Distribution:
- Good Posture: ${generatedReport.value.postureTimeDistribution.GOOD}%
- Warning: ${generatedReport.value.postureTimeDistribution.WARNING}%
- Poor: ${generatedReport.value.postureTimeDistribution.POOR}%
- Critical: ${generatedReport.value.postureTimeDistribution.CRITICAL}%

=== DETECTED ISSUES ===
${generatedReport.value.detailedIssues.map(issue => `
${issue.title} (Severity: ${issue.severity})
${issue.description}
Health Impact: ${issue.healthRisk}

Immediate Actions:
${issue.immediateActions.map(a => `- ${a}`).join('\n')}

Daily Exercises:
${issue.dailyExercises.map(e => `- ${e.name} (${e.frequency})`).join('\n')}

Workstation Setup:
${issue.workstationSetup.map(s => `- ${s}`).join('\n')}
`).join('\n')}

=== PERSONALIZED ADVICE ===
${generatedReport.value.detailedIssues.map(issue => 
  issue.personalizedAdvice.map(a => `- ${a}`).join('\n')
).join('\n')}

=== ACTION PLAN ===
Priority Issues: ${generatedReport.value.actionPlan.priority.map(p => p.issue).join(', ')}

Immediate Actions:
${generatedReport.value.actionPlan.immediate.map(a => `- ${a}`).join('\n')}

Short-term (Week): 
${generatedReport.value.actionPlan.shortTerm.map(a => `- ${a}`).join('\n')}

Long-term (Month):
${generatedReport.value.actionPlan.longTerm.map(a => `- ${a}`).join('\n')}

Health Risk Assessment:
${generatedReport.value.healthRiskAssessment}
`;

      const blob = new Blob([reportText], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `posture-report-${new Date().toISOString().split('T')[0]}.txt`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      showStatusToast('Downloaded', 'Report saved to your device.', 'var(--accent)');
    }

    function startNewSession() {
      viewMode.value = 'setup';
      isSessionActive.value = false;
      generatedReport.value = null;
      geminiSessionAnalysis.value = null;
      geminiVideoGroups.value = [];
      detectedIssues.value = [];
      timedSessionTotalSeconds.value = Number.isFinite(selectedDuration.value) ? selectedDuration.value * 60 : null;
      currentSession = null;
    }

    function goToDashboard() {
      window.location.hash = '#/';
    }

    // ========== LIFECYCLE ==========
    onMounted(async () => {
      await ensureMediaPipeScripts();
      backendStatus.value = await checkBackendHealth({
        successMessage: 'Monitoring services ready',
        unavailableMessage: 'Monitoring view loaded (backend unavailable)'
      });

      if (route.query?.report === 'last') {
        const history = getSessionHistoryList();
        if (history.length > 0) {
          const latestSession = history[0];
          const report = generateDetailedReport(latestSession);
          if (report && report.status === 'SUCCESS') {
            generatedReport.value = report;
            previousSessionReports.value = history
              .slice(1)
              .map((session) => ({ report: generateDetailedReport(session) }))
              .filter((item) => item.report && item.report.status === 'SUCCESS');
            selectedDuration.value = latestSession.mode === 'timed'
              ? Math.max(1, Math.round((latestSession.duration || 0) / 60))
              : null;
            timedSessionTotalSeconds.value = null;
            sessionElapsedTime.value = formatTimeSeconds(latestSession.duration || 0);
            viewMode.value = 'report-view';
          }
        }

      window.setOverlayEnabled?.(showOnScreenAlerts.value);
      }
    });

    onBeforeUnmount(() => {
      if (isSessionActive.value) {
        endSession();
      }
      if (timerIntervalId) clearInterval(timerIntervalId);
      stopPostureRecording();
      window.stopCamera?.();
    });

    return {
      // View and Mode
      viewMode,
      selectedDuration,
      postureHoldSeconds,
      enabledAlerts,
      showOnScreenAlerts,
      sessionLabel,
      
      // Monitoring
      isSessionActive,
      sessionElapsedTime,
      sessionCountdownTime,
      isLoading,
      backendStatus,
      
      // Metrics
      liveMetrics,
      realtimeMetricRows,
      detectedIssues,
      activeScreenAlerts,
      
      // Report
      generatedReport,
      previousSessionReports,
      geminiSessionAnalysis,
      geminiVideoGroups,
      
      // Toast
      showToast,
      toastTitle,
      toastMessage,
      toastColor,
      hideStatusToast,
      
      // Actions
      startSession,
      endSession,
      downloadReport,
      startNewSession,
      goToDashboard
    };
  },
  template: `
    <!-- SESSION SETUP SCREEN -->
    <div v-show="viewMode === 'setup'" class="w-full">
      <app-card>
        <div class="text-center mb-8">
          <h2 class="font-[Syne] text-[2rem] font-extrabold mb-3">Start a Posture Monitoring Session</h2>
          <p class="text-[var(--muted)] text-[1rem]">Pick session duration, hold threshold, and alert types before starting</p>
        </div>

        <div class="assess-warning-banner mb-8">
          ⚠️ Monitoring guidance only. These insights help with posture awareness, but they are not clinical exam results or a medical diagnosis. If pain, dizziness, headaches, or discomfort persist, stop and seek advice from a qualified healthcare professional.
        </div>

        <!-- Duration Picker -->
        <div class="mb-8">
          <label class="block text-[0.95rem] font-semibold mb-3">Session Duration</label>
          <div class="grid grid-cols-3 sm:grid-cols-6 gap-2">
            <button
              v-for="dur in [5, 10, 15, 30, 45, null]"
              :key="dur"
              @click="selectedDuration = dur"
              :class="['btn-calibrate', selectedDuration === dur ? 'btn-emphasis btn-emphasis-accent' : 'bg-[var(--surface2)] text-[var(--text)]']"
              class="py-3 rounded-lg font-semibold"
            >
              {{ dur === null ? 'Unlimited' : dur + 'm' }}
            </button>
          </div>
        </div>

        <div class="mb-8 p-4 bg-[var(--surface2)] border border-[var(--border)] rounded-xl">
          <label class="block text-[0.95rem] font-semibold mb-2">Posture Alert Hold Time: {{ postureHoldSeconds }}s</label>
          <p class="text-[0.85rem] text-[var(--muted)] mb-3">Flag an issue only if it persists for the selected duration (3-10 seconds).</p>
          <input
            type="range"
            min="3"
            max="10"
            step="1"
            v-model.number="postureHoldSeconds"
            class="w-full"
          />
          <div class="flex justify-between text-[0.75rem] text-[var(--muted)] mt-1">
            <span>3s</span>
            <span>10s</span>
          </div>
        </div>

        <div class="mb-8 p-4 bg-[var(--surface2)] border border-[var(--border)] rounded-xl">
          <label class="block text-[0.95rem] font-semibold mb-3">Alert Types</label>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[0.9rem]">
            <label class="flex items-center gap-2">
              <input type="checkbox" v-model="enabledAlerts.screenDistance" />
              <span>Approaching Screen Too Much</span>
            </label>
            <label class="flex items-center gap-2">
              <input type="checkbox" v-model="enabledAlerts.shoulderAsymmetry" />
              <span>Uneven Shoulders</span>
            </label>
            <label class="flex items-center gap-2">
              <input type="checkbox" v-model="enabledAlerts.headTilt" />
              <span>Head Tilt</span>
            </label>
          </div>
          <label class="flex items-center gap-2 mt-4 text-[0.9rem]">
            <input type="checkbox" v-model="showOnScreenAlerts" />
            <span>Show on-screen overlay alerts</span>
          </label>
          <p class="text-[0.78rem] text-[var(--muted)] mt-2">Default is off. Enable this if you want visual alert overlays while monitoring.</p>
        </div>

        <!-- Action Buttons -->
        <div class="flex gap-3 justify-center">
          <button @click="startSession" class="btn-calibrate btn-emphasis btn-emphasis-accent px-8 py-3 rounded-lg font-semibold">
            Start Monitoring
          </button>
        </div>

        <!-- Info Box -->
        <div class="mt-8 p-4 bg-[var(--surface2)] border border-[var(--border)] rounded-xl text-[0.9rem] text-[var(--muted)]">
          <strong>📷 Camera Permission Required:</strong> Make sure your camera is enabled in browser settings. WellAlign uses your camera only to analyze your posture—no video is recorded.
        </div>
      </app-card>
    </div>

    <!-- MONITORING ACTIVE SCREEN -->
    <div v-show="viewMode === 'monitoring'" class="w-full">
      <app-card>
        <div class="flex items-center justify-between mb-6">
          <div>
            <h2 class="font-[Syne] text-[1.8rem] font-extrabold">Live Posture Monitoring</h2>
            <p class="text-[var(--muted)] text-[0.95rem]">{{ sessionLabel }}</p>
          </div>
          <div class="text-right">
            <div class="flex items-center gap-2.5 mb-2">
              <div class="pulse-dot"></div>
              <span class="text-[var(--accent)] font-semibold">Live</span>
            </div>
          </div>
        </div>

        <!-- Session Timers -->
        <div class="grid grid-cols-2 gap-4 mb-6">
          <div class="bg-[var(--surface2)] p-4 rounded-xl border border-[var(--border)]">
            <div class="text-[var(--muted)] text-[0.85rem] mb-2">{{ selectedDuration === null ? 'Elapsed Time' : 'Time Remaining' }}</div>
            <div class="font-['JetBrains_Mono'] text-[1.8rem] font-semibold text-[var(--accent)]">
              {{ selectedDuration === null ? sessionElapsedTime : sessionCountdownTime }}
            </div>
          </div>
          <div class="bg-[var(--surface2)] p-4 rounded-xl border border-[var(--border)]">
            <div class="text-[var(--muted)] text-[0.85rem] mb-2">Overall Severity Score</div>
            <div class="font-['JetBrains_Mono'] text-[1.8rem] font-semibold" :class="liveMetrics.overallSeverity <= 33 ? 'text-[var(--accent)]' : liveMetrics.overallSeverity <= 66 ? 'text-[var(--warn)]' : 'text-[var(--danger)]'">
              {{ liveMetrics.overallSeverity }}%
            </div>
          </div>
        </div>

        <!-- Camera Feed (Critical Element) -->
        <div class="mb-6 p-4 bg-[var(--surface2)] rounded-xl border border-[var(--border)] overflow-hidden">
          <div class="camera-feed">
            <video id="video" playsinline></video>
            <canvas id="canvas"></canvas>
            <div class="scanline"></div>
            <div class="camera-corners">
              <span></span><span></span><span></span><span></span>
            </div>

            <div v-if="showOnScreenAlerts && activeScreenAlerts.length" class="absolute inset-0 z-20 bg-[rgba(239,68,68,0.18)] border border-[rgba(239,68,68,0.55)] flex items-center justify-center p-4 text-center">
              <div class="bg-[rgba(9,9,11,0.78)] text-white px-4 py-3 rounded-lg text-[0.95rem]">
                {{ activeScreenAlerts.join(' • ') }}
              </div>
            </div>
            
            <!-- Status Label -->
            <div class="absolute bottom-4 left-4 text-white text-sm bg-black bg-opacity-50 px-2 py-1 rounded">
              <span id="statusLabel">Initializing...</span>
            </div>

            <div id="alertOverlay" class="absolute inset-0 z-10 opacity-0 pointer-events-none bg-[rgba(239,68,68,0.12)] flex items-center justify-center text-white text-sm font-semibold transition-opacity duration-200">
              Too close to the screen
            </div>
            
            <!-- Hidden elements needed by mediapipe.js but not displayed -->
            <div style="display: none;">
              <span id="baselineLabel"></span>
              <span id="tolLabel"></span>
              <span id="sizeStat"></span>
              <span id="baseStat"></span>
              <span id="stateStat"></span>
              <span id="soundLabel"></span>
            </div>
          </div>
        </div>
        <div class="mb-6 p-5 bg-[var(--surface)] rounded-xl border border-[var(--border)]">
          <h3 class="font-[Syne] text-[1.3rem] font-bold mb-4">Real-time Metrics</h3>
          <div class="flex flex-col gap-4">
            <div v-for="row in realtimeMetricRows" :key="row.key" class="flex flex-col gap-1.5">
              <div class="flex items-center justify-between text-[0.95rem]">
                <span class="text-[var(--text)]">{{ row.label }}</span>
                <span class="font-semibold" :style="{ color: row.color }">{{ row.valueText }}</span>
              </div>
              <div class="h-[0.38rem] bg-[var(--surface2)] rounded-full overflow-hidden">
                <div class="h-full rounded-full transition-all duration-300" :style="{ width: row.width + '%', background: row.gradient }"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Stop Button -->
        <button @click="endSession" class="btn-calibrate btn-emphasis btn-emphasis-danger w-full py-3 rounded-lg font-semibold">
          End Session
        </button>
      </app-card>
    </div>

    <!-- REPORT VIEW SCREEN -->
    <div v-show="viewMode === 'report-view'" class="w-full">
      <!-- Loading State -->
      <div v-if="isLoading" class="flex flex-col items-center justify-center min-h-[60vh]">
        <div class="animate-spin mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="w-12 h-12 text-[var(--accent)]">
            <circle cx="12" cy="12" r="10" stroke-opacity="0.3"/>
            <path d="M12 2a10 10 0 0110 10" stroke-linecap="round"/>
          </svg>
        </div>
        <h3 class="font-semibold text-[1.2rem] mb-2">Analyzing Your Posture...</h3>
        <p class="text-[var(--muted)]">Generating your personalized report with recommendations</p>
      </div>

      <!-- Report Display -->
      <div v-else-if="generatedReport" class="w-full">
        <app-card>
          <div class="text-center mb-8">
            <h2 class="font-[Syne] text-[2rem] font-extrabold mb-2">Your Posture Report</h2>
            <p class="text-[var(--muted)]">Session completed — {{ sessionElapsedTime }} of monitoring</p>
          </div>

          <div class="assess-warning-banner">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="w-5 h-5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v4"/>
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 17h.01"/>
              <path stroke-linecap="round" stroke-linejoin="round" d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/>
            </svg>
            <div>
              <strong>Monitoring guidance only.</strong> This is not a clinical exam. Live camera frames are analyzed in-session, and raw video is not stored.
            </div>
          </div>

          <PostureReport 
            :report="generatedReport"
            :session-duration="sessionElapsedTime"
            :previous-sessions="previousSessionReports"
            @download-report="downloadReport"
            @start-new-session="startNewSession"
            @go-to-dashboard="goToDashboard"
          />

          <div v-if="geminiSessionAnalysis" class="mt-6 p-5 bg-[var(--surface2)] rounded-xl border border-[var(--border)]">
            <h3 class="font-semibold text-[1.05rem] mb-2">Gemini Session Validation</h3>
            <p class="text-[0.9rem] text-[var(--muted)] mb-2">{{ geminiSessionAnalysis.analysis || 'AI session analysis unavailable.' }}</p>
            <p v-if="geminiSessionAnalysis.confirmedScore !== null" class="text-[0.85rem] text-[var(--accent)] mb-3">
              Confirmed session score: {{ geminiSessionAnalysis.confirmedScore }}%
            </p>

            <div v-if="geminiSessionAnalysis.recommendedExercises && geminiSessionAnalysis.recommendedExercises.length" class="mb-4">
              <h4 class="font-semibold text-[0.9rem] mb-2">Corrective Exercises</h4>
              <ul class="space-y-1 text-[0.85rem]">
                <li v-for="exercise in geminiSessionAnalysis.recommendedExercises.slice(0, 5)" :key="exercise" class="text-[var(--muted)]">• {{ exercise }}</li>
              </ul>
            </div>

            <div v-if="geminiVideoGroups.length" class="space-y-3">
              <div v-for="group in geminiVideoGroups.slice(0, 3)" :key="group.query" class="p-3 bg-[var(--surface)] rounded-lg border border-[var(--border)]">
                <div class="text-[0.8rem] font-semibold mb-1">Search: {{ group.query }}</div>
                <div v-if="group.reason" class="text-[0.75rem] text-[var(--muted)] mb-2">{{ group.reason }}</div>
                <div class="flex flex-col gap-1 text-[0.8rem]">
                  <a
                    v-for="video in group.videos.slice(0, 3)"
                    :key="video.videoId || video.url"
                    :href="video.url"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="underline text-[var(--accent2)]"
                  >
                    {{ video.title }}
                  </a>
                </div>
              </div>
            </div>
          </div>
        </app-card>
      </div>
    </div>

    <!-- Toast Notification -->
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
