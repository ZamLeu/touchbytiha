/**
 * touchbytiha — Theme Manager
 * Dark / Light mode with system preference detection
 */

const THEME_KEY = 'touchbytiha-theme';

/**
 * Get the current effective theme
 * @returns {'light' | 'dark'}
 */
function getTheme() {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  
  // Fall back to system preference
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Apply theme to the document
 * @param {'light' | 'dark'} theme
 */
function applyTheme(theme) {
  const html = document.documentElement;
  const toggle = document.querySelector('.theme-toggle');
  
  html.setAttribute('data-theme', theme);
  
  if (toggle) {
    toggle.setAttribute('aria-pressed', theme === 'dark');
    toggle.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`);
  }
}

/**
 * Toggle between light and dark themes
 */
function toggleTheme() {
  const current = getTheme();
  const next = current === 'dark' ? 'light' : 'dark';
  localStorage.setItem(THEME_KEY, next);
  applyTheme(next);
}

/**
 * Initialize theme system
 */
export function initTheme() {
  // Apply stored or system theme
  applyTheme(getTheme());
  
  // Toggle button click
  const toggle = document.querySelector('.theme-toggle');
  if (toggle) {
    toggle.addEventListener('click', toggleTheme);
  }
  
  // Listen for system theme changes (but only if user hasn't set a preference)
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem(THEME_KEY)) {
      applyTheme(e.matches ? 'dark' : 'light');
    }
  });
}