/**
 * Subdivisions per bar from time signature.
 * Smallest grid unit: 16ths for x/4 (4 per quarter), 16ths for x/8 (2 per eighth).
 * 4/4 → 16, 3/4 → 12, 6/8 → 12 (6 eighths × 2), 12/8 → 24.
 * @param {{ num: number, denom: number }} timeSignature
 * @returns {number}
 */
export function getSubdivisionsPerBar(timeSignature) {
  const num = timeSignature?.num ?? 4;
  const denom = timeSignature?.denom ?? 4;
  if (denom === 8) return num * 2;  // compound: 6/8 → 12, 12/8 → 24 (2 sixteenths per eighth)
  return num * 4;                   // simple: 4/4 → 16, 3/4 → 12 (4 sixteenths per quarter)
}

/** Subdivisions per beat for metronome/tick rate. 4/4 → 4, 6/8 → 6 (2 dotted-quarter beats), 3/4 → 4. */
export function getSubdivisionsPerBeat(timeSignature) {
  const subsPerBar = getSubdivisionsPerBar(timeSignature);
  const num = timeSignature?.num ?? 4;
  const denom = timeSignature?.denom ?? 4;
  // Compound (x/8): beats are dotted quarters. 6/8 = 2 beats, 12/8 = 4 beats (num/3).
  const beatsPerBar = denom === 8 ? num / 3 : num;
  return Math.max(1, Math.round(subsPerBar / beatsPerBar));
}

/**
 * Convert a riff (note events) to a tab (array of columns) for the exercise engine.
 * Tab format: each column is length-6 array, index 0 = high e, 5 = low E; value = fret or null.
 *
 * Note format (1-based for editing): string 1–6 (1=high e, 6=low E), bar 1+, subdivision 1+ (slot within the bar).
 * Subdivisions per bar from getSubdivisionsPerBar(timeSignature). slot (0-based) = (bar - 1) * subdivisionsPerBar + (subdivision - 1).
 *
 * @param {import('../../data/riffs/gallops.js').Riff} riff
 * @returns {(number | null)[][]} tab
 */
export function riffToTab(riff) {
  const { notes, timeSignature } = riff;
  if (!notes.length) return [];

  const subdivisionsPerBar = getSubdivisionsPerBar(timeSignature);

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
