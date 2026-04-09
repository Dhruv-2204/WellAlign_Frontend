// Progress Hub: combined view showing today's plan and progress tracking in one unified dashboard.
import { checkBackendHealth } from '../services/backendHealth.js';
import { useStatusToast } from '../utils/useStatusToast.js';
import { api } from '../services/api.js';

export const ProgressHubView = {
  setup() {
    const { ref, watch, computed, onMounted, onBeforeUnmount, nextTick } = Vue;

    const selectedPeriod = ref('7D');
    const chart = ref(null);
    const backendSyncStatus = ref('Syncing data...');
    const assessments = ref([]);

    const {
      showToast,
      toastTitle,
      toastMessage,
      showStatusToast,
      hideStatusToast
    } = useStatusToast(3200);

    // ===== PROGRESS DATA (Assessment page source, not live monitoring) =====
    const weeklyData = ref([]);
    const sessionHistory = ref([]);

    // ===== COMPUTED PROPERTIES =====
    const daysRecordedRate = computed(() => {
      if (!weeklyData.value.length) return 0;
      const taken = weeklyData.value.filter((day) => !day.isAbsent).length;
      return Math.round((taken / weeklyData.value.length) * 100);
    });

    const averageRecordedScore = computed(() => {
      const recordedDays = weeklyData.value.filter((day) => !day.isAbsent);
      if (!recordedDays.length) return 0;
      const sum = recordedDays.reduce((acc, day) => acc + day.score, 0);
      return Math.round(sum / recordedDays.length);
    });

    const takenDaysCount = computed(() => weeklyData.value.filter((day) => !day.isAbsent).length);

    function unwrapData(payload) {
      if (!payload || typeof payload !== 'object') return payload;
      if (payload.success && payload.data !== undefined) return payload.data;
      return payload.data !== undefined ? payload.data : payload;
    }

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

    function getSevenDayWindowEndingTomorrow() {
      const tomorrow = new Date();
      tomorrow.setHours(0, 0, 0, 0);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const start = new Date(tomorrow);
      start.setDate(tomorrow.getDate() - 6);

      const days = [];
      for (let i = 0; i < 7; i += 1) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        days.push(d);
      }
      return days;
    }

    function getRollingDays(count) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const days = [];
      for (let i = count - 1; i >= 0; i -= 1) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        days.push(d);
      }
      return days;
    }

    function buildDayScoreRows(days, latestByDay) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);

      return days.map((dateValue, index) => {
        const key = toDayKey(dateValue);
        const latest = latestByDay.get(key);
        const isTomorrow = dateValue.getTime() === tomorrow.getTime();
        const isToday = dateValue.getTime() === today.getTime();
        const isAbsent = !latest;
        const score = latest ? latest.score : 0;

        let statusText = 'Latest score from Assess';
        if (isTomorrow) {
          statusText = 'Upcoming day - posture score not taken yet';
        } else if (isToday && isAbsent) {
          statusText = 'Today - posture score not taken';
        } else if (isAbsent) {
          statusText = 'Absent - posture score not taken';
        }

        return {
          id: index + 1,
          key,
          name: dateValue.toLocaleDateString('en-GB', { weekday: 'short' }),
          shortDate: dateValue.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
          score,
          isAbsent,
          isTomorrow,
          isToday,
          statusText,
          timeText: latest
            ? new Date(latest.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : '--:--',
          color: isAbsent ? 'var(--muted)' : (score >= 75 ? 'var(--accent)' : 'var(--warn)')
        };
      });
    }

    function buildRecentAssessEntries(assessmentRows) {
      const sorted = [...assessmentRows].sort((a, b) => {
        const aTime = new Date(a.createdAt || a.timestamp || 0).getTime();
        const bTime = new Date(b.createdAt || b.timestamp || 0).getTime();
        return bTime - aTime;
      });

      return sorted
        .map((item) => {
          const score = parseScore(item);
          if (score === null) return null;

          const createdAt = new Date(item.createdAt || item.timestamp || Date.now());
          return {
            id: item._id || item.id || createdAt.getTime(),
            date: createdAt.toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'short' }),
            time: createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            score,
            duration: 'Captured from Assess page',
            quality: 'Recorded',
            color: score >= 75 ? 'var(--accent)' : 'var(--warn)'
          };
        })
        .filter(Boolean)
        .slice(0, 3);
    }

    async function loadAssessmentProgress() {
      try {
        const payload = await api.assessments.list();
        const rows = unwrapData(payload);
        assessments.value = Array.isArray(rows) ? rows : [];
      } catch (err) {
        assessments.value = [];
        showStatusToast('Sync Warning', 'Assessment history unavailable. Marking missing days as absent.', 'var(--warn)');
      }

      const latestByDay = makeLatestAssessmentMap(assessments.value);
      // Weekly progress is intentionally sourced from Assess page submissions, not live monitoring sessions.
      weeklyData.value = buildDayScoreRows(getSevenDayWindowEndingTomorrow(), latestByDay);
      sessionHistory.value = buildRecentAssessEntries(assessments.value);
    }

    function getChartData() {
      if (selectedPeriod.value === '7D') {
        const days = weeklyData.value.length ? weeklyData.value : buildDayScoreRows(getSevenDayWindowEndingTomorrow(), new Map());
        return {
          labels: days.map((day) => day.shortDate),
          data: days.map((day) => day.score),
          absent: days.map((day) => day.isAbsent)
        };
      }

      if (selectedPeriod.value === '30D') {
        const latestByDay = makeLatestAssessmentMap(assessments.value);
        const rows30 = buildDayScoreRows(getRollingDays(30), latestByDay);
        return {
          labels: rows30.map((row) => row.shortDate),
          data: rows30.map((row) => row.score),
          absent: rows30.map((row) => row.isAbsent)
        };
      };

      return { labels: [], data: [], absent: [] };
    }

    function initChart() {
      const canvas = document.getElementById('progressChart');
      if (!canvas || !window.Chart) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const gradient = ctx.createLinearGradient(0, 0, 0, 180);
      gradient.addColorStop(0, 'rgba(200, 249, 106, 0.25)');
      gradient.addColorStop(1, 'rgba(200, 249, 106, 0.01)');

      const chartData = getChartData();

      if (chart.value) {
        chart.value.destroy();
      }

      chart.value = new Chart(ctx, {
        type: 'line',
        data: {
          labels: chartData.labels,
          datasets: [{
            label: 'Posture Score',
            data: chartData.data,
            borderColor: '#c8f96a',
            borderWidth: 2.5,
            backgroundColor: gradient,
            fill: true,
            tension: 0.45,
            pointRadius: 4,
            pointBackgroundColor: (ctx) => chartData.absent[ctx.dataIndex] ? '#6b7280' : '#c8f96a',
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
                  const isAbsent = chartData.absent[point.dataIndex];
                  return isAbsent ? 'Absent - posture score not taken' : `Score: ${point.parsed.y}%`;
                }
              }
            }
          },
          scales: {
            x: {
              grid: { color: 'rgba(255,255,255,0.04)' },
              ticks: { color: '#6b7280', font: { family: 'DM Sans', size: 11 } }
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

    watch(selectedPeriod, () => {
      nextTick(() => {
        initChart();
      });
    });

    onMounted(async () => {
      backendSyncStatus.value = await checkBackendHealth({
        successMessage: 'Data synced',
        unavailableMessage: 'Using local data (backend unavailable)'
      });

      await loadAssessmentProgress();

      nextTick(() => {
        initChart();
      });
    });

    onBeforeUnmount(() => {
      if (chart.value) {
        chart.value.destroy();
      }
    });

    return {
      selectedPeriod,
      showToast,
      toastTitle,
      toastMessage,
      // Progress
      weeklyData,
      sessionHistory,
      backendSyncStatus,
      averageRecordedScore,
      daysRecordedRate,
      takenDaysCount,
      hideStatusToast
    };
  },
  template: `
    <div class="w-full delay-[50ms]">
      <app-card>
        <div class="flex items-center justify-between">
          <div>
            <h1 class="font-[Syne] text-[2.2rem] font-extrabold mb-2">Progress Hub</h1>
            <p class="text-[var(--muted)] text-[0.95rem]">Your posture progress in one view</p>
            <p class="text-[0.75rem] text-[var(--muted)] mt-2">{{ backendSyncStatus }}</p>
          </div>

        </div>
      </app-card>
    </div>

    <!-- MAIN GRID: PROGRESS + SIDEBAR -->
    <div class="monitoring-grid">
      <div class="flex flex-col gap-5">
        <!-- CHART -->
        <div class="card delay-[150ms]">
          <div class="section-header">
            <div>
              <div class="section-title">Posture Score Trend</div>
              <p class="text-[0.72rem] text-[var(--muted)] mt-1">Source: Assess page submissions (not live monitoring)</p>
            </div>
            <div class="flex gap-2">
              <span @click="selectedPeriod = '7D'" :class="{['badge-green']: selectedPeriod === '7D', ['badge-muted']: selectedPeriod !== '7D'}" class="badge cursor-pointer">7D</span>
              <span @click="selectedPeriod = '30D'" :class="{['badge-green']: selectedPeriod === '30D', ['badge-muted']: selectedPeriod !== '30D'}" class="badge cursor-pointer">30D</span>
            </div>
          </div>
          <div class="chart-container">
            <canvas id="progressChart"></canvas>
          </div>
        </div>

        <!-- WEEKLY BREAKDOWN WITH PLAN ADHERENCE -->
        <div class="card delay-[200ms]">
          <div class="section-header">
            <div class="section-title">Weekly Breakdown</div>
            <span class="badge badge-green">{{ daysRecordedRate }}% Days Recorded</span>
          </div>

          <div class="grid grid-cols-7 gap-2">
            <div v-for="day in weeklyData" :key="day.id" class="text-center p-3 bg-[var(--surface2)] rounded-lg border" :class="{ 'border-[var(--accent)] border-2': !day.isAbsent }" :style="{ borderTopColor: day.color, borderTopWidth: '0.1875rem' }">
              <div class="text-[0.7rem] text-[var(--muted)] mb-1">{{ day.name }}</div>
              <div class="text-[1rem] font-extrabold" :style="{ color: day.color }">{{ day.score }}%</div>
              <div class="text-[0.65rem] text-[var(--muted)] mt-1">{{ day.statusText }}</div>
              <div class="text-[1.2rem] mt-1" :class="!day.isAbsent ? 'text-[var(--accent)]' : 'text-[var(--muted)]'">{{ !day.isAbsent ? '✓' : 'Absent' }}</div>
            </div>
          </div>
        </div>

        <!-- SESSION HISTORY (CONDENSED) -->
        <div class="card delay-[250ms]">
          <div class="section-header">
            <div class="section-title">Recent Sessions</div>
            <span class="badge badge-muted">Latest existing assessments</span>
          </div>

          <div v-if="sessionHistory.length" class="flex flex-col gap-3">
            <div v-for="session in sessionHistory" :key="session.id" class="p-4 bg-[var(--surface2)] rounded-lg border border-[var(--border)]" :style="{ borderTopColor: session.color, borderTopWidth: '0.1875rem' }">
              <div class="flex justify-between items-start">
                <div>
                  <div class="font-semibold text-[0.9rem]">{{ session.date }} • {{ session.time }}</div>
                  <div class="text-[0.8rem] text-[var(--muted)]">{{ session.duration }}</div>
                </div>
                <div class="flex flex-col items-end">
                  <div class="text-[1.3rem] font-extrabold" :style="{ color: session.color }">{{ session.score }}%</div>
                  <div class="text-[0.75rem] text-[var(--muted)]">{{ session.quality }}</div>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="text-[0.85rem] text-[var(--muted)] p-4 bg-[var(--surface2)] rounded-lg border border-[var(--border)]">
            No assessment sessions recorded yet.
          </div>
        </div>
      </div>

      <!-- RIGHT SIDEBAR -->
      <div class="right-col">
        <!-- KEY METRICS -->
        <div class="card delay-[150ms]">
          <div class="section-header">
            <div class="section-title">Key Metrics</div>
          </div>

          <div class="flex flex-col gap-3">
            <div class="p-3 bg-[var(--surface2)] rounded-lg border-l-[0.1875rem] border-[var(--accent)]">
              <div class="card-label">Average of Recorded Days</div>
              <div class="card-value text-2xl text-[var(--accent)]">{{ averageRecordedScore }}%</div>
            </div>
            <div class="p-3 bg-[var(--surface2)] rounded-lg border-l-[0.1875rem] border-[var(--warn)]">
              <div class="card-label">Coverage</div>
              <div class="card-value text-2xl text-[var(--warn)]">{{ takenDaysCount }}/7</div>
            </div>
          </div>
        </div>


      </div>
    </div>

    <!-- TOAST NOTIFICATION -->
    <div v-if="showToast" class="alert-toast">
      <div class="toast-header">
        <div class="toast-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4"><circle cx="12" cy="12" r="9"/><path stroke-linecap="round" stroke-linejoin="round" d="M12 10v6"/><path stroke-linecap="round" stroke-linejoin="round" d="M12 7h.01"/></svg></div>
        <div class="toast-title text-[var(--accent)]">{{ toastTitle }}</div>
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
