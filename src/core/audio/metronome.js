/**
 * Metronome: schedule click sounds and callbacks at BPM/subdivision rate.
 * Uses getAudioContext() for a single shared context.
 */

import { getAudioContext } from './audioContext.js';

const COUNT_IN_BEATS = 4;

/**
 * Play a single click (sine, short envelope).
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
 * @param {number} options.bpm
 * @param {number} options.subdivision - notes per beat (1–8)
 * @param {number} [options.volume=0.3] - click volume 0–1
 * @param { (beat: number) => void } [options.onBeat]
 * @param { (tick: number) => void } [options.onTick]
 * @param { (remaining: number) => void } [options.onCountIn]
 */
export function createMetronome(options) {
  const { bpm, subdivision, volume = 0.3, onBeat, onTick, onCountIn } = options;

  let nextNoteTime = 0;
  let currentBeat = 0;
  let currentSubBeat = 0;
  let currentTick = 0;
  let countIn = 0;
  let timerId = null;

  const secondsPerBeat = 60.0 / bpm;
  const secondsPerNote = secondsPerBeat / subdivision;

  function schedule() {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    while (nextNoteTime < now + 0.1) {
      const isCountingIn = countIn < COUNT_IN_BEATS;
      const delayMs = (nextNoteTime - now) * 1000;

      if (isCountingIn) {
        const countValue = COUNT_IN_BEATS - countIn;
        countIn += 1;
        setTimeout(() => {
          const c = getAudioContext();
          playClickAt(c, 1200, 0.5, c.currentTime);
          onCountIn?.(countValue);
          onBeat?.(currentBeat);
        }, Math.max(0, delayMs));
        nextNoteTime += secondsPerBeat;
        currentBeat = (currentBeat + 1) % 4;
      } else {
        const isOnBeat = currentSubBeat === 0;
        if (isOnBeat && volume > 0) {
          setTimeout(() => {
            const c = getAudioContext();
            const freq = currentBeat === 0 ? 1000 : 800;
            const gain = currentBeat === 0 ? volume : volume * 0.4;
            playClickAt(c, freq, gain, c.currentTime);
          }, Math.max(0, delayMs));
        }
        setTimeout(() => {
          if (currentSubBeat === 0) onBeat?.(currentBeat);
          onTick?.(currentTick);
        }, Math.max(0, delayMs));

        nextNoteTime += secondsPerNote;
        currentTick += 1;
        currentSubBeat += 1;
        if (currentSubBeat >= subdivision) {
          currentSubBeat = 0;
          currentBeat = (currentBeat + 1) % 4;
        }
      }
    }
  }

  return {
    start() {
      const ctx = getAudioContext();
      if (ctx.state === 'suspended') ctx.resume();
      nextNoteTime = ctx.currentTime;
      currentBeat = 0;
      currentSubBeat = 0;
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
      currentSubBeat = 0;
      currentTick = 0;
      countIn = 0;
      onBeat?.(-1);
    },
  };
}
