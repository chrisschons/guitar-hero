/**
 * Convert a riff (note events) to a tab (array of columns) for the exercise engine.
 * Tab format: each column is length-6 array, index 0 = high e, 5 = low E; value = fret or null.
 *
 * Note format (1-based for editing): string 1–6 (1=high e, 6=low E), bar 1+, subdivision 1+ (slot within the bar).
 * Subdivisions per bar = timeSignature.num * (subdivisionsPerBeat ?? 2). E.g. 4/4 default → 8 subs/bar (eighth notes).
 * slot (0-based) = (bar - 1) * subdivisionsPerBar + (subdivision - 1).
 *
 * @param {import('../../data/riffs/gallops.js').Riff} riff
 * @returns {(number | null)[][]} tab
 */
export function riffToTab(riff) {
  const { notes, timeSignature } = riff;
  if (!notes.length) return [];

  const beatsPerBar = timeSignature?.num ?? 4;
  const subdivisionsPerBeat = riff.subdivisionsPerBeat ?? 2;
  const subdivisionsPerBar = beatsPerBar * subdivisionsPerBeat;

  let maxSlot = 0;
  for (const n of notes) {
    const bar = n.bar >= 1 ? n.bar : 1;
    const sub = n.subdivision >= 1 ? n.subdivision : 1;
    const slot = (bar - 1) * subdivisionsPerBar + (sub - 1);
    if (slot > maxSlot) maxSlot = slot;
  }

  const numColumns = maxSlot + 1;
  /** @type {(number | null)[][]} */
  const tab = Array.from({ length: numColumns }, () => [null, null, null, null, null, null]);

  for (const n of notes) {
    const bar = n.bar >= 1 ? n.bar : 1;
    const sub = n.subdivision >= 1 ? n.subdivision : 1;
    const stringIndex = Math.max(0, Math.min(5, n.string >= 1 ? n.string - 1 : 5));
    const slot = (bar - 1) * subdivisionsPerBar + (sub - 1);
    if (slot >= 0 && slot < numColumns) {
      tab[slot][stringIndex] = n.fret;
    }
  }

  return tab;
}
