import { checkBackendHealth } from '../services/backendHealth.js';
import { useStatusToast } from '../utils/useStatusToast.js';
import { useMonitoringSession } from '../services/monitoringSession.js';

export const DashboardView = {
  setup() {
    const { ref, computed, onMounted, onBeforeUnmount, nextTick } = Vue;
    const { useRouter } = VueRouter;

    const router = useRouter();
    const timer = ref('00:00:00');
    const seconds = ref(0);
    const isSessionActive = ref(false);
    const monitoringState = useMonitoringSession();
    const monitoringStatus = computed(() => (monitoringState.isMonitoring ? 'ON' : 'OFF'));
    const lastSession = computed(() => monitoringState.lastSession);
    const chatInput = ref('');
    const nextMsgId = ref(4);
    const backendStatus = ref('Connecting to backend...');

    function formatSessionEndedAt(value) {
      if (!value) return 'N/A';
      const dt = new Date(value);
      if (Number.isNaN(dt.getTime())) return 'N/A';
      return dt.toLocaleString();
    }

    function goToMonitoring() {
      router.push({ name: 'monitoring', query: { report: 'last' } });
    }
    const {
      showToast,
      toastTitle,
      toastMessage,
      showStatusToast,
      hideStatusToast
    } = useStatusToast(8000);

    const chatMessages = ref([
      { id: 1, type: 'bot', text: 'How can I help you improve your posture today?' },
      { id: 2, type: 'user', text: 'Why does my lower back hurt after 1 hour?' },
      { id: 3, type: 'bot', text: 'That usually indicates a lack of lumbar support or pelvic tilt. Try adjusting your chair backrest and ensure your hips are slightly higher than your knees.' }
    ]);

    const recentSessions = ref([
      { id: 1, date: 'Monday 12:30 PM', duration: '45 min', score: 87, scoreColor: '#c8f96a' },
      { id: 2, date: 'Sunday 2:15 PM', duration: '30 min', score: 82, scoreColor: '#6af9c8' },
      { id: 3, date: 'Saturday 3:45 PM', duration: '52 min', score: 91, scoreColor: '#c8f96a' }
    ]);

    let timerInterval = null;
    let chartInstance = null;

    function updateTimer() {
      const h = String(Math.floor(seconds.value / 3600)).padStart(2, '0');
      const m = String(Math.floor((seconds.value % 3600) / 60)).padStart(2, '0');
      const s = String(seconds.value % 60).padStart(2, '0');
      timer.value = `${h}:${m}:${s}`;
    }

    function startSession() {
      if (isSessionActive.value) return;
      isSessionActive.value = true;
      timerInterval = setInterval(() => {
        seconds.value += 1;
        updateTimer();
      }, 1000);
    }

    function endSession() {
      isSessionActive.value = false;
      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
    }

    function sendMessage() {
      const msg = chatInput.value.trim();
      if (!msg) return;

      chatMessages.value.push({ id: nextMsgId.value++, type: 'user', text: msg });
      chatInput.value = '';

      nextTick(() => {
        const wrap = document.getElementById('chatWrap');
        if (wrap) wrap.scrollTop = wrap.scrollHeight;
      });

      setTimeout(() => {
        chatMessages.value.push({
          id: nextMsgId.value++,
          type: 'bot',
          text: 'Based on your current posture data, focus on deep neck flexors and thoracic mobility today. I can add a target routine if you want.'
        });

        nextTick(() => {
          const wrap = document.getElementById('chatWrap');
          if (wrap) wrap.scrollTop = wrap.scrollHeight;
        });
      }, 700);
    }

    function initChart() {
      const canvas = document.getElementById('progressChart');
      if (!canvas || !window.Chart) return;

      const ctx = canvas.getContext('2d');
      const gradient = ctx.createLinearGradient(0, 0, 0, 180);
      gradient.addColorStop(0, 'rgba(200, 249, 106, 0.25)');
      gradient.addColorStop(1, 'rgba(200, 249, 106, 0.01)');

      chartInstance = new Chart(canvas, {
        type: 'line',
        data: {
          labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
          datasets: [{
            label: 'Posture Score',
            data: [65, 72, 68, 78, 75, 82, 84],
            borderColor: '#10b981',
            borderWidth: 2.5,
            backgroundColor: gradient,
            fill: true,
            tension: 0.45,
            pointRadius: 4,
            pointBackgroundColor: '#10b981',
            pointBorderColor: '#0d0f14',
            pointBorderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: '#1a1e2a',
              borderColor: 'rgba(255,255,255,0.08)',
              borderWidth: 1,
              titleColor: '#c8f96a',
              bodyColor: '#e8eaf0',
              padding: 10,
              callbacks: {
                label: (point) => `Score: ${point.parsed.y}%`
              }
            }
          },
          scales: {
            x: {
              grid: { color: 'rgba(255,255,255,0.04)' },
              ticks: { color: '#6b7280', font: { family: 'DM Sans', size: 11 } }
            },
            y: {
              min: 45,
              max: 100,
              grid: { color: 'rgba(255,255,255,0.04)' },
              ticks: {
                color: '#6b7280',
                font: { family: 'DM Sans', size: 11 },
                callback: (value) => `${value}%`
              }
            }
          }
        }
      });
    }

    onMounted(async () => {
      updateTimer();
      backendStatus.value = await checkBackendHealth({
        successMessage: 'Backend connected',
        unavailableMessage: 'Backend unavailable; showing local dashboard data',
        countSuffix: 'records fetched'
      });
      showStatusToast('Slouch Detected', 'You have been leaning forward for 15 minutes. Straighten up and take a short break.', 'var(--warn)');
      nextTick(() => initChart());
    });

    onBeforeUnmount(() => {
      if (timerInterval) clearInterval(timerInterval);
      if (chartInstance) chartInstance.destroy();
    });

    return {
      timer,
      isSessionActive,
      monitoringStatus,
      lastSession,
      chatInput,
      chatMessages,
      showToast,
      toastTitle,
      toastMessage,
      recentSessions,
      backendStatus,
      startSession,
      endSession,
      hideStatusToast,
      sendMessage,
      formatSessionEndedAt,
      goToMonitoring
    };
  },
  template: `
    <div class="w-full">
      <app-card>
        <div class="flex items-center justify-between">
          <div>
            <h1 class="font-[Syne] text-[2.4rem] font-extrabold mb-2">Welcome back, Drew</h1>
            <p class="text-[var(--muted)] text-base">Track your posture journey and maintain healthy habits</p>
            <p class="text-[0.75rem] text-[var(--muted)] mt-2">{{ backendStatus }}</p>
          </div>
        </div>
      </app-card>
    </div>

    <div class="stats-row">
      <div class="stat-card green delay-[50ms]">
        <div class="card-label">Posture Score</div>
        <div class="score-ring-wrap">
          <div class="score-ring">
            <svg width="56" height="56" viewBox="0 0 56 56">
              <circle class="ring-bg" cx="28" cy="28" r="22" fill="none" stroke-width="5"/>
              <circle class="ring-fill" cx="28" cy="28" r="22" fill="none" stroke-width="5"/>
            </svg>
            <div class="center-text">84</div>
          </div>
          <div>
            <div class="card-value text-3xl text-[var(--accent)]">84%</div>
            <div class="text-[0.72rem] text-[var(--muted)] mt-0.5">up 3% from yesterday</div>
          </div>
        </div>
      </div>

      <div class="stat-card teal delay-[100ms]">
        <div class="card-label">Active Session</div>
        <div class="session-timer">{{ timer }}</div>
        <div class="goal-sub">{{ isSessionActive ? 'Live monitoring running' : 'Start a new session' }}</div>
      </div>

      <div class="stat-card warn delay-[150ms]">
        <div class="card-label">Slouch Alerts</div>
        <div class="card-value text-[var(--warn)]">12</div>
        <div class="issues-row">
          <span class="issue-chip red">Forward Head</span>
          <span class="issue-chip warn">Rounded Shoulders</span>
        </div>
      </div>

      <div class="stat-card neutral delay-[200ms]">
        <div class="card-label">Daily Goal</div>
        <div class="flex items-baseline gap-1">
          <div class="goal-text">6</div>
          <div class="text-[var(--muted)] text-lg font-[Syne] font-bold">/8h</div>
        </div>
        <div class="posture-bar-wrap">
          <div class="posture-bar">
            <div class="posture-bar-fill w-[75%]"></div>
          </div>
          <div class="text-[0.68rem] text-[var(--muted)] mt-1">75% of daily monitoring goal</div>
        </div>
      </div>
    </div>

    <div class="monitoring-grid">
      <div class="flex flex-col gap-5">
        <div class="card delay-[250ms]">
          <div class="section-header">
            <div class="section-title">Live Monitoring</div>
            <span class="badge" :class="monitoringStatus === 'ON' ? 'badge-green' : 'badge-muted'">{{ monitoringStatus }}</span>
          </div>

          <div class="bg-[var(--surface2)] border border-[var(--border)] rounded-xl p-4 flex flex-col gap-3">
            <p class="text-[0.9rem] text-[var(--muted)]">Live camera preview has been moved to the dedicated monitoring page.</p>
            <router-link to="/monitoring" class="btn-calibrate btn-emphasis btn-emphasis-accent text-center mt-0">Open Monitoring Page</router-link>
          </div>

          <div v-if="lastSession" class="mt-4 bg-[var(--surface2)] border border-[var(--border)] rounded-xl p-4">
            <div class="flex justify-between items-start mb-3">
              <div class="section-title">Last Session Stats</div>
              <button @click="goToMonitoring" class="text-[0.7rem] text-[var(--accent)] hover:underline font-semibold">View Details</button>
            </div>
            <div class="flex flex-col gap-2 text-[0.85rem]">
              <div class="flex justify-between"><span class="text-[var(--muted)]">Ended</span><span>{{ formatSessionEndedAt(lastSession.endedAt) }}</span></div>
              <div class="flex justify-between"><span class="text-[var(--muted)]">Duration</span><span>{{ lastSession.duration }}</span></div>
              <div class="flex justify-between"><span class="text-[var(--muted)]">Score</span><span class="text-[var(--accent)] font-semibold">{{ lastSession.score }}%</span></div>
            </div>
          </div>
        </div>

        <div class="card delay-[300ms]">
          <div class="section-header">
            <div class="section-title">Weekly Progress History</div>
            <div class="flex gap-2">
              <span class="badge badge-muted cursor-pointer">7D</span>
              <span class="badge badge-green cursor-pointer">30D</span>
              <span class="badge badge-muted cursor-pointer">90D</span>
            </div>
          </div>
          <div class="chart-container">
            <canvas id="progressChart"></canvas>
          </div>
        </div>
      </div>

      <div class="right-col">
        <div class="card delay-[300ms] flex-1">
          <div class="section-header">
            <div class="section-title">Well AI Assistant</div>
          </div>

          <div class="chat-wrap" id="chatWrap">
            <div v-for="msg in chatMessages" :key="msg.id" :class="['chat-bubble', msg.type]">
              {{ msg.text }}
            </div>
          </div>

          <div class="chat-input-wrap">
            <input v-model="chatInput" class="chat-input" placeholder="Ask a question..." @keydown.enter="sendMessage" />
            <button class="chat-send" @click="sendMessage">Send</button>
          </div>
        </div>

        <div class="card delay-[350ms]">
          <div class="section-header">
            <div class="section-title">Recent Sessions</div>
            <span class="badge badge-muted">This Week</span>
          </div>

          <div class="flex flex-col gap-2.5">
            <div v-for="session in recentSessions" :key="session.id" class="flex justify-between items-center p-3 bg-[var(--surface2)] rounded-lg">
              <div>
                <div class="font-medium text-[0.9rem] mb-1">{{ session.date }}</div>
                <div class="text-sm text-[var(--muted)]">{{ session.duration }} • {{ session.score }}% score</div>
              </div>
              <div :style="{ color: session.scoreColor }" class="text-xl font-extrabold">{{ session.score }}%</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showToast" class="alert-toast">
      <div class="toast-header">
        <div class="toast-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4 3 20h18L12 4Z"/><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v5"/><path stroke-linecap="round" stroke-linejoin="round" d="M12 17h.01"/></svg></div>
        <div class="toast-title">{{ toastTitle }}</div>
      </div>
      <div class="toast-body">
        {{ toastMessage }}
      </div>
      <div class="toast-actions">
        <button class="toast-btn ghost" @click="hideStatusToast">Dismiss</button>
        <button class="toast-btn primary" @click="hideStatusToast">Show Tip</button>
      </div>
    </div>
  `
};
