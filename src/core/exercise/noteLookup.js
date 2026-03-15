/**
 * Build a lookup from (slotIndex, stringIndex) to note info for playback (pluck vs sustain).
 * Uses riff note data so duration is authoritative: duration 1 = pluck, duration > 1 = sustain.
 */

import { getSubdivisionsPerBar } from './riffToTab.js';

/**
 * @param {import('../../types/riff').Riff} riff
 * @returns {(slotIndex: number, stringIndex: number) => { fret: number, duration: number, startSlot: number } | null}
 */
export function buildNoteLookup(riff) {
  const notes = riff?.notes ?? [];
  const timeSignature = riff?.timeSignature;
  const subdivisionsPerBar = getSubdivisionsPerBar(timeSignature);

  /** @type {Map<string, { fret: number, duration: number, startSlot: number }>} */
  const map = new Map();

  for (const n of notes) {
    const bar = n.bar >= 1 ? n.bar : 1;
    const sub = n.subdivision >= 1 ? n.subdivision : 1;
    const stringIndex = Math.max(0, Math.min(5, n.string >= 1 ? n.string - 1 : 5));
    const duration = n.durationSubdivisions && n.durationSubdivisions > 0 ? n.durationSubdivisions : 1;
    const startSlot = (bar - 1) * subdivisionsPerBar + (sub - 1);
    const endSlot = startSlot + duration - 1;
    for (let slot = startSlot; slot <= endSlot; slot += 1) {
      map.set(`${slot},${stringIndex}`, { fret: n.fret, duration, startSlot });
    }
  }

  return (slotIndex, stringIndex) => map.get(`${slotIndex},${stringIndex}`) ?? null;
}
