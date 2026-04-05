// Central route registry for the WellAlign SPA.
import { DashboardView } from './views/DashboardView.js';
import { AssessView } from './views/AssessView.js';
import { PlanView } from './views/PlanView.js';
import { MonitoringView } from './views/MonitoringView.js';
import { ProgressView } from './views/ProgressView.js';
import { SettingsView } from './views/SettingsView.js';
import { LoginView } from './views/LoginView.js';
import { RegisterView } from './views/RegisterView.js';
import { NotFoundView } from './views/NotFoundView.js';
import { initAuth, isAuthenticated, logout, getMe } from './services/auth.js';

const { createRouter, createWebHashHistory } = VueRouter;

// Hash routing keeps deployment simple for static hosting environments.
const routes = [
  { path: '/', redirect: '/login', meta: { requiresAuth: false } },
  { path: '/dashboard', name: 'dashboard', component: DashboardView, meta: { requiresAuth: true } },
  { path: '/assess', name: 'assess', component: AssessView, meta: { requiresAuth: true } },
  { path: '/plan', name: 'plan', component: PlanView, meta: { requiresAuth: true } },
  { path: '/monitoring', name: 'monitoring', component: MonitoringView, meta: { requiresAuth: true } },
  { path: '/progress', name: 'progress', component: ProgressView, meta: { requiresAuth: true } },
  { path: '/settings', name: 'settings', component: SettingsView, meta: { requiresAuth: true } },
  { path: '/login', name: 'login', component: LoginView, meta: { guestOnly: true } },
  { path: '/register', name: 'register', component: RegisterView, meta: { guestOnly: true } },
  { path: '/:pathMatch(.*)*', name: 'not-found', component: NotFoundView }
];

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
  // Reset scroll on navigation so each page starts at the top.
  scrollBehavior() {
    return { top: 0 };
  }
});

// Route guard: protects app pages, keeps logged-in users out of login, validates tokens
router.beforeEach(async (to) => {
  initAuth();

  // Try to validate token if we have one
  if (isAuthenticated()) {
    try {
      const result = await getMe();
      if (!result.success) {
        // Token is invalid, clear it
        logout();
      }
    } catch (err) {
      console.error('Token validation failed:', err);
      logout();
    }
  }

  // After validation, check guards
  if (to.meta.requiresAuth && !isAuthenticated()) {
    return {
      name: 'login',
      query: { redirect: to.fullPath }
    };
  }

  if (to.meta.guestOnly && isAuthenticated()) {
    return { name: 'dashboard', params: {} };
  }

  return true;
});
