/**
 * Basic demo riffs: single-string patterns for 4/4 and 6/8.
 * 16th-note grid: 4/4 → 16 subdivisions/bar, 6/8 → 16 (from time signature).
 */

/** @typedef {import('../../types/riff').Riff} Riff */

/** 4/4 demo — 16 subdivisions per bar on low E, 2 bars. */
export const demo44Riff = /** @type {Riff} */ ({
  id: 'demo-4-4',
  name: '4/4 single string',
  timeSignature: { num: 4, denom: 4 },
  bpmRange: { min: 60, max: 120 },
  style: 'demo',
  notes: [
    { string: 6, fret: 0, bar: 1, subdivision: 1 }, 
    { string: 6, fret: 0, bar: 1, subdivision: 3 },
    { string: 6, fret: 0, bar: 1, subdivision: 4 },
    { string: 6, fret: 0, bar: 1, subdivision: 5 },
    { string: 6, fret: 0, bar: 1, subdivision: 7 },
    { string: 6, fret: 0, bar: 1, subdivision: 8 },
    { string: 6, fret: 0, bar: 1, subdivision: 9 },
    { string: 6, fret: 0, bar: 1, subdivision: 11 },
    { string: 6, fret: 0, bar: 1, subdivision: 12 },
    { string: 6, fret: 0, bar: 1, subdivision: 13 },
    { string: 6, fret: 0, bar: 1, subdivision: 15 },
    { string: 6, fret: 0, bar: 1, subdivision: 16 },
    { string: 6, fret: 0, bar: 2, subdivision: 1 },
    { string: 6, fret: 0, bar: 2, subdivision: 3 },
    { string: 6, fret: 0, bar: 2, subdivision: 4 },
    { string: 6, fret: 0, bar: 2, subdivision: 5 },
    { string: 6, fret: 0, bar: 2, subdivision: 6 },
    { string: 6, fret: 0, bar: 2, subdivision: 7 },
    { string: 6, fret: 0, bar: 2, subdivision: 8 },
    { string: 6, fret: 0, bar: 2, subdivision: 9 },
    { string: 6, fret: 0, bar: 2, subdivision: 11 },
    { string: 6, fret: 0, bar: 2, subdivision: 13 },
    { string: 6, fret: 0, bar: 2, subdivision: 15 },
 
   

  ],
});

/** 6/8 demo — 16 subdivisions per bar on low E (2 dotted-quarter beats × 8). */
export const demo68Riff = /** @type {Riff} */ ({
  id: 'demo-6-8',
  name: '6/8 single string',
  timeSignature: { num: 6, denom: 8 },
  bpmRange: { min: 60, max: 120 },
  style: 'demo',
  notes: [
    { string: 6, fret: 0, bar: 1, subdivision: 1 },
    { string: 6, fret: 0, bar: 1, subdivision: 3 },
    { string: 6, fret: 0, bar: 1, subdivision: 4 },
    { string: 6, fret: 0, bar: 1, subdivision: 5 },
    { string: 6, fret: 0, bar: 1, subdivision: 7 },
    { string: 6, fret: 0, bar: 1, subdivision: 8 },
    { string: 6, fret: 0, bar: 1, subdivision: 9 },
    { string: 6, fret: 0, bar: 1, subdivision: 11 },
    { string: 6, fret: 0, bar: 1, subdivision: 12 },
    { string: 6, fret: 0, bar: 1, subdivision: 13 },
    { string: 6, fret: 0, bar: 1, subdivision: 15 },
    { string: 6, fret: 0, bar: 1, subdivision: 16 },
    { string: 6, fret: 0, bar: 2, subdivision: 1 },
    { string: 6, fret: 0, bar: 2, subdivision: 5 },
    { string: 6, fret: 0, bar: 2, subdivision: 9 },
    { string: 6, fret: 0, bar: 2, subdivision: 13 },
  ],
});
