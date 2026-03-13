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
    const duration = n.durationSubdivisions && n.durationSubdivisions > 0 ? n.durationSubdivisions : 1;
    const startSlot = (bar - 1) * subsPerBar + (subdivision - 1);
    if (startSlot < 0 || startSlot >= totalSlots) continue;
    const endSlot = Math.min(totalSlots - 1, startSlot + duration - 1);
    for (let slot = startSlot; slot <= endSlot; slot += 1) {
      grid[s][slot] = n.fret;
    }
  }

  return grid;
}

export function gridToNotes(riff: Riff, grid: RiffGrid): NoteEvent[] {
  const subsPerBar = riff.timeSignature ? getSubdivisionsPerBar(riff.timeSignature) : 16;
  const notes: NoteEvent[] = [];

  for (let s = 0; s < 6; s++) {
    let slot = 0;
    while (slot < grid[s].length) {
      const fret = grid[s][slot];
      if (fret === null || fret === undefined || fret === '') {
        slot += 1;
        continue;
      }
      const f = Number(fret);
      if (!Number.isFinite(f) || f < 0) {
        slot += 1;
        continue;
      }

      // Start of a run: extend while same fret continues.
      let runEnd = slot + 1;
      while (runEnd < grid[s].length && grid[s][runEnd] === fret) {
        runEnd += 1;
      }

      const durationSubdivisions = runEnd - slot;
      const bar = Math.floor(slot / subsPerBar) + 1;
      const subdivision = (slot % subsPerBar) + 1;
      const note: NoteEvent = {
        string: s + 1,
        fret: f,
        bar,
        subdivision,
      };
      if (durationSubdivisions > 1) {
        note.durationSubdivisions = durationSubdivisions;
      }
      notes.push(note);
      slot = runEnd;
    }
  }

  return notes;
}

/**
 * Apply a single-cell edit without merging adjacent same-fret runs.
 * Removes or trims any note overlapping (stringIndex, slotIndex), then adds
 * one note at that cell if value is non-null. Keeps two adjacent same-fret
 * notes as two separate notes.
 */
export function applyCellUpdateToNotes(
  riff: Riff,
  notes: NoteEvent[],
  stringIndex: number,
  slotIndex: number,
  value: number | null
): NoteEvent[] {
  const subsPerBar = riff.timeSignature ? getSubdivisionsPerBar(riff.timeSignature) : 16;
  const str = stringIndex + 1; // 1-based string in NoteEvent
  const result: NoteEvent[] = [];

  for (const n of notes) {
    if (n.string !== str) {
      result.push(n);
      continue;
    }
    const startSlot = (n.bar - 1) * subsPerBar + (n.subdivision - 1);
    const duration = n.durationSubdivisions && n.durationSubdivisions > 0 ? n.durationSubdivisions : 1;
    const endSlot = startSlot + duration - 1;
    if (slotIndex < startSlot || slotIndex > endSlot) {
      result.push(n);
      continue;
    }
    // This note overlaps the edited cell: trim or remove so the cell is cleared
    if (startSlot < slotIndex) {
      const beforeDur = slotIndex - startSlot;
      result.push({
        ...n,
        durationSubdivisions: beforeDur > 1 ? beforeDur : undefined,
      });
    }
    if (endSlot > slotIndex) {
      const afterStart = slotIndex + 1;
      const afterDur = endSlot - afterStart + 1;
      const bar = Math.floor(afterStart / subsPerBar) + 1;
      const subdivision = (afterStart % subsPerBar) + 1;
      result.push({
        string: n.string,
        fret: n.fret,
        bar,
        subdivision,
        ...(afterDur > 1 ? { durationSubdivisions: afterDur } : {}),
      });
    }
  }

  if (value !== null && Number.isFinite(value)) {
    const bar = Math.floor(slotIndex / subsPerBar) + 1;
    const subdivision = (slotIndex % subsPerBar) + 1;
    result.push({
      string: str,
      fret: value,
      bar,
      subdivision,
    });
  }

  // Sort by (string, startSlot) to keep order stable
  return result.sort((a, b) => {
    const slotA = (a.bar - 1) * subsPerBar + (a.subdivision - 1);
    const slotB = (b.bar - 1) * subsPerBar + (b.subdivision - 1);
    if (a.string !== b.string) return a.string - b.string;
    return slotA - slotB;
  });
}

export function noteSlotRange(n: NoteEvent, subsPerBar: number): { startSlot: number; endSlot: number } {
  const startSlot = (n.bar - 1) * subsPerBar + (n.subdivision - 1);
  const duration = n.durationSubdivisions && n.durationSubdivisions > 0 ? n.durationSubdivisions : 1;
  const endSlot = startSlot + duration - 1;
  return { startSlot, endSlot };
}

/**
 * Apply a duration resize by updating only the affected note(s) in the notes array.
 * Does not merge or overwrite other same-fret notes on the same string.
 * Clamps the new span so it does not overlap any other note on that string.
 */
export function applyDurationResizeToNotes(
  riff: Riff,
  notes: NoteEvent[],
  stringIndex: number,
  anchorSlot: number,
  targetSlot: number,
  totalSlots: number
): { notes: NoteEvent[]; selection: Set<string> } {
  const subsPerBar = riff.timeSignature ? getSubdivisionsPerBar(riff.timeSignature) : 16;
  const str = stringIndex + 1;
  const minSlot = Math.max(0, Math.min(anchorSlot, targetSlot));
  const maxSlot = Math.min(totalSlots - 1, Math.max(anchorSlot, targetSlot));

  // Find the note that contains anchorSlot on this string
  let resizedNote: NoteEvent | null = null;
  const otherNotesOnString: NoteEvent[] = [];
  for (const n of notes) {
    if (n.string !== str) continue;
    const { startSlot, endSlot } = noteSlotRange(n, subsPerBar);
    if (anchorSlot >= startSlot && anchorSlot <= endSlot) {
      resizedNote = n;
    } else {
      otherNotesOnString.push(n);
    }
  }

  const result = notes.filter((n) => n.string !== str);
  const nextSelection = new Set<string>();

  if (!resizedNote) {
    // No note contains anchor (e.g. drag from empty or wrong string) - leave notes unchanged
    for (const o of otherNotesOnString) result.push(o);
    return { notes: sortNotesByStringSlot(result, subsPerBar), selection: nextSelection };
  }

  const { startSlot: curStart, endSlot: curEnd } = noteSlotRange(resizedNote, subsPerBar);
  const fret = resizedNote.fret;

  let spanStart: number;
  let spanEnd: number;

  if (curStart === curEnd) {
    // Single-slot note: dragging defines the new span directly.
    spanStart = minSlot;
    spanEnd = maxSlot;
  } else if (anchorSlot === curStart && targetSlot >= curStart && targetSlot <= curEnd) {
    // Dragging in from the left edge over part of the group: remove the dragged
    // prefix and keep the remainder of the note to the right.
    const newStart = targetSlot + 1;
    if (newStart <= curEnd) {
      spanStart = newStart;
      spanEnd = curEnd;
    } else {
      // Dragged across the entire note span; keep original as a safety net.
      spanStart = curStart;
      spanEnd = curEnd;
    }
  } else if (anchorSlot === curEnd && targetSlot >= curStart && targetSlot <= curEnd) {
    // Dragging in from the right edge over part of the group: remove the dragged
    // suffix and keep the remainder of the note to the left.
    const newEnd = targetSlot - 1;
    if (newEnd >= curStart) {
      spanStart = curStart;
      spanEnd = newEnd;
    } else {
      // Dragged across the entire note span; keep original as a safety net.
      spanStart = curStart;
      spanEnd = curEnd;
    }
  } else {
    // Dragging outward: grow the span to include the dragged region.
    spanStart = Math.min(curStart, minSlot);
    spanEnd = Math.max(curEnd, maxSlot);
  }

  for (const o of otherNotesOnString) {
    const { startSlot, endSlot } = noteSlotRange(o, subsPerBar);
    // If the candidate span would overlap any other note on this string,
    // bail out and keep the original span for this note. This guarantees
    // we never "grow through" a neighboring note, left or right.
    const disjoint = endSlot < spanStart || startSlot > spanEnd;
    if (!disjoint) {
      spanStart = curStart;
      spanEnd = curEnd;
      break;
    }
  }

  if (spanEnd >= spanStart) {
    const bar = Math.floor(spanStart / subsPerBar) + 1;
    const subdivision = (spanStart % subsPerBar) + 1;
    const duration = spanEnd - spanStart + 1;
    result.push({
      string: str,
      fret,
      bar,
      subdivision,
      ...(duration > 1 ? { durationSubdivisions: duration } : {}),
    });
    for (let slot = spanStart; slot <= spanEnd; slot += 1) nextSelection.add(`${stringIndex}-${slot}`);
  }
  for (const o of otherNotesOnString) result.push(o);
  return { notes: sortNotesByStringSlot(result, subsPerBar), selection: nextSelection };
}

function sortNotesByStringSlot(notes: NoteEvent[], subsPerBar: number): NoteEvent[] {
  return notes.sort((a, b) => {
    const slotA = (a.bar - 1) * subsPerBar + (a.subdivision - 1);
    const slotB = (b.bar - 1) * subsPerBar + (b.subdivision - 1);
    if (a.string !== b.string) return a.string - b.string;
    return slotA - slotB;
  });
}

