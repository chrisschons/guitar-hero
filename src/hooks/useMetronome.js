import { useRef, useEffect, useCallback } from 'react';
import { getAudioContext, resumeAudioContext, createMetronome } from '../core/audio';

/**
 * Thin wrapper around core/audio metronome. Starts/stops when isPlaying changes;
 * recreates metronome when bpm, subdivision, or volume change.
 */
export function useMetronome(bpm, subdivision, isPlaying, onBeat, onTick, onCountIn, volume = 0.3) {
  const metronomeRef = useRef(null);
  const onBeatRef = useRef(onBeat);
  const onTickRef = useRef(onTick);
  const onCountInRef = useRef(onCountIn);
  onBeatRef.current = onBeat;
  onTickRef.current = onTick;
  onCountInRef.current = onCountIn;

  useEffect(() => {
    const meta = createMetronome({
      bpm,
      subdivision,
      volume,
      onBeat: (beat) => onBeatRef.current?.(beat),
      onTick: (tick) => onTickRef.current?.(tick),
      onCountIn: (n) => onCountInRef.current?.(n),
    });
    metronomeRef.current = meta;
    return () => {
      meta.stop();
      metronomeRef.current = null;
    };
  }, [bpm, subdivision, volume]);

  useEffect(() => {
    if (isPlaying) {
      resumeAudioContext();
      metronomeRef.current?.start();
    } else {
      metronomeRef.current?.stop();
    }
  }, [isPlaying, bpm, subdivision]);

  const reset = useCallback(() => {
    metronomeRef.current?.reset();
    onBeatRef.current?.(-1);
  }, []);

  return { reset };
}
