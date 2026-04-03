// Shared app shell: navbar, theme toggle, user menu, and route outlet.
import { applyTheme, getSavedTheme, toggleTheme, getThemeIcon } from '../utils/theme.js';
import { useAuth, logout } from '../services/auth.js';
import { useMonitoringSession } from '../services/monitoringSession.js';

export const AppLayout = {
  setup() {
    const { ref, onMounted, onBeforeUnmount } = Vue;
    const { useRoute, useRouter } = VueRouter;

    const route = useRoute();
    const router = useRouter();
    const auth = useAuth();
    const monitoringState = useMonitoringSession();
    const isLoggedIn = Vue.computed(() => Boolean(auth.token));
    const isMonitoringActive = Vue.computed(() => monitoringState.isMonitoring);
    const userDisplayName = Vue.computed(() => auth.user?.name || 'User');
    const menuOpen = ref(false);
    const userMenuRef = ref(null);
    const themeMode = ref(getSavedTheme());

    const links = [
      { name: 'dashboard', label: 'Dashboard', to: '/' },
      { name: 'assess', label: 'Assess', to: '/assess' },
      { name: 'plan', label: 'Plan', to: '/plan' },
      { name: 'monitoring', label: 'Monitoring', to: '/monitoring' },
      { name: 'progress', label: 'Progress', to: '/progress' },
      { name: 'settings', label: 'Settings', to: '/settings' }
    ];

    function isActive(name) {
      return route.name === name;
    }

    function onLogout() {
      logout();
      menuOpen.value = false;
      router.push({ name: 'login' });
    }

    // Keeps theme state reactive while persisting to storage via utility helpers.
    function onThemeToggle() {
      themeMode.value = toggleTheme();
    }

    function closeOnOutsideClick(event) {
      if (!userMenuRef.value) return;
      if (!userMenuRef.value.contains(event.target)) {
        menuOpen.value = false;
      }
    }

    onMounted(() => {
      // Apply saved theme once the shell is mounted and start menu outside-click handling.
      themeMode.value = applyTheme(themeMode.value);
      document.addEventListener('click', closeOnOutsideClick);
    });

    onBeforeUnmount(() => {
      document.removeEventListener('click', closeOnOutsideClick);
    });

    return {
      isLoggedIn,
      isMonitoringActive,
      menuOpen,
      userMenuRef,
      links,
      isActive,
      onThemeToggle,
      onLogout,
      themeMode,
      getThemeIcon,
      userDisplayName
    };
  },
  template: `
    <div>
      <nav>
        <div class="nav-logo">
          <div class="logo-icon">WA</div>
          WELLALIGN
        </div>

        <div class="nav-links">
          <router-link
            v-for="link in links"
            :key="link.name"
            class="nav-link"
            :class="{ active: isActive(link.name) }"
            :to="link.to"
          >
            {{ link.label }}
          </router-link>
        </div>

        <div class="flex items-center gap-3">
          <div class="badge" :class="isMonitoringActive ? 'badge-green' : 'badge-muted'">
            {{ isMonitoringActive ? 'Monitoring ON' : 'Monitoring OFF' }}
          </div>

          <button
            class="theme-toggle-btn"
            id="themeToggle"
            @click="onThemeToggle"
            v-html="getThemeIcon(themeMode)"
            aria-label="Toggle theme"
            title="Toggle theme"
          ></button>

          <router-link
            v-if="!isLoggedIn"
            class="btn-calibrate mt-0 px-4 py-2"
            id="authButton"
            to="/login"
          >
            Login / Sign up
          </router-link>

          <div v-else class="relative" id="userMenu" ref="userMenuRef">
            <div class="avatar cursor-pointer" id="userMenuButton" @click="menuOpen = !menuOpen">{{ userDisplayName }}</div>
            <div
              class="absolute right-0 mt-2 w-36 bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-lg"
              :class="{ hidden: !menuOpen }"
              id="userMenuDropdown"
            >
              <router-link class="block px-4 py-2 text-sm hover:bg-[var(--surface2)]" to="/settings">Profile</router-link>
              <button class="block w-full text-left px-4 py-2 text-sm hover:bg-[var(--surface2)]" @click="onLogout">Logout</button>
            </div>
          </div>
        </div>
      </nav>

      <main class="page-container">
        <router-view v-slot="{ Component }">
          <keep-alive>
            <component :is="Component" />
          </keep-alive>
        </router-view>
      </main>
    </div>
  `
};
