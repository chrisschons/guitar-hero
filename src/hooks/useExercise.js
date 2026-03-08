import { useRef, useState, useMemo, useEffect, useCallback } from 'react';
import { createExerciseEngine } from '../core/exercise';
import { generateTab } from '../data/exerciseTypes';

/**
 * Hook that owns the exercise engine: generates tab from settings and advances on each metronome tick.
 * Returns tab, currentNotes, activeNoteIndex, onTick, reset, and getCurrentColumn (for playing audio in the same tick).
 */
export function useExercise(typeId, exerciseId, patternId, rootNote, subdivision = 2) {
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
    engine.setTab(tab);
  }, [engine, tab]);

  const state = engine.getState();
  const currentNotes = useMemo(
    () => engine.getCurrentNotes(),
    [engine, state.tickIndex]
  );
  const activeNoteIndex =
    state.tab.length && state.tickIndex >= 0
      ? ((state.tickIndex % state.tab.length) + state.tab.length) % state.tab.length
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
    return s.tab.length && s.tickIndex >= 0
      ? ((s.tickIndex % s.tab.length) + s.tab.length) % s.tab.length
      : -1;
  }, [engine]);

  return {
    tab,
    currentNotes,
    activeNoteIndex,
    onTick,
    reset,
    getCurrentColumn,
    getActiveNoteIndex,
  };
}
