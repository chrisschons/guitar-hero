import { useRef, useEffect, useCallback } from 'react';
import { getAudioContext, resumeAudioContext, createMetronome } from '../core/audio';
import { getBeatsPerBarForDots } from '../data/exerciseTypes';

/**
 * Thin wrapper around core/audio metronome. Starts/stops when isPlaying changes;
 * recreates metronome when bpm, subdivision, volume, or timeSignatureId change.
 */
export function useMetronome(bpm, subdivision, isPlaying, onBeat, onTick, onCountIn, volume = 0.3, timeSignatureId = '4/4') {
  const metronomeRef = useRef(null);
  const onBeatRef = useRef(onBeat);
  const onTickRef = useRef(onTick);
  const onCountInRef = useRef(onCountIn);
  onBeatRef.current = onBeat;
  onTickRef.current = onTick;
  onCountInRef.current = onCountIn;

  const beatsPerBar = getBeatsPerBarForDots(timeSignatureId);

  useEffect(() => {
    const meta = createMetronome({
      bpm,
      subdivision,
      beatsPerBar,
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
  }, [bpm, subdivision, volume, beatsPerBar]);

  useEffect(() => {
    if (isPlaying) {
      resumeAudioContext();
      metronomeRef.current?.start();
    } else {
      metronomeRef.current?.stop();
    }
  }, [isPlaying, bpm, subdivision, beatsPerBar]);

  const reset = useCallback(() => {
    metronomeRef.current?.reset();
    onBeatRef.current?.(-1);
  }, []);

  return { reset };
}
