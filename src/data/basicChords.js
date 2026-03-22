/**
 * Basic chord shapes for reference page.
 * Box is fixed 5 columns. frets[i] = column index 0–4 (high e to low E), or -1 = mute.
 * Column 0 = always mute/open (no finger). When startFret>0, data 0 = first fret (display col 1), 1 = second (col 2), etc.
 * startFret: actual fret of first fret column (0 = open position, omit for open chords).
 */
import { ROOT_SEMITONES, getNoteAt } from '../core/music/index.js';
import { STANDARD_TUNING } from './tunings.js';

/** Actual fret for pitch/root. dataCol = value in frets[]: when startFret=0, 0=open 1=fret1...; when startFret>0, 0=startFret 1=startFret+1... */
export function getActualFret(dataCol, startFret) {
  if (dataCol < 0) return -1;
  if (startFret === 0) return dataCol; // 0=open, 1=fret1, 2=fret2...
  return startFret + dataCol; // 0=startFret, 1=startFret+1...
}

export function isRootAt(stringIndex, dataCol, startFret, rootLetter, tuning = STANDARD_TUNING) {
  const fret = getActualFret(dataCol, startFret);
  if (fret < 0) return false;
  const semitone = getNoteAt(stringIndex, fret, tuning);
  return ROOT_SEMITONES[rootLetter] === semitone;
}

// Chord: { frets: number[], root: string, startFret?: number, barre?: number[] }
// barre: optional. Either [fret, startString, endString] 1-based (fret 1–24, strings 1–6, 1=high e) e.g. [1,1,6];
//        or legacy [colIndex, fromString, toString] 0-based (colIndex 1=first fret, strings 0–5).
export const BASIC_CHORDS = {
  major: [
    { root: 'A', frets: [0, 2, 2, 2, 0, -1] },
    { root: 'B', frets: [0,2,2,2,0,-1], startFret: 2, barre: [2, 1, 5] },
    { root: 'C', frets: [0, 1, 0, 0, 2, 3] },
    { root: 'D', frets: [2, 3, 2, 0, -1, -1] },
    { root: 'E', frets: [0, 0, 1, 2, 2, 0] },
    { root: 'F', frets: [0,0,1,2,2,0], startFret: 1, barre: [1, 1, 6] },
    { root: 'G', frets: [3, 0, 0, 0, 2, 3]},
  ],
  minor: [
    { root: 'A', frets: [0, 1, 2, 2, 0, -1] },
    { root: 'B', frets: [0,2,2,2,0,-1], startFret: 2, barre: [2, 1, 5] },
    { root: 'C', frets: [-1, 1, 0, 1, 3, -1]},
    { root: 'D', frets: [1, 3, 2, 0, -1, -1] },
    { root: 'E', frets: [0, 0, 0, 2, 2, 0] },
    { root: 'F', frets: [0,0,0,2,2,0], startFret: 1, barre: [1, 1, 6] },
    { root: 'G', frets: [0,0,0,2,2,0], startFret: 3, barre: [3,1,6] },
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
