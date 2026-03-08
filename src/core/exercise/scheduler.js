/**
 * Exercise scheduler: holds tab and tick index, advances on each metronome tick.
 * Loops at bar boundaries so blank space at end of a bar is respected before looping.
 */

/**
 * @typedef {(number | null)[]} TabColumn - length 6
 */

/**
 * Create an exercise engine that holds tab state and advances on each tick.
 */
export function createExerciseEngine() {
  let state = {
    /** @type {TabColumn[]} */
    tab: [],
    tickIndex: -1,
    loop: true,
    /** total ticks before loop reset (>= tab.length); when 0, use tab.length */
    loopTicks: 0,
  };

  function getLoopTicks() {
    if (!state.tab.length) return 0;
    if (state.loopTicks > 0) return state.loopTicks;
    return state.tab.length;
  }

  function getCurrentColumn() {
    const { tab, tickIndex } = state;
    if (!tab.length || tickIndex < 0) return null;
    if (tickIndex >= tab.length) return null; // blank space at end of bar
    return tab[tickIndex];
  }

  function getCurrentNotes() {
    const col = getCurrentColumn();
    if (!col) return [];
    return col
      .map((fret, stringIndex) => (fret != null ? { stringIndex, fret } : null))
      .filter(Boolean);
  }

  function onTick() {
    state.tickIndex += 1;
    const loopTicks = getLoopTicks();
    if (loopTicks > 0 && state.loop && state.tickIndex >= loopTicks) {
      state.tickIndex = 0;
    }
  }

  function setTab(tab, ticksPerBar = 0) {
    state.tab = Array.isArray(tab) ? tab : [];
    state.tickIndex = -1;
    state.loopTicks = 0;
    if (state.tab.length && ticksPerBar > 0) {
      state.loopTicks = Math.ceil(state.tab.length / ticksPerBar) * ticksPerBar;
    }
  }

  function reset() {
    state.tickIndex = -1;
  }

  /** Set tick index (e.g. after user drags scroll). Clamps to [0, loopTicks - 1]. */
  function seek(tickIndex) {
    const loopTicks = getLoopTicks();
    if (loopTicks > 0) {
      state.tickIndex = Math.max(0, Math.min(loopTicks - 1, Math.floor(tickIndex)));
    }
  }

  function setLoop(loop) {
    state.loop = !!loop;
  }

  return {
    getState: () => ({ ...state }),
    getLoopTicks,
    getCurrentColumn,
    getCurrentNotes,
    onTick,
    setTab,
    reset,
    seek,
    setLoop,
  };
}
