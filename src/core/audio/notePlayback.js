/**
 * Note playback: play (string, fret) or a full tab column using tuning.
 * Frequency from tuning + open-string octave + fret; A4 = 440 Hz reference.
 */

import { getAudioContext } from './audioContext.js';
import { STANDARD_TUNING_OCTAVES } from '../../data/tunings.js';

const A4_HZ = 440;
const A4_MIDI = 69;

/**
 * Get MIDI note number for a string/fret in a tuning.
 * @param {number} stringIndex - 0 = high e, 5 = low E
 * @param {number} fret
 * @param {number[]} tuning - semitones from C per open string (length 6)
 * @param {number[]} [openOctaves] - MIDI octave per open string (default standard)
 * @returns {number} MIDI note (e.g. 64 for e4)
 */
export function getMidiNote(stringIndex, fret, tuning, openOctaves = STANDARD_TUNING_OCTAVES) {
  const openPitchClass = tuning[stringIndex];
  const openMidi = 12 + 12 * openOctaves[stringIndex] + openPitchClass;
  return openMidi + fret;
}

/**
 * Get frequency in Hz for a string/fret in a tuning.
 * @param {number} stringIndex
 * @param {number} fret
 * @param {number[]} tuning
 * @param {number[]} [openOctaves]
 * @returns {number} Hz
 */
export function getNoteFrequency(stringIndex, fret, tuning, openOctaves = STANDARD_TUNING_OCTAVES) {
  const midi = getMidiNote(stringIndex, fret, tuning, openOctaves);
  return A4_HZ * Math.pow(2, (midi - A4_MIDI) / 12);
}

/**
 * Play a single note (pluck envelope).
 * @param {AudioContext} ctx
 * @param {number} stringIndex
 * @param {number} fret
 * @param {number[]} tuning
 * @param {number} [volume=0.2]
 * @param {number[]} [openOctaves]
 */
export function playNote(ctx, stringIndex, fret, tuning, volume = 0.2, openOctaves) {
  const frequency = getNoteFrequency(stringIndex, fret, tuning, openOctaves);
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = 'triangle';
  osc.frequency.value = frequency;
  const now = ctx.currentTime;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(volume, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
  osc.start(now);
  osc.stop(now + 0.4);
}

/**
 * Play all non-null frets in a tab column.
 * @param {AudioContext} ctx
 * @param {(number|null)[]} column - length 6, index 0 = high e
 * @param {number[]} tuning
 * @param {number} [volume=0.2]
 */
export function playColumn(ctx, column, tuning, volume = 0.2) {
  column.forEach((fret, stringIndex) => {
    if (fret != null) {
      playNote(ctx, stringIndex, fret, tuning, volume);
    }
  });
}
