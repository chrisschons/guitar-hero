/**
 * Singleton AudioContext for the app. Lazy-init on first use (respects browser autoplay).
 */

let ctx = null;

/**
 * @returns {AudioContext}
 */
export function getAudioContext() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return ctx;
}

/**
 * Resume if suspended (e.g. after user gesture).
 * @returns {Promise<void>}
 */
export function resumeAudioContext() {
  const context = getAudioContext();
  if (context.state === 'suspended') {
    return context.resume();
  }
  return Promise.resolve();
}
