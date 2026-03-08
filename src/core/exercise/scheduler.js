/**
 * Exercise scheduler: holds tab and tick index, advances on each metronome tick.
 * No UI; used by useExercise hook.
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
  };

  function getCurrentColumn() {
    const { tab, tickIndex, loop } = state;
    if (!tab.length || tickIndex < 0) return null;
    const i = loop ? ((tickIndex % tab.length) + tab.length) % tab.length : Math.min(tickIndex, tab.length - 1);
    return tab[i];
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
    if (state.tab.length && state.loop) {
      state.tickIndex = ((state.tickIndex % state.tab.length) + state.tab.length) % state.tab.length;
    }
  }

  function setTab(tab) {
    state.tab = Array.isArray(tab) ? tab : [];
    state.tickIndex = -1;
  }

  function reset() {
    state.tickIndex = -1;
  }

  function setLoop(loop) {
    state.loop = !!loop;
  }

  return {
    getState: () => ({ ...state }),
    getCurrentColumn,
    getCurrentNotes,
    onTick,
    setTab,
    reset,
    setLoop,
  };
}
