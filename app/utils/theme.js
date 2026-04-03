// Shared theme utility: applies, persists, and renders icon state for dark/light mode.
const sunIcon = '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0V5a1 1 0 0 1 1-1Zm0 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7-4a1 1 0 0 1 1 1h0a1 1 0 1 1-2 0h0a1 1 0 0 1 1-1ZM4 12a1 1 0 0 1 1-1h0a1 1 0 1 1 0 2h0a1 1 0 0 1-1-1Zm12.95 5.536a1 1 0 0 1 1.415 0h0a1 1 0 0 1-1.414 1.415h0a1 1 0 0 1 0-1.415Zm-9.9 0a1 1 0 0 1 0 1.415h0A1 1 0 1 1 5.64 17.95h0a1 1 0 0 1 1.414 0ZM12 18a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0v-1a1 1 0 0 1 1-1Zm6.364-11.364a1 1 0 0 1 0 1.414h0a1 1 0 1 1-1.414-1.414h0a1 1 0 0 1 1.414 0Zm-12.728 0a1 1 0 0 1 1.414 0h0A1 1 0 1 0 5.636 8.05h0A1 1 0 0 1 4.222 6.636h0a1 1 0 0 1 .414-1.414Z"/></svg>';
const moonIcon = '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M21 13.08A9 9 0 0 1 11.08 3 7 7 0 1 0 21 13.08Z"/></svg>';

// Applies stored preference early to avoid theme flicker on first paint.
export function bootstrapThemeFromStorage() {
  const targets = [document.documentElement, document.body];
  const isLight = localStorage.getItem('wa-theme') === 'light';
  targets.forEach((el) => el && el.classList[isLight ? 'add' : 'remove']('theme-light'));
  return isLight ? 'light' : 'dark';
}

export function applyTheme(mode) {
  const targets = [document.documentElement, document.body];
  const isLight = mode === 'light';
  targets.forEach((el) => el && el.classList[isLight ? 'add' : 'remove']('theme-light'));
  localStorage.setItem('wa-theme', isLight ? 'light' : 'dark');
  return isLight ? 'light' : 'dark';
}

export function getSavedTheme() {
  return localStorage.getItem('wa-theme') === 'light' ? 'light' : 'dark';
}

// Convenience toggle used by the navbar button.
export function toggleTheme() {
  const next = getSavedTheme() === 'light' ? 'dark' : 'light';
  return applyTheme(next);
}

export function getThemeIcon(mode) {
  return mode === 'light' ? sunIcon : moonIcon;
}
