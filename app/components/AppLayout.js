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
    const userInitials = Vue.computed(() => {
      const name = auth.user?.name || 'U';
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    });
    const menuOpen = ref(false);
    const userMenuRef = ref(null);
    const themeMode = ref(getSavedTheme());

    const links = [
      { name: 'dashboard', label: 'Dashboard', to: '/dashboard' },
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
      userDisplayName,
      userInitials
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
            <button class="user-profile-btn" id="userMenuButton" @click="menuOpen = !menuOpen" :title="userDisplayName">
              <div class="user-avatar">{{ userInitials }}</div>
              <span class="user-name-display">{{ userDisplayName }}</span>
            </button>
            <div
              class="user-dropdown"
              :class="{ hidden: !menuOpen }"
              id="userMenuDropdown"
            >
              <div class="user-dropdown-header">{{ userDisplayName }}</div>
              <router-link class="user-dropdown-item" to="/settings">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.26 2.37 1.806a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.26 3.31-1.806 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.26-2.37-1.806a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.26-3.31 1.806-2.37a1.724 1.724 0 002.572-1.065z"></path></svg>
                Settings
              </router-link>
              <button class="user-dropdown-item" @click="onLogout">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
                Logout
              </button>
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
