// SPA entry point: mounts the shared layout, global UI components, and router.
import { router } from './router.js';
import { AppLayout } from './components/AppLayout.js';
import { AppCard, AppList } from './components/common.js';
import { initAuth } from './services/auth.js';
import { initMonitoringSession } from './services/monitoringSession.js';

const { createApp } = Vue;

// Hydrate mock auth state before mounting so guards/UI read consistent state.
initAuth();
initMonitoringSession();

const app = createApp(AppLayout);
// Register reusable primitives used by multiple route views.
app.component('app-card', AppCard);
app.component('app-list', AppList);
app.use(router);
app.mount('#app');
