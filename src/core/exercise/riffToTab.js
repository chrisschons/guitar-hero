/**
 * Convert a riff (note events) to a tab (array of columns) for the exercise engine.
 * Tab format: each column is length-6 array, index 0 = high e, 5 = low E; value = fret or null.
 *
 * @param {import('../../data/riffs/gallops.js').Riff} riff
 * @param {number} subdivisionsPerBeat - e.g. 2 for eighth notes
 * @returns {(number | null)[][]} tab
 */
export function riffToTab(riff, subdivisionsPerBeat = 2) {
  const { notes } = riff;
  if (!notes.length) return [];

  let maxSlot = 0;
  for (const n of notes) {
    const slot = n.beat * subdivisionsPerBeat + n.subdivision;
    if (slot > maxSlot) maxSlot = slot;
  }

  const numColumns = maxSlot + 1;
  /** @type {(number | null)[][]} */
  const tab = Array.from({ length: numColumns }, () => [null, null, null, null, null, null]);

  for (const n of notes) {
    const slot = n.beat * subdivisionsPerBeat + n.subdivision;
    if (slot >= 0 && slot < numColumns && n.string >= 0 && n.string <= 5) {
      tab[slot][n.string] = n.fret;
    }
  }

  return tab;
}
