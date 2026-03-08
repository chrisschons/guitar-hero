/**
 * Riff definitions: note-event format for conversion to tab.
 * Each note: { string, fret, beat, subdivision, duration }.
 * string 0 = high e, 5 = low E. subdivision 0..subdivisionsPerBeat-1. duration in slots.
 */

/** @typedef {{ string: number, fret: number, beat: number, subdivision: number, duration: number }} RiffNote */
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

/** Simple gallop (eighth-note pattern on one chord) */
export const gallopRiff = /** @type {Riff} */ ({
  id: 'gallop-simple',
  name: 'Simple Gallop',
  timeSignature: { num: 4, denom: 4 },
  bpmRange: { min: 90, max: 140 },
  style: 'gallop',
  notes: [
    // Beat 0: root, root, root (power chord low E + A + D)
    { string: 5, fret: 0, beat: 0, subdivision: 0, duration: 1 },
    { string: 4, fret: 2, beat: 0, subdivision: 0, duration: 1 },
    { string: 3, fret: 2, beat: 0, subdivision: 0, duration: 1 },
    { string: 5, fret: 0, beat: 0, subdivision: 1, duration: 1 },
    { string: 4, fret: 2, beat: 0, subdivision: 1, duration: 1 },
    { string: 3, fret: 2, beat: 0, subdivision: 1, duration: 1 },
    { string: 5, fret: 0, beat: 1, subdivision: 0, duration: 1 },
    { string: 4, fret: 2, beat: 1, subdivision: 0, duration: 1 },
    { string: 3, fret: 2, beat: 1, subdivision: 0, duration: 1 },
    // Beat 2: same
    { string: 5, fret: 0, beat: 2, subdivision: 0, duration: 1 },
    { string: 4, fret: 2, beat: 2, subdivision: 0, duration: 1 },
    { string: 3, fret: 2, beat: 2, subdivision: 0, duration: 1 },
    { string: 5, fret: 0, beat: 2, subdivision: 1, duration: 1 },
    { string: 4, fret: 2, beat: 2, subdivision: 1, duration: 1 },
    { string: 3, fret: 2, beat: 2, subdivision: 1, duration: 1 },
    { string: 5, fret: 0, beat: 3, subdivision: 0, duration: 1 },
    { string: 4, fret: 2, beat: 3, subdivision: 0, duration: 1 },
    { string: 3, fret: 2, beat: 3, subdivision: 0, duration: 1 },
  ],
});

/** Single-note alternate picking (pentatonic-style) */
export const alternatePickingRiff = /** @type {Riff} */ ({
  id: 'alt-pick-1',
  name: 'Alternate Picking (A minor pentatonic)',
  timeSignature: { num: 4, denom: 4 },
  bpmRange: { min: 80, max: 120 },
  style: 'alternatePicking',
  notes: [
    { string: 5, fret: 5, beat: 0, subdivision: 0, duration: 1 },
    { string: 5, fret: 8, beat: 0, subdivision: 1, duration: 1 },
    { string: 4, fret: 5, beat: 1, subdivision: 0, duration: 1 },
    { string: 4, fret: 7, beat: 1, subdivision: 1, duration: 1 },
    { string: 3, fret: 5, beat: 2, subdivision: 0, duration: 1 },
    { string: 3, fret: 7, beat: 2, subdivision: 1, duration: 1 },
    { string: 2, fret: 5, beat: 3, subdivision: 0, duration: 1 },
    { string: 2, fret: 7, beat: 3, subdivision: 1, duration: 1 },
  ],
});
