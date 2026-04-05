// RegisterView - Real backend registration
import { registerBackend, isAuthenticated } from '../services/auth.js';
import { useStatusToast } from '../utils/useStatusToast.js';

export const RegisterView = {
  setup() {
    const { ref, onMounted } = Vue;
    const router = VueRouter.useRouter();

    // Form state
    const name = ref('');
    const email = ref('');
    const password = ref('');
    const confirmPassword = ref('');
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

      if (!name.value.trim()) {
        errors.value.name = 'Name is required';
      } else if (name.value.trim().length < 2) {
        errors.value.name = 'Name must be at least 2 characters';
      }

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

      if (!confirmPassword.value) {
        errors.value.confirmPassword = 'Please confirm your password';
      } else if (confirmPassword.value !== password.value) {
        errors.value.confirmPassword = 'Passwords do not match';
      }

      return Object.keys(errors.value).length === 0;
    }

    // Handle register
    async function handleRegister() {
      if (!validateForm()) {
        showStatusToast('Validation Error', 'Please check your inputs', 'var(--warn)');
        return;
      }

      isLoading.value = true;
      errors.value = {};

      try {
        const result = await registerBackend(name.value.trim(), email.value.trim(), password.value);

        if (result.success) {
          showStatusToast('Registration Successful', 'Redirecting to login...', 'var(--accent)');
          
          // Redirect to login page
          setTimeout(() => {
            router.push('/login');
          }, 1500);
        } else {
          // Handle backend errors
          const errorMsg = result.message || 'Registration failed. Please try again.';
          showStatusToast('Registration Failed', errorMsg, 'var(--danger)');
          
          // Show specific field errors if available
          if (result.errors) {
            errors.value = result.errors;
          }
        }
      } catch (error) {
        console.error('Registration error:', error);
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
        handleRegister();
      }
    }

    return {
      name,
      email,
      password,
      confirmPassword,
      isLoading,
      errors,
      handleRegister,
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
          <h1 class="font-[Syne] text-[2rem] font-extrabold">Create Account</h1>
          <p class="text-[var(--muted)] text-[0.95rem]">Join WellAlign to start your posture journey</p>
        </div>

        <!-- Register Form -->
        <form class="auth-form" @submit.prevent="handleRegister">
          <!-- Name Field -->
          <div class="form-group">
            <label for="name" class="form-label">Full Name</label>
            <input
              id="name"
              v-model="name"
              type="text"
              class="form-input"
              placeholder="John Doe"
              @keypress="handleKeyPress"
              :class="{ 'input-error': errors.name }"
              :disabled="isLoading"
            />
            <div v-if="errors.name" class="form-error">{{ errors.name }}</div>
          </div>

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

          <!-- Confirm Password Field -->
          <div class="form-group">
            <label for="confirmPassword" class="form-label">Confirm Password</label>
            <input
              id="confirmPassword"
              v-model="confirmPassword"
              type="password"
              class="form-input"
              placeholder="••••••••"
              @keypress="handleKeyPress"
              :class="{ 'input-error': errors.confirmPassword }"
              :disabled="isLoading"
            />
            <div v-if="errors.confirmPassword" class="form-error">{{ errors.confirmPassword }}</div>
          </div>

          <!-- Register Button -->
          <button
            type="submit"
            class="btn-auth"
            :disabled="isLoading"
            :class="{ 'opacity-50 cursor-not-allowed': isLoading }"
          >
            {{ isLoading ? 'Creating Account...' : 'Sign Up' }}
          </button>
        </form>

        <!-- Divider -->
        <div class="auth-divider">
          <span>or</span>
        </div>

        <!-- Login Link -->
        <div class="auth-footer">
          <p class="text-[0.9rem]">
            Already have an account?
            <router-link to="/login" class="auth-link">Login here</router-link>
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
