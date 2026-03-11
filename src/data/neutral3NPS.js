/**
 * Neutral 3NPS shapes: key-agnostic patterns.
 * Each shape is 6 strings (0 = high e, 5 = low E), each string has 3 relative fret offsets
 * (0–6) from the position’s starting fret. No key or transposition.
 *
 * Starting frets per key from ref/scale-position-default.txt (major lines 1–13).
 * Position-to-position intervals (frets): 1→2: W(2), 2→3: H(1), 3→4: W(2), 4→5: W(2),
 * 5→6: H(1), 6→7: W(2), 7→1: W(2).
 */

// Shape format: [string0, string1, ..., string5], each string = [offset, offset, offset]
// Derived from C major positions with position start = min fret on low E.
export const NEUTRAL_3NPS_SHAPES = [
  // Position 1
  [
    [2, 4, 5], [2, 4, 5], [1, 2, 4], [1, 2, 4], [0, 2, 4], [0, 2, 4],
  ],
  // Position 2
  [
    [2, 3, 5], [2, 3, 5], [0, 2, 4], [0, 2, 4], [0, 2, 4], [0, 2, 3],
  ],
  // Position 3
  [
    [1, 3, 5], [1, 3, 5], [0, 2, 4], [0, 2, 3], [0, 2, 3], [0, 1, 3],
  ],
  // Position 4
  [
    [2, 4, 6], [2, 4, 5], [1, 3, 4], [1, 2, 4], [1, 2, 4], [0, 2, 4],
  ],
  // Position 5
  [
    [2, 4, 5], [2, 3, 5], [1, 2, 4], [0, 2, 4], [0, 2, 4], [0, 2, 4],
  ],
  // Position 6
  [
    [2, 3, 5], [1, 3, 5], [0, 2, 4], [0, 2, 4], [0, 2, 3], [0, 2, 3],
  ],
  // Position 7
  [
    [1, 3, 5], [1, 3, 5], [0, 2, 3], [0, 2, 3], [0, 1, 3], [0, 1, 3],
  ],
];

// Fret interval from position i to position i+1 (position 7 → position 1: index 6).
// 1→2: 2, 2→3: 1, 3→4: 2, 4→5: 2, 5→6: 1, 6→7: 2, 7→1: 2
export const MAJOR_POSITION_OFFSETS = [2, 2, 1, 2, 2, 2, 1];

// Major: starting position (1–7 → index 0–6) and starting fret per key (pitch class 0–11).
// From ref/scale-position-default.txt lines 1–13
export const MAJOR_START_POSITION_INDEX = {
  0: 2, 1: 2, 2: 1, 3: 1, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0,
};
export const MAJOR_START_FRET = {
  0: 0, 1: 1, 2: 0, 3: 1, 4: 0, 5: 1, 6: 2, 7: 3, 8: 4, 9: 5, 10: 6, 11: 7,
};

/**
 * Convert a neutral shape + starting fret to [stringIndex, fret] notes (0–23).
 */
export function shapeToNotes(shape, startFret) {
  const notes = [];
  for (let stringIndex = 0; stringIndex < 6; stringIndex += 1) {
    const offsets = shape[stringIndex] || [];
    for (let i = 0; i < offsets.length; i += 1) {
      const fret = startFret + offsets[i];
      if (fret >= 0 && fret <= 23) notes.push([stringIndex, fret]);
    }
  }
  return notes;
}

/**
 * Starting fret for the first position (in display order) for major key with given root semitone (0–11).
 */
export function getMajorFirstStartFret(rootSemitone) {
  const pc = ((rootSemitone % 12) + 12) % 12;
  return MAJOR_START_FRET[pc] ?? 0;
}

/**
 * Starting position index (0–6) for major key.
 */
export function getMajorFirstPositionIndex(rootSemitone) {
  const pc = ((rootSemitone % 12) + 12) % 12;
  return MAJOR_START_POSITION_INDEX[pc] ?? 0;
}

/**
 * Starting frets for the first two positions in display order for major.
 * Returns [startFretPos1, startFretPos2].
 */
export function getMajorFirstTwoStartFrets(rootSemitone) {
  const pc = ((rootSemitone % 12) + 12) % 12;
  const posIndex0 = MAJOR_START_POSITION_INDEX[pc] ?? 0;
  const startFret0 = MAJOR_START_FRET[pc] ?? 0;
  const startFret1 = startFret0 + (MAJOR_POSITION_OFFSETS[posIndex0] ?? 0);
  return [startFret0, startFret1];
}

/**
 * Notes for the first two positions (in display order) for major key.
 * Returns [notesPos1, notesPos2], each [stringIndex, fret][].
 */
export function getMajorFirstTwoPositionNotes(rootSemitone) {
  return getMajorFirstNPositionNotes(rootSemitone, 2);
}

/**
 * Notes for the first N positions (in display order) for major key.
 * Uses only the interval array: start at (positionIndex, startFret) for the key,
 * then step through MAJOR_POSITION_OFFSETS for each next position. No manual overrides.
 * Returns array of N note arrays, each [stringIndex, fret][].
 */
export function getMajorFirstNPositionNotes(rootSemitone, n) {
  const pc = ((rootSemitone % 12) + 12) % 12;
  const startIndex = MAJOR_START_POSITION_INDEX[pc] ?? 0;
  let startFret = MAJOR_START_FRET[pc] ?? 0;
  const result = [];
  for (let i = 0; i < n; i += 1) {
    const posIndex = (startIndex + i) % 7;
    const shape = NEUTRAL_3NPS_SHAPES[posIndex];
    result.push(shapeToNotes(shape, startFret));
    startFret += MAJOR_POSITION_OFFSETS[posIndex] ?? 0;
  }
  return result;
}
