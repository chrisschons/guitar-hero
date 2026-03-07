import { useRef, useEffect, useCallback } from 'react';

// Standard guitar tuning frequencies (E2 to E4)
const STRING_BASE_FREQUENCIES = [
  329.63, // e (high E)
  246.94, // B
  196.00, // G
  146.83, // D
  110.00, // A
  82.41,  // E (low E)
];

// Calculate frequency for a given string and fret
function getNoteFrequency(stringIndex, fret) {
  const baseFreq = STRING_BASE_FREQUENCIES[stringIndex];
  return baseFreq * Math.pow(2, fret / 12);
}

export function useNoteTones(isPlaying, volume = 0.7) {
  const audioContextRef = useRef(null);

  const initAudio = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    return audioContextRef.current;
  }, []);

  const playNote = useCallback((stringIndex, fret) => {
    const ctx = initAudio();
    if (!ctx || volume === 0) return;

    const frequency = getNoteFrequency(stringIndex, fret);

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    // Soft triangle wave for a mellow guitar-like tone
    osc.type = 'triangle';
    osc.frequency.value = frequency;

    const now = ctx.currentTime;
    // Quick attack, medium decay for a pluck-like sound
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume * 0.2, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc.start(now);
    osc.stop(now + 0.4);
  }, [initAudio, volume]);

  const playColumn = useCallback((column) => {
    column.forEach((fret, stringIndex) => {
      if (fret !== null) {
        playNote(stringIndex, fret);
      }
    });
  }, [playNote]);

  useEffect(() => {
    if (isPlaying) {
      initAudio();
    }
  }, [isPlaying, initAudio]);

  return { playColumn };
}
