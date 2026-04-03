// Plan page: presents prescribed exercises, completion tracking, and export actions.
import { checkBackendHealth } from '../services/backendHealth.js';
import { useStatusToast } from '../utils/useStatusToast.js';

export const PlanView = {
  setup() {
    const { ref, computed, onMounted } = Vue;

    const backendStatus = ref('Loading personalized plan...');

    const {
      showToast,
      toastTitle,
      toastMessage,
      showStatusToast,
      hideStatusToast
    } = useStatusToast(3200);

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

    // Drives the "Completed x/y" indicator in the UI.
    const completedCount = computed(() => todaysPlan.value.filter((item) => item.completed).length);

    // Marks tasks done/pending and gives immediate user feedback.
    function toggleTask(task) {
      task.completed = !task.completed;
      const state = task.completed ? 'completed' : 'marked as pending';
      showStatusToast('Plan Updated', `${task.title} ${state}.`);
    }

    function exportPlan() {
      showStatusToast('Export Started', 'Your plan export is being prepared.');
    }

    onMounted(async () => {
      backendStatus.value = await checkBackendHealth({
        successMessage: 'Plan synced',
        unavailableMessage: 'Using local plan template (backend unavailable)',
        countSuffix: 'plan entries available'
      });
    });

    return {
      backendStatus,
      todaysPlan,
      prescribedExercises,
      completedCount,
      showToast,
      toastTitle,
      toastMessage,
      toggleTask,
      exportPlan,
      hideStatusToast
    };
  },
  template: `
    <div class="w-full">
      <app-card>
        <div class="flex items-center justify-between">
          <div>
            <h1 class="font-[Syne] text-[2rem] font-extrabold mb-2">Plan & Recommendations</h1>
            <p class="text-[var(--muted)] text-[0.95rem]">Personalized focus areas from your latest assessment.</p>
            <p class="text-[0.75rem] text-[var(--muted)] mt-2">{{ backendStatus }}</p>
          </div>
          <div class="flex gap-2">
            <a class="btn-calibrate mt-0" href="exercise-search.html">Browse Exercises</a>
            <button class="btn-calibrate mt-0 bg-[var(--surface2)] text-[var(--text)]" @click="exportPlan">Export Plan</button>
          </div>
        </div>
      </app-card>
    </div>

    <div class="monitoring-grid">
      <div class="flex flex-col gap-5">
        <div class="card">
          <div class="section-header">
            <div class="section-title">Today's Plan</div>
            <span class="badge badge-green">20 min</span>
          </div>
          <div class="mb-3 text-[0.85rem] text-[var(--muted)]">Completed: {{ completedCount }}/{{ todaysPlan.length }}</div>
          <div class="flex flex-col gap-3">
            <div
              v-for="item in todaysPlan"
              :key="item.id"
              class="p-3 bg-[var(--surface2)] rounded-lg border border-[var(--border)] cursor-pointer"
              :class="{ 'opacity-70': item.completed }"
              @click="toggleTask(item)"
            >
              <div class="flex justify-between items-center">
                <div class="font-semibold">{{ item.title }}</div>
                <span class="badge" :class="item.completed ? 'badge-green' : 'badge-muted'">{{ item.completed ? 'Done' : item.volume }}</span>
              </div>
              <p class="text-[var(--muted)] text-sm mt-1">{{ item.description }}</p>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="section-header">
            <div class="section-title">Progression</div>
            <span class="badge badge-muted">Week 3</span>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div class="p-3 rounded-lg bg-[var(--surface2)] border border-[var(--border)]">
              <div class="card-label">Focus</div>
              <div class="card-value text-[1.3rem] text-[var(--accent)]">Neck / Thoracic</div>
            </div>
            <div class="p-3 rounded-lg bg-[var(--surface2)] border border-[var(--border)]">
              <div class="card-label">Intensity</div>
              <div class="card-value text-[1.3rem]">Light -> Moderate</div>
            </div>
            <div class="p-3 rounded-lg bg-[var(--surface2)] border border-[var(--border)]">
              <div class="card-label">Next Review</div>
              <div class="card-value text-[1.3rem]">In 5 days</div>
            </div>
          </div>
        </div>
      </div>

      <div class="right-col">
        <app-card title="Prescribed Exercises">
          <app-list :items="prescribedExercises" list-class="flex flex-col gap-2">
            <template #default="{ item: exercise }">
              <div class="flex justify-between items-center p-3 bg-[var(--surface2)] rounded-lg">
                <div>
                  <div class="font-semibold">{{ exercise.name }}</div>
                  <div class="text-sm text-[var(--muted)]">{{ exercise.meta }}</div>
                </div>
                <a class="badge badge-green" href="exercise-search.html">Open</a>
              </div>
            </template>
          </app-list>
        </app-card>

        <div class="card">
          <div class="section-header">
            <div class="section-title">Notes</div>
          </div>
          <p class="text-[var(--muted)] text-sm leading-6">Aim for daily consistency over intensity. If discomfort persists beyond mild soreness, reduce volume and reassess technique. Re-run an assessment after finishing this block.</p>
        </div>
      </div>
    </div>

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
