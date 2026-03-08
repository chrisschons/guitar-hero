/**
 * Tuner: microphone input → pitch detection → frequency → note + cents.
 * Uses AnalyserNode FFT and parabolic interpolation for sub-bin frequency estimate.
 */

import { getAudioContext } from './audioContext.js';
import { frequencyToNoteCents } from '../music/notes.js';

const DEFAULT_FFT_SIZE = 8192;
const DEFAULT_SMOOTHING = 0.8;
const MIN_MAGNITUDE = 0.001;
const MIN_FREQ = 55;
const MAX_FREQ = 1200;

/**
 * Parabolic interpolation for peak frequency between FFT bins.
 * @param {Float32Array} data - frequency data
 * @param {number} peakIndex
 * @returns {number} fractional bin offset (delta)
 */
function parabolicInterpolation(data, peakIndex) {
  const n = data.length;
  if (peakIndex <= 0 || peakIndex >= n - 1) return 0;
  const y0 = data[peakIndex - 1];
  const y1 = data[peakIndex];
  const y2 = data[peakIndex + 1];
  const denom = y0 - 2 * y1 + y2;
  if (Math.abs(denom) < 1e-10) return 0;
  return 0.5 * (y0 - y2) / denom;
}

/**
 * Find the peak frequency in the FFT data (with parabolic interpolation).
 * @param {Float32Array} data
 * @param {number} sampleRate
 * @param {number} fftSize
 * @returns {{ frequency: number, magnitude: number } | null}
 */
function findPeakFrequency(data, sampleRate, fftSize) {
  const binWidth = sampleRate / fftSize;
  let peakIndex = 0;
  let peakMagnitude = 0;

  const minBin = Math.floor(MIN_FREQ / binWidth);
  const maxBin = Math.min(data.length - 1, Math.ceil(MAX_FREQ / binWidth));

  for (let i = minBin; i <= maxBin; i++) {
    if (data[i] > peakMagnitude) {
      peakMagnitude = data[i];
      peakIndex = i;
    }
  }

  if (peakMagnitude < MIN_MAGNITUDE) return null;

  const delta = parabolicInterpolation(data, peakIndex);
  const frequency = (peakIndex + delta) * binWidth;
  return { frequency, magnitude: peakMagnitude };
}

/**
 * Create a tuner that analyses mic input and reports note + cents via callback.
 * @param {object} [options]
 * @param {(result: { noteName: string, cents: number, frequency: number } | null) => void} [options.onPitch]
 * @param {number} [options.fftSize]
 * @returns {Promise<{ stop: () => void }>} Resolves when mic is active; user must call stop() when done.
 */
export async function startTuner(options = {}) {
  const { onPitch, fftSize = DEFAULT_FFT_SIZE } = options;

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') await ctx.resume();

  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = fftSize;
  analyser.smoothingTimeConstant = DEFAULT_SMOOTHING;
  analyser.minDecibels = -90;
  analyser.maxDecibels = -10;
  source.connect(analyser);

  const dataArray = new Float32Array(analyser.frequencyBinCount);
  let animationId = null;

  function tick() {
    analyser.getFloatFrequencyData(dataArray);
    const peak = findPeakFrequency(dataArray, ctx.sampleRate, analyser.fftSize);
    if (peak && onPitch) {
      const noteCents = frequencyToNoteCents(peak.frequency);
      if (noteCents) {
        onPitch({
          noteName: noteCents.noteName,
          cents: noteCents.cents,
          frequency: peak.frequency,
        });
      } else {
        onPitch(null);
      }
    } else if (onPitch) {
      onPitch(null);
    }
    animationId = requestAnimationFrame(tick);
  }

  tick();

  return {
    stop() {
      if (animationId != null) cancelAnimationFrame(animationId);
      stream.getTracks().forEach((t) => t.stop());
      source.disconnect();
    },
  };
}
