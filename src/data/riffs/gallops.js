/**
 * Riff definitions: note-event format for conversion to tab.
 *
 * Each note: { string, fret, bar, subdivision } — all 1-based for editing. No "beat"; subdivision is the slot within the bar.
 * - string: 1 = high e, 6 = low E.
 * - bar: 1-based bar number.
 * - subdivision: 1-based slot within the bar (1 to subdivisionsPerBar). subdivisionsPerBar = timeSignature.num * (subdivisionsPerBeat ?? 4).
 *   E.g. 4/4 with default 4 subs/beat → 16 subs/bar: full bar of 16ths = sub 1–16, full bar of 8ths = sub 1,3,5,7,9,11,13,15.
 * - subdivisionsPerBeat: optional, default 4. Only set for simpler (e.g. 2) or more complex (e.g. 12) grids.
 *
 * slot (0-based) = (bar - 1) * subdivisionsPerBar + (subdivision - 1).
 */

/** @typedef {{ string: number, fret: number, bar: number, subdivision: number, duration?: number }} RiffNote */
/** @typedef {{ num: number, denom: number }} TimeSignature */
/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   timeSignature: TimeSignature,
 *   bpmRange: { min: number, max: number },
 *   notes: RiffNote[],
 *   style: string,
 *   subdivisionsPerBeat?: number
 * }} Riff
 */

/** Demo: 4 bars — whole note, eighth notes, triplets, 16th notes (1 bar each). 12 subs/beat → 48 subs/bar. */
export const subdivisionDemoRiff = /** @type {Riff} */ ({
  id: 'subdivision-demo',
  name: 'Subdivision demo (whole, 8th, triplet, 16th)',
  timeSignature: { num: 4, denom: 4 },
  bpmRange: { min: 60, max: 100 },
  style: 'gallop',
  subdivisionsPerBeat: 12,
  notes: [
    // Bar 1: whole note — sub 1
    { string: 6, fret: 0, bar: 1, subdivision: 1 },

    // Bar 2: eighth notes — subs 1, 7, 13, 19, 25, 31, 37, 43
    { string: 6, fret: 0, bar: 2, subdivision: 1 },
    { string: 6, fret: 0, bar: 2, subdivision: 7 },
    { string: 6, fret: 0, bar: 2, subdivision: 13 },
    { string: 6, fret: 0, bar: 2, subdivision: 19 },
    { string: 6, fret: 0, bar: 2, subdivision: 25 },
    { string: 6, fret: 0, bar: 2, subdivision: 31 },
    { string: 6, fret: 0, bar: 2, subdivision: 37 },
    { string: 6, fret: 0, bar: 2, subdivision: 43 },

    // Bar 3: triplets — 12 notes at 1,5,9, 13,17,21, 25,29,33, 37,41,45
    { string: 6, fret: 0, bar: 3, subdivision: 1 },
    { string: 6, fret: 0, bar: 3, subdivision: 5 },
    { string: 6, fret: 0, bar: 3, subdivision: 9 },
    { string: 6, fret: 0, bar: 3, subdivision: 13 },
    { string: 6, fret: 0, bar: 3, subdivision: 17 },
    { string: 6, fret: 0, bar: 3, subdivision: 21 },
    { string: 6, fret: 0, bar: 3, subdivision: 25 },
    { string: 6, fret: 0, bar: 3, subdivision: 29 },
    { string: 6, fret: 0, bar: 3, subdivision: 33 },
    { string: 6, fret: 0, bar: 3, subdivision: 37 },
    { string: 6, fret: 0, bar: 3, subdivision: 41 },
    { string: 6, fret: 0, bar: 3, subdivision: 45 },

    // Bar 4: 16th notes — subs 1–46 step 3 (1,4,7,...,46)
    { string: 6, fret: 0, bar: 4, subdivision: 1 },
    { string: 6, fret: 0, bar: 4, subdivision: 4 },
    { string: 6, fret: 0, bar: 4, subdivision: 7 },
    { string: 6, fret: 0, bar: 4, subdivision: 10 },
    { string: 6, fret: 0, bar: 4, subdivision: 13 },
    { string: 6, fret: 0, bar: 4, subdivision: 16 },
    { string: 6, fret: 0, bar: 4, subdivision: 19 },
    { string: 6, fret: 0, bar: 4, subdivision: 22 },
    { string: 6, fret: 0, bar: 4, subdivision: 25 },
    { string: 6, fret: 0, bar: 4, subdivision: 28 },
    { string: 6, fret: 0, bar: 4, subdivision: 31 },
    { string: 6, fret: 0, bar: 4, subdivision: 34 },
    { string: 6, fret: 0, bar: 4, subdivision: 37 },
    { string: 6, fret: 0, bar: 4, subdivision: 40 },
    { string: 6, fret: 0, bar: 4, subdivision: 43 },
    { string: 6, fret: 0, bar: 4, subdivision: 46 },
  ],
});

/** Simple gallop (eighth-note pattern on one chord). 4 subs/beat → 16/bar; 8ths at 1,3,5,7,9,11,13,15 for first two beats. */
export const gallopRiff = /** @type {Riff} */ ({
  id: 'gallop-simple',
  name: 'Simple Gallop',
  timeSignature: { num: 4, denom: 4 },
  bpmRange: { min: 90, max: 140 },
  style: 'gallop',
  subdivisionsPerBeat: 4,
  notes: [
    { string: 6, fret: 0, bar: 1, subdivision: 1 },
    { string: 6, fret: 0, bar: 1, subdivision: 2 },
    { string: 6, fret: 0, bar: 1, subdivision: 3 },
    { string: 6, fret: 0, bar: 1, subdivision: 4 },
    { string: 6, fret: 0, bar: 1, subdivision: 5 },
    { string: 6, fret: 0, bar: 1, subdivision: 6 },
    { string: 6, fret: 0, bar: 1, subdivision: 7 },
    { string: 6, fret: 0, bar: 1, subdivision: 8 },
  ],
});

/** Single-note alternate picking (pentatonic-style). Default 4 subs/beat → 8ths at 1,3,5,7,9,11,13,15. */
export const alternatePickingRiff = /** @type {Riff} */ ({
  id: 'alt-pick-1',
  name: 'Alternate Picking (A minor pentatonic)',
  timeSignature: { num: 4, denom: 4 },
  bpmRange: { min: 80, max: 120 },
  style: 'alternatePicking',
  notes: [
    { string: 6, fret: 5, bar: 1, subdivision: 1 },
    { string: 6, fret: 8, bar: 1, subdivision: 3 },
    { string: 5, fret: 5, bar: 1, subdivision: 5 },
    { string: 5, fret: 7, bar: 1, subdivision: 7 },
    { string: 4, fret: 5, bar: 1, subdivision: 9 },
    { string: 4, fret: 7, bar: 1, subdivision: 11 },
    { string: 3, fret: 5, bar: 1, subdivision: 13 },
    { string: 3, fret: 7, bar: 1, subdivision: 15 },
  ],
});
