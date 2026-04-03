// Progress view: visualizes trend history, period filtering, and summary achievements.
import { checkBackendHealth } from '../services/backendHealth.js';
import { useStatusToast } from '../utils/useStatusToast.js';

export const ProgressView = {
  setup() {
    const { ref, watch, onMounted, onBeforeUnmount, nextTick } = Vue;

    const selectedPeriod = ref('7D');
    const selectedDay = ref(7);
    const chart = ref(null);
    const backendSyncStatus = ref('Syncing progress data...');

    const {
      showToast,
      toastTitle,
      toastMessage,
      showStatusToast,
      hideStatusToast
    } = useStatusToast(6000);

    const weeklyData = ref([
      { id: 1, name: 'Mon', score: 78, hours: '3.2', color: 'var(--warn)' },
      { id: 2, name: 'Tue', score: 82, hours: '4.1', color: 'var(--accent)' },
      { id: 3, name: 'Wed', score: 80, hours: '3.8', color: 'var(--accent)' },
      { id: 4, name: 'Thu', score: 85, hours: '4.5', color: 'var(--accent)' },
      { id: 5, name: 'Fri', score: 81, hours: '3.9', color: 'var(--accent)' },
      { id: 6, name: 'Sat', score: 79, hours: '2.1', color: 'var(--warn)' },
      { id: 7, name: 'Sun', score: 84, hours: '4.3', color: 'var(--accent)' }
    ]);

    const sessionHistory = ref([
      { id: 1, date: 'Today', time: '2:45 PM', score: 84, duration: '2h 45m', quality: 'Excellent', color: 'var(--accent)' },
      { id: 2, date: 'Yesterday', time: '3:30 PM', score: 81, duration: '1h 30m', quality: 'Good', color: 'var(--accent)' },
      { id: 3, date: 'Monday', time: '12:00 PM', score: 78, duration: '3h 15m', quality: 'Good', color: 'var(--accent)' },
      { id: 4, date: 'Sunday', time: '5:00 PM', score: 76, duration: '2h 10m', quality: 'Fair', color: 'var(--warn)' },
      { id: 5, date: 'Saturday', time: '4:20 PM', score: 82, duration: '4h 30m', quality: 'Excellent', color: 'var(--accent)' },
      { id: 6, date: 'Friday', time: '1:10 PM', score: 79, duration: '2h 45m', quality: 'Good', color: 'var(--accent)' }
    ]);

    // Map the selected period to an appropriate summary dataset for chart rendering.
    function getChartData() {
      if (selectedPeriod.value === '7D') {
        return {
          labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
          data: [78, 82, 80, 85, 81, 79, 84]
        };
      }

      if (selectedPeriod.value === '30D') {
        return {
          labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
          data: [75, 78, 82, 81]
        };
      }

      return {
        labels: ['Jan', 'Feb', 'Mar'],
        data: [68, 75, 81]
      };
    }

    // Create or refresh the Chart.js instance whenever the selected period changes.
    function initChart() {
      const canvas = document.getElementById('progressChart');
      if (!canvas || !window.Chart) return;

      const ctx = canvas.getContext('2d');
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
            pointBackgroundColor: '#c8f96a',
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
              min: 60,
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

    // Re-render chart after reactive period updates.
    watch(selectedPeriod, () => {
      nextTick(() => {
        initChart();
      });
    });

    // Load backend sync status, show progress toast, then initialize chart after mount.
    onMounted(async () => {
      backendSyncStatus.value = await checkBackendHealth({
        successMessage: 'Synced with backend',
        unavailableMessage: 'Using local progress data (backend unavailable)'
      });
      showStatusToast('Progress Updated', 'Your session data has been synced and charts updated.');

      nextTick(() => {
        initChart();
      });
    });

    // Release chart resources when leaving the page.
    onBeforeUnmount(() => {
      if (chart.value) {
        chart.value.destroy();
      }
    });

    return {
      selectedPeriod,
      selectedDay,
      showToast,
      toastTitle,
      toastMessage,
      weeklyData,
      sessionHistory,
      backendSyncStatus,
      hideStatusToast
    };
  },
  template: `
    <div class="w-full delay-[50ms]">
      <app-card>
        <div class="flex items-center justify-between">
          <div>
            <h2 class="font-[Syne] text-[1.8rem] font-extrabold mb-2">Your Progress</h2>
            <p class="text-[var(--muted)] text-[0.95rem]">Track your posture improvements over time</p>
            <p class="text-[0.75rem] text-[var(--muted)] mt-2">{{ backendSyncStatus }}</p>
          </div>
          <div class="flex gap-2">
            <span @click="selectedPeriod = '7D'" :class="{['badge-green']: selectedPeriod === '7D', ['badge-muted']: selectedPeriod !== '7D'}" class="badge cursor-pointer">7D</span>
            <span @click="selectedPeriod = '30D'" :class="{['badge-green']: selectedPeriod === '30D', ['badge-muted']: selectedPeriod !== '30D'}" class="badge cursor-pointer">30D</span>
            <span @click="selectedPeriod = '90D'" :class="{['badge-green']: selectedPeriod === '90D', ['badge-muted']: selectedPeriod !== '90D'}" class="badge cursor-pointer">90D</span>
          </div>
        </div>
      </app-card>
    </div>

    <div class="monitoring-grid">
      <div class="flex flex-col gap-5">
        <div class="card delay-[100ms]">
          <div class="section-header">
            <div class="section-title">Posture Score Trend</div>
            <span class="badge badge-green">{{ selectedPeriod }}</span>
          </div>
          <div class="chart-container">
            <canvas id="progressChart"></canvas>
          </div>
        </div>

        <div class="card delay-[150ms]">
          <div class="section-header">
            <div class="section-title">Weekly Breakdown</div>
          </div>

          <div class="grid grid-cols-7 gap-2">
            <div v-for="day in weeklyData" :key="day.id" class="text-center p-3 bg-[var(--surface2)] rounded-lg cursor-pointer border-t-[0.1875rem]" :style="{ borderTopColor: day.color }" @click="selectedDay = day.id">
              <div class="text-[0.75rem] text-[var(--muted)] mb-1">{{ day.name }}</div>
              <div class="text-[1.1rem] font-extrabold" :style="{ color: day.color }">{{ day.score }}%</div>
              <div class="text-[0.65rem] text-[var(--muted)] mt-1">{{ day.hours }}h</div>
            </div>
          </div>
        </div>

        <div class="card delay-[200ms]">
          <div class="section-header">
            <div class="section-title">Session History</div>
            <span class="badge badge-muted">All Time</span>
          </div>

          <div class="grid gap-4 grid-cols-[repeat(auto-fit,minmax(15.625rem,1fr))]">
            <div v-for="session in sessionHistory" :key="session.id" class="p-4 bg-[var(--surface2)] rounded-xl border border-[var(--border)]" :style="{ borderTopColor: session.color, borderTopWidth: '0.1875rem' }">
              <div class="flex justify-between items-start mb-2">
                <div>
                  <div class="font-semibold text-[0.9rem]">{{ session.date }} • {{ session.time }}</div>
                  <div class="text-[0.8rem] text-[var(--muted)]">{{ session.duration }}</div>
                </div>
                <div class="text-[1.3rem] font-extrabold" :style="{ color: session.color }">{{ session.score }}%</div>
              </div>
              <div class="flex justify-between text-[0.75rem] text-[var(--muted)]">
                <span>Duration: {{ session.duration }}</span>
                <span>{{ session.quality }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="right-col">
        <div class="card delay-[100ms]">
          <div class="section-header">
            <div class="section-title">Key Metrics</div>
          </div>

          <div class="flex flex-col gap-4">
            <div class="p-3 bg-[var(--surface2)] rounded-lg border-l-[0.1875rem] border-[var(--accent)]">
              <div class="card-label">Average Score</div>
              <div class="card-value text-2xl text-[var(--accent)]">81%</div>
            </div>

            <div class="p-3 bg-[var(--surface2)] rounded-lg border-l-[0.1875rem] border-[var(--accent2)]">
              <div class="card-label">Total Hours</div>
              <div class="card-value text-2xl text-[var(--accent2)]">48h</div>
            </div>

            <div class="p-3 bg-[var(--surface2)] rounded-lg border-l-[0.1875rem] border-[var(--warn)]">
              <div class="card-label">Improvement</div>
              <div class="card-value text-2xl text-[var(--warn)]">+12%</div>
              <div class="goal-sub">vs last period</div>
            </div>
          </div>
        </div>

        <div class="card delay-[150ms]">
          <div class="section-header">
            <div class="section-title">Achievements</div>
          </div>

          <div class="flex flex-col gap-2.5">
            <div class="flex items-center gap-3 p-3 bg-[var(--surface2)] rounded-lg">
              <div class="text-[1.5rem]"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3s2 2 2 5a3 3 0 0 1-6 0c0-2.5 2-4 2-4s-4 2-4 7a6 6 0 1 0 12 0c0-3-2-5-2-5"/></svg></div>
              <div>
                <div class="font-semibold text-[0.85rem]">7-Day Streak</div>
                <div class="text-[0.7rem] text-[var(--muted)]">Keep it going!</div>
              </div>
            </div>

            <div class="flex items-center gap-3 p-3 bg-[var(--surface2)] rounded-lg">
              <div class="text-[1.5rem]"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" d="M8 5h8v3a4 4 0 0 1-8 0V5Z"/><path stroke-linecap="round" stroke-linejoin="round" d="M16 6h3a2 2 0 0 1-2 2h-1"/><path stroke-linecap="round" stroke-linejoin="round" d="M8 6H5a2 2 0 0 0 2 2h1"/><path stroke-linecap="round" stroke-linejoin="round" d="M12 12v4"/><path stroke-linecap="round" stroke-linejoin="round" d="M9 20h6"/></svg></div>
              <div>
                <div class="font-semibold text-[0.85rem]">80% Milestone</div>
                <div class="text-[0.7rem] text-[var(--muted)]">Great score!</div>
              </div>
            </div>

            <div class="flex items-center gap-3 p-3 bg-[var(--surface2)] rounded-lg opacity-60">
              <div class="text-[1.5rem]"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="w-6 h-6"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1"/></svg></div>
              <div>
                <div class="font-semibold text-[0.85rem]">100-Hour Club</div>
                <div class="text-[0.7rem] text-[var(--muted)]">Coming soon...</div>
              </div>
            </div>
          </div>
        </div>

        <div class="card delay-[200ms]">
          <div class="section-header">
            <div class="section-title">Monthly Goal</div>
          </div>

          <div class="mb-4">
            <div class="flex justify-between mb-2">
              <span class="text-[0.9rem] text-[var(--text)]">Target: 100 hours</span>
              <span class="text-[0.9rem] text-[var(--accent)] font-semibold">48 hours</span>
            </div>
            <div class="posture-bar">
              <div class="posture-bar-fill w-[48%] bg-[linear-gradient(90deg,var(--accent),#d4ff4a)]"></div>
            </div>
            <div class="text-[0.75rem] text-[var(--muted)] mt-2">48% complete • On track</div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showToast" class="alert-toast">
      <div class="toast-header">
        <div class="toast-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16 9 11l3 3 8-8"/><path stroke-linecap="round" stroke-linejoin="round" d="M20 10V6h-4"/></svg></div>
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
