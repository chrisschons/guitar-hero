/**
 * Build a lookup from (slotIndex, stringIndex) to note info for playback (pluck vs sustain).
 * Uses riff note data so duration is authoritative: duration 1 = pluck, duration > 1 = sustain.
 * For notes in a tuplet group, onset is computed from group ratio and indexInGroup. We store
 * the fractional onsetSlot so playback can schedule the note at the correct time within the slot
 * (triplets: 3 notes evenly across 4 slots, not 3 on-the-grid notes + rest).
 */

import { getSubdivisionsPerBar } from './riffToTab.js';

/**
 * @param {import('../../types/riff').Riff} riff
 * @returns {(slotIndex: number, stringIndex: number) => { fret: number, duration: number, startSlot: number, onsetSlot?: number }[]}
 */
export function buildNoteLookup(riff) {
  const notes = riff?.notes ?? [];
  const timeSignature = riff?.timeSignature;
  const rhythmGroups = riff?.rhythmGroups ?? [];
  const subdivisionsPerBar = getSubdivisionsPerBar(timeSignature);

  /** @type {Map<string, { fret: number, duration: number, startSlot: number, onsetSlot?: number }[]>} */
  const map = new Map();

  const groupById = new Map(rhythmGroups.map((g) => [g.id, g]));

  function push(key, info) {
    const list = map.get(key) ?? [];
    list.push(info);
    map.set(key, list);
  }

  for (const n of notes) {
    const stringIndex = Math.max(0, Math.min(5, n.string >= 1 ? n.string - 1 : 5));
    const bar = n.bar >= 1 ? n.bar : 1;
    const sub = n.subdivision >= 1 ? n.subdivision : 1;
    const startSlot = (bar - 1) * subdivisionsPerBar + (sub - 1);
    const duration = n.durationSubdivisions && n.durationSubdivisions > 0 ? n.durationSubdivisions : 1;
    const endSlot = startSlot + duration - 1;

    const group = n.rhythmGroupId ? groupById.get(n.rhythmGroupId) : null;
    const indexInGroup = n.indexInGroup ?? 0;

    if (group?.type === 'tuplet' && group.tupletRatio) {
      const spanSlots = group.endSlot - group.startSlot + 1;
      const nNotes = group.tupletRatio.n;
      const onsetSlot = group.startSlot + (indexInGroup / nNotes) * spanSlots;
      const triggerSlot = Math.floor(onsetSlot);
      push(`${triggerSlot},${stringIndex}`, {
        fret: n.fret,
        duration: 1,
        startSlot: triggerSlot,
        onsetSlot,
      });
    } else {
      for (let slot = startSlot; slot <= endSlot; slot += 1) {
        push(`${slot},${stringIndex}`, { fret: n.fret, duration, startSlot });
      }
    }
  }

  return (slotIndex, stringIndex) => map.get(`${slotIndex},${stringIndex}`) ?? [];
}
