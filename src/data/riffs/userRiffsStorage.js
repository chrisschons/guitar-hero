/** @typedef {import('../../types/riff').Riff} Riff */

/**
 * User riffs in localStorage. Merged with built-in riffs for getRiff/list.
 */

const STORAGE_KEY = 'guitar-hero-user-riffs';
const ID_PREFIX = 'user-riff-';

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
  const now = new Date().toISOString();
  const meta = {
    ...riff.metadata,
    modifiedAt: now,
  };
  if (!meta.createdAt) meta.createdAt = now;
  const toSave = { ...riff, metadata: meta };
  const riffs = loadUserRiffs();
  riffs[riff.id] = toSave;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(riffs));
}

/**
 * Delete a user riff from localStorage by id. No-op if the id does not exist
 * or refers to a built-in (non-user) riff.
 * @param {string} id
 */
export function deleteUserRiff(id) {
  if (!id.startsWith(ID_PREFIX)) return;
  const riffs = loadUserRiffs();
  if (!Object.prototype.hasOwnProperty.call(riffs, id)) return;
  delete riffs[id];
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

