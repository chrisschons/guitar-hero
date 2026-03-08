// String labels (high to low)
export const STRING_LABELS = ['e', 'B', 'G', 'D', 'A', 'E'];

// Note subdivisions per beat (1–8 for freeform scroller)
export const SUBDIVISIONS = [
  { id: 1, name: '♩', notesPerBeat: 1 },  // Quarter notes
  { id: 2, name: '♪', notesPerBeat: 2 },  // Eighth notes
  { id: 3, name: '³', notesPerBeat: 3 },  // Triplets
  { id: 4, name: '♬', notesPerBeat: 4 },  // 16th notes
  { id: 5, name: '5', notesPerBeat: 5 },  // Quintuplets
  { id: 6, name: '6', notesPerBeat: 6 },  // Sextuplets
  { id: 7, name: '7', notesPerBeat: 7 },  // Septuplets
  { id: 8, name: '8', notesPerBeat: 8 },  // 8 per beat
];

// Time signatures for bar lines (and future count-in)
export const TIME_SIGNATURES = [
  { id: '4/4', name: '4/4', beatsPerMeasure: 4 },
  { id: '3/4', name: '3/4', beatsPerMeasure: 3 },
  { id: '6/8', name: '6/8', beatsPerMeasure: 3 },   // 3 dotted-quarter beats
  { id: '12/8', name: '12/8', beatsPerMeasure: 6 }, // 6 dotted-quarter beats
];

/** Slots (columns) per measure for bar line spacing */
export function getSlotsPerMeasure(timeSignatureId, subdivision) {
  const ts = TIME_SIGNATURES.find((t) => t.id === timeSignatureId);
  const sub = Number(subdivision) || 2;
  if (!ts) return 4 * sub;
  return ts.beatsPerMeasure * sub;
}

// Root notes with their fret position on low E string
export const ROOT_NOTES = [
  { id: 'E', name: 'E', fret: 0 },
  { id: 'G', name: 'G', fret: 3 },
  { id: 'A', name: 'A', fret: 5 },
  { id: 'B', name: 'B', fret: 7 },
];

// Get fret offset from A (the default root for pentatonic)
export function getRootOffset(rootId) {
  const root = ROOT_NOTES.find(r => r.id === rootId);
  return root ? root.fret - 5 : 0;
}

// Get absolute fret for root on low E
export function getRootFret(rootId) {
  const root = ROOT_NOTES.find(r => r.id === rootId);
  return root ? root.fret : 0;
}

// Convert a note [stringIndex, fret] to a tab column
function noteToColumn(note) {
  const column = [null, null, null, null, null, null];
  if (Array.isArray(note[0])) {
    // Multiple notes (chord)
    note.forEach(([string, fret]) => {
      column[string] = fret;
    });
  } else {
    column[note[0]] = note[1];
  }
  return column;
}

// Exercise Types
export const EXERCISE_TYPES = [
  {
    id: 'pentatonic',
    name: 'Pentatonic',
    scaleType: 'pentatonic',
    exercises: [
      { id: 'pos1', name: 'Position 1', positionIndex: 0 },
      { id: 'pos2', name: 'Position 2', positionIndex: 1 },
      { id: 'pos3', name: 'Position 3', positionIndex: 2 },
      { id: 'pos4', name: 'Position 4', positionIndex: 3 },
      { id: 'pos5', name: 'Position 5', positionIndex: 4 },
    ],
    patterns: [
      { id: 'up-down', name: 'Up & Down' },
      { id: 'groups-of-4', name: 'Groups of 4' },
      { id: 'groups-of-3', name: 'Groups of 3' },
      { id: 'skip-one', name: 'Skip One (3rds)' },
      { id: 'two-up-one-back', name: '2 Up, 1 Back' },
      { id: 'string-pairs', name: 'String Pairs' },
    ],
  },
  {
    id: 'blues',
    name: 'Blues Scale',
    scaleType: 'blues',
    exercises: [
      { id: 'pos1', name: 'Position 1', positionIndex: 0 },
      { id: 'pos2', name: 'Position 2', positionIndex: 1 },
      { id: 'pos3', name: 'Position 3', positionIndex: 2 },
      { id: 'pos4', name: 'Position 4', positionIndex: 3 },
      { id: 'pos5', name: 'Position 5', positionIndex: 4 },
    ],
    patterns: [
      { id: 'up-down', name: 'Up & Down' },
      { id: 'groups-of-4', name: 'Groups of 4' },
      { id: 'groups-of-3', name: 'Groups of 3' },
    ],
  },
  {
    id: 'major-3nps',
    name: 'Major 3NPS',
    scaleType: 'major',
    exercises: [
      { id: 'pos1', name: 'Position 1', positionIndex: 0 },
      { id: 'pos2', name: 'Position 2', positionIndex: 1 },
      { id: 'pos3', name: 'Position 3', positionIndex: 2 },
    ],
    patterns: [
      { id: 'up-down', name: 'Up & Down' },
      { id: 'groups-of-3', name: 'Groups of 3' },
      { id: 'groups-of-4', name: 'Groups of 4' },
    ],
  },
  {
    id: 'minor-3nps',
    name: 'Minor 3NPS',
    scaleType: 'minor',
    exercises: [
      { id: 'pos1', name: 'Position 1', positionIndex: 0 },
      { id: 'pos2', name: 'Position 2', positionIndex: 1 },
      { id: 'pos3', name: 'Position 3', positionIndex: 2 },
    ],
    patterns: [
      { id: 'up-down', name: 'Up & Down' },
      { id: 'groups-of-3', name: 'Groups of 3' },
      { id: 'groups-of-4', name: 'Groups of 4' },
    ],
  },
  {
    id: 'scale-runs',
    name: 'Scale Runs',
    scaleType: 'pentatonic', // Default, but can work with different scales
    exercises: [
      { id: 'penta-pos1-2', name: 'Penta 1→2', scaleType: 'pentatonic' },
      { id: 'penta-pos2-3', name: 'Penta 2→3', scaleType: 'pentatonic' },
      { id: 'penta-pos3-4', name: 'Penta 3→4', scaleType: 'pentatonic' },
      { id: 'penta-pos4-5', name: 'Penta 4→5', scaleType: 'pentatonic' },
      { id: 'blues-pos1-2', name: 'Blues 1→2', scaleType: 'blues' },
      { id: 'blues-pos2-3', name: 'Blues 2→3', scaleType: 'blues' },
      { id: 'major-pos1-2', name: 'Major 1→2', scaleType: 'major' },
      { id: 'minor-pos1-2', name: 'Minor 1→2', scaleType: 'minor' },
    ],
    patterns: [
      { id: 'up-down', name: 'Up & Down' },
      { id: 'groups-of-3', name: 'Groups of 3' },
    ],
  },
  {
    id: 'power-chords',
    name: 'Power Chords',
    exercises: [
      { id: 'e-string-climb', name: 'E String Climb' },
      { id: 'a-string-climb', name: 'A String Climb' },
      { id: 'punk-progression', name: 'Punk Progression' },
      { id: 'gallop', name: 'Gallop Pattern' },
    ],
    patterns: [
      { id: 'default', name: 'Default' },
      { id: 'double', name: 'Double Strum' },
      { id: 'palm-mute', name: 'With Rests' },
    ],
  },
  {
    id: 'riffs',
    name: 'Riffs',
    exercises: [{ id: 'random-mix', name: 'Random mix' }, ...RIFFS.map((r) => ({ id: r.id, name: r.name }))],
    patterns: [{ id: 'default', name: 'Default' }],
  },
  {
    id: 'chord-progressions',
    name: 'Chord Progressions',
    exercises: CHORD_PROGRESSIONS.map((p) => ({ id: p.id, name: p.name })),
    patterns: [{ id: 'default', name: 'Default' }],
  },
];

// Scale intervals from root (in semitones)
export const SCALE_INTERVALS = {
  pentatonic: [0, 3, 5, 7, 10],           // Minor pentatonic: 1, b3, 4, 5, b7
  blues: [0, 3, 5, 6, 7, 10],             // Blues: 1, b3, 4, b5, 5, b7
  major: [0, 2, 4, 5, 7, 9, 11],          // Major: 1, 2, 3, 4, 5, 6, 7
  minor: [0, 2, 3, 5, 7, 8, 10],          // Natural minor: 1, 2, b3, 4, 5, b6, b7
};

// String open note semitones from C (e=4, B=11, G=7, D=2, A=9, E=4) - string index 0 high e to 5 low E
// Sourced from music engine / standard tuning for single source of truth
import { STANDARD_TUNING } from '../data/tunings.js';
import { getScale as getScaleFromEngine, getNoteAt } from '../core/music/index.js';
import { RIFFS, getRiff, getRandomMixTab } from './riffs/index.js';
import { CHORD_PROGRESSIONS, generateChordProgressionTab } from './chordProgressions.js';
import { riffToTab } from '../core/exercise/riffToTab.js';
export const STRING_SEMITONES = STANDARD_TUNING;

// Get position notes for reference page (neutral/key of A). Returns { notes: [[stringIndex, fret], ...] }.
export function getReferencePosition(scaleTypeId, positionIndex) {
  let positions;
  switch (scaleTypeId) {
    case 'pentatonic': positions = PENTATONIC_POSITIONS; break;
    case 'blues': positions = BLUES_POSITIONS; break;
    case 'major-3nps': positions = MAJOR_3NPS_POSITIONS; break;
    case 'minor-3nps': positions = MINOR_3NPS_POSITIONS; break;
    default: return { notes: [] };
  }
  const notes = positions[positionIndex] ? [...positions[positionIndex]] : [];
  return { notes };
}

// Get all scale notes across the fretboard for reference (key of A). Returns { notes }.
// Uses music engine for scale pitch classes and getNoteAt.
export function getReferenceFullScale(scaleTypeId) {
  const scaleType = scaleTypeId === 'major-3nps' ? 'major' : scaleTypeId === 'minor-3nps' ? 'minor' : scaleTypeId;
  const intervals = SCALE_INTERVALS[scaleType];
  if (!intervals) return { notes: [] };
  const rootSemitone = 9; // A
  const scaleNotes = getScaleFromEngine(rootSemitone, intervals);
  const notes = [];
  for (let stringIndex = 0; stringIndex < 6; stringIndex++) {
    for (let fret = 0; fret <= 23; fret++) {
      const noteSemitone = getNoteAt(stringIndex, fret, STRING_SEMITONES);
      if (scaleNotes.includes(noteSemitone)) {
        notes.push([stringIndex, fret]);
      }
    }
  }
  return { notes };
}
// Format: [stringIndex, fret] - strings: 0=e, 1=B, 2=G, 3=D, 4=A, 5=E
// Verified against actual A minor pentatonic notes: A, C, D, E, G
const PENTATONIC_POSITIONS = [
  // Position 1 (frets 5-8)
  [[5, 5], [5, 8], [4, 5], [4, 7], [3, 5], [3, 7], [2, 5], [2, 7], [1, 5], [1, 8], [0, 5], [0, 8]],
  // Position 2 (frets 7-10)
  [[5, 8], [5, 10], [4, 7], [4, 10], [3, 7], [3, 10], [2, 7], [2, 9], [1, 8], [1, 10], [0, 8], [0, 10]],
  // Position 3 (frets 10-13)
  [[5, 10], [5, 12], [4, 10], [4, 12], [3, 10], [3, 12], [2, 9], [2, 12], [1, 10], [1, 13], [0, 10], [0, 12]],
  // Position 4 (frets 12-15)
  [[5, 12], [5, 15], [4, 12], [4, 15], [3, 12], [3, 14], [2, 12], [2, 14], [1, 13], [1, 15], [0, 12], [0, 15]],
  // Position 5 (frets 15-17)
  [[5, 15], [5, 17], [4, 15], [4, 17], [3, 14], [3, 17], [2, 14], [2, 17], [1, 15], [1, 17], [0, 15], [0, 17]],
];

// Blues scale positions (base in A) - pentatonic + blue note (b5)
const BLUES_POSITIONS = [
  // Position 1 (frets 5-8)
  [[5, 5], [5, 8], [4, 5], [4, 6], [4, 7], [3, 5], [3, 7], [2, 5], [2, 7], [2, 8], [1, 5], [1, 8], [0, 5], [0, 8]],
  // Position 2 (frets 7-10)
  [[5, 8], [5, 10], [4, 7], [4, 10], [4, 11], [3, 7], [3, 10], [2, 7], [2, 8], [2, 9], [1, 8], [1, 10], [0, 8], [0, 10], [0, 11]],
  // Position 3 (frets 10-13)
  [[5, 10], [5, 11], [5, 12], [4, 10], [4, 12], [3, 10], [3, 12], [3, 13], [2, 9], [2, 12], [1, 10], [1, 11], [1, 13], [0, 10], [0, 12]],
  // Position 4 (frets 12-15)
  [[5, 12], [5, 15], [4, 12], [4, 13], [4, 15], [3, 12], [3, 14], [2, 12], [2, 14], [2, 15], [1, 13], [1, 15], [0, 12], [0, 15]],
  // Position 5 (frets 15-17)
  [[5, 15], [5, 17], [5, 18], [4, 15], [4, 17], [3, 14], [3, 17], [3, 18], [2, 14], [2, 17], [1, 15], [1, 17], [1, 18], [0, 15], [0, 17]],
];

// Major scale 3-notes-per-string positions (base in A)
// Each position starts on a different scale degree
const MAJOR_3NPS_POSITIONS = [
  // Position 1 - starts on root (A) at fret 5 on low E
  [[5, 4], [5, 5], [5, 7], [4, 4], [4, 5], [4, 7], [3, 4], [3, 6], [3, 7], [2, 4], [2, 6], [2, 7], [1, 5], [1, 7], [1, 9], [0, 5], [0, 7], [0, 9]],
  // Position 2 - starts on 2nd (B) at fret 7 on low E
  [[5, 5], [5, 7], [5, 9], [4, 5], [4, 7], [4, 9], [3, 6], [3, 7], [3, 9], [2, 6], [2, 7], [2, 9], [1, 7], [1, 9], [1, 10], [0, 7], [0, 9], [0, 10]],
  // Position 3 - starts on 3rd (C#) at fret 9 on low E
  [[5, 7], [5, 9], [5, 11], [4, 7], [4, 9], [4, 11], [3, 7], [3, 9], [3, 11], [2, 7], [2, 9], [2, 11], [1, 9], [1, 10], [1, 12], [0, 9], [0, 10], [0, 12]],
];

// Minor scale 3-notes-per-string positions (base in A)
const MINOR_3NPS_POSITIONS = [
  // Position 1 - starts on root (A) at fret 5 on low E
  [[5, 3], [5, 5], [5, 7], [4, 3], [4, 5], [4, 7], [3, 4], [3, 5], [3, 7], [2, 4], [2, 5], [2, 7], [1, 5], [1, 6], [1, 8], [0, 5], [0, 7], [0, 8]],
  // Position 2 - starts on 2nd (B) at fret 7 on low E
  [[5, 5], [5, 7], [5, 8], [4, 5], [4, 7], [4, 8], [3, 5], [3, 7], [3, 9], [2, 5], [2, 7], [2, 9], [1, 6], [1, 8], [1, 10], [0, 7], [0, 8], [0, 10]],
  // Position 3 - starts on b3rd (C) at fret 8 on low E
  [[5, 7], [5, 8], [5, 10], [4, 7], [4, 8], [4, 10], [3, 7], [3, 9], [3, 10], [2, 7], [2, 9], [2, 10], [1, 8], [1, 10], [1, 12], [0, 8], [0, 10], [0, 12]],
];

// Pentatonic pattern generators
const PENTATONIC_PATTERNS = {
  'up-down': (notes) => {
    const ascending = notes.map(noteToColumn);
    const descending = [...notes].reverse().map(noteToColumn);
    return [...ascending, ...descending];
  },
  'groups-of-4': (notes) => {
    const result = [];
    for (let i = 0; i <= notes.length - 4; i++) {
      for (let j = 0; j < 4; j++) result.push(noteToColumn(notes[i + j]));
    }
    const reversed = [...notes].reverse();
    for (let i = 0; i <= reversed.length - 4; i++) {
      for (let j = 0; j < 4; j++) result.push(noteToColumn(reversed[i + j]));
    }
    return result;
  },
  'groups-of-3': (notes) => {
    const result = [];
    for (let i = 0; i <= notes.length - 3; i++) {
      for (let j = 0; j < 3; j++) result.push(noteToColumn(notes[i + j]));
    }
    const reversed = [...notes].reverse();
    for (let i = 0; i <= reversed.length - 3; i++) {
      for (let j = 0; j < 3; j++) result.push(noteToColumn(reversed[i + j]));
    }
    return result;
  },
  'skip-one': (notes) => {
    const result = [];
    for (let i = 0; i < notes.length - 2; i++) {
      result.push(noteToColumn(notes[i]));
      result.push(noteToColumn(notes[i + 2]));
    }
    const reversed = [...notes].reverse();
    for (let i = 0; i < reversed.length - 2; i++) {
      result.push(noteToColumn(reversed[i]));
      result.push(noteToColumn(reversed[i + 2]));
    }
    return result;
  },
  'two-up-one-back': (notes) => {
    const result = [];
    for (let i = 0; i < notes.length - 1; i++) {
      result.push(noteToColumn(notes[i]));
      result.push(noteToColumn(notes[i + 1]));
      if (i < notes.length - 2) result.push(noteToColumn(notes[i]));
    }
    const reversed = [...notes].reverse();
    for (let i = 0; i < reversed.length - 1; i++) {
      result.push(noteToColumn(reversed[i]));
      result.push(noteToColumn(reversed[i + 1]));
      if (i < reversed.length - 2) result.push(noteToColumn(reversed[i]));
    }
    return result;
  },
  'string-pairs': (notes) => {
    const result = [];
    for (let i = 0; i < notes.length; i += 2) {
      result.push(noteToColumn(notes[i]));
      result.push(noteToColumn(notes[i + 1]));
      result.push(noteToColumn(notes[i + 1]));
      result.push(noteToColumn(notes[i]));
    }
    return result;
  },
};

// Scale run exercises - transition between positions at natural points
// Each returns the specific notes for the exercise (not just combined positions)
// These create realistic practice patterns where you shift positions at root notes
const SCALE_RUN_EXERCISES = {
  // Pentatonic runs
  'penta-pos1-2': (offset) => [
    [5, 5 + offset], [5, 8 + offset], [4, 5 + offset], [4, 7 + offset], [3, 5 + offset], [3, 7 + offset],
    [3, 10 + offset], [2, 7 + offset], [2, 9 + offset], [1, 8 + offset], [1, 10 + offset], [0, 8 + offset], [0, 10 + offset],
  ],
  'penta-pos2-3': (offset) => [
    [5, 8 + offset], [5, 10 + offset], [4, 7 + offset], [4, 10 + offset], [3, 7 + offset], [3, 10 + offset], [2, 7 + offset], [2, 9 + offset],
    [2, 12 + offset], [1, 10 + offset], [1, 13 + offset], [0, 10 + offset], [0, 12 + offset],
  ],
  'penta-pos3-4': (offset) => [
    [5, 10 + offset], [5, 12 + offset], [4, 10 + offset], [4, 12 + offset], [3, 10 + offset], [3, 12 + offset], [2, 9 + offset], [2, 12 + offset],
    [2, 14 + offset], [1, 13 + offset], [1, 15 + offset], [0, 12 + offset], [0, 15 + offset],
  ],
  'penta-pos4-5': (offset) => [
    [5, 12 + offset], [5, 15 + offset], [4, 12 + offset], [4, 15 + offset], [3, 12 + offset], [3, 14 + offset], [2, 12 + offset], [2, 14 + offset],
    [2, 17 + offset], [1, 15 + offset], [1, 17 + offset], [0, 15 + offset], [0, 17 + offset],
  ],
  
  // Blues runs
  'blues-pos1-2': (offset) => [
    [5, 5 + offset], [5, 8 + offset], [4, 5 + offset], [4, 6 + offset], [4, 7 + offset], [3, 5 + offset], [3, 7 + offset],
    [3, 10 + offset], [2, 7 + offset], [2, 8 + offset], [2, 9 + offset], [1, 8 + offset], [1, 10 + offset], [0, 8 + offset], [0, 10 + offset],
  ],
  'blues-pos2-3': (offset) => [
    [5, 8 + offset], [5, 10 + offset], [4, 7 + offset], [4, 10 + offset], [4, 11 + offset], [3, 7 + offset], [3, 10 + offset], [2, 7 + offset], [2, 8 + offset], [2, 9 + offset],
    [2, 12 + offset], [1, 10 + offset], [1, 11 + offset], [1, 13 + offset], [0, 10 + offset], [0, 12 + offset],
  ],
  
  // Major 3NPS runs
  'major-pos1-2': (offset) => [
    [5, 4 + offset], [5, 5 + offset], [5, 7 + offset], [4, 4 + offset], [4, 5 + offset], [4, 7 + offset], [3, 4 + offset], [3, 6 + offset], [3, 7 + offset],
    [3, 9 + offset], [2, 6 + offset], [2, 7 + offset], [2, 9 + offset], [1, 7 + offset], [1, 9 + offset], [1, 10 + offset], [0, 7 + offset], [0, 9 + offset], [0, 10 + offset],
  ],
  
  // Minor 3NPS runs
  'minor-pos1-2': (offset) => [
    [5, 3 + offset], [5, 5 + offset], [5, 7 + offset], [4, 3 + offset], [4, 5 + offset], [4, 7 + offset], [3, 4 + offset], [3, 5 + offset], [3, 7 + offset],
    [3, 9 + offset], [2, 5 + offset], [2, 7 + offset], [2, 9 + offset], [1, 6 + offset], [1, 8 + offset], [1, 10 + offset], [0, 7 + offset], [0, 8 + offset], [0, 10 + offset],
  ],
};

// Scale run pattern generators
const SCALE_RUN_PATTERNS = {
  'up-down': (notes) => {
    const ascending = notes.map(noteToColumn);
    const descending = [...notes].reverse().slice(1).map(noteToColumn);
    return [...ascending, ...descending];
  },
  'groups-of-3': (notes) => {
    const result = [];
    for (let i = 0; i <= notes.length - 3; i++) {
      for (let j = 0; j < 3; j++) result.push(noteToColumn(notes[i + j]));
    }
    const reversed = [...notes].reverse();
    for (let i = 0; i <= reversed.length - 3; i++) {
      for (let j = 0; j < 3; j++) result.push(noteToColumn(reversed[i + j]));
    }
    return result;
  },
};

// Power chord helper - creates a power chord shape
// rootString: 5 for E string root, 4 for A string root
function powerChord(rootString, fret) {
  if (rootString === 5) {
    return [[5, fret], [4, fret + 2], [3, fret + 2]];
  } else {
    return [[4, fret], [3, fret + 2], [2, fret + 2]];
  }
}

// Power chord exercise generators
const POWER_CHORD_EXERCISES = {
  'e-string-climb': (rootFret) => {
    // Climb up the E string: I - II - III - IV - V and back
    const frets = [0, 2, 4, 5, 7].map(f => f + rootFret);
    const chords = frets.map(f => powerChord(5, f));
    const descending = [...chords].reverse().slice(1);
    return [...chords, ...descending];
  },
  'a-string-climb': (rootFret) => {
    // Climb up the A string
    const frets = [0, 2, 4, 5, 7].map(f => f + rootFret);
    const chords = frets.map(f => powerChord(4, f));
    const descending = [...chords].reverse().slice(1);
    return [...chords, ...descending];
  },
  'punk-progression': (rootFret) => {
    // Classic I-V-vi-IV progression with power chords
    const progression = [
      powerChord(5, rootFret),      // I
      powerChord(5, rootFret + 7),  // V
      powerChord(5, rootFret + 9),  // vi
      powerChord(5, rootFret + 5),  // IV
    ];
    // Repeat twice
    return [...progression, ...progression];
  },
  'gallop': (rootFret) => {
    // Gallop rhythm on root chord (popular in metal)
    const root = powerChord(5, rootFret);
    const fifth = powerChord(5, rootFret + 7);
    // Root root root, fifth fifth fifth pattern
    return [root, root, root, fifth, fifth, fifth, root, root];
  },
};

// Power chord pattern modifiers
const POWER_CHORD_PATTERNS = {
  'default': (chords) => chords.map(noteToColumn),
  'double': (chords) => {
    const result = [];
    chords.forEach(chord => {
      result.push(noteToColumn(chord));
      result.push(noteToColumn(chord));
    });
    return result;
  },
  'palm-mute': (chords) => {
    const result = [];
    const rest = [null, null, null, null, null, null];
    chords.forEach(chord => {
      result.push(noteToColumn(chord));
      result.push(rest);
    });
    return result;
  },
};

// Generic pattern generators (used by multiple scale types)
const GENERIC_PATTERNS = {
  'up-down': (notes) => {
    const ascending = notes.map(noteToColumn);
    const descending = [...notes].reverse().map(noteToColumn);
    return [...ascending, ...descending];
  },
  'groups-of-4': (notes) => {
    const result = [];
    for (let i = 0; i <= notes.length - 4; i++) {
      for (let j = 0; j < 4; j++) result.push(noteToColumn(notes[i + j]));
    }
    const reversed = [...notes].reverse();
    for (let i = 0; i <= reversed.length - 4; i++) {
      for (let j = 0; j < 4; j++) result.push(noteToColumn(reversed[i + j]));
    }
    return result;
  },
  'groups-of-3': (notes) => {
    const result = [];
    for (let i = 0; i <= notes.length - 3; i++) {
      for (let j = 0; j < 3; j++) result.push(noteToColumn(notes[i + j]));
    }
    const reversed = [...notes].reverse();
    for (let i = 0; i <= reversed.length - 3; i++) {
      for (let j = 0; j < 3; j++) result.push(noteToColumn(reversed[i + j]));
    }
    return result;
  },
};

// Get position data for a scale type
function getPositionsForScale(scaleType) {
  switch (scaleType) {
    case 'pentatonic': return PENTATONIC_POSITIONS;
    case 'blues': return BLUES_POSITIONS;
    case 'major': return MAJOR_3NPS_POSITIONS;
    case 'minor': return MINOR_3NPS_POSITIONS;
    default: return PENTATONIC_POSITIONS;
  }
}

// Main tab generation function
export function generateTab(typeId, exerciseId, patternId, rootNote, subdivision = 2) {
  const type = EXERCISE_TYPES.find(t => t.id === typeId);
  if (!type) return [];

  if (typeId === 'riffs') {
    if (exerciseId === 'random-mix') {
      return getRandomMixTab(subdivision, 3);
    }
    const riff = getRiff(exerciseId);
    if (!riff) return [];
    const subDiv = riff.subdivisionsPerBeat ?? subdivision;
    return riffToTab(riff, subDiv);
  }

  if (typeId === 'chord-progressions') {
    const preset = CHORD_PROGRESSIONS.find((p) => p.id === exerciseId);
    if (!preset) return [];
    return generateChordProgressionTab(preset.progression, subdivision);
  }

  if (typeId === 'pentatonic') {
    const exercise = type.exercises.find(e => e.id === exerciseId);
    if (!exercise) return [];
    
    const offset = getRootOffset(rootNote);
    const baseNotes = PENTATONIC_POSITIONS[exercise.positionIndex];
    const transposedNotes = baseNotes.map(([string, fret]) => [string, fret + offset]);
    
    const patternFn = PENTATONIC_PATTERNS[patternId] || PENTATONIC_PATTERNS['up-down'];
    return patternFn(transposedNotes);
  }

  if (typeId === 'blues') {
    const exercise = type.exercises.find(e => e.id === exerciseId);
    if (!exercise) return [];
    
    const offset = getRootOffset(rootNote);
    const baseNotes = BLUES_POSITIONS[exercise.positionIndex];
    const transposedNotes = baseNotes.map(([string, fret]) => [string, fret + offset]);
    
    const patternFn = GENERIC_PATTERNS[patternId] || GENERIC_PATTERNS['up-down'];
    return patternFn(transposedNotes);
  }

  if (typeId === 'major-3nps') {
    const exercise = type.exercises.find(e => e.id === exerciseId);
    if (!exercise) return [];
    
    const offset = getRootOffset(rootNote);
    const baseNotes = MAJOR_3NPS_POSITIONS[exercise.positionIndex];
    const transposedNotes = baseNotes.map(([string, fret]) => [string, fret + offset]);
    
    const patternFn = GENERIC_PATTERNS[patternId] || GENERIC_PATTERNS['up-down'];
    return patternFn(transposedNotes);
  }

  if (typeId === 'minor-3nps') {
    const exercise = type.exercises.find(e => e.id === exerciseId);
    if (!exercise) return [];
    
    const offset = getRootOffset(rootNote);
    const baseNotes = MINOR_3NPS_POSITIONS[exercise.positionIndex];
    const transposedNotes = baseNotes.map(([string, fret]) => [string, fret + offset]);
    
    const patternFn = GENERIC_PATTERNS[patternId] || GENERIC_PATTERNS['up-down'];
    return patternFn(transposedNotes);
  }

  if (typeId === 'scale-runs') {
    const offset = getRootOffset(rootNote);
    const exerciseFn = SCALE_RUN_EXERCISES[exerciseId];
    if (!exerciseFn) return [];
    
    const notes = exerciseFn(offset);
    const patternFn = SCALE_RUN_PATTERNS[patternId] || SCALE_RUN_PATTERNS['up-down'];
    return patternFn(notes);
  }

  if (typeId === 'power-chords') {
    const rootFret = getRootFret(rootNote);
    const exerciseFn = POWER_CHORD_EXERCISES[exerciseId];
    if (!exerciseFn) return [];
    
    const chords = exerciseFn(rootFret);
    const patternFn = POWER_CHORD_PATTERNS[patternId] || POWER_CHORD_PATTERNS['default'];
    return patternFn(chords);
  }

  return [];
}

// Get visualization data for fretboard
export function getVisualizationData(typeId, exerciseId, rootNote) {
  const type = EXERCISE_TYPES.find(t => t.id === typeId);
  const offset = getRootOffset(rootNote);
  
  if (typeId === 'pentatonic') {
    const exercise = type?.exercises.find(e => e.id === exerciseId);
    if (!exercise) return { type: 'pentatonic', positionIndex: 0, offset };
    
    return {
      type: 'pentatonic',
      scaleType: 'pentatonic',
      positionIndex: exercise.positionIndex,
      offset,
    };
  }

  if (typeId === 'blues') {
    const exercise = type?.exercises.find(e => e.id === exerciseId);
    if (!exercise) return { type: 'blues', positionIndex: 0, offset, positionNotes: [] };
    
    const baseNotes = BLUES_POSITIONS[exercise.positionIndex] || [];
    const positionNotes = baseNotes.map(([string, fret]) => [string, fret + offset]);
    
    return {
      type: 'blues',
      scaleType: 'blues',
      positionIndex: exercise.positionIndex,
      offset,
      positionNotes,
    };
  }

  if (typeId === 'major-3nps') {
    const exercise = type?.exercises.find(e => e.id === exerciseId);
    if (!exercise) return { type: 'major-3nps', positionIndex: 0, offset, positionNotes: [] };
    
    const baseNotes = MAJOR_3NPS_POSITIONS[exercise.positionIndex] || [];
    const positionNotes = baseNotes.map(([string, fret]) => [string, fret + offset]);
    
    return {
      type: 'major-3nps',
      scaleType: 'major',
      positionIndex: exercise.positionIndex,
      offset,
      positionNotes,
    };
  }

  if (typeId === 'minor-3nps') {
    const exercise = type?.exercises.find(e => e.id === exerciseId);
    if (!exercise) return { type: 'minor-3nps', positionIndex: 0, offset, positionNotes: [] };
    
    const baseNotes = MINOR_3NPS_POSITIONS[exercise.positionIndex] || [];
    const positionNotes = baseNotes.map(([string, fret]) => [string, fret + offset]);
    
    return {
      type: 'minor-3nps',
      scaleType: 'minor',
      positionIndex: exercise.positionIndex,
      offset,
      positionNotes,
    };
  }

  if (typeId === 'scale-runs') {
    const exercise = type?.exercises.find(e => e.id === exerciseId);
    const scaleType = exercise?.scaleType || 'pentatonic';
    const exerciseFn = SCALE_RUN_EXERCISES[exerciseId];
    const notes = exerciseFn ? exerciseFn(offset) : [];
    return {
      type: 'scale-runs',
      scaleType,
      offset,
      exerciseNotes: notes,
    };
  }

  if (typeId === 'power-chords') {
    const rootFret = getRootFret(rootNote);
    return {
      type: 'power-chords',
      rootFret,
      exerciseId,
    };
  }

  return { type: 'none' };
}
