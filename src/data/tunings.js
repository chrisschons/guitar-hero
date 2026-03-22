/**
 * Tuning definitions: open string pitch classes (semitones from C).
 * Index 0 = high e, 5 = low E.
 */

// Semitones from C: C=0, D=2, E=4, F=5, G=7, A=9, B=11; sharps +1
const C = 0, D = 2, E = 4, F = 5, G = 7, A = 9, B = 11;
const Bb = 10, Eb = 3;

/** Standard: E A D G B e */
export const STANDARD_TUNING = [4, B, G, D, A, E];

/** Open string octaves (MIDI octave number) for standard tuning. Index 0 = high e, 5 = low E. */
export const STANDARD_TUNING_OCTAVES = [4, 3, 3, 3, 2, 2];

/** Open string octaves for C standard tuning (all strings -4 semitones from standard).
 * String s=3 (Bb) wraps pitch class 2→10 when detuned, so its octave drops from 3→2. */
export const C_STANDARD_TUNING_OCTAVES = [4, 3, 3, 2, 2, 2];

/** Drop C: C G C F A D */
export const DROP_C_TUNING = [D, A, F, C, G, C];

/** C standard: C F Bb Eb G C */
export const C_STANDARD_TUNING = [C, G, Eb, Bb, F, C];

export const TUNINGS = {
  standard: { id: 'standard', name: 'Standard', semitones: STANDARD_TUNING, octaves: STANDARD_TUNING_OCTAVES },
  // dropC: { id: 'dropC', name: 'Drop C', semitones: DROP_C_TUNING }, // hidden for now; future enhancement
  cStandard: { id: 'cStandard', name: 'C Standard', semitones: C_STANDARD_TUNING, octaves: C_STANDARD_TUNING_OCTAVES },
};

/** Array of tunings for UI (e.g. selector) */
export const TUNINGS_LIST = Object.values(TUNINGS);
