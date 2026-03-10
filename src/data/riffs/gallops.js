/**
 * Riff definitions: note-event format for conversion to tab.
 *
 * Each note: { string, fret, bar, subdivision } — all 1-based for editing. No "beat"; subdivision is the slot within the bar.
 * - string: 1 = high e, 6 = low E.
 * - bar: 1-based bar number.
 * - subdivision: 1-based slot within the bar (1 to subdivisionsPerBar). subdivisionsPerBar from time signature (16th-note grid: 4/4→16, 6/8→16).
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
 *   style: string
 * }} Riff
 */

/** Demo: 4 bars — whole, 8th, triplet, 16th (triplets need future support; currently uses 16/bar). */
export const subdivisionDemoRiff = /** @type {Riff} */ ({
  id: 'subdivision-demo',
  name: 'Subdivision demo (whole, 8th, triplet, 16th)',
  timeSignature: { num: 4, denom: 4 },
  bpmRange: { min: 60, max: 100 },
  style: 'gallop',
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

/** Simple gallop (eighth-note pattern). 16/bar; 8ths at 1,3,5,7,9,11,13,15 for first two beats. */
export const gallopRiff = /** @type {Riff} */ ({
  id: 'gallop-simple',
  name: 'Simple Gallop',
  timeSignature: { num: 4, denom: 4 },
  bpmRange: { min: 90, max: 140 },
  style: 'gallop',
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

// --- Metal instructor: gallop & power chord exercises (8 bars, 16 subdivisions/bar) ---

/** Beginner gallop: classic "dun-dun-dun" rhythm on open E. Long-short-short = 1, 4, 6 per beat. */
function gallopPattern16(bar, rootFret = 0) {
  const subs = [1, 4, 6, 9, 12, 14]; // 6 hits per bar
  return subs.map((sub) => ({ string: 6, fret: rootFret, bar, subdivision: sub }));
}

/** Gallop 1 — Beginner: 8 bars on open E (E5 root). Build consistency and right-hand control. */
export const gallopBeginnerRiff = /** @type {Riff} */ ({
  id: 'gallop-beginner',
  name: 'Gallop Rhythm (Beginner) — Open E',
  timeSignature: { num: 4, denom: 4 },
  bpmRange: { min: 70, max: 100 },
  style: 'gallop',
  notes: [1, 2, 3, 4, 5, 6, 7, 8].flatMap((b) => gallopPattern16(b, 0)),
});

/** Gallop 2 — Intermediate: same rhythm, 4 bars E then 4 bars A. Adds a simple root change. */
export const gallopIntermediateRiff = /** @type {Riff} */ ({
  id: 'gallop-intermediate',
  name: 'Gallop Rhythm (Intermediate) — E to A',
  timeSignature: { num: 4, denom: 4 },
  bpmRange: { min: 85, max: 115 },
  style: 'gallop',
  notes: [
    ...([1, 2, 3, 4].flatMap((b) => gallopPattern16(b, 0))),
    ...([5, 6, 7, 8].flatMap((b) => gallopPattern16(b, 5))),
  ],
});

/** Power chord: E5 = 6/0 + 5/2. One note object per string at same bar/subdivision. */
function powerChordE5(bar, subdivision) {
  return [
    { string: 6, fret: 0, bar, subdivision },
    { string: 5, fret: 2, bar, subdivision },
  ];
}
function powerChordA5(bar, subdivision) {
  return [
    { string: 6, fret: 5, bar, subdivision },
    { string: 5, fret: 7, bar, subdivision },
  ];
}
function powerChordB5(bar, subdivision) {
  return [
    { string: 6, fret: 7, bar, subdivision },
    { string: 5, fret: 9, bar, subdivision },
  ];
}

/** Power chord 1 — Beginner: E5 → A5 → E5 → B5, 2 bars per chord. Quarter notes (1, 5, 9, 13). */
export const powerChordBeginnerRiff = /** @type {Riff} */ ({
  id: 'power-chord-beginner',
  name: 'Power Chords (Beginner) — E A E B',
  timeSignature: { num: 4, denom: 4 },
  bpmRange: { min: 60, max: 90 },
  style: 'powerChord',
  notes: [
    ...[1, 2].flatMap((b) => [1, 5, 9, 13].flatMap((s) => powerChordE5(b, s))),
    ...[3, 4].flatMap((b) => [1, 5, 9, 13].flatMap((s) => powerChordA5(b, s))),
    ...[5, 6].flatMap((b) => [1, 5, 9, 13].flatMap((s) => powerChordE5(b, s))),
    ...[7, 8].flatMap((b) => [1, 5, 9, 13].flatMap((s) => powerChordB5(b, s))),
  ],
});

/** Power chord 2 — Intermediate: same progression with eighth notes. More strums per bar. */
export const powerChordIntermediateRiff = /** @type {Riff} */ ({
  id: 'power-chord-intermediate',
  name: 'Power Chords (Intermediate) — E A E B, 8ths',
  timeSignature: { num: 4, denom: 4 },
  bpmRange: { min: 70, max: 100 },
  style: 'powerChord',
  notes: [
    ...[1, 2].flatMap((b) => [1, 3, 5, 7, 9, 11, 13, 15].flatMap((s) => powerChordE5(b, s))),
    ...[3, 4].flatMap((b) => [1, 3, 5, 7, 9, 11, 13, 15].flatMap((s) => powerChordA5(b, s))),
    ...[5, 6].flatMap((b) => [1, 3, 5, 7, 9, 11, 13, 15].flatMap((s) => powerChordE5(b, s))),
    ...[7, 8].flatMap((b) => [1, 3, 5, 7, 9, 11, 13, 15].flatMap((s) => powerChordB5(b, s))),
  ],
});
