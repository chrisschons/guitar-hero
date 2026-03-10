/**
 * Theme: single source of truth for UI colors. Applied to CSS custom properties.
 * Tailwind uses --color-* vars (e.g. bg-bg-primary → --color-bg-primary).
 */

export const defaultTheme = {
  id: 'default',
  bgPrimary: '#1a1a2e',
  bgSecondary: '#16213e',
  bgTertiary: '#0f3460',
  accent: '#e94560',
  accentLight: '#ff5a75',
  textPrimary: '#eeeeee',
  textSecondary: '#aaaaaa',
  string: '#888888',
};

/** Light theme: light backgrounds, dark text */
export const lightTheme = {
  id: 'light',
  bgPrimary: '#f5f5f5',
  bgSecondary: '#e8e8e8',
  bgTertiary: '#d0d0d0',
  accent: '#c41e3a',
  accentLight: '#e94560',
  textPrimary: '#1a1a1a',
  textSecondary: '#555555',
  string: '#666666',
};

/** Dark theme: darker than default */
export const darkTheme = {
  id: 'dark',
  bgPrimary: '#0d0d14',
  bgSecondary: '#12121f',
  bgTertiary: '#1a1a2e',
  accent: '#e94560',
  accentLight: '#ff5a75',
  textPrimary: '#e0e0e0',
  textSecondary: '#9a9a9a',
  string: '#6a6a6a',
};

const VAR_MAP = {
  bgPrimary: '--color-bg-primary',
  bgSecondary: '--color-bg-secondary',
  bgTertiary: '--color-bg-tertiary',
  accent: '--color-accent',
  accentLight: '--color-accent-light',
  textPrimary: '--color-text-primary',
  textSecondary: '--color-text-secondary',
  string: '--color-string',
};

/**
 * Apply theme to document. Sets CSS custom properties on :root.
 * @param {typeof defaultTheme} theme
 */
export function applyTheme(theme) {
  const root = document.documentElement;
  Object.entries(VAR_MAP).forEach(([key, varName]) => {
    const value = theme[key];
    if (value != null) root.style.setProperty(varName, value);
  });
}

/** All themes by id. Add new themes here and persist id in localStorage. */
export const THEMES = {
  default: defaultTheme,
  light: lightTheme,
  dark: darkTheme,
};

const STORAGE_KEY = 'guitar-hero-theme-id';

/** Load theme id from localStorage and apply that theme. Call once at app init. */
export function loadAndApplyTheme() {
  const id = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
  const theme = THEMES[id ?? 'default'] ?? defaultTheme;
  applyTheme(theme);
}

/** Persist theme id to localStorage. Call when user changes theme. */
export function persistThemeId(themeId) {
  if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, themeId);
}
