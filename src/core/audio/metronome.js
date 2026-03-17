/**
 * Metronome: schedule click sounds and callbacks at BPM/subdivision rate.
 * Uses getAudioContext() for a single shared context.
 * Clicks are scheduled at precise AudioContext.currentTime for accurate timing (lookahead).
 */

import { getAudioContext } from './audioContext.js';

const LOOKAHEAD_SEC = 0.2; // Schedule clicks up to 200ms ahead

/**
 * Play a single click (sine, short envelope) at a precise context time.
 * @param {AudioContext} ctx
 * @param {number} frequency - Hz
 * @param {number} gainValue - 0–1
 * @param {number} when - ctx.currentTime when to play
 */
function playClickAt(ctx, frequency, gainValue, when) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.frequency.value = frequency;
  osc.type = 'sine';
  gain.gain.setValueAtTime(0, when);
  gain.gain.setValueAtTime(gainValue, when);
  gain.gain.exponentialRampToValueAtTime(0.001, when + 0.1);
  osc.start(when);
  osc.stop(when + 0.1);
}

/**
 * Create a metronome scheduler. Call start() when playback begins, stop() when it ends.
 * schedule() should be called periodically (e.g. every 25ms) while running.
 *
 * @param {object} options
 * @param {number} options.bpm - quarter notes per minute
 * @param {number} options.subdivision - subdivisions per beat (e.g. 4 for 16ths in 3/4, 6 for 8ths in 6/8)
 * @param {number} [options.beatsPerBar=4] - musical beats per bar (3 for 3/4, 2 for 6/8)
 * @param {number} [options.beatUnit=1] - beat duration in quarter notes (1 = quarter, 1.5 = dotted quarter for 6/8)
 * @param {number} [options.countInBeats] - count-in beats before first tick; 0 = no count-in (default: beatsPerBar)
 * @param {number} [options.volume=0.3] - click volume 0–1
 * @param { (beat: number) => void } [options.onBeat]
 * @param { (tick: number) => void } [options.onTick]
 * @param { (remaining: number) => void } [options.onCountIn]
 */
export function createMetronome(options) {
  const { bpm, subdivision, volume = 0.1, onBeat, onTick, onCountIn } = options;
  const beatsPerBar = Math.max(1, Number(options.beatsPerBar) || 4);
  const beatUnit = Number(options.beatUnit) || 1; // 1 = quarter, 1.5 = dotted quarter (6/8)
  const countInBeats = Number(options.countInBeats) ?? beatsPerBar;
  const maxGain = 0.5;
  const effectiveVolume = Math.min(1, volume) * maxGain;

  let nextNoteTime = 0;
  let currentBeat = 0;
  let currentTick = 0;
  let countIn = countInBeats > 0 ? 0 : beatsPerBar; // skip count-in when 0
  let timerId = null;

  const secondsPerBeat = (60.0 / bpm) * beatUnit;
  const secondsPerNote = secondsPerBeat / subdivision;

  function schedule() {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    while (nextNoteTime < now + LOOKAHEAD_SEC) {
      const isCountingIn = countInBeats > 0 && countIn < countInBeats;

      if (isCountingIn) {
        const countValue = countInBeats - countIn;
        countIn += 1;
        const when = nextNoteTime;
        if (effectiveVolume > 0) {
          playClickAt(ctx, 1200, effectiveVolume, when);
        } else {
          playClickAt(ctx, 1200, 0.25, when);
        }
        const delayMs = (when - now) * 1000;
        if (delayMs >= 0) setTimeout(() => onCountIn?.(countValue), delayMs);
        nextNoteTime += secondsPerBeat;
      } else {
        const beatForCallback = currentBeat;
        const when = nextNoteTime;
        if (effectiveVolume > 0) {
          const freq = beatForCallback === 0 ? 1000 : 800;
          const gain = beatForCallback === 0 ? effectiveVolume : effectiveVolume * 0.4;
          playClickAt(ctx, freq, gain, when);
        }
        const delayMs = (when - now) * 1000;
        if (delayMs >= 0) setTimeout(() => onBeat?.(beatForCallback), delayMs);

        for (let sub = 0; sub < subdivision; sub++) {
          const subWhen = nextNoteTime + sub * secondsPerNote;
          const subDelayMs = (subWhen - now) * 1000;
          const tickForCallback = currentTick + sub;
          // Fire onTick even when behind (use 0 delay so note playback still runs)
          setTimeout(() => onTick?.(tickForCallback), Math.max(0, subDelayMs));
        }

        nextNoteTime += secondsPerBeat;
        currentTick += subdivision;
        currentBeat = (currentBeat + 1) % beatsPerBar;
      }
    }
  }

  return {
    start() {
      const ctx = getAudioContext();
      if (ctx.state === 'suspended') ctx.resume();
      nextNoteTime = ctx.currentTime;
      currentBeat = 0;
      currentTick = 0;
      countIn = 0;
      timerId = setInterval(schedule, 25);
    },

    stop() {
      if (timerId) {
        clearInterval(timerId);
        timerId = null;
      }
    },

    reset() {
      currentBeat = 0;
      currentTick = 0;
      countIn = 0;
      onBeat?.(-1);
    },
  };
}
