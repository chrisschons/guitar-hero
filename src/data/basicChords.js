/**
 * Basic chord shapes for reference page.
 * Box is fixed 5 columns. frets[i] = column index 0–4 (high e to low E), or -1 = mute.
 * Column 0 = always mute/open (no finger). When startFret>0, data 0 = first fret (display col 1), 1 = second (col 2), etc.
 * startFret: actual fret of first fret column (0 = open position, omit for open chords).
 */
const ROOT_SEMITONES = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
const STRING_SEMITONES = [4, 11, 7, 2, 9, 4]; // e, B, G, D, A, E

/** Actual fret for pitch/root. dataCol = value in frets[]: when startFret=0, 0=open 1=fret1...; when startFret>0, 0=startFret 1=startFret+1... */
export function getActualFret(dataCol, startFret) {
  if (dataCol < 0) return -1;
  if (startFret === 0) return dataCol; // 0=open, 1=fret1, 2=fret2...
  return startFret + dataCol; // 0=startFret, 1=startFret+1...
}

export function isRootAt(stringIndex, dataCol, startFret, rootLetter) {
  const fret = getActualFret(dataCol, startFret);
  if (fret < 0) return false;
  const semitone = (STRING_SEMITONES[stringIndex] + fret) % 12;
  return ROOT_SEMITONES[rootLetter] === semitone;
}

// Chord: { frets: number[], root: string, startFret?: number }
export const BASIC_CHORDS = {
  major: [
    { root: 'A', frets: [0, 2, 2, 2, 0, -1] },
    { root: 'B', frets: [0,2,2,2,0,-1], startFret: 2 },
    { root: 'C', frets: [0, 1, 0, 0, 2, 3] },
    { root: 'D', frets: [2, 3, 2, 0, -1, -1] },
    { root: 'E', frets: [0, 0, 1, 2, 2, 0] },
    { root: 'F', frets: [0,0,1,2,2,0], startFret: 1 },
    { root: 'G', frets: [3, 0, 0, 0, 2, 3] },
  ],
  minor: [
    { root: 'A', frets: [0, 1, 2, 2, 0, -1] },
    { root: 'B', frets: [0,2,2,2,0,-1], startFret: 2 },
    { root: 'C', frets: [-1, 1, 0, 1, 3, -1]},
    { root: 'D', frets: [2, 3, 1, 0, -1, -1] },
    { root: 'E', frets: [0, 0, 0, 2, 2, 0] },
    { root: 'F', frets: [0,0,0,2,2,0], startFret: 1 },
    { root: 'G', frets: [0,0,0,2,2,0], startFret: 3 },
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
