/**
 * Basic demo riffs: single-string patterns for 4/4 and 6/8.
 * Bar + subdivision only. Default 2 subdivisions per beat (e.g. 4/4 → 8 eighth notes per bar).
 */

/** @typedef {import('./gallops.js').Riff} Riff */

/** 4/4 demo — 8 eighth notes per bar on low E, 2 bars. subdivisionsPerBeat: 2 → 8 subs/bar. */
export const demo44Riff = /** @type {Riff} */ ({
  id: 'demo-4-4',
  name: '4/4 single string',
  timeSignature: { num: 4, denom: 4 },
  bpmRange: { min: 60, max: 120 },
  style: 'demo',
  subdivisionsPerBeat: 4,
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

/** 6/8 demo — six eighth notes per bar on low E, 2 bars. subdivisionsPerBeat: 1 → 6 subs/bar. */
export const demo68Riff = /** @type {Riff} */ ({
  id: 'demo-6-8',
  name: '6/8 single string',
  timeSignature: { num: 6, denom: 8 },
  bpmRange: { min: 60, max: 120 },
  style: 'demo',
  subdivisionsPerBeat: 4,
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
    { string: 6, fret: 0, bar: 1, subdivision: 17 },
    { string: 6, fret: 0, bar: 1, subdivision: 19 },
    { string: 6, fret: 0, bar: 1, subdivision: 20 },
    { string: 6, fret: 0, bar: 1, subdivision: 21 },
    { string: 6, fret: 0, bar: 1, subdivision: 23 },
    { string: 6, fret: 0, bar: 1, subdivision: 24 },


  ],
});
