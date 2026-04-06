// LoginView - Real backend authentication
import { loginBackend, isAuthenticated } from '../services/auth.js';
import { useStatusToast } from '../utils/useStatusToast.js';

export const LoginView = {
  setup() {
    const { ref, onMounted } = Vue;
    const router = VueRouter.useRouter();

    // Form state
    const email = ref('');
    const password = ref('');
    const isLoading = ref(false);
    const errors = ref({});

    const {
      showToast,
      toastTitle,
      toastMessage,
      showStatusToast,
      hideStatusToast
    } = useStatusToast(3500);

    // Redirect if already logged in
    onMounted(() => {
      if (isAuthenticated()) {
        router.push('/dashboard');
      }
    });

    // Validate form
    function validateForm() {
      errors.value = {};

      if (!email.value.trim()) {
        errors.value.email = 'Email is required';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) {
        errors.value.email = 'Please enter a valid email';
      }

      if (!password.value) {
        errors.value.password = 'Password is required';
      } else if (password.value.length < 8) {
        errors.value.password = 'Password must be at least 8 characters';
      }

      return Object.keys(errors.value).length === 0;
    }

    // Handle login
    async function handleLogin() {
      if (!validateForm()) {
        showStatusToast('Validation Error', 'Please check your inputs', 'var(--warn)');
        return;
      }

      isLoading.value = true;
      errors.value = {};

      try {
        const result = await loginBackend(email.value, password.value);

        if (result.success) {
          showStatusToast('Login Successful', `Welcome back, ${result.user.name}!`, 'var(--accent)');
          setTimeout(() => {
            showStatusToast(
              'Wellbeing Guidance Notice',
              'WellAlign provides posture and wellbeing guidance only. Seek medical care for ongoing pain or injuries.',
              'var(--warn)'
            );
          }, 500);
          
          // Redirect to dashboard
          setTimeout(() => {
            router.push('/dashboard');
          }, 1800);
        } else {
          // Handle backend errors
          const errorMsg = result.message || 'Login failed. Please try again.';
          showStatusToast('Login Failed', errorMsg, 'var(--danger)');
          
          // Show specific field errors if available
          if (result.errors) {
            errors.value = result.errors;
          }
        }
      } catch (error) {
        console.error('Login error:', error);
        showStatusToast(
          'Error',
          error.message || 'An unexpected error occurred',
          'var(--danger)'
        );
      } finally {
        isLoading.value = false;
      }
    }

    // Handle Enter key
    function handleKeyPress(event) {
      if (event.key === 'Enter' && !isLoading.value) {
        handleLogin();
      }
    }

    return {
      email,
      password,
      isLoading,
      errors,
      handleLogin,
      handleKeyPress,
      showToast,
      toastTitle,
      toastMessage,
      hideStatusToast
    };
  },
  template: `
    <div class="auth-container">
      <div class="auth-card">
        <div class="auth-header">
          <h1 class="font-[Syne] text-[2rem] font-extrabold">Welcome Back</h1>
          <p class="text-[var(--muted)] text-[0.95rem]">Login to your WellAlign account</p>
        </div>

        <!-- Login Form -->
        <form class="auth-form" @submit.prevent="handleLogin">
          <!-- Email Field -->
          <div class="form-group">
            <label for="email" class="form-label">Email Address</label>
            <input
              id="email"
              v-model="email"
              type="email"
              class="form-input"
              placeholder="you@example.com"
              @keypress="handleKeyPress"
              :class="{ 'input-error': errors.email }"
              :disabled="isLoading"
            />
            <div v-if="errors.email" class="form-error">{{ errors.email }}</div>
          </div>

          <!-- Password Field -->
          <div class="form-group">
            <label for="password" class="form-label">Password</label>
            <input
              id="password"
              v-model="password"
              type="password"
              class="form-input"
              placeholder="••••••••"
              @keypress="handleKeyPress"
              :class="{ 'input-error': errors.password }"
              :disabled="isLoading"
            />
            <div v-if="errors.password" class="form-error">{{ errors.password }}</div>
          </div>

          <!-- Login Button -->
          <button
            type="submit"
            class="btn-auth"
            :disabled="isLoading"
            :class="{ 'opacity-50 cursor-not-allowed': isLoading }"
          >
            {{ isLoading ? 'Logging in...' : 'Login' }}
          </button>
        </form>

        <!-- Divider -->
        <div class="auth-divider">
          <span>or</span>
        </div>

        <!-- Register Link -->
        <div class="auth-footer">
          <p class="text-[0.9rem]">
            Don't have an account?
            <router-link to="/register" class="auth-link">Create one now</router-link>
          </p>
        </div>
      </div>

      <!-- Toast Notification -->
      <div v-if="showToast" class="alert-toast">
        <div class="toast-header">
          <div class="toast-icon">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4">
              <circle cx="12" cy="12" r="9"/>
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 10v6"/>
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 7h.01"/>
            </svg>
          </div>
          <div class="toast-title text-[var(--accent)]">{{ toastTitle }}</div>
        </div>
        <div class="toast-body">
          {{ toastMessage }}
        </div>
        <div class="toast-actions">
          <button class="toast-btn ghost" @click="hideStatusToast">Dismiss</button>
        </div>
      </div>
    </div>
  `
};
