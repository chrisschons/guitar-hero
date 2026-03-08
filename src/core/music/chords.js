/**
 * Chord interval structures (semitones from root).
 * Fingering is separate (data/chordShapes or basicChords).
 */

export const CHORD_INTERVALS = {
  major: [0, 4, 7],
  minor: [0, 3, 7],
  seventh: [0, 4, 7, 10],
  min7: [0, 3, 7, 10],
  power: [0, 7],
};

/**
 * Get chord pitch classes from root and interval structure.
 * @param {number} rootSemitone - 0–11
 * @param {number[]} intervals - e.g. CHORD_INTERVALS.major
 * @returns {number[]} pitch classes in chord
 */
export function getChord(rootSemitone, intervals) {
  return intervals.map((i) => (rootSemitone + i) % 12);
}

/**
 * Check if a pitch class is the root of a chord.
 * @param {number} semitone - pitch class at (string, fret)
 * @param {number} rootSemitone - chord root 0–11
 * @returns {boolean}
 */
export function isRootNote(semitone, rootSemitone) {
  return semitone === rootSemitone;
}
