/**
 * Audio engine — public API.
 */

export { getAudioContext, resumeAudioContext } from './audioContext.js';
export { createMetronome } from './metronome.js';
export {
  getNoteFrequency,
  getMidiNote,
  playNote,
  playNoteStart,
  playColumn,
  playColumnWithDuration,
} from './notePlayback.js';
export { startTuner } from './tuner.js';
