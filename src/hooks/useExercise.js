import { useRef, useState, useMemo, useEffect, useCallback } from 'react';
import { createExerciseEngine } from '../core/exercise';
import { generateTab } from '../data/exerciseTypes';

/**
 * Hook that owns the exercise engine: generates tab from settings and advances on each metronome tick.
 * When ticksPerBar is provided, loop length is rounded up to a full bar so blank space at end of bar is respected.
 * Returns tab, currentNotes, activeNoteIndex, onTick, reset, getCurrentColumn, getActiveNoteIndex, loopTicks.
 */
export function useExercise(typeId, exerciseId, patternId, rootNote, subdivision = 2, ticksPerBar = 0) {
  const engineRef = useRef(null);
  if (!engineRef.current) {
    engineRef.current = createExerciseEngine();
  }
  const engine = engineRef.current;

  const [, setTick] = useState(0);

  const tab = useMemo(
    () => generateTab(typeId, exerciseId, patternId, rootNote, subdivision),
    [typeId, exerciseId, patternId, rootNote, subdivision]
  );

  useEffect(() => {
    engine.setTab(tab, ticksPerBar);
  }, [engine, tab, ticksPerBar]);

  const state = engine.getState();
  const loopTicks = engine.getLoopTicks();
  const currentNotes = useMemo(
    () => engine.getCurrentNotes(),
    [engine, state.tickIndex]
  );
  // During blank space (tickIndex >= tab.length), hold at last column for scroll/display; otherwise use tickIndex
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

  return {
    tab,
    currentNotes,
    activeNoteIndex,
    onTick,
    reset,
    getCurrentColumn,
    getActiveNoteIndex,
    loopTicks,
  };
}
