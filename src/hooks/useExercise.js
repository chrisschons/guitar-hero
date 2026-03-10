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

  const tab = useMemo(() => {
    const result = generateTab(typeId, exerciseId, patternId, rootNote, subdivision);
    // #region agent log
    if (result?.length && typeId === 'major-3nps' && typeof fetch !== 'undefined') {
      const firstThreeLowE = result.slice(0, 3).map((col) => (col && col[5]) ?? null);
      fetch('http://127.0.0.1:7481/ingest/7c3e261f-81b5-47e6-baf0-d02d2bca5bcd',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'2abbdd'},body:JSON.stringify({sessionId:'2abbdd',location:'useExercise.js:tab useMemo',message:'Tab generated (no tuning in deps)',data:{typeId,rootNote,firstThreeLowE},timestamp:Date.now(),hypothesisId:'H2'})}).catch(()=>{});
    }
    // #endregion
    return result;
  }, [typeId, exerciseId, patternId, rootNote, subdivision]);

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
