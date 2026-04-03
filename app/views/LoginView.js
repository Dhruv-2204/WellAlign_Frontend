// Mock login page for previewing route guards and auth-dependent UI.
import { loginMock, useAuth } from '../services/auth.js';

export const LoginView = {
  setup() {
    const { reactive, ref, computed } = Vue;
    const { useRouter, useRoute } = VueRouter;

    const auth = useAuth();
    const router = useRouter();
    const route = useRoute();

    const form = reactive({
      name: 'Demo User',
      email: 'demo@wellalign.app'
    });

    const submitting = ref(false);
    const isLoggedIn = computed(() => Boolean(auth.token));

    async function submitMockLogin() {
      if (!form.email.trim()) return;
      submitting.value = true;

      loginMock({
        name: form.name.trim(),
        email: form.email.trim()
      });

      const redirectTarget = typeof route.query.redirect === 'string' ? route.query.redirect : '/';
      await router.replace(redirectTarget);
      submitting.value = false;
    }

    return {
      form,
      submitting,
      isLoggedIn,
      submitMockLogin
    };
  },
  template: `
    <div class="w-full max-w-[34rem] mx-auto">
      <app-card>
        <h1 class="font-[Syne] text-[2rem] font-extrabold mb-2">Welcome Back</h1>
        <p class="text-[var(--muted)] text-[0.95rem] mb-5">This is a mock auth screen for demo purposes.</p>

        <div v-if="isLoggedIn" class="p-3 rounded-lg border border-[var(--border)] bg-[var(--surface2)] mb-4 text-[0.9rem]">
          You are already signed in.
        </div>

        <form class="flex flex-col gap-3" @submit.prevent="submitMockLogin">
          <div>
            <label class="block text-[0.85rem] text-[var(--muted)] mb-2 font-semibold">Name</label>
            <input v-model="form.name" class="input-field" type="text" placeholder="Your name" />
          </div>

          <div>
            <label class="block text-[0.85rem] text-[var(--muted)] mb-2 font-semibold">Email</label>
            <input v-model="form.email" class="input-field" type="email" placeholder="your@email.com" required />
          </div>

          <button class="btn-calibrate w-full py-3 mt-2" :disabled="submitting">
            {{ submitting ? 'Signing in...' : 'Sign in (Mock)' }}
          </button>
        </form>
      </app-card>
    </div>
  `
};
