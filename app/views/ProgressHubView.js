// Progress Hub: combined view showing today's plan and progress tracking in one unified dashboard.
import { checkBackendHealth } from '../services/backendHealth.js';
import { useStatusToast } from '../utils/useStatusToast.js';

export const ProgressHubView = {
  setup() {
    const { ref, watch, computed, onMounted, onBeforeUnmount, nextTick } = Vue;

    const selectedPeriod = ref('7D');
    const chart = ref(null);
    const backendSyncStatus = ref('Syncing data...');

    const {
      showToast,
      toastTitle,
      toastMessage,
      showStatusToast,
      hideStatusToast
    } = useStatusToast(3200);

    // ===== TODAY'S PLAN =====
    const todaysPlan = ref([
      {
        id: 1,
        title: 'Neck flexor activation',
        volume: '3 x 12',
        description: 'Supine chin tucks with 3s holds.',
        completed: false
      },
      {
        id: 2,
        title: 'Thoracic extension',
        volume: '2 x 10',
        description: 'Foam roll mid-back, slow controlled.',
        completed: false
      },
      {
        id: 3,
        title: 'Scapular retraction',
        volume: '3 x 15',
        description: 'Band rows focusing on mid traps.',
        completed: false
      }
    ]);

    const prescribedExercises = ref([
      { id: 1, name: 'Wall slides', meta: 'Mobility · 2 x 12' },
      { id: 2, name: 'Prone Y/T/W', meta: 'Strength · 3 x 10' },
      { id: 3, name: 'Hip flexor stretch', meta: 'Mobility · 2 x 30s' }
    ]);

    // ===== PROGRESS DATA =====
    const weeklyData = ref([
      { id: 1, name: 'Mon', score: 78, hours: '3.2', color: 'var(--warn)', planDone: false },
      { id: 2, name: 'Tue', score: 82, hours: '4.1', color: 'var(--accent)', planDone: true },
      { id: 3, name: 'Wed', score: 80, hours: '3.8', color: 'var(--accent)', planDone: true },
      { id: 4, name: 'Thu', score: 85, hours: '4.5', color: 'var(--accent)', planDone: true },
      { id: 5, name: 'Fri', score: 81, hours: '3.9', color: 'var(--accent)', planDone: false },
      { id: 6, name: 'Sat', score: 79, hours: '2.1', color: 'var(--warn)', planDone: true },
      { id: 7, name: 'Sun', score: 84, hours: '4.3', color: 'var(--accent)', planDone: true }
    ]);

    const sessionHistory = ref([
      { id: 1, date: 'Today', time: '2:45 PM', score: 84, duration: '2h 45m', quality: 'Excellent', color: 'var(--accent)' },
      { id: 2, date: 'Yesterday', time: '3:30 PM', score: 81, duration: '1h 30m', quality: 'Good', color: 'var(--accent)' },
      { id: 3, date: 'Monday', time: '12:00 PM', score: 78, duration: '3h 15m', quality: 'Good', color: 'var(--accent)' }
    ]);

    // ===== COMPUTED PROPERTIES =====
    const completedCount = computed(() => todaysPlan.value.filter((item) => item.completed).length);

    const planAdherenceRate = computed(() => {
      const completed = weeklyData.value.filter(day => day.planDone).length;
      return Math.round((completed / weeklyData.value.length) * 100);
    });

    const averageScore = computed(() => {
      const sum = weeklyData.value.reduce((acc, day) => acc + day.score, 0);
      return Math.round(sum / weeklyData.value.length);
    });

    // ===== METHODS =====
    function toggleTask(task) {
      task.completed = !task.completed;
      const state = task.completed ? 'completed' : 'marked as pending';
      showStatusToast('Plan Updated', `${task.title} ${state}.`);
    }

    function exportPlan() {
      showStatusToast('Export Started', 'Your plan export is being prepared.');
    }

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
      // Plan
      todaysPlan,
      prescribedExercises,
      completedCount,
      toggleTask,
      exportPlan,
      // Progress
      weeklyData,
      sessionHistory,
      backendSyncStatus,
      averageScore,
      planAdherenceRate,
      hideStatusToast
    };
  },
  template: `
    <div class="w-full delay-[50ms]">
      <app-card>
        <div class="flex items-center justify-between">
          <div>
            <h1 class="font-[Syne] text-[2.2rem] font-extrabold mb-2">Progress Hub</h1>
            <p class="text-[var(--muted)] text-[0.95rem]">Your daily plan & posture progress in one view</p>
            <p class="text-[0.75rem] text-[var(--muted)] mt-2">{{ backendSyncStatus }}</p>
          </div>
          <div class="flex gap-2">
            <button class="btn-calibrate mt-0 bg-[var(--surface2)] text-[var(--text)]" @click="exportPlan">Export Plan</button>
          </div>
        </div>
      </app-card>
    </div>

    <!-- TODAY'S PLAN SECTION (TOP PRIORITY) -->
    <div class="card delay-[100ms]">
      <div class="flex items-center justify-between mb-4">
        <div class="section-header flex-1">
          <div class="section-title">📋 Today's Plan</div>
        </div>
        <span class="badge badge-green">{{ completedCount }}/{{ todaysPlan.length }} Complete</span>
      </div>

      <div class="flex flex-col gap-3">
        <div
          v-for="item in todaysPlan"
          :key="item.id"
          class="p-4 bg-[var(--surface2)] rounded-lg border border-[var(--border)] cursor-pointer transition-all hover:border-[var(--accent)]"
          :class="{ 'opacity-60': item.completed }"
          @click="toggleTask(item)"
        >
          <div class="flex justify-between items-start">
            <div class="flex-1">
              <div class="font-semibold text-[0.95rem]" :class="{ 'line-through': item.completed }">{{ item.title }}</div>
              <p class="text-[var(--muted)] text-sm mt-1">{{ item.description }}</p>
            </div>
            <span class="badge ml-3" :class="item.completed ? 'badge-green' : 'badge-muted'">{{ item.completed ? '✓ Done' : item.volume }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- MAIN GRID: PROGRESS + SIDEBAR -->
    <div class="monitoring-grid">
      <div class="flex flex-col gap-5">
        <!-- CHART -->
        <div class="card delay-[150ms]">
          <div class="section-header">
            <div class="section-title">Posture Score Trend</div>
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
            <span class="badge badge-green">{{ planAdherenceRate }}% Plan Done</span>
          </div>

          <div class="grid grid-cols-7 gap-2">
            <div v-for="day in weeklyData" :key="day.id" class="text-center p-3 bg-[var(--surface2)] rounded-lg border" :class="{ 'border-[var(--accent)] border-2': day.planDone }" :style="{ borderTopColor: day.color, borderTopWidth: day.planDone ? '0.1875rem' : '0.1875rem' }">
              <div class="text-[0.7rem] text-[var(--muted)] mb-1">{{ day.name }}</div>
              <div class="text-[1rem] font-extrabold" :style="{ color: day.color }">{{ day.score }}%</div>
              <div class="text-[0.65rem] text-[var(--muted)] mt-1">{{ day.hours }}h</div>
              <div class="text-[1.2rem] mt-1" :class="day.planDone ? 'text-[var(--accent)]' : 'text-[var(--muted)]'">{{ day.planDone ? '✓' : '—' }}</div>
            </div>
          </div>
        </div>

        <!-- SESSION HISTORY (CONDENSED) -->
        <div class="card delay-[250ms]">
          <div class="section-header">
            <div class="section-title">Recent Sessions</div>
            <span class="badge badge-muted">Last 3</span>
          </div>

          <div class="flex flex-col gap-3">
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
              <div class="card-label">Average Score</div>
              <div class="card-value text-2xl text-[var(--accent)]">{{ averageScore }}%</div>
            </div>
            <div class="p-3 bg-[var(--surface2)] rounded-lg border-l-[0.1875rem] border-[var(--warn)]">
              <div class="card-label">Plan Adherence</div>
              <div class="card-value text-2xl text-[var(--warn)]">{{ planAdherenceRate }}%</div>
            </div>
            <div class="p-3 bg-[var(--surface2)] rounded-lg border-l-[0.1875rem] border-[var(--success)]">
              <div class="card-label">Total Hours</div>
              <div class="card-value text-2xl">25.8h</div>
            </div>
          </div>
        </div>

        <!-- PRESCRIBED EXERCISES -->
        <div class="card delay-[200ms]">
          <div class="section-header">
            <div class="section-title">Prescribed Exercises</div>
          </div>

          <div class="flex flex-col gap-3">
            <div v-for="exercise in prescribedExercises" :key="exercise.id" class="p-3 bg-[var(--surface2)] rounded-lg border border-[var(--border)]">
              <div class="font-semibold text-[0.95rem]">{{ exercise.name }}</div>
              <div class="text-sm text-[var(--muted)] mt-1">{{ exercise.meta }}</div>
              <a class="badge badge-green text-[0.75rem] mt-2 inline-block" href="">View</a>
            </div>
          </div>
        </div>

        <!-- PROGRESSION INFO -->
        <div class="card delay-[250ms]">
          <div class="section-header">
            <div class="section-title">Progression</div>
            <span class="badge badge-muted">Week 3</span>
          </div>

          <div class="space-y-3">
            <div class="p-3 rounded-lg bg-[var(--surface2)] border border-[var(--border)]">
              <div class="card-label text-[0.75rem]">Focus Area</div>
              <div class="card-value text-[1.1rem] text-[var(--accent)] mt-1">Neck / Thoracic</div>
            </div>
            <div class="p-3 rounded-lg bg-[var(--surface2)] border border-[var(--border)]">
              <div class="card-label text-[0.75rem]">Intensity</div>
              <div class="card-value text-[1.1rem] mt-1">Light → Moderate</div>
            </div>
            <div class="p-3 rounded-lg bg-[var(--surface2)] border border-[var(--border)]">
              <div class="card-label text-[0.75rem]">Next Review</div>
              <div class="card-value text-[1.1rem] mt-1">In 5 days</div>
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
