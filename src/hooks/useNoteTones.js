import { useCallback } from 'react';
import { getAudioContext, resumeAudioContext, playColumn as playColumnEngine } from '../core/audio';
import { STANDARD_TUNING } from '../data/tunings';

/**
 * Thin wrapper around core/audio note playback. Uses shared AudioContext.
 * playColumn(column) plays all non-null frets using the given tuning.
 */
export function useNoteTones(isPlaying, volume = 0.7, tuning = STANDARD_TUNING) {
  const playColumn = useCallback(
    (column) => {
      if (volume === 0 || !column) return;
      const ctx = getAudioContext();
      if (ctx.state === 'suspended') ctx.resume();
      playColumnEngine(ctx, column, tuning, volume * 0.2);
    },
    [tuning, volume]
  );

  return { playColumn };
}
