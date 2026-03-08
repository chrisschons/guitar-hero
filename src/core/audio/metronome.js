/**
 * Metronome: schedule click sounds and callbacks at BPM/subdivision rate.
 * Uses getAudioContext() for a single shared context.
 */

import { getAudioContext } from './audioContext.js';

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
 * @param {number} [options.beatsPerBar=4] - beats per bar (from time signature, e.g. 4 for 4/4, 6 for 6/8)
 * @param {number} [options.volume=0.3] - click volume 0–1
 * @param { (beat: number) => void } [options.onBeat]
 * @param { (tick: number) => void } [options.onTick]
 * @param { (remaining: number) => void } [options.onCountIn]
 */
export function createMetronome(options) {
  const { bpm, subdivision, volume = 0.3, onBeat, onTick, onCountIn } = options;
  const beatsPerBar = Math.max(1, Number(options.beatsPerBar) || 4);
  const maxGain = 0.5;
  const effectiveVolume = Math.min(1, volume) * maxGain;

  let nextNoteTime = 0;
  let currentBeat = 0;
  let currentTick = 0;
  let countIn = 0;
  let timerId = null;

  const secondsPerBeat = 60.0 / bpm;
  const secondsPerNote = secondsPerBeat / subdivision;

  function schedule() {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    while (nextNoteTime < now + 0.1) {
      const countInBeats = beatsPerBar;
      const isCountingIn = countIn < countInBeats;
      const delayMs = (nextNoteTime - now) * 1000;

      if (isCountingIn) {
        const countValue = countInBeats - countIn;
        countIn += 1;
        setTimeout(() => {
          const c = getAudioContext();
          const countInGain = effectiveVolume > 0 ? effectiveVolume : 0.25;
          playClickAt(c, 1200, countInGain, c.currentTime);
          onCountIn?.(countValue);
        }, Math.max(0, delayMs));
        nextNoteTime += secondsPerBeat;
        // Do not advance currentBeat or call onBeat during count-in; first real beat will be 0
      } else {
        // Metronome ticks on beats only: play click and report beat
        const beatForCallback = currentBeat;
        if (effectiveVolume > 0) {
          setTimeout(() => {
            const c = getAudioContext();
            const freq = beatForCallback === 0 ? 1000 : 800;
            const gain = beatForCallback === 0 ? effectiveVolume : effectiveVolume * 0.4;
            playClickAt(c, freq, gain, c.currentTime);
          }, Math.max(0, delayMs));
        }
        setTimeout(() => onBeat?.(beatForCallback), Math.max(0, delayMs));

        // Fire onTick at subdivision rate within this beat so the exercise advances correctly
        for (let sub = 0; sub < subdivision; sub++) {
          const subDelayMs = (nextNoteTime + sub * secondsPerNote - now) * 1000;
          const tickForCallback = currentTick + sub;
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
