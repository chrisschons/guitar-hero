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
 * @param {number} [delaySec=0] - schedule note at ctx.currentTime + delaySec (for tuplet timing)
 */
export function playNote(ctx, stringIndex, fret, tuning, volume = 0.2, openOctaves, delaySec = 0) {
  const frequency = getNoteFrequency(stringIndex, fret, tuning, openOctaves);
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = 'triangle';
  osc.frequency.value = frequency;
  const now = ctx.currentTime + delaySec;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(volume, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
  osc.start(now);
  osc.stop(now + 0.4);
}

const RELEASE_SEC = 0.03;

/**
 * Start a sustained note; returns a handle with stop() to end it (short release).
 * @param {AudioContext} ctx
 * @param {number} stringIndex
 * @param {number} fret
 * @param {number[]} tuning
 * @param {number} [volume=0.2]
 * @param {number[]} [openOctaves]
 * @returns {{ stop: () => void }}
 */
export function playNoteStart(ctx, stringIndex, fret, tuning, volume = 0.2, openOctaves) {
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
  osc.start(now);

  return {
    stop() {
      const t = ctx.currentTime;
      gain.gain.setValueAtTime(gain.gain.value, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + RELEASE_SEC);
      osc.stop(t + RELEASE_SEC);
    },
  };
}

/**
 * Play all non-null frets in a tab column.
 * @param {AudioContext} ctx
 * @param {(number|null)[]} column - length 6, index 0 = high e
 * @param {number[]} tuning
 * @param {number} [volume=0.2]
 * @param {number[]} [openOctaves]
 */
export function playColumn(ctx, column, tuning, volume = 0.2, openOctaves) {
  column.forEach((fret, stringIndex) => {
    if (fret != null) {
      playNote(ctx, stringIndex, fret, tuning, volume, openOctaves);
    }
  });
}

/**
 * Play column using riff note duration: duration 1 = pluck, duration > 1 = sustain (start at note start, stop when leaving span).
 * For tuplet notes, onsetSlot is fractional; use slotDurationSec to schedule the pluck at the correct time within the slot.
 * @param {AudioContext} ctx
 * @param {number} slotIndex - current playback slot
 * @param {(number|null)[]} column - length 6
 * @param {({ fret: number, duration: number, startSlot: number, onsetSlot?: number } | null)[]} noteInfoPerString - length 6
 * @param {number[]} tuning
 * @param {number} [volume=0.2]
 * @param {Map<number, { stop: () => void, endSlot: number }>} activeNotes - mutated
 * @param {number} [slotDurationSec] - seconds per slot; when set, notes with onsetSlot are scheduled at (onsetSlot - slotIndex) * slotDurationSec
 * @param {number[]} [openOctaves]
 */
export function playColumnWithDuration(ctx, slotIndex, column, noteInfoPerString, tuning, volume = 0.2, activeNotes, slotDurationSec, openOctaves) {
  if (!column || !Array.isArray(column)) return;

  for (let stringIndex = 0; stringIndex < 6; stringIndex++) {
    const fret = column[stringIndex];
    const entry = activeNotes.get(stringIndex);
    const infos = noteInfoPerString[stringIndex];
    const list = Array.isArray(infos) ? infos : infos ? [infos] : [];

    if (entry && slotIndex > entry.endSlot) {
      entry.stop();
      activeNotes.delete(stringIndex);
    }

    if (list.length === 0) {
      if (fret != null) playNote(ctx, stringIndex, fret, tuning, volume, openOctaves);
      continue;
    }

    for (const info of list) {
      if (info.duration === 1) {
        const delaySec =
          slotDurationSec != null && info.onsetSlot != null
            ? Math.max(0, (info.onsetSlot - slotIndex) * slotDurationSec)
            : 0;
        playNote(ctx, stringIndex, info.fret, tuning, volume, openOctaves, delaySec);
        continue;
      }

      const endSlot = info.startSlot + info.duration - 1;
      if (slotIndex === info.startSlot) {
        if (entry) {
          entry.stop();
          activeNotes.delete(stringIndex);
        }
        const handle = playNoteStart(ctx, stringIndex, info.fret, tuning, volume, openOctaves);
        activeNotes.set(stringIndex, { stop: handle.stop, endSlot });
      }
    }
  }
}
