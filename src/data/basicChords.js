/**
 * Basic chord shapes for reference page.
 * frets[0]=high e ... frets[5]=low E; -1 = mute, 0 = open, 1+ = fret number.
 * startFret: first fret shown (0 = open position); diagram shows 5 frets.
 */
const ROOT_SEMITONES = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
const STRING_SEMITONES = [4, 11, 7, 2, 9, 4]; // e, B, G, D, A, E

export function isRootAt(stringIndex, fret, rootLetter) {
  const semitone = (STRING_SEMITONES[stringIndex] + fret) % 12;
  return ROOT_SEMITONES[rootLetter] === semitone;
}

// Chord: { frets: number[], root: string, startFret?: number }
export const BASIC_CHORDS = {
  major: [
    { root: 'A', frets: [0, 2, 2, 2, 0, -1] },
    { root: 'B', frets: [2, 2, 4, 4, 4, 2], startFret: 2 },
    { root: 'C', frets: [0, 1, 0, 0, 2, 3] },
    { root: 'D', frets: [2, 3, 2, 0, -1, -1] },
    { root: 'E', frets: [0, 0, 1, 2, 2, 0] },
    { root: 'F', frets: [1, 1, 2, 3, 3, 1], startFret: 1 },
    { root: 'G', frets: [3, 0, 0, 0, 2, 3] },
  ],
  minor: [
    { root: 'A', frets: [0, 1, 2, 2, 0, -1] },
    { root: 'B', frets: [2, 3, 4, 4, 2, -1], startFret: 2 },
    { root: 'C', frets: [3, 1, 0, 0, 1, 3] },
    { root: 'D', frets: [2, 3, 1, 0, -1, -1] },
    { root: 'E', frets: [0, 0, 0, 2, 2, 0] },
    { root: 'F', frets: [1, 1, 3, 3, 2, 1], startFret: 1 },
    { root: 'G', frets: [3, 3, 5, 5, 3, 3], startFret: 3 },
  ],
  seventh: [
    { root: 'A', frets: [0, 2, 0, 2, 0, -1] },
    { root: 'B', frets: [0, 2, 2, 2, 0, 2], startFret: 2 },
    { root: 'C', frets: [0, 1, 0, 0, 2, 1] },
    { root: 'D', frets: [2, 1, 2, 0, -1, -1] },
    { root: 'E', frets: [0, 0, 1, 2, 0, 0] },
    { root: 'F', frets: [1, 1, 2, 1, 3, 1], startFret: 1 },
    { root: 'G', frets: [1, 0, 0, 0, 2, 3] },
  ],
};

export const BASIC_CHORD_LABELS = {
  major: 'Major',
  minor: 'Minor',
  seventh: '7',
};

export function getBasicChordsByType(typeId) {
  return BASIC_CHORDS[typeId] || [];
}
