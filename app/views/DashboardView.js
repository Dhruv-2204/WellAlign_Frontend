import { checkBackendHealth } from '../services/backendHealth.js';
import { useStatusToast } from '../utils/useStatusToast.js';
import { useMonitoringSession } from '../services/monitoringSession.js';
import { sendGeminiChatMessage, fetchGeminiChatHistory } from '../services/geminiService.js';
import { useAuth } from '../services/auth.js';
import { fetchAssessmentHistory, formatAssessmentForHistory } from '../services/assessmentHistory.js';

const CHAT_VIDEO_CACHE_KEY = 'wa-chat-video-cache';

function normalizeKey(text) {
  return String(text || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function makeVideoCacheKey(userMessage, botMessage) {
  return `${normalizeKey(userMessage)}::${normalizeKey(botMessage)}`;
}

function shouldShowVideosForMessage(userMessage) {
  const text = normalizeKey(userMessage);
  if (!text) return false;

  return [
    'video',
    'youtube',
    'link',
    'exercise',
    'routine',
    'stretch',
    'workout',
    'demonstration',
    'tutorial'
  ].some((keyword) => text.includes(keyword));
}

function readVideoCache() {
  try {
    const raw = localStorage.getItem(CHAT_VIDEO_CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveVideoCache(cache) {
  localStorage.setItem(CHAT_VIDEO_CACHE_KEY, JSON.stringify(cache));
}

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
    const latestAssessment = ref(null);
    const assessmentHistory = ref([]);
    const selectedTrendPeriod = ref('7D');
    const monitoringScore = computed(() => lastSession.value?.score ?? null);
    const assessmentScore = computed(() => {
      if (!latestAssessment.value) return null;
      if (latestAssessment.value.overallScore !== null && latestAssessment.value.overallScore !== undefined) {
        return latestAssessment.value.overallScore;
      }
      if (latestAssessment.value.frontScore !== null && latestAssessment.value.frontScore !== undefined) {
        return latestAssessment.value.frontScore;
      }
      if (latestAssessment.value.sideScore !== null && latestAssessment.value.sideScore !== undefined) {
        return latestAssessment.value.sideScore;
      }
      return null;
    });
    const authState = useAuth();
    const userFirstName = computed(() => {
      const name = authState.user?.name || '';
      const firstName = String(name).split(' ')[0].trim();
      return firstName || 'User';
    });
    const chatInput = ref('');
    const isSendingChat = ref(false);
    const hasShownChatDisclaimer = ref(false);
    const nextMsgId = ref(2);
    const backendStatus = ref('Connecting to backend...');
    const chatVideoCache = ref(readVideoCache());

    function formatSessionEndedAt(value) {
      if (!value) return 'N/A';
      const dt = new Date(value);
      if (Number.isNaN(dt.getTime())) return 'N/A';
      return dt.toLocaleString();
    }

    function goToMonitoring() {
      router.push({ name: 'monitoring', query: { report: 'last' } });
    }

    function goToAssess() {
      router.push({ name: 'assess' });
    }

    async function loadLatestAssessment() {
      try {
        const history = await fetchAssessmentHistory();
        assessmentHistory.value = Array.isArray(history) ? history : [];
        if (!history.length) {
          latestAssessment.value = null;
          return;
        }
        latestAssessment.value = formatAssessmentForHistory(history[0]);
      } catch (error) {
        console.error('Failed to load latest assessment:', error);
        assessmentHistory.value = [];
        latestAssessment.value = null;
      }
    }
    const {
      showToast,
      toastTitle,
      toastMessage,
      showStatusToast,
      hideStatusToast
    } = useStatusToast(8000);

    const chatMessages = ref([
      {
        id: 1,
        type: 'bot',
        text: 'I am your posture assistant. Ask for quick posture tips, desk setup help, or exercise suggestions.',
        youtubeVideos: [],
        source: 'system'
      }
    ]);



    let timerInterval = null;
    let chartInstance = null;

    function toDayKey(dateValue) {
      const d = new Date(dateValue);
      if (Number.isNaN(d.getTime())) return null;
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }

    function parseScore(assessment) {
      const raw = assessment?.overall_score ?? assessment?.score;
      const numeric = Number(raw);
      return Number.isFinite(numeric) ? Math.max(0, Math.min(100, Math.round(numeric))) : null;
    }

    function makeLatestAssessmentMap(assessmentRows) {
      const sorted = [...assessmentRows].sort((a, b) => {
        const aTime = new Date(a.createdAt || a.timestamp || 0).getTime();
        const bTime = new Date(b.createdAt || b.timestamp || 0).getTime();
        return bTime - aTime;
      });

      const latestByDay = new Map();
      sorted.forEach((item) => {
        const key = toDayKey(item.createdAt || item.timestamp);
        if (!key || latestByDay.has(key)) return;
        const score = parseScore(item);
        if (score === null) return;
        latestByDay.set(key, {
          score,
          createdAt: item.createdAt || item.timestamp
        });
      });

      return latestByDay;
    }

    function getWindowEndingTomorrow(daysCount) {
      const tomorrow = new Date();
      tomorrow.setHours(0, 0, 0, 0);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const start = new Date(tomorrow);
      start.setDate(tomorrow.getDate() - (daysCount - 1));

      const days = [];
      for (let i = 0; i < daysCount; i += 1) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        days.push(d);
      }
      return days;
    }

    function buildChartRows(days, latestByDay) {
      return days.map((dateValue) => {
        const key = toDayKey(dateValue);
        const latest = latestByDay.get(key);
        const isAbsent = !latest;

        return {
          shortDate: dateValue.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
          score: latest ? latest.score : 0,
          isAbsent
        };
      });
    }

    function getTrendLength() {
      if (selectedTrendPeriod.value === '30D') return 30;
      if (selectedTrendPeriod.value === '90D') return 90;
      return 7;
    }

    function getTrendChartData() {
      const latestByDay = makeLatestAssessmentMap(assessmentHistory.value);
      const rows = buildChartRows(getWindowEndingTomorrow(getTrendLength()), latestByDay);
      return {
        labels: rows.map((row) => row.shortDate),
        data: rows.map((row) => row.score),
        absent: rows.map((row) => row.isAbsent)
      };
    }

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

    async function loadChatHistory() {
      try {
        const history = await fetchGeminiChatHistory({ limit: 20, skip: 0 });
        if (!history.length) {
          nextMsgId.value = chatMessages.value.length + 1;
          return;
        }

        const replay = [];
        let previousUserMessage = '';
        history
          .slice()
          .reverse()
          .forEach((item) => {
            if (item.userMessage) {
              previousUserMessage = item.userMessage;
              replay.push({
                id: nextMsgId.value++,
                type: 'user',
                text: item.userMessage,
                youtubeVideos: []
              });
            }

            if (item.response) {
              const key = makeVideoCacheKey(previousUserMessage, item.response);
              const cachedVideos = shouldShowVideosForMessage(previousUserMessage)
                ? (chatVideoCache.value[key] || [])
                : [];
              replay.push({
                id: nextMsgId.value++,
                type: 'bot',
                text: item.response,
                youtubeVideos: cachedVideos,
                source: 'history'
              });
            }
          });

        chatMessages.value = [chatMessages.value[0], ...replay].slice(-30);
      } catch (error) {
        console.error('Failed to load chat history:', error);
      }
    }

    async function sendMessage() {
      const msg = chatInput.value.trim();
      if (!msg || isSendingChat.value) return;

      if (!hasShownChatDisclaimer.value) {
        showStatusToast(
          'Wellbeing Guidance Notice',
          'AI guidance supports posture and wellbeing only. Seek medical care for persistent pain or injury symptoms.',
          'var(--warn)'
        );
        hasShownChatDisclaimer.value = true;
      }

      chatMessages.value.push({ id: nextMsgId.value++, type: 'user', text: msg });
      chatInput.value = '';
      isSendingChat.value = true;

      nextTick(() => {
        const wrap = document.getElementById('chatWrap');
        if (wrap) wrap.scrollTop = wrap.scrollHeight;
      });

      try {
        const response = await sendGeminiChatMessage(msg);
        const allowVideos = shouldShowVideosForMessage(msg);
        const videos = allowVideos ? (response.youtubeVideos || []) : [];

        chatMessages.value.push({
          id: nextMsgId.value++,
          type: 'bot',
          text: response.response || 'I could not generate a reply. Please try again.',
          youtubeVideos: videos,
          source: response.source || 'unknown'
        });

        const key = makeVideoCacheKey(msg, response.response);
        if (key && videos.length) {
          chatVideoCache.value[key] = videos.slice(0, 3);
          saveVideoCache(chatVideoCache.value);
        }
      } catch (error) {
        console.error('Chat send failed:', error);
        chatMessages.value.push({
          id: nextMsgId.value++,
          type: 'bot',
          text: 'I could not reach AI services right now. Please try again in a moment.',
          youtubeVideos: [],
          source: 'error'
        });
      } finally {
        isSendingChat.value = false;

        nextTick(() => {
          const wrap = document.getElementById('chatWrap');
          if (wrap) wrap.scrollTop = wrap.scrollHeight;
        });
      }
    }

    function handleChatInputKeydown(event) {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
      }
    }

    function initChart() {
      const canvas = document.getElementById('progressChart');
      if (!canvas || !window.Chart) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const gradient = ctx.createLinearGradient(0, 0, 0, 180);
      gradient.addColorStop(0, 'rgba(200, 249, 106, 0.25)');
      gradient.addColorStop(1, 'rgba(200, 249, 106, 0.01)');

      const trendData = getTrendChartData();

      if (chartInstance) {
        chartInstance.destroy();
      }

      const tickStep = selectedTrendPeriod.value === '90D'
        ? 10
        : selectedTrendPeriod.value === '30D'
          ? 5
          : 1;

      chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
          labels: trendData.labels,
          datasets: [{
            label: 'Posture Score',
            data: trendData.data,
            borderColor: '#10b981',
            borderWidth: 2.5,
            backgroundColor: gradient,
            fill: true,
            tension: 0.45,
            pointRadius: 4,
            pointBackgroundColor: (ctx) => trendData.absent[ctx.dataIndex] ? '#6b7280' : '#10b981',
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
                label: (point) => {
                  const isAbsent = trendData.absent[point.dataIndex];
                  return isAbsent ? 'Absent - posture score not taken' : `Score: ${point.parsed.y}%`;
                }
              }
            }
          },
          scales: {
            x: {
              grid: { color: 'rgba(255,255,255,0.04)' },
              ticks: {
                color: '#6b7280',
                font: { family: 'DM Sans', size: 11 },
                autoSkip: true,
                maxTicksLimit: selectedTrendPeriod.value === '90D' ? 10 : selectedTrendPeriod.value === '30D' ? 8 : 7,
                callback: (value, index) => {
                  if (index % tickStep !== 0 && index !== trendData.labels.length - 1) {
                    return '';
                  }
                  return trendData.labels[index] || '';
                }
              }
            },
            y: {
              min: 0,
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
      await loadLatestAssessment();
      await loadChatHistory();
      nextTick(() => initChart());
    });

    Vue.watch(selectedTrendPeriod, () => {
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
      latestAssessment,
      monitoringScore,
      assessmentScore,
      chatInput,
      isSendingChat,
      chatMessages,
      showToast,
      toastTitle,
      toastMessage,
      backendStatus,
      selectedTrendPeriod,
      startSession,
      endSession,
      hideStatusToast,
      sendMessage,
      handleChatInputKeydown,
      formatSessionEndedAt,
      goToMonitoring,
      goToAssess,
      userFirstName
    };
  },
  template: `
    <div class="w-full">
      <app-card>
        <div class="flex items-center justify-between">
          <div>
            <h1 class="font-[Syne] text-[2.4rem] font-extrabold mb-2">Welcome back, {{ userFirstName }}</h1>
            <p class="text-[var(--muted)] text-base">Track your posture journey and maintain healthy habits</p>
            <p class="text-[0.75rem] text-[var(--muted)] mt-2">{{ backendStatus }}</p>
          </div>
        </div>
      </app-card>
    </div>

    <div class="dashboard-main-grid">
      <div class="dashboard-left-stack">
        <div class="stats-row dashboard-stats-row">
          <div class="stat-card green delay-[50ms]">
            <div class="card-label">Monitoring Score</div>
            <div class="card-value text-3xl text-[var(--accent)]">{{ monitoringScore !== null ? monitoringScore + '%' : 'N/A' }}</div>
            <div class="text-[0.72rem] text-[var(--muted)] mt-0.5">
              {{ lastSession ? formatSessionEndedAt(lastSession.endedAt) : 'No sessions yet' }}
            </div>
          </div>

          <div class="stat-card teal delay-[100ms]">
            <div class="card-label">Assessment Score</div>
            <div class="card-value text-3xl text-[var(--accent2)]">{{ assessmentScore !== null ? assessmentScore + '%' : 'N/A' }}</div>
            <div class="text-[0.72rem] text-[var(--muted)] mt-0.5">
              {{ latestAssessment ? latestAssessment.timestamp : 'No assessments yet' }}
            </div>
          </div>
        </div>

        <div class="dashboard-summary-grid">
          <div class="card delay-[250ms]">
            <div class="section-header">
              <div class="section-title">Live Monitoring</div>
              <span class="badge" :class="monitoringStatus === 'ON' ? 'badge-green' : 'badge-muted'">{{ monitoringStatus }}</span>
            </div>

            <div class="bg-[var(--surface2)] border border-[var(--border)] rounded-xl p-4 flex flex-col gap-3 h-full">
              <div class="flex justify-between items-start">
                <div class="text-[0.82rem] text-[var(--muted)]">Last Session</div>
                <span class="badge" :class="monitoringStatus === 'ON' ? 'badge-green' : 'badge-muted'">{{ monitoringStatus === 'ON' ? 'ACTIVE' : 'IDLE' }}</span>
              </div>

              <div v-if="lastSession" class="flex flex-col gap-2 text-[0.85rem]">
                <div class="flex justify-between"><span class="text-[var(--muted)]">When</span><span>{{ formatSessionEndedAt(lastSession.endedAt) }}</span></div>
                <div class="flex justify-between"><span class="text-[var(--muted)]">Duration</span><span>{{ lastSession.duration }}</span></div>
                <div class="flex justify-between"><span class="text-[var(--muted)]">Score</span><span class="text-[var(--accent)] font-semibold">{{ lastSession.score }}%</span></div>
              </div>

              <div v-else class="text-[0.85rem] text-[var(--muted)]">
                No monitoring sessions yet. Start one to see your latest session stats.
              </div>

              <button @click="goToMonitoring" class="btn-calibrate btn-emphasis btn-emphasis-accent text-center mt-0">Open Monitoring Page</button>
            </div>
          </div>

          <div class="card delay-[280ms]">
            <div class="section-header">
              <div class="section-title">Posture Assessment</div>
              <span class="badge" :class="latestAssessment ? 'badge-green' : 'badge-muted'">
                {{ latestAssessment ? 'Latest Result' : 'No Reports Yet' }}
              </span>
            </div>

            <div v-if="latestAssessment" class="bg-[var(--surface2)] border border-[var(--border)] rounded-xl p-4 h-full">
              <div class="flex justify-between items-start mb-3">
                <div class="text-[0.82rem] text-[var(--muted)]">Last Assessment</div>
                <span class="badge" :style="{ backgroundColor: latestAssessment.status === 'success' ? 'var(--accent)' : latestAssessment.status === 'partial' ? 'var(--warn)' : 'var(--danger)', color: '#fff' }">
                  {{ String(latestAssessment.status || 'unknown').toUpperCase() }}
                </span>
              </div>

              <div class="flex flex-col gap-2 text-[0.85rem]">
                <div class="flex justify-between"><span class="text-[var(--muted)]">When</span><span>{{ latestAssessment.timestamp }}</span></div>
                <div class="flex justify-between"><span class="text-[var(--muted)]">Mode</span><span>{{ latestAssessment.mode }}</span></div>
                <div class="flex justify-between" v-if="latestAssessment.overallScore !== null"><span class="text-[var(--muted)]">Overall</span><span class="text-[var(--accent)] font-semibold">{{ latestAssessment.overallScore }}%</span></div>
                <div class="flex justify-between" v-if="latestAssessment.frontScore !== null"><span class="text-[var(--muted)]">Front</span><span>{{ latestAssessment.frontScore }}%</span></div>
                <div class="flex justify-between" v-if="latestAssessment.sideScore !== null"><span class="text-[var(--muted)]">Side</span><span>{{ latestAssessment.sideScore }}%</span></div>
              </div>

              <button @click="goToAssess" class="btn-calibrate btn-emphasis btn-emphasis-accent text-center mt-4 w-full">
                Open Assess Page
              </button>
            </div>

            <div v-else class="bg-[var(--surface2)] border border-[var(--border)] rounded-xl p-4 text-[0.85rem] text-[var(--muted)] h-full flex flex-col justify-between">
              <div>Complete your first assessment to see latest posture report details here.</div>
              <button @click="goToAssess" class="btn-calibrate btn-emphasis btn-emphasis-accent text-center mt-4 w-full">
                Go to Assess
              </button>
            </div>
          </div>
        </div>

        <div class="card delay-[250ms]">
          <div class="section-header">
            <div>
              <div class="section-title">Progress History</div>
              <p class="text-[0.72rem] text-[var(--muted)] mt-1">Source: Assess page submissions (not live monitoring)</p>
            </div>
            <div class="flex gap-2">
              <span
                @click="selectedTrendPeriod = '7D'"
                class="badge cursor-pointer"
                :class="selectedTrendPeriod === '7D' ? 'badge-green' : 'badge-muted'"
              >7D</span>
              <span
                @click="selectedTrendPeriod = '30D'"
                class="badge cursor-pointer"
                :class="selectedTrendPeriod === '30D' ? 'badge-green' : 'badge-muted'"
              >30D</span>
              <span
                @click="selectedTrendPeriod = '90D'"
                class="badge cursor-pointer"
                :class="selectedTrendPeriod === '90D' ? 'badge-green' : 'badge-muted'"
              >90D</span>
            </div>
          </div>
          <div class="chart-container">
            <canvas id="progressChart"></canvas>
          </div>
        </div>
      </div>

      <div class="right-col dashboard-chat-col">
        <div class="card delay-[300ms] dashboard-chat-card">
          <div class="section-header">
            <div class="section-title">AI Assistant</div>
          </div>

          <div class="mb-3 p-3 text-[0.78rem] rounded-lg border border-[var(--warn)] bg-[rgba(249,115,22,0.08)] text-[var(--muted)]">
            AI tips are for posture and wellbeing support only, not medical diagnosis or treatment.
          </div>

          <div class="chat-wrap chat-wrap-large" id="chatWrap">
            <div v-for="msg in chatMessages" :key="msg.id" :class="['chat-bubble', msg.type]">
              <div>{{ msg.text }}</div>
              <div v-if="msg.type === 'bot' && msg.source" class="chat-source-chip" :class="msg.source === 'gemini' ? 'live' : 'fallback'">
                {{ msg.source === 'gemini' ? 'Live AI' : 'Fallback' }}
              </div>
              <div v-if="msg.youtubeVideos && msg.youtubeVideos.length" class="mt-2 flex flex-col gap-1 text-[0.78rem]">
                <a
                  v-for="video in msg.youtubeVideos.slice(0, 3)"
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

          <div class="chat-input-wrap">
            <textarea
              v-model="chatInput"
              class="chat-input chat-input-large"
              placeholder="Ask Well AI about posture, exercises, desk setup, or wellbeing tips..."
              @keydown="handleChatInputKeydown"
              :disabled="isSendingChat"
            ></textarea>
            <button class="chat-send chat-send-large" @click="sendMessage" :disabled="isSendingChat">
              <span>{{ isSendingChat ? 'Sending' : 'Send' }}</span>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4">
                <path stroke-linecap="round" stroke-linejoin="round" d="m5 12 14-7-3 7 3 7-14-7Z"/>
              </svg>
            </button>
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
