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
