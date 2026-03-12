import type { Riff, NoteEvent } from '../types/riff';
import { getSubdivisionsPerBar } from './exercise';
import { noteSlotRange } from './riffGrid';
import { applyCellUpdateToNotes as applyCellUpdateFromRiffGrid } from './riffGrid';

export type EditorCell = {
  noteId: string;
  fret: number;
  isNoteStart: boolean;
  durationIndex: number;
} | null;

export type EditorGrid = EditorCell[][];

const NUM_STRINGS = 6;

/**
 * Generate a stable id for a note that lacks one (for editor session).
 * Same note in the array always gets the same id.
 */
function ensureNoteId(note: NoteEvent, index: number): string {
  if (note.id != null && note.id !== '') return note.id;
  return `n-${index}`;
}

/**
 * Project notes to editor grid. Each cell references the note that occupies it.
 * Notes without id get a stable generated id (by index). This is the only
 * notes -> grid path; the editor never reconstructs notes from the grid.
 */
export function notesToEditorGrid(riff: Riff, bars: number): EditorGrid {
  const subsPerBar = riff.timeSignature ? getSubdivisionsPerBar(riff.timeSignature) : 16;
  const totalSlots = bars * subsPerBar;
  const grid: EditorGrid = Array.from({ length: NUM_STRINGS }, () =>
    Array.from({ length: totalSlots }, () => null)
  );

  const notes = riff.notes ?? [];
  for (let i = 0; i < notes.length; i += 1) {
    const n = notes[i];
    const noteId = ensureNoteId(n, i);
    const s = Math.max(0, Math.min(NUM_STRINGS - 1, n.string - 1));
    const { startSlot, endSlot } = noteSlotRange(n, subsPerBar);
    if (startSlot < 0 || startSlot >= totalSlots) continue;
    const lastSlot = Math.min(totalSlots - 1, endSlot);
    for (let slot = startSlot; slot <= lastSlot; slot += 1) {
      grid[s][slot] = {
        noteId,
        fret: n.fret,
        isNoteStart: slot === startSlot,
        durationIndex: slot - startSlot,
      };
    }
  }

  return grid;
}

export function cellKey(stringIndex: number, slotIndex: number): string {
  return `${stringIndex}-${slotIndex}`;
}

export function getSubsPerBar(riff: Riff): number {
  return riff.timeSignature ? getSubdivisionsPerBar(riff.timeSignature) : 16;
}

// --- Re-export cell update (no merge) ---
export function applyCellUpdateToNotes(
  riff: Riff,
  notes: NoteEvent[],
  stringIndex: number,
  slotIndex: number,
  value: number | null
): NoteEvent[] {
  return applyCellUpdateFromRiffGrid(riff, notes, stringIndex, slotIndex, value);
}

/**
 * Update only the fret of the note that occupies (stringIndex, slotIndex), without splitting.
 * If value is null, remove that note entirely. Use this when editing a duration group
 * so the whole note keeps its duration and only the fret changes.
 */
export function updateNoteFretAtSlot(
  riff: Riff,
  notes: NoteEvent[],
  stringIndex: number,
  slotIndex: number,
  value: number | null
): NoteEvent[] {
  const subsPerBar = getSubsPerBar(riff);
  const str = stringIndex + 1;
  const result: NoteEvent[] = [];

  for (const n of notes) {
    if (n.string !== str) {
      result.push(n);
      continue;
    }
    const { startSlot, endSlot } = noteSlotRange(n, subsPerBar);
    if (slotIndex < startSlot || slotIndex > endSlot) {
      result.push(n);
      continue;
    }
    // This note covers the slot: update fret or remove
    if (value === null || !Number.isFinite(value)) {
      // Remove the entire note
      continue;
    }
    result.push({ ...n, fret: value });
  }

  return sortNotesByStringSlot(result, subsPerBar);
}

/**
 * Create a duration group (or one note per row) for the selected cells with the given fret.
 * - Group selection by string; for each string create one note spanning min..max selected slot.
 * - Any existing notes overlapping the selection are removed first.
 * Use when the user has multi-selected empty (or to-be-replaced) cells and types a digit.
 */
export function createNotesInSelection(
  riff: Riff,
  notes: NoteEvent[],
  cellKeys: Set<string>,
  fret: number
): NoteEvent[] {
  if (cellKeys.size === 0 || !Number.isFinite(fret) || fret < 0) return notes;
  const subsPerBar = getSubsPerBar(riff);

  // Group by string index
  const byString = new Map<number, number[]>();
  for (const key of cellKeys) {
    const [sStr, slotStr] = key.split('-');
    const s = Number(sStr);
    const slot = Number(slotStr);
    if (!Number.isFinite(s) || !Number.isFinite(slot)) continue;
    if (!byString.has(s)) byString.set(s, []);
    byString.get(s)!.push(slot);
  }

  // Clear existing notes in the selection
  let result = deleteSelectionFromNotes(riff, notes, cellKeys);

  // Add one note per row
  for (const [stringIndex, slots] of byString) {
    if (slots.length === 0) continue;
    const minSlot = Math.min(...slots);
    const maxSlot = Math.max(...slots);
    const duration = maxSlot - minSlot + 1;
    const bar = Math.floor(minSlot / subsPerBar) + 1;
    const subdivision = (minSlot % subsPerBar) + 1;
    const newNote: NoteEvent = {
      string: stringIndex + 1,
      fret,
      bar,
      subdivision,
      ...(duration > 1 ? { durationSubdivisions: duration } : {}),
    };
    result = result.concat(newNote);
  }

  return sortNotesByStringSlot(result, subsPerBar);
}
export function notesOverlappingCellKeys(
  notes: NoteEvent[],
  subsPerBar: number,
  cellKeys: Set<string>
): NoteEvent[] {
  const out: NoteEvent[] = [];
  const seen = new Set<string>();
  for (const key of cellKeys) {
    const [sStr, slotStr] = key.split('-');
    const stringIndex = Number(sStr);
    const slot = Number(slotStr);
    if (!Number.isFinite(stringIndex) || !Number.isFinite(slot)) continue;
    const str = stringIndex + 1;
    for (let i = 0; i < notes.length; i += 1) {
      const n = notes[i];
      if (n.string !== str) continue;
      const { startSlot, endSlot } = noteSlotRange(n, subsPerBar);
      if (slot >= startSlot && slot <= endSlot) {
        const id = n.id ?? `n-${i}`;
        if (!seen.has(id)) {
          seen.add(id);
          out.push(n);
        }
      }
    }
  }
  return out;
}

/** Get note (with stable id) that occupies (stringIndex, slot), or null. */
export function getNoteAtSlot(
  notes: NoteEvent[],
  subsPerBar: number,
  stringIndex: number,
  slot: number
): (NoteEvent & { id: string }) | null {
  const str = stringIndex + 1;
  for (let i = 0; i < notes.length; i += 1) {
    const n = notes[i];
    if (n.string !== str) continue;
    const { startSlot, endSlot } = noteSlotRange(n, subsPerBar);
    if (slot >= startSlot && slot <= endSlot) {
      return { ...n, id: n.id ?? `n-${i}` };
    }
  }
  return null;
}

function sortNotesByStringSlot(notes: NoteEvent[], subsPerBar: number): NoteEvent[] {
  return [...notes].sort((a, b) => {
    const slotA = (a.bar - 1) * subsPerBar + (a.subdivision - 1);
    const slotB = (b.bar - 1) * subsPerBar + (b.subdivision - 1);
    if (a.string !== b.string) return a.string - b.string;
    return slotA - slotB;
  });
}

/** Slot range for a note (bar/subdivision/duration -> startSlot, endSlot). */
function getSlotRange(n: NoteEvent, subsPerBar: number): { startSlot: number; endSlot: number } {
  return noteSlotRange(n, subsPerBar);
}

/** Check if [start, end] on string overlaps any note in the list (excluding noteIds in exclude). */
function rangeOverlapsNote(
  notes: NoteEvent[],
  subsPerBar: number,
  stringIndex: number,
  start: number,
  end: number,
  excludeNoteIds: Set<string>
): boolean {
  const str = stringIndex + 1;
  for (let i = 0; i < notes.length; i += 1) {
    const n = notes[i];
    const id = n.id ?? `n-${i}`;
    if (excludeNoteIds.has(id)) continue;
    if (n.string !== str) continue;
    const r = getSlotRange(n, subsPerBar);
    if (r.endSlot >= start && r.startSlot <= end) return true;
  }
  return false;
}

// --- Delete selection: remove/trim/split notes overlapping cellKeys ---
export function deleteSelectionFromNotes(
  riff: Riff,
  notes: NoteEvent[],
  cellKeys: Set<string>
): NoteEvent[] {
  const subsPerBar = getSubsPerBar(riff);
  const result: NoteEvent[] = [];

  for (const n of notes) {
    const { startSlot, endSlot } = getSlotRange(n, subsPerBar);
    const str = n.string;
    const s = str - 1;

    const selectedInNote: number[] = [];
    for (let slot = startSlot; slot <= endSlot; slot += 1) {
      if (cellKeys.has(cellKey(s, slot))) selectedInNote.push(slot);
    }

    if (selectedInNote.length === 0) {
      result.push(n);
      continue;
    }

    if (selectedInNote.length === endSlot - startSlot + 1) continue;

    let slot = startSlot;
    while (slot <= endSlot) {
      if (cellKeys.has(cellKey(s, slot))) {
        slot += 1;
        continue;
      }
      const segStart = slot;
      while (slot <= endSlot && !cellKeys.has(cellKey(s, slot))) slot += 1;
      const segEnd = slot - 1;
      const dur = segEnd - segStart + 1;
      const bar = Math.floor(segStart / subsPerBar) + 1;
      const subdivision = (segStart % subsPerBar) + 1;
      result.push({
        ...n,
        bar,
        subdivision,
        ...(dur > 1 ? { durationSubdivisions: dur } : {}),
      });
    }
  }

  return sortNotesByStringSlot(result, subsPerBar);
}

// --- Resize note by id: set end to newEndSlot, clamp to avoid collision ---
export function resizeNoteDuration(
  riff: Riff,
  notes: NoteEvent[],
  noteId: string,
  newEndSlot: number
): NoteEvent[] {
  const subsPerBar = getSubsPerBar(riff);
  const totalSlots = riff.lengthBars ? riff.lengthBars * subsPerBar : 128;
  let targetNote: NoteEvent | null = null;
  let targetIndex = -1;
  const others: NoteEvent[] = [];

  for (let i = 0; i < notes.length; i += 1) {
    const n = notes[i];
    const id = n.id ?? `n-${i}`;
    if (id === noteId) {
      targetNote = n;
      targetIndex = i;
    } else {
      others.push(n);
    }
  }

  if (!targetNote || targetIndex < 0) return notes;

  const { startSlot } = getSlotRange(targetNote, subsPerBar);
  let spanEnd = Math.max(startSlot, Math.min(totalSlots - 1, newEndSlot));

  const str = targetNote.string;
  const s = str - 1;
  for (const o of others) {
    if (o.string !== str) continue;
    const r = getSlotRange(o, subsPerBar);
    if (r.endSlot < startSlot) continue;
    if (r.startSlot > spanEnd) continue;
    if (r.startSlot <= startSlot && r.endSlot >= spanEnd) {
      spanEnd = startSlot - 1;
      break;
    }
    if (r.startSlot <= spanEnd) spanEnd = Math.min(spanEnd, r.startSlot - 1);
  }

  if (spanEnd < startSlot) return notes;

  const duration = spanEnd - startSlot + 1;
  const bar = Math.floor(startSlot / subsPerBar) + 1;
  const subdivision = (startSlot % subsPerBar) + 1;
  const updated: NoteEvent = {
    ...targetNote,
    bar,
    subdivision,
    ...(duration > 1 ? { durationSubdivisions: duration } : {}),
  };

  const result = [...others, updated];
  return sortNotesByStringSlot(result, subsPerBar);
}

// --- Move notes: find notes overlapping cellKeys, remove (trim/split), reinsert at +delta ---
export function moveNotes(
  riff: Riff,
  notes: NoteEvent[],
  cellKeys: Set<string>,
  deltaString: number,
  deltaSlot: number
): { notes: NoteEvent[]; movedCellKeys: Set<string> } {
  const subsPerBar = getSubsPerBar(riff);
  const totalSlots = riff.lengthBars ? riff.lengthBars * subsPerBar : 128;
  const bars = riff.lengthBars ?? 8;

  const grid = notesToEditorGrid(riff, bars);
  const noteIdsInSelection = new Set<string>();
  for (const key of cellKeys) {
    const [sStr, slotStr] = key.split('-');
    const s = Number(sStr);
    const slot = Number(slotStr);
    if (!Number.isFinite(s) || !Number.isFinite(slot)) continue;
    const cell = grid[s]?.[slot];
    if (cell) noteIdsInSelection.add(cell.noteId);
  }

  const movedBlocks: { string: number; startSlot: number; endSlot: number; fret: number; noteId: string }[] = [];
  const notesWithoutMoved: NoteEvent[] = [];

  for (let i = 0; i < notes.length; i += 1) {
    const n = notes[i];
    const id = n.id ?? `n-${i}`;
    if (!noteIdsInSelection.has(id)) {
      notesWithoutMoved.push(n);
      continue;
    }
    const { startSlot, endSlot } = getSlotRange(n, subsPerBar);
    const str = n.string;
    const s = str - 1;

    const selectedSlots: number[] = [];
    for (let slot = startSlot; slot <= endSlot; slot += 1) {
      if (cellKeys.has(cellKey(s, slot))) selectedSlots.push(slot);
    }
    if (selectedSlots.length === 0) {
      notesWithoutMoved.push(n);
      continue;
    }
    const moveStart = Math.min(...selectedSlots);
    const moveEnd = Math.max(...selectedSlots);

    movedBlocks.push({
      string: str,
      startSlot: moveStart,
      endSlot: moveEnd,
      fret: n.fret,
      noteId: id,
    });

    let slot = startSlot;
    while (slot <= endSlot) {
      if (slot >= moveStart && slot <= moveEnd) {
        slot = moveEnd + 1;
        continue;
      }
      const segStart = slot;
      while (slot <= endSlot && (slot < moveStart || slot > moveEnd)) slot += 1;
      const segEnd = slot - 1;
      if (segEnd >= segStart) {
        const dur = segEnd - segStart + 1;
        const bar = Math.floor(segStart / subsPerBar) + 1;
        const subdivision = (segStart % subsPerBar) + 1;
        notesWithoutMoved.push({
          ...n,
          bar,
          subdivision,
          ...(dur > 1 ? { durationSubdivisions: dur } : {}),
        });
      }
    }
  }

  const excludeIds = new Set(movedBlocks.map((b) => b.noteId));
  const newNotes: NoteEvent[] = [...notesWithoutMoved];

  for (const block of movedBlocks) {
    const newStart = block.startSlot + deltaSlot;
    const newEnd = block.endSlot + deltaSlot;
    const newStr = block.string + deltaString;
    if (newStr < 1 || newStr > NUM_STRINGS) continue;
    const newS = newStr - 1;
    if (newStart < 0 || newEnd >= totalSlots) continue;

    if (rangeOverlapsNote(newNotes, subsPerBar, newS, newStart, newEnd, excludeIds)) continue;

    const bar = Math.floor(newStart / subsPerBar) + 1;
    const subdivision = (newStart % subsPerBar) + 1;
    const duration = newEnd - newStart + 1;
    newNotes.push({
      string: newStr,
      fret: block.fret,
      bar,
      subdivision,
      id: block.noteId,
      ...(duration > 1 ? { durationSubdivisions: duration } : {}),
    });
  }

  const movedCellKeys = new Set<string>();
  for (const block of movedBlocks) {
    const newStart = block.startSlot + deltaSlot;
    const newEnd = block.endSlot + deltaSlot;
    const newStr = block.string + deltaString;
    const newS = newStr - 1;
    if (newStr < 1 || newStr > NUM_STRINGS) continue;
    if (newStart < 0 || newEnd >= totalSlots) continue;
    for (let slot = newStart; slot <= newEnd; slot += 1) movedCellKeys.add(cellKey(newS, slot));
  }

  return { notes: sortNotesByStringSlot(newNotes, subsPerBar), movedCellKeys };
}

// --- Combine duration: one string, contiguous range -> one note ---
export function combineDurationInSelection(
  riff: Riff,
  notes: NoteEvent[],
  cellKeys: Set<string>
): NoteEvent[] {
  const subsPerBar = getSubsPerBar(riff);
  if (cellKeys.size === 0) return notes;

  const byString = new Map<number, number[]>();
  for (const key of cellKeys) {
    const [sStr, slotStr] = key.split('-');
    const s = Number(sStr);
    const slot = Number(slotStr);
    if (!Number.isFinite(s) || !Number.isFinite(slot)) continue;
    if (!byString.has(s)) byString.set(s, []);
    byString.get(s)!.push(slot);
  }

  let result = notes;
  for (const [stringIndex, slots] of byString) {
    if (slots.length === 0) continue;
    const minSlot = Math.min(...slots);
    const maxSlot = Math.max(...slots);
    const spanLength = maxSlot - minSlot + 1;
    if (spanLength <= 1) continue;

    const str = stringIndex + 1;
    const fret = (() => {
      const grid = notesToEditorGrid({ ...riff, notes: result }, riff.lengthBars ?? 8);
      const cell = grid[stringIndex]?.[minSlot];
      return cell?.fret ?? 0;
    })();

    const withoutOverlap: NoteEvent[] = [];
    for (const n of result) {
      if (n.string !== str) {
        withoutOverlap.push(n);
        continue;
      }
      const { startSlot, endSlot } = getSlotRange(n, subsPerBar);
      if (endSlot < minSlot || startSlot > maxSlot) {
        withoutOverlap.push(n);
        continue;
      }
      if (startSlot < minSlot) {
        const dur = minSlot - startSlot;
        withoutOverlap.push({
          ...n,
          durationSubdivisions: dur > 1 ? dur : undefined,
        });
      }
      if (endSlot > maxSlot) {
        const afterStart = maxSlot + 1;
        const dur = endSlot - afterStart + 1;
        const bar = Math.floor(afterStart / subsPerBar) + 1;
        const subdivision = (afterStart % subsPerBar) + 1;
        withoutOverlap.push({
          string: n.string,
          fret: n.fret,
          bar,
          subdivision,
          ...(dur > 1 ? { durationSubdivisions: dur } : {}),
        });
      }
    }

    const bar = Math.floor(minSlot / subsPerBar) + 1;
    const subdivision = (minSlot % subsPerBar) + 1;
    withoutOverlap.push({
      string: str,
      fret,
      bar,
      subdivision,
      durationSubdivisions: spanLength,
    });
    result = sortNotesByStringSlot(withoutOverlap, subsPerBar);
  }

  return result;
}

// --- Split duration to notes ---
export function splitDurationToNotes(
  riff: Riff,
  notes: NoteEvent[],
  cellKeys: Set<string>
): NoteEvent[] {
  const subsPerBar = getSubsPerBar(riff);
  const result: NoteEvent[] = [];
  const noteIdsInSelection = new Set<string>();
  for (const key of cellKeys) {
    const [sStr, slotStr] = key.split('-');
    const s = Number(sStr);
    const slot = Number(slotStr);
    if (!Number.isFinite(s) || !Number.isFinite(slot)) continue;
    const note = getNoteAtSlot(notes, subsPerBar, s, slot);
    if (note && (note.durationSubdivisions ?? 1) > 1) noteIdsInSelection.add(note.id);
  }

  for (let i = 0; i < notes.length; i += 1) {
    const n = notes[i];
    const id = n.id ?? `n-${i}`;
    const dur = n.durationSubdivisions && n.durationSubdivisions > 1 ? n.durationSubdivisions : 1;
    if (dur <= 1 || !noteIdsInSelection.has(id)) {
      result.push(n);
      continue;
    }
    const { startSlot, endSlot } = getSlotRange(n, subsPerBar);
    for (let slot = startSlot; slot <= endSlot; slot += 1) {
      const bar = Math.floor(slot / subsPerBar) + 1;
      const subdivision = (slot % subsPerBar) + 1;
      result.push({
        string: n.string,
        fret: n.fret,
        bar,
        subdivision,
      });
    }
  }

  return sortNotesByStringSlot(result, subsPerBar);
}
