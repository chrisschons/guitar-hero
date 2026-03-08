/**
 * Fretboard note grid from tuning.
 * No UI; pure data only.
 */

/**
 * Build a grid of pitch classes for the fretboard.
 * @param {number[]} tuning - length 6, semitones from C per open string
 * @param {number} numFrets - e.g. 24
 * @returns {number[][]} grid[stringIndex][fret] = pitch class 0–11 (fret 0 = open)
 */
export function getFretboardNotes(tuning, numFrets = 24) {
  return tuning.map((open) =>
    Array.from({ length: numFrets + 1 }, (_, fret) => (open + fret) % 12)
  );
}
