import { useCallback, useRef } from 'react';
import {
  getAudioContext,
  resumeAudioContext,
  playColumn as playColumnEngine,
  playColumnWithDuration as playColumnWithDurationEngine,
} from '../core/audio';
import { STANDARD_TUNING } from '../data/tunings';

/**
 * Thin wrapper around core/audio note playback. Uses shared AudioContext.
 * playColumn(column) plays all non-null frets (short pluck).
 * playColumnWithDuration(slotIndex, column, noteInfoPerString) uses riff duration: duration 1 = pluck, >1 = sustain.
 * Resumes context before playing so notes sound after user gesture (e.g. Play).
 */
export function useNoteTones(isPlaying, volume = 0.7, tuning = STANDARD_TUNING) {
  const activeSustainedRef = useRef(new Map());

  const playColumn = useCallback(
    (column) => {
      if (volume === 0 || !column || !Array.isArray(column)) return;
      const ctx = getAudioContext();
      const play = () => playColumnEngine(ctx, column, tuning, volume * 0.2);
      if (ctx.state === 'suspended') {
        resumeAudioContext().then(play);
      } else {
        play();
      }
    },
    [tuning, volume]
  );

  const playColumnWithDuration = useCallback(
    (slotIndex, column, noteInfoPerString) => {
      if (volume === 0 || !column || !Array.isArray(column)) return;
      const ctx = getAudioContext();
      const run = () =>
        playColumnWithDurationEngine(
          ctx,
          slotIndex,
          column,
          noteInfoPerString,
          tuning,
          volume * 0.2,
          activeSustainedRef.current
        );
      if (ctx.state === 'suspended') {
        resumeAudioContext().then(run);
      } else {
        run();
      }
    },
    [tuning, volume]
  );

  const stopAllSustained = useCallback(() => {
    const map = activeSustainedRef.current;
    map.forEach((entry) => entry.stop());
    map.clear();
  }, []);

  return { playColumn, playColumnWithDuration, stopAllSustained };
}
