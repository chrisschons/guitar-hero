import type { Riff, NoteEvent } from '../types/riff';
import { getSubdivisionsPerBar } from './exercise';

export type RiffGrid = (number | null)[][];

export function notesToGrid(riff: Riff, bars: number): RiffGrid {
  const subsPerBar = riff.timeSignature ? getSubdivisionsPerBar(riff.timeSignature) : 16;
  const totalSlots = bars * subsPerBar;
  const grid: RiffGrid = Array.from({ length: 6 }, () => Array(totalSlots).fill(null));

  for (const n of riff.notes || []) {
    const s = Math.max(0, Math.min(5, n.string - 1));
    const bar = n.bar >= 1 && n.bar <= bars ? n.bar : 1;
    const subdivision = n.subdivision >= 1 && n.subdivision <= subsPerBar ? n.subdivision : 1;
    const slot = (bar - 1) * subsPerBar + (subdivision - 1);
    if (slot >= 0 && slot < totalSlots) {
      grid[s][slot] = n.fret;
    }
  }

  return grid;
}

export function gridToNotes(riff: Riff, grid: RiffGrid): NoteEvent[] {
  const subsPerBar = riff.timeSignature ? getSubdivisionsPerBar(riff.timeSignature) : 16;
  const notes: NoteEvent[] = [];

  for (let s = 0; s < 6; s++) {
    for (let slot = 0; slot < grid[s].length; slot++) {
      const fret = grid[s][slot];
      if (fret === null || fret === undefined || fret === '') continue;
      const f = Number(fret);
      if (!Number.isFinite(f) || f < 0) continue;
      const bar = Math.floor(slot / subsPerBar) + 1;
      const subdivision = (slot % subsPerBar) + 1;
      notes.push({ string: s + 1, fret: f, bar, subdivision });
    }
  }

  return notes;
}

