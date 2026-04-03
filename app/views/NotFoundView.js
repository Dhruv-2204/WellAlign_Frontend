// NotFound view: fallback route for unknown paths in the SPA.
export const NotFoundView = {
  // Keeps navigation recoverable by routing users back to the dashboard.
  template: `
    <div class="w-full">
      <div class="card">
        <h2 class="font-[Syne] text-[1.8rem] font-extrabold mb-2">Page Not Found</h2>
        <p class="text-[var(--muted)] mb-4">The route does not exist in this SPA yet.</p>
        <router-link to="/" class="btn-calibrate mt-0 inline-flex">Back to Dashboard</router-link>
      </div>
    </div>
  `
};
