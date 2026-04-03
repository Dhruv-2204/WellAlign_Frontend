// Settings page: account, monitoring preferences, privacy, and system controls.
import { useStatusToast } from '../utils/useStatusToast.js';
import { checkBackendHealth } from '../services/backendHealth.js';

export const SettingsView = {
  setup() {
    const { reactive, watch, ref, onMounted } = Vue;
    const backendStatus = ref('Checking sync status...');
    const {
      showToast,
      toastTitle,
      toastMessage,
      showStatusToast,
      hideStatusToast
    } = useStatusToast(3000);

    const settings = reactive({
      fullName: 'Drew',
      email: 'drew@example.com',
      autoStart: true,
      alerts: true,
      sound: false,
      sensitivity: 'normal',
      frequency: 'normal',
      analytics: true,
      cameraPrivacy: true,
      autoUpdate: true
    });

    // Any preference change triggers a lightweight "saved" confirmation toast.
    watch(
      settings,
      () => {
        showStatusToast('Settings Saved', 'Your preferences have been updated successfully.');
      },
      { deep: true }
    );

    onMounted(async () => {
      // Shows whether sync is available while keeping local-first behavior.
      backendStatus.value = await checkBackendHealth({
        successMessage: 'Settings profile synced',
        unavailableMessage: 'Settings are saved locally (backend unavailable)'
      });
    });

    return {
      backendStatus,
      settings,
      showToast,
      toastTitle,
      toastMessage,
      hideStatusToast
    };
  },
  template: `
    <div class="w-full delay-[50ms]">
      <app-card>
        <h2 class="font-[Syne] text-[1.8rem] font-extrabold mb-2">Settings</h2>
        <p class="text-[var(--muted)] text-[0.95rem]">Manage your account and preferences</p>
        <p class="text-[0.75rem] text-[var(--muted)] mt-2">{{ backendStatus }}</p>
      </app-card>
    </div>

    <div class="monitoring-grid">
      <div class="flex flex-col gap-5">
        <div class="card delay-[100ms]">
          <div class="section-header mb-5">
            <div class="section-title">Account</div>
          </div>

          <div class="mb-4">
            <label class="block text-[0.85rem] text-[var(--muted)] mb-2 font-semibold">Full Name</label>
            <input v-model="settings.fullName" type="text" class="input-field" placeholder="Enter your full name" />
          </div>

          <div class="mb-4">
            <label class="block text-[0.85rem] text-[var(--muted)] mb-2 font-semibold">Email</label>
            <input v-model="settings.email" type="email" class="input-field" placeholder="Enter your email" />
          </div>

          <div class="mb-4">
            <label class="block text-[0.85rem] text-[var(--muted)] mb-2 font-semibold">Password</label>
            <button class="btn-calibrate w-full py-3 mt-0">Change Password</button>
          </div>
        </div>

        <div class="card delay-[150ms]">
          <div class="section-header mb-5">
            <div class="section-title">Monitoring</div>
          </div>

          <div class="setting-item">
            <div>
              <div class="font-semibold mb-1">Auto-start Session</div>
              <div class="text-[0.8rem] text-[var(--muted)]">Automatically start monitoring on launch</div>
            </div>
            <div :class="['toggle-switch', { active: settings.autoStart }]" @click="settings.autoStart = !settings.autoStart"></div>
          </div>

          <div class="setting-item">
            <div>
              <div class="font-semibold mb-1">Alert Notifications</div>
              <div class="text-[0.8rem] text-[var(--muted)]">Receive posture alerts during sessions</div>
            </div>
            <div :class="['toggle-switch', { active: settings.alerts }]" @click="settings.alerts = !settings.alerts"></div>
          </div>

          <div class="setting-item">
            <div>
              <div class="font-semibold mb-1">Sound Effects</div>
              <div class="text-[0.8rem] text-[var(--muted)]">Play sound on alerts and milestones</div>
            </div>
            <div :class="['toggle-switch', { active: settings.sound }]" @click="settings.sound = !settings.sound"></div>
          </div>

          <div class="mt-4">
            <label class="block text-[0.85rem] text-[var(--muted)] mb-2 font-semibold">Alert Sensitivity</label>
            <select v-model="settings.sensitivity" class="select-field">
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
            </select>
          </div>

          <div>
            <label class="block text-[0.85rem] text-[var(--muted)] mb-2 font-semibold">Check Frequency</label>
            <select v-model="settings.frequency" class="select-field">
              <option value="low">Every 30 seconds</option>
              <option value="normal">Every 15 seconds</option>
              <option value="high">Every 5 seconds</option>
            </select>
          </div>
        </div>

        <div class="card delay-[200ms]">
          <div class="section-header mb-5">
            <div class="section-title">Privacy & Data</div>
          </div>

          <div class="setting-item">
            <div>
              <div class="font-semibold mb-1">Data Analytics</div>
              <div class="text-[0.8rem] text-[var(--muted)]">Help improve posture detection with usage data</div>
            </div>
            <div :class="['toggle-switch', { active: settings.analytics }]" @click="settings.analytics = !settings.analytics"></div>
          </div>

          <div class="setting-item mb-4">
            <div>
              <div class="font-semibold mb-1">Camera Privacy</div>
              <div class="text-[0.8rem] text-[var(--muted)]">Store camera data locally only</div>
            </div>
            <div :class="['toggle-switch', { active: settings.cameraPrivacy }]" @click="settings.cameraPrivacy = !settings.cameraPrivacy"></div>
          </div>

          <button class="btn-calibrate w-full py-3 mb-3 mt-0">Download My Data</button>
          <button class="btn-calibrate w-full py-3 border-[var(--danger)] text-[var(--danger)] mt-0">Delete Account</button>
        </div>
      </div>

      <div class="right-col">
        <div class="card delay-[200ms]">
          <div class="section-header mb-5">
            <div class="section-title">System</div>
          </div>

          <div class="setting-item mb-4">
            <div>
              <div class="font-semibold mb-1">Auto Update</div>
              <div class="text-[0.8rem] text-[var(--muted)]">Check for updates automatically</div>
            </div>
            <div :class="['toggle-switch', { active: settings.autoUpdate }]" @click="settings.autoUpdate = !settings.autoUpdate"></div>
          </div>

          <button class="btn-calibrate w-full py-3 mb-3 mt-0">Check for Updates</button>
          <div class="text-[0.8rem] text-[var(--muted)] p-3 bg-[var(--surface2)] rounded-lg">
            <div>Current Version: 1.2.3</div>
            <div>Last Updated: Mar 5, 2026</div>
          </div>
        </div>

        <div class="card delay-[250ms]">
          <div class="section-header mb-5">
            <div class="section-title">Help & Support</div>
          </div>

          <button class="btn-calibrate w-full py-3 mb-3 mt-0 text-left inline-flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.5 3.5 10 12 13.5 20.5 10 12 6.5Z"/><path stroke-linecap="round" stroke-linejoin="round" d="M7 12.2V16c0 .8 2.2 2 5 2s5-1.2 5-2v-3.8"/></svg>
            <span>User Guide</span>
          </button>
          <button class="btn-calibrate w-full py-3 mb-3 text-left inline-flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16v12H4z"/><path stroke-linecap="round" stroke-linejoin="round" d="m4 7 8 6 8-6"/></svg>
            <span>Contact Support</span>
          </button>
          <button class="btn-calibrate w-full py-3 text-left inline-flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="m8 8 8 8"/><path stroke-linecap="round" stroke-linejoin="round" d="m16 8-8 8"/><path stroke-linecap="round" stroke-linejoin="round" d="M9.5 19H7a2 2 0 0 1-2-2v-2.5"/><path stroke-linecap="round" stroke-linejoin="round" d="M14.5 5H17a2 2 0 0 1 2 2v2.5"/></svg>
            <span>Report Issue</span>
          </button>
        </div>
      </div>
    </div>

    <div v-if="showToast" class="alert-toast">
      <div class="toast-header">
        <div class="toast-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="m5 13 4 4L19 7"/></svg></div>
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
