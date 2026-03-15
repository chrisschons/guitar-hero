/**
 * Full app reset: clear all persisted riffs and settings, then reload.
 * Use for "Reset all to default" from Grid Editor or anywhere without App state.
 */

import { clearAllUserRiffs } from './riffs/userRiffsStorage.js';

const SETTINGS_KEYS = [
  'guitar-hero-bpm',
  'guitar-hero-subdivision',
  'guitar-hero-metronome-volume',
  'guitar-hero-root-note',
  'guitar-hero-type',
  'guitar-hero-exercise',
  'guitar-hero-pattern',
  'guitar-hero-tab-scroll',
  'guitar-hero-show-fretboard',
  'guitar-hero-tuning',
  'guitar-hero-time-signature',
  'guitar-hero-theme-id',
  'guitar-hero-count-in',
  'guitar-hero-show-fret-notes',
  'guitar-hero-editor-metronome-volume',
  'guitar-hero-debug-root',
];

/**
 * Clear all user riffs and every known settings key from localStorage, then reload the app.
 * After reload, useLocalStorage hooks will read missing keys and use defaults.
 */
export function resetAppToDefaultsAndReload() {
  clearAllUserRiffs();
  for (const key of SETTINGS_KEYS) {
    try {
      localStorage.removeItem(key);
    } catch (_) {
      // ignore
    }
  }
  window.location.reload();
}
