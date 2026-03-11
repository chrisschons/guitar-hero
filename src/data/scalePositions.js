/**
 * Canonical 3NPS scale positions in C. Used as the single source for major/minor 3NPS
 * across the app (Reference, practice fretboard, tab generation).
 * Format: [stringIndex, fret], 0 = high e, 5 = low E.
 */

import { getNoteAt } from '../core/music';
import { STANDARD_TUNING } from './tunings';
import { getMajorFirstNPositionNotes } from './neutral3NPS';

// —— C major 3NPS (7 positions) ———
// Order: Position 1 .. 7 so positionIndex 0 = Position 1, etc.

const C_MAJOR_POSITION1 = [
  [5, 8], [5, 10], [5, 12], [4, 8], [4, 10], [4, 12], [3, 9], [3, 10], [3, 12],
  [2, 9], [2, 10], [2, 12], [1, 10], [1, 12], [1, 13], [0, 10], [0, 12], [0, 13],
];
const C_MAJOR_POSITION2 = [
  [0, 12], [0, 13], [0, 15], [1, 12], [1, 13], [1, 15], [2, 10], [2, 12], [2, 14],
  [3, 10], [3, 12], [3, 14], [4, 10], [4, 12], [4, 13], [5, 10], [5, 12], [5, 13],
];
const C_MAJOR_POSITION3 = [
  [0, 13], [0, 15], [0, 17], [1, 13], [1, 15], [1, 17], [2, 12], [2, 14], [2, 16],
  [3, 12], [3, 14], [3, 15], [4, 12], [4, 14], [4, 15], [5, 12], [5, 13], [5, 15],
];
const C_MAJOR_POSITION4 = [
  [0, 3], [0, 5], [0, 7], [1, 3], [1, 5], [1, 6], [2, 2], [2, 4], [2, 5],
  [3, 2], [3, 3], [3, 5], [4, 2], [4, 3], [4, 5], [5, 1], [5, 3], [5, 5],
];
const C_MAJOR_POSITION5 = [
  [0, 5], [0, 7], [0, 8], [1, 5], [1, 6], [1, 8], [2, 4], [2, 5], [2, 7],
  [3, 3], [3, 5], [3, 7], [4, 3], [4, 5], [4, 7], [5, 3], [5, 5], [5, 7],
];
const C_MAJOR_POSITION6 = [
  [0, 7], [0, 8], [0, 10], [1, 6], [1, 8], [1, 10], [2, 5], [2, 7], [2, 9],
  [3, 5], [3, 7], [3, 9], [4, 5], [4, 7], [4, 8], [5, 5], [5, 7], [5, 8],
];
const C_MAJOR_POSITION7 = [
  [0, 8], [0, 10], [0, 12], [1, 8], [1, 10], [1, 12], [2, 7], [2, 9], [2, 10],
  [3, 7], [3, 9], [3, 10], [4, 7], [4, 8], [4, 10], [5, 7], [5, 8], [5, 10],
];

/** C major 3NPS: 7 positions, index 0 = Position 1 … index 6 = Position 7. */
export const C_MAJOR_3NPS_POSITIONS = [
  C_MAJOR_POSITION1,
  C_MAJOR_POSITION2,
  C_MAJOR_POSITION3,
  C_MAJOR_POSITION4,
  C_MAJOR_POSITION5,
  C_MAJOR_POSITION6,
  C_MAJOR_POSITION7,
];

// Major start positions from ref/scale-position-default.txt (posX -> index X-1)
// c  pos3 f0, c# pos3 f1, d pos2 f0, d# pos2 f1, e pos1 f0, f pos1 f1,
// f# pos1 f2, g pos1 f3, g# pos1 f4, a pos1 f5, a# pos1 f6, b pos1 f7
const MAJOR_START_INDEX = {
  0: 2, // C (pos3)
  1: 2, // C#
  2: 1, // D (pos2)
  3: 1, // D#
  4: 0, // E (pos1)
  5: 0, // F
  6: 0, // F#
  7: 0, // G
  8: 0, // G#
  9: 0, // A
  10: 0, // A#
  11: 0, // B
};

const MAJOR_START_FRET = {
  0: 0, // C f0
  1: 1, // C# f1
  2: 0, // D f0
  3: 1, // D# f1
  4: 0, // E f0
  5: 1, // F f1
  6: 2, // F# f2
  7: 3, // G f3
  8: 4, // G# f4
  9: 5, // A f5
  10: 6, // A# f6
  11: 7, // B f7
};

// Minor defaults from ref/scale-position-default.txt
// c pos4, c# pos3, d pos2, d# pos2, e pos1, f pos1, f# pos7, g pos7, g# pos6, a pos5, a# pos5, b pos4
const MINOR_START_INDEX = {
  0: 3, // C
  1: 2, // C#
  2: 1, // D
  3: 1, // D#
  4: 0, // E
  5: 0, // F
  6: 6, // F#
  7: 6, // G
  8: 5, // G#
  9: 4, // A
  10: 4, // A#
  11: 3, // B
};

/** Flatten 3rd, 6th, 7th of the scale relative to root (for natural minor). */
function majorToMinor(notes, rootSemitone, tuning = STANDARD_TUNING) {
  return notes.map(([stringIndex, fret]) => {
    const pitch = getNoteAt(stringIndex, fret, tuning);
    const degree = (pitch - rootSemitone + 12) % 12;
    if (degree === 4 || degree === 9 || degree === 11) {
      const newFret = fret === 0 ? 11 : fret - 1;
      return [stringIndex, newFret];
    }
    return [stringIndex, fret];
  });
}

/**
 * Major 3NPS positions for a given root (0–11). Returns 7 positions in display order.
 * Uses neutral shapes + interval array only: start (position, fret) from key, then loop
 * MAJOR_POSITION_OFFSETS for each next position. Single source of truth with neutral3NPS.
 */
export function getMajor3NPSPositions(rootSemitone) {
  return getMajorFirstNPositionNotes(rootSemitone, 7);
}

/**
 * Natural minor 3NPS positions for a given root. Derived from major (b3, b6, b7).
 */
export function getMinor3NPSPositions(rootSemitone, tuning = STANDARD_TUNING) {
  return getMajor3NPSPositions(rootSemitone).map((pos) =>
    majorToMinor(pos, rootSemitone, tuning)
  );
}

/**
 * For a given root and scaleType ('major' | 'minor'), return an ordering of
 * canonical position indices [0–6] such that the first index is the
 * configured starting position for that key (from ref/scale-position-default.txt),
 * and the rest follow in canonical order, wrapping around.
 *
 * Example (major):
 * - E: starting canonical position = 1 (index 0) → [0,1,2,3,4,5,6]
 * - C: starting canonical position = 4 (index 3) → [3,4,5,6,0,1,2]
 */
export function get3NPSStartingOrder(rootSemitone, scaleType = 'major') {
  const pc = ((rootSemitone % 12) + 12) % 12;

  const start =
    scaleType === 'minor'
      ? (MINOR_START_INDEX[pc] ?? 0)
      : (MAJOR_START_INDEX[pc] ?? 0);

  const order = [];
  for (let i = 0; i < 7; i += 1) {
    order.push((start + i) % 7);
  }
  return order;
}
