// Settings page: account, monitoring preferences, privacy, and system controls.
import { useStatusToast } from '../utils/useStatusToast.js';
import { checkBackendHealth } from '../services/backendHealth.js';
import { api } from '../services/api.js';
import { useAuth, logout, updateAuthUser } from '../services/auth.js';

export const SettingsView = {
  setup() {
    const { reactive, watch, ref, onMounted } = Vue;
    const auth = useAuth();
    const backendStatus = ref('Checking sync status...');
    const isSaving = ref(false);
    const isChangingPassword = ref(false);
    const isDeletingAccount = ref(false);
    const suppressAutoSave = ref(false);
    let saveTimer = null;

    const {
      showToast,
      toastTitle,
      toastMessage,
      showStatusToast,
      hideStatusToast
    } = useStatusToast(3000);

    const settings = reactive({
      fullName: '',
      email: '',
      alerts: true,
      sound: false,
      cameraPrivacy: true
    });

    const passwordForm = reactive({
      oldPassword: '',
      newPassword: '',
      confirmNewPassword: ''
    });

    function unwrapData(response) {
      if (!response || typeof response !== 'object') return response;
      if (response.success && response.data !== undefined) return response.data;
      return response.data !== undefined ? response.data : response;
    }

    async function loadSettings() {
      try {
        let me = {};
        try {
          const meResponse = await api.account.getMe();
          me = unwrapData(meResponse) || {};
        } catch (meErr) {
          // Fallback to auth state when profile endpoint is unavailable.
          me = auth.user || {};
        }

        suppressAutoSave.value = true;
        settings.fullName = me.name || auth.user?.name || 'User';
        settings.email = me.email || auth.user?.email || '';

        try {
          const prefResponse = await api.account.getSettings();
          const pref = unwrapData(prefResponse) || {};
          settings.alerts = pref.alerts ?? settings.alerts;
          settings.sound = pref.sound ?? settings.sound;
          settings.cameraPrivacy = pref.cameraPrivacy ?? settings.cameraPrivacy;
        } catch (prefErr) {
          // Keep defaults if settings endpoint is unavailable.
          console.warn('Settings endpoint unavailable, using defaults:', prefErr);
        }
      } catch (err) {
        showStatusToast('Load Failed', 'Unable to load settings from backend.');
      } finally {
        setTimeout(() => {
          suppressAutoSave.value = false;
        }, 0);
      }
    }

    async function persistSettings() {
      if (isSaving.value) return;
      isSaving.value = true;
      try {
        const profilePayload = {
          name: settings.fullName,
          email: settings.email
        };
        let profileSaved = false;
        let preferencesSaved = false;

        try {
          await api.account.updateProfile(profilePayload);
          updateAuthUser({ name: settings.fullName, email: settings.email });
          profileSaved = true;
        } catch (profileErr) {
          // Keep going so preference save can still succeed.
          profileSaved = false;
        }

        try {
          await api.account.updateSettings({
            alerts: settings.alerts,
            sound: settings.sound,
            cameraPrivacy: settings.cameraPrivacy
          });
          preferencesSaved = true;
        } catch (prefErr) {
          preferencesSaved = false;
        }

        if (profileSaved || preferencesSaved) {
          showStatusToast('Settings Saved', 'Your preferences have been updated successfully.');
        } else {
          showStatusToast('Save Failed', 'Backend routes for settings/profile are not available.');
        }
      } catch (err) {
        showStatusToast('Save Failed', 'Could not save settings to backend.');
      } finally {
        isSaving.value = false;
      }
    }

    async function changePassword() {
      const oldPassword = String(passwordForm.oldPassword || '').trim();
      const newPassword = String(passwordForm.newPassword || '').trim();
      const confirmPassword = String(passwordForm.confirmNewPassword || '').trim();

      if (!oldPassword || !newPassword || !confirmPassword) {
        showStatusToast('Missing Fields', 'Enter your current and new password.');
        return;
      }
      if (newPassword.length < 8) {
        showStatusToast('Weak Password', 'New password must be at least 8 characters.');
        return;
      }
      if (newPassword !== confirmPassword) {
        showStatusToast('Mismatch', 'New password and confirmation do not match.');
        return;
      }

      isChangingPassword.value = true;
      try {
        await api.account.changePassword(oldPassword, newPassword);
        passwordForm.oldPassword = '';
        passwordForm.newPassword = '';
        passwordForm.confirmNewPassword = '';
        showStatusToast('Password Updated', 'Your password has been changed.');
      } catch (err) {
        if (err?.status === 404) {
          showStatusToast('Password Change Unavailable', 'Backend does not expose a password-change route yet.');
        } else {
          showStatusToast('Password Change Failed', 'Current password may be incorrect.');
        }
      } finally {
        isChangingPassword.value = false;
      }
    }

    async function deleteAccount() {
      const confirmed = window.confirm('This will permanently delete your account and data. Continue?');
      if (!confirmed) return;

      isDeletingAccount.value = true;
      try {
        await api.account.deleteAccount();
        logout();
        showStatusToast('Account Deleted', 'Your account has been removed.');
        setTimeout(() => {
          window.location.hash = '#/login';
        }, 350);
      } catch (err) {
        if (err?.status === 404) {
          showStatusToast('Delete Unavailable', 'Backend does not expose an account-delete route yet.');
        } else {
          showStatusToast('Delete Failed', 'Unable to delete account at this time.');
        }
      } finally {
        isDeletingAccount.value = false;
      }
    }

    // Debounced backend save for any settings/profile changes.
    watch(
      settings,
      () => {
        if (suppressAutoSave.value) return;
        if (saveTimer) {
          clearTimeout(saveTimer);
        }
        saveTimer = setTimeout(() => {
          persistSettings();
        }, 450);
      },
      { deep: true }
    );

    onMounted(async () => {
      // Shows whether sync is available while keeping local-first behavior.
      backendStatus.value = await checkBackendHealth({
        successMessage: 'Settings profile synced',
        unavailableMessage: 'Settings are saved locally (backend unavailable)'
      });

      await loadSettings();
    });

    return {
      backendStatus,
      settings,
      passwordForm,
      isSaving,
      isChangingPassword,
      isDeletingAccount,
      showToast,
      toastTitle,
      toastMessage,
      changePassword,
      deleteAccount,
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

    <div class="monitoring-grid settings-grid">
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
            <input v-model="passwordForm.oldPassword" type="password" class="input-field mb-2" placeholder="Current password" />
            <input v-model="passwordForm.newPassword" type="password" class="input-field mb-2" placeholder="New password" />
            <input v-model="passwordForm.confirmNewPassword" type="password" class="input-field mb-2" placeholder="Confirm new password" />
            <button class="btn-calibrate w-full py-3 mt-0" :disabled="isChangingPassword" @click="changePassword">
              {{ isChangingPassword ? 'Updating Password...' : 'Change Password' }}
            </button>
          </div>

          <div class="text-[0.75rem] text-[var(--muted)]" v-if="isSaving">Saving settings...</div>
        </div>

        <div class="card delay-[150ms]">
          <div class="section-header mb-5">
            <div class="section-title">Monitoring</div>
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


        </div>

        <div class="card delay-[200ms]">
          <div class="section-header mb-5">
            <div class="section-title">Privacy & Data</div>
          </div>


          <div class="setting-item mb-4">
            <div>
              <div class="font-semibold mb-1">Camera Privacy</div>
              <div class="text-[0.8rem] text-[var(--muted)]">Store camera data locally only</div>
            </div>
            <div :class="['toggle-switch', { active: settings.cameraPrivacy }]" @click="settings.cameraPrivacy = !settings.cameraPrivacy"></div>
          </div>

          <button class="btn-calibrate w-full py-3 mb-3 mt-0">Download My Data</button>
          <button
            class="btn-calibrate w-full py-3 border-[var(--danger)] text-[var(--danger)] mt-0"
            :disabled="isDeletingAccount"
            @click="deleteAccount"
          >
            {{ isDeletingAccount ? 'Deleting Account...' : 'Delete Account' }}
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
