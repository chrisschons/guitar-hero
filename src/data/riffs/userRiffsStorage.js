/**
 * User riffs in localStorage. Merged with built-in riffs for getRiff/list.
 */

const STORAGE_KEY = 'guitar-hero-user-riffs';
const ID_PREFIX = 'user-riff-';

/** @typedef {import('./gallops.js').Riff} Riff */

/**
 * @returns {{ [id: string]: Riff }}
 */
export function loadUserRiffs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * @param {Riff} riff
 */
export function saveUserRiff(riff) {
  const riffs = loadUserRiffs();
  riffs[riff.id] = { ...riff };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(riffs));
}

/**
 * Generate a new id for a user riff (not persisted until save).
 * @returns {string}
 */
export function nextUserRiffId() {
  const riffs = loadUserRiffs();
  const ids = Object.keys(riffs);
  let n = 1;
  while (ids.includes(ID_PREFIX + n)) n++;
  return ID_PREFIX + n;
}

/**
 * @returns {string[]} user riff ids only (for ordering / "your riffs")
 */
export function getUserRiffIds() {
  return Object.keys(loadUserRiffs());
}
