// Assess view: collects front/side uploads and stages posture assessment requests.
import { checkBackendHealth } from '../services/backendHealth.js';
import { useStatusToast } from '../utils/useStatusToast.js';

export const AssessView = {
  setup() {
    const { ref, onMounted } = Vue;

    const backendStatus = ref('Connecting to backend...');
    const frontFileName = ref('');
    const sideFileName = ref('');

    const {
      showToast,
      toastTitle,
      toastMessage,
      showStatusToast,
      hideStatusToast
    } = useStatusToast(3500);

    const recentAssessments = ref([
      { id: 1, timestamp: 'Today, 10:15 AM', mode: 'Front + Side', score: 82, scoreColor: 'var(--accent)' },
      { id: 2, timestamp: 'Mar 28, 5:40 PM', mode: 'Front + Side', score: 80, scoreColor: 'var(--accent2)' }
    ]);

    // Capture selected front-view image metadata and confirm to the user.
    function onFrontFileChange(event) {
      const file = event.target.files && event.target.files[0];
      if (!file) return;
      frontFileName.value = file.name;
      showStatusToast('Front View Uploaded', `Selected: ${file.name}`);
    }

    // Capture selected side-view image metadata and confirm to the user.
    function onSideFileChange(event) {
      const file = event.target.files && event.target.files[0];
      if (!file) return;
      sideFileName.value = file.name;
      showStatusToast('Side View Uploaded', `Selected: ${file.name}`);
    }

    // Validate both uploads before queuing assessment generation.
    function generateAssessment() {
      if (!frontFileName.value || !sideFileName.value) {
        showStatusToast('Upload Required', 'Please upload both front and side images first.', 'var(--warn)');
        return;
      }
      showStatusToast('Assessment Queued', 'Images uploaded. Alignment metrics will be generated shortly.');
    }

    // Resolve backend availability so the UI can explain whether data is local or synced.
    onMounted(async () => {
      backendStatus.value = await checkBackendHealth({
        successMessage: 'Backend connected',
        unavailableMessage: 'Backend unavailable. You can still stage local uploads.',
        countSuffix: 'assessment entries available'
      });
    });

    return {
      backendStatus,
      frontFileName,
      sideFileName,
      recentAssessments,
      showToast,
      toastTitle,
      toastMessage,
      onFrontFileChange,
      onSideFileChange,
      generateAssessment,
      hideStatusToast
    };
  },
  template: `
    <div class="w-full">
      <app-card>
        <div class="flex items-center justify-between">
          <div>
            <h1 class="font-[Syne] text-[2rem] font-extrabold mb-2">Assess Your Posture</h1>
            <p class="text-[var(--muted)] text-[0.95rem]">Upload front and side photos to generate an assessment summary.</p>
            <p class="text-[0.75rem] text-[var(--muted)] mt-2">{{ backendStatus }}</p>
          </div>
          <button class="btn-calibrate min-w-[10rem] mt-0">View History</button>
        </div>
      </app-card>
    </div>

    <div class="monitoring-grid">
      <div class="flex flex-col gap-5">
        <div class="card">
          <div class="section-header">
            <div class="section-title">Upload Images</div>
            <span class="badge badge-muted">Front + Side</span>
          </div>

          <div class="grid gap-4 grid-cols-1 md:grid-cols-2">
            <label class="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface2)] min-h-[200px] flex flex-col items-center justify-center gap-3 cursor-pointer">
              <input class="hidden" type="file" accept="image/png,image/jpeg" @change="onFrontFileChange" />
              <div class="text-3xl"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="w-8 h-8"><path stroke-linecap="round" stroke-linejoin="round" d="M12 16V4"/><path stroke-linecap="round" stroke-linejoin="round" d="m7 9 5-5 5 5"/><path stroke-linecap="round" stroke-linejoin="round" d="M4 18h16"/></svg></div>
              <div class="font-semibold">Front View</div>
              <p class="text-[var(--muted)] text-sm text-center">Drag & drop or click to upload</p>
              <button class="btn-calibrate w-full mt-0" type="button">{{ frontFileName || 'Upload' }}</button>
            </label>

            <label class="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface2)] min-h-[200px] flex flex-col items-center justify-center gap-3 cursor-pointer">
              <input class="hidden" type="file" accept="image/png,image/jpeg" @change="onSideFileChange" />
              <div class="text-3xl"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="w-8 h-8"><path stroke-linecap="round" stroke-linejoin="round" d="M12 16V4"/><path stroke-linecap="round" stroke-linejoin="round" d="m7 9 5-5 5 5"/><path stroke-linecap="round" stroke-linejoin="round" d="M4 18h16"/></svg></div>
              <div class="font-semibold">Side View</div>
              <p class="text-[var(--muted)] text-sm text-center">Drag & drop or click to upload</p>
              <button class="btn-calibrate w-full mt-0" type="button">{{ sideFileName || 'Upload' }}</button>
            </label>
          </div>

          <div class="mt-4 flex flex-wrap gap-2 text-[0.85rem] text-[var(--muted)]">
            <span class="badge badge-muted">PNG/JPG up to 10MB</span>
            <span class="badge badge-muted">Good lighting</span>
            <span class="badge badge-muted">Full body in frame</span>
          </div>

          <div class="mt-4">
            <button class="btn-calibrate w-full mt-0" @click="generateAssessment">Generate Assessment</button>
          </div>
        </div>

        <app-card title="Recent Assessments" badge="Auto-saved" badge-class="badge badge-green">
          <app-list :items="recentAssessments">
            <template #default="{ item }">
              <div class="flex justify-between items-center p-3 bg-[var(--surface2)] rounded-lg">
                <div>
                  <div class="font-semibold">{{ item.timestamp }}</div>
                  <div class="text-sm text-[var(--muted)]">{{ item.mode }}</div>
                </div>
                <div :style="{ color: item.scoreColor }" class="font-bold">Score {{ item.score }}%</div>
              </div>
            </template>
          </app-list>
        </app-card>
      </div>

      <div class="right-col">
        <div class="card">
          <div class="section-header">
            <div class="section-title">Guidelines</div>
          </div>
          <ul class="list-disc pl-5 space-y-2 text-[0.95rem] text-[var(--muted)]">
            <li>Stand neutral with arms relaxed at your sides.</li>
            <li>Place camera at shoulder height; keep feet visible.</li>
            <li>Avoid wide-angle distortion; step back if needed.</li>
            <li>Wear form-fitting clothing for clearer landmarks.</li>
          </ul>
        </div>

        <div class="card">
          <div class="section-header">
            <div class="section-title">Next Steps</div>
          </div>
          <div class="flex flex-col gap-2 text-[0.95rem]">
            <div class="flex items-center gap-2">
              <span class="badge badge-green">1</span>
              <span>Upload both views</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="badge badge-green">2</span>
              <span>Generate alignment metrics</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="badge badge-green">3</span>
              <span>Send to Plan for recommendations</span>
            </div>
          </div>
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
