/**
 * Scale step patterns (semitone steps between consecutive scale degrees).
 * Engine uses these to generate scales dynamically from any root.
 */

export const SCALE_STEP_PATTERNS = {
  major: [2, 2, 1, 2, 2, 2, 1],
  naturalMinor: [2, 1, 2, 2, 1, 2, 2],
  pentatonicMinor: [3, 2, 2, 3, 2],
  pentatonicMajor: [2, 2, 3, 2, 3],
  blues: [3, 2, 1, 1, 3, 2],
};

/**
 * Convert step pattern to semitone intervals from root.
 * @param {number[]} stepPattern - e.g. [2, 2, 1, 2, 2, 2, 1]
 * @returns {number[]} e.g. [0, 2, 4, 5, 7, 9, 11]
 */
export function stepsToIntervals(stepPattern) {
  const intervals = [0];
  let sum = 0;
  for (let i = 0; i < stepPattern.length - 1; i++) {
    sum += stepPattern[i];
    intervals.push(sum);
  }
  return intervals;
}

/**
 * Build scale as pitch classes from root using a step pattern.
 * @param {number} rootSemitone - 0–11
 * @param {number[]} stepPattern - from SCALE_STEP_PATTERNS
 * @returns {number[]} pitch classes in scale
 */
export function getScaleFromSteps(rootSemitone, stepPattern) {
  const intervals = stepsToIntervals(stepPattern);
  return intervals.map((i) => (rootSemitone + i) % 12);
}

/**
 * Legacy: scale intervals as semitone offsets from root (existing app format).
 * Use for compatibility with getReferenceFullScale and fretboard highlighting.
 */
export const SCALE_INTERVALS = {
  pentatonic: [0, 3, 5, 7, 10],
  blues: [0, 3, 5, 6, 7, 10],
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
};

/**
 * Get scale pitch classes from root using interval set (legacy format).
 * @param {number} rootSemitone - 0–11
 * @param {number[]} intervals - e.g. SCALE_INTERVALS.major
 * @returns {number[]} pitch classes in scale
 */
export function getScale(rootSemitone, intervals) {
  return intervals.map((i) => (rootSemitone + i) % 12);
}
