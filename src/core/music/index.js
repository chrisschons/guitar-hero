/**
 * Music Theory Engine — public API.
 * All note calculations are semitone-based; no hardcoded note arrays in logic.
 */

export {
  NOTE_NAMES,
  ROOT_SEMITONES,
  getNoteAt,
  transpose,
  getNoteName,
  getStringLabels,
  frequencyToNoteCents,
} from './notes.js';

export {
  SCALE_STEP_PATTERNS,
  SCALE_INTERVALS,
  stepsToIntervals,
  getScaleFromSteps,
  getScale,
} from './scales.js';

export {
  CHORD_INTERVALS,
  getChord,
  isRootNote,
} from './chords.js';

export { getFretboardNotes } from './tuning.js';
