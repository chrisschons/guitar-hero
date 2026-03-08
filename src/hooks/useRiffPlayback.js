import { useRef, useState, useMemo, useEffect, useCallback } from 'react';
import { createExerciseEngine } from '../core/exercise';
import { riffToTab } from '../core/exercise/riffToTab';

const BARS = 8;

/**
 * Playback for a single riff object (e.g. editor state). Uses same engine as useExercise.
 * Tab is padded to BARS so loop is exactly 8 bars.
 * @param {import('../data/riffs/gallops.js').Riff} riff
 * @returns {{ tab: (number|null)[][], activeNoteIndex: number, onTick: () => void, reset: () => void, getCurrentColumn: () => (number|null)[]|null, getActiveNoteIndex: () => number, loopTicks: number }}
 */
export function useRiffPlayback(riff) {
  const engineRef = useRef(null);
  if (!engineRef.current) engineRef.current = createExerciseEngine();
  const engine = engineRef.current;

  const [, setTick] = useState(0);
  const beatsPerBar = riff?.timeSignature?.num ?? 4;
  const subdivisionsPerBeat = riff?.subdivisionsPerBeat ?? 2;
  const subdivisionsPerBar = beatsPerBar * subdivisionsPerBeat;
  const targetColumns = BARS * subdivisionsPerBar;

  const tab = useMemo(() => {
    if (!riff?.notes) return [];
    const t = riffToTab(riff);
    if (t.length >= targetColumns) return t.slice(0, targetColumns);
    return [
      ...t,
      ...Array.from({ length: targetColumns - t.length }, () => [null, null, null, null, null, null]),
    ];
  }, [riff, targetColumns]);

  useEffect(() => {
    engine.setTab(tab, subdivisionsPerBar);
  }, [engine, tab, subdivisionsPerBar]);

  const state = engine.getState();
  const loopTicks = engine.getLoopTicks();
  const activeNoteIndex =
    state.tab.length && state.tickIndex >= 0
      ? state.tickIndex < state.tab.length
        ? state.tickIndex
        : state.tab.length - 1
      : -1;

  const onTick = useCallback(() => {
    engine.onTick();
    setTick((t) => t + 1);
  }, [engine]);

  const reset = useCallback(() => {
    engine.reset();
    setTick((t) => t + 1);
  }, [engine]);

  const getCurrentColumn = useCallback(() => engine.getCurrentColumn(), [engine]);
  const getActiveNoteIndex = useCallback(() => {
    const s = engine.getState();
    if (!s.tab.length || s.tickIndex < 0) return -1;
    return s.tickIndex < s.tab.length ? s.tickIndex : s.tab.length - 1;
  }, [engine]);

  const seek = useCallback(
    (tickIndex) => {
      engine.seek(tickIndex);
      setTick((t) => t + 1);
    },
    [engine]
  );

  return {
    tab,
    activeNoteIndex,
    onTick,
    reset,
    seek,
    getCurrentColumn,
    getActiveNoteIndex,
    loopTicks,
  };
}
