/**
 * Scale position generator.
 *
 * Pentatonic: computed mathematically (pitch-based window).
 * Blues: fixed shape model per minor_blues_shapes_prompt.md.
 *   Each position is a predefined spatial shape anchored on the low string.
 *   The geometry IS the data — shapes are not derived from pentatonic logic.
 */

import { getScale, SCALE_INTERVALS } from './scales.js';

// ---------------------------------------------------------------------------
// Pentatonic — pitch-based window
// ---------------------------------------------------------------------------

/**
 * Pentatonic-style 5-position anchor intervals (semitones from root).
 * Positions are anchored at scale degrees: root(0), b3(3), 4th(5), 5th(7), b7(10).
 */
const PENTA_ANCHORS = [0, 3, 5, 7, 10];

// ---------------------------------------------------------------------------
// Blues — fixed shape model
//
// Each entry:
//   anchorInterval  — semitones above root for the note that appears at
//                     relative fret 0 on the low string (index 5).
//   strings         — relative fret arrays, one per string, ordered
//                     strings[0] = low E (s=5) … strings[5] = high e (s=0).
//
// Source: minor_blues_shapes_prompt.md
// String numbering in that doc: 6=low E … 1=high e  →  strings[i] = s=5-i
// ---------------------------------------------------------------------------

const BLUES_SHAPES = [
  {
    // Position 1 — anchor: root (0 semitones)
    anchorInterval: 0,
    strings: [
      [0, 3],       // s=5  low E  : 1, b3
      [0, 1, 2],    // s=4  A      : 4, b5, 5
      [0, 2],       // s=3  D      : b7, 1
      [0, 2],       // s=2  G      : b3, 4
      [0, 1, 3],    // s=1  B      : 5, b5, b7
      [0, 3],       // s=0  high e : 1, b3
    ],
  },
  {
    // Position 2 — anchor: b3 (3 semitones)
    anchorInterval: 3,
    strings: [
      [0, 2,3],       // s=5  low E
      [-1,  2],   // s=4  A
      [-1, 2],      // s=3  D
      [-1, 0,1],      // s=2  G
      [0, 2],       // s=1  B
      [0, 2,3],       // s=0  high e
    ],
  },
  {
    // Position 3 — anchor: 4th (5 semitones)
    anchorInterval: 5,
    strings: [
      [0, 1,2],       // s=5  low E
      [0, 2],       // s=4  A
      [0, 2, 3],    // s=3  D
      [-1, 2],   // s=2  G
      [0,3],       // s=1  B
      [0,1,2],       // s=0  high e
    ],
  },
  {
    // Position 4 — anchor: b5 (6 semitones)
    anchorInterval: 7,
    strings: [
      [0, 3],       // s=5  low E
      [0,3],   // s=4  A
      [0,1,2],      // s=3  D
      [0,2],      // s=2  G
      [1,3,4],       // s=1  B
      [0,3],       // s=0  high e
    ],
  },
  {
    // Position 5 — anchor: 5th (7 semitones)
    anchorInterval: 10,
    strings: [
      [0,2],       // s=5  low E
      [0,2,3],       // s=4  A
      [-1, 2],   // s=3  D
      [-1, 2],      // s=2  G
      [0,1,2],       // s=1  B
      [0, 2],       // s=0  high e
    ],
  },
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate scale position notes for any root, scale type, tuning, and position index.
 *
 * @param {number} rootSemitone   0–11
 * @param {'pentatonic'|'blues'}  scaleType
 * @param {number} positionIndex  0–4
 * @param {number[]} tuning       length 6, index 0 = high e, index 5 = low string
 * @returns {[number, number][]}  [stringIndex, fret][] low→high string order
 */
export function generateScalePosition(rootSemitone, scaleType, positionIndex, tuning) {
  if (positionIndex < 0 || positionIndex > 4) return [];

  // --- Blues: render fixed shape -------------------------------------------
  if (scaleType === 'blues') {
    const shape = BLUES_SHAPES[positionIndex];
    // Anchor fret = where the anchor interval note falls on the low string.
    // If any shape note would land below fret 0, shift up one octave so the
    // full shape stays on the fretboard without altering the pitch content.
    const anchorNote = (rootSemitone + shape.anchorInterval) % 12;
    const minRelFret = Math.min(...shape.strings.flat());
    let anchorFret = ((anchorNote - tuning[5]) % 12 + 12) % 12;
    if (anchorFret + minRelFret < 1) anchorFret += 12;

    const notes = [];
    for (let i = 0; i < 6; i++) {
      const s = 5 - i; // strings[0]=s=5 (low E) … strings[5]=s=0 (high e)
      for (const relFret of shape.strings[i]) {
        const fret = anchorFret + relFret;
        if (fret <= 24) {
          notes.push([s, fret]);
        }
      }
    }
    return notes;
  }

  // --- Pentatonic: pitch-based window --------------------------------------
  const intervals = SCALE_INTERVALS[scaleType];
  if (!intervals) return [];

  const scalePitches = getScale(rootSemitone, intervals);
  const anchorFret = ((rootSemitone - tuning[5]) % 12 + 12) % 12;
  const posCenter = anchorFret + PENTA_ANCHORS[positionIndex];
  const windowStart = Math.max(0, posCenter - 1);
  const windowEnd = Math.min(24, posCenter + 3);

  const notes = [];
  for (let s = 5; s >= 0; s--) {
    for (let f = windowStart; f <= windowEnd; f++) {
      const pitch = (tuning[s] + f) % 12;
      if (scalePitches.includes(pitch)) {
        notes.push([s, f]);
      }
    }
  }
  return notes;
}
