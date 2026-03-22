/**
 * gridEngine.ts — Pure grid operations for the riff editor.
 *
 * ARCHITECTURE CONTRACT:
 *   - GridNote[] is the sole source of truth during an edit session.
 *   - Every operation is a pure function: (GridNote[], ...params) → GridNote[]
 *   - No riff reads, no gridToNotes round-trips, no DOM access.
 *   - IDs are assigned once (at creation or load) and never change.
 *   - The riff is an OUTPUT of gridNotesToNoteEvents(), never an input during editing.
 */

import type { NoteEvent, RhythmGroup } from '../types/riff';

// ─── Types ────────────────────────────────────────────────────────────────────

export type GridNote = {
  id: string;
  row: number;       // 0 = high e, 5 = low E
  startCol: number;
  endCol: number;
  fret: number;
  /** Notes sharing a chordId move/delete together as a vertical unit. */
  chordId: string | null;
  /** If set, note belongs to a tuplet/rhythm group. */
  rhythmGroupId?: string;
  indexInGroup?: number;
};

export type ClipboardData = {
  originRow: number;
  originCol: number;
  spanRows: number;
  spanCols: number;
  items: ClipboardItem[];
  rhythmGroup?: { tupletRatio: { n: number; d: number }; spanCols: number };
};

type ClipboardItem = {
  rowOffset: number;
  colOffset: number;
  duration: number; // endCol - startCol + 1
  fret: number;
  indexInGroup?: number;
};

// ─── ID generation ────────────────────────────────────────────────────────────

let _idCounter = Date.now();

export function genNoteId(): string {
  return `n-${++_idCounter}-${Math.random().toString(36).slice(2, 7)}`;
}

export function genChordId(): string {
  return `c-${++_idCounter}-${Math.random().toString(36).slice(2, 7)}`;
}

export function genGroupId(): string {
  return `rg-${++_idCounter}-${Math.random().toString(36).slice(2, 7)}`;
}

// ─── Conversion helpers ───────────────────────────────────────────────────────

/**
 * One-time load: NoteEvent[] → GridNote[] with stable IDs and chordIds assigned.
 * ChordId is assigned per startCol column (notes sharing a column share a chordId).
 */
export function noteEventsToGridNotes(
  notes: NoteEvent[],
  subsPerBar: number,
  totalCols: number
): GridNote[] {
  const result: GridNote[] = [];
  // Map startCol → chordId for chord grouping
  const colToChordId = new Map<number, string>();

  for (const n of notes) {
    const startCol = (n.bar - 1) * subsPerBar + (n.subdivision - 1);
    if (startCol < 0 || startCol >= totalCols) continue;
    const dur = (n.durationSubdivisions && n.durationSubdivisions > 0)
      ? n.durationSubdivisions : 1;
    const endCol = Math.min(totalCols - 1, startCol + dur - 1);
    const row = Math.max(0, Math.min(5, n.string - 1));

    // Assign chordId: reuse existing for this column, or create new if there's already another note here
    let chordId: string | null = null;
    const notesAtCol = result.filter(g => g.startCol === startCol);
    if (notesAtCol.length > 0) {
      // There are already notes at this column — share or create chordId
      const existingChordId = notesAtCol[0].chordId;
      if (existingChordId) {
        chordId = existingChordId;
      } else {
        // Upgrade the first note to have a chordId, and share it
        const newChordId = colToChordId.get(startCol) ?? genChordId();
        colToChordId.set(startCol, newChordId);
        for (const g of result) {
          if (g.startCol === startCol) g.chordId = newChordId;
        }
        chordId = newChordId;
      }
    } else if (colToChordId.has(startCol)) {
      chordId = colToChordId.get(startCol)!;
    }

    result.push({
      id: n.id ?? genNoteId(),
      row,
      startCol,
      endCol,
      fret: n.fret,
      chordId,
      rhythmGroupId: n.rhythmGroupId,
      indexInGroup: n.indexInGroup,
    });
  }

  return sortGridNotes(result);
}

/**
 * Flush: GridNote[] → NoteEvent[] for save / playback.
 * This is the ONLY place gridNotes become riff notes.
 */
export function gridNotesToNoteEvents(
  notes: GridNote[],
  subsPerBar: number
): NoteEvent[] {
  return notes.map(n => {
    const bar = Math.floor(n.startCol / subsPerBar) + 1;
    const subdivision = (n.startCol % subsPerBar) + 1;
    const duration = n.endCol - n.startCol + 1;
    const evt: NoteEvent = {
      id: n.id,
      string: n.row + 1,
      fret: n.fret,
      bar,
      subdivision,
      ...(duration > 1 ? { durationSubdivisions: duration } : {}),
      ...(n.rhythmGroupId ? { rhythmGroupId: n.rhythmGroupId } : {}),
      ...(n.indexInGroup != null ? { indexInGroup: n.indexInGroup } : {}),
    };
    return evt;
  });
}

// ─── Chord helpers ────────────────────────────────────────────────────────────

/** Re-compute chordIds for a list of notes based purely on startCol overlap. */
function recomputeChordIds(notes: GridNote[]): GridNote[] {
  // Group by startCol
  const byCol = new Map<number, GridNote[]>();
  for (const n of notes) {
    if (!byCol.has(n.startCol)) byCol.set(n.startCol, []);
    byCol.get(n.startCol)!.push(n);
  }
  return notes.map(n => {
    const col = byCol.get(n.startCol)!;
    if (col.length <= 1) return { ...n, chordId: null };
    // Use first note's chordId if it has one, else generate
    const existingId = col.find(g => g.chordId)?.chordId ?? genChordId();
    return { ...n, chordId: existingId };
  });
}

/** After deleting notes, clean up any chordIds that now only refer to one note. */
function cleanOrphanChordIds(notes: GridNote[]): GridNote[] {
  const chordIdCount = new Map<string, number>();
  for (const n of notes) {
    if (n.chordId) chordIdCount.set(n.chordId, (chordIdCount.get(n.chordId) ?? 0) + 1);
  }
  return notes.map(n =>
    n.chordId && (chordIdCount.get(n.chordId) ?? 0) <= 1
      ? { ...n, chordId: null }
      : n
  );
}

// ─── Sort ─────────────────────────────────────────────────────────────────────

function sortGridNotes(notes: GridNote[]): GridNote[] {
  return [...notes].sort((a, b) => a.row !== b.row ? a.row - b.row : a.startCol - b.startCol);
}

// ─── Overlap detection ────────────────────────────────────────────────────────

/** True if note A and note B overlap in their column ranges (same row assumed). */
function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aEnd >= bStart && aStart <= bEnd;
}

/** Get all cols a note occupies as a [start, end] range. */
function noteRange(n: GridNote): [number, number] {
  return [n.startCol, n.endCol];
}

/**
 * Carve a "hole" [hStart, hEnd] out of a note's column range.
 * Returns 0, 1, or 2 trimmed notes (split if hole is in the middle).
 */
function carveHole(
  n: GridNote,
  hStart: number,
  hEnd: number
): GridNote[] {
  const [nStart, nEnd] = noteRange(n);
  if (hEnd < nStart || hStart > nEnd) return [n]; // no overlap
  const result: GridNote[] = [];
  if (nStart < hStart) result.push({ ...n, id: genNoteId(), endCol: hStart - 1 });
  if (nEnd > hEnd) result.push({ ...n, id: genNoteId(), startCol: hEnd + 1 });
  return result;
}

// ─── OPERATION: placeNote ─────────────────────────────────────────────────────

/**
 * Place a single note at (row, col). Clears any existing notes that overlap,
 * assigns chordId if another note already exists at that col.
 */
export function placeNote(
  notes: GridNote[],
  row: number,
  col: number,
  fret: number,
  totalCols: number
): GridNote[] {
  if (col < 0 || col >= totalCols || row < 0 || row > 5) return notes;

  // Clear overlapping notes on this row
  const cleared = notes.flatMap(n => {
    if (n.row !== row) return [n];
    if (!rangesOverlap(n.startCol, n.endCol, col, col)) return [n];
    return carveHole(n, col, col);
  });

  // Check if another note exists at this startCol (for chordId)
  const notesAtCol = cleared.filter(n => n.startCol === col);
  let chordId: string | null = null;
  if (notesAtCol.length > 0) {
    const existing = notesAtCol[0].chordId;
    if (existing) {
      chordId = existing;
    } else {
      chordId = genChordId();
      // Upgrade existing notes at this col to share the chordId
      for (const g of cleared) {
        if (g.startCol === col) g.chordId = chordId;
      }
    }
  }

  const newNote: GridNote = {
    id: genNoteId(),
    row,
    startCol: col,
    endCol: col,
    fret,
    chordId,
  };

  return sortGridNotes(cleanOrphanChordIds([...cleared, newNote]));
}

// ─── OPERATION: deleteNotes ───────────────────────────────────────────────────

/**
 * Delete notes by stable ID. Also expands deletion to include chord mates
 * and (optionally) full rhythm groups.
 */
export function deleteNotes(
  notes: GridNote[],
  ids: Set<string>,
  opts: { expandChords?: boolean; expandGroups?: boolean } = {}
): GridNote[] {
  const toDelete = new Set(ids);

  if (opts.expandChords || opts.expandGroups) {
    const chordIds = new Set<string>();
    const groupIds = new Set<string>();
    for (const n of notes) {
      if (!toDelete.has(n.id)) continue;
      if (opts.expandChords && n.chordId) chordIds.add(n.chordId);
      if (opts.expandGroups && n.rhythmGroupId) groupIds.add(n.rhythmGroupId);
    }
    for (const n of notes) {
      if (opts.expandChords && n.chordId && chordIds.has(n.chordId)) toDelete.add(n.id);
      if (opts.expandGroups && n.rhythmGroupId && groupIds.has(n.rhythmGroupId)) toDelete.add(n.id);
    }
  }

  return cleanOrphanChordIds(notes.filter(n => !toDelete.has(n.id)));
}

// ─── OPERATION: deleteSelectionRange ─────────────────────────────────────────

/**
 * Delete all notes that overlap any cell in the given (row, col) ranges.
 * Duration notes that partially overlap are trimmed (not fully deleted).
 */
export function deleteSelectionRange(
  notes: GridNote[],
  ranges: { row: number; startCol: number; endCol: number }[]
): GridNote[] {
  const byRow = new Map<number, { startCol: number; endCol: number }[]>();
  for (const r of ranges) {
    if (!byRow.has(r.row)) byRow.set(r.row, []);
    byRow.get(r.row)!.push({ startCol: r.startCol, endCol: r.endCol });
  }

  const result = notes.flatMap(n => {
    const holes = byRow.get(n.row);
    if (!holes) return [n];
    // Don't carve inside tuplet groups — delete whole group or nothing
    if (n.rhythmGroupId) {
      const fullyCovered = holes.some(h => h.startCol <= n.startCol && h.endCol >= n.endCol);
      return fullyCovered ? [] : [n];
    }
    let pieces: GridNote[] = [n];
    for (const hole of holes) {
      pieces = pieces.flatMap(p => carveHole(p, hole.startCol, hole.endCol));
    }
    return pieces;
  });

  return sortGridNotes(cleanOrphanChordIds(result));
}

// ─── OPERATION: moveNotes ─────────────────────────────────────────────────────

/**
 * Move selected notes by (deltaRow, deltaCol). Clamped to grid bounds.
 *
 * Rules:
 *  - Selection is expanded to include full chord mates AND full rhythm groups.
 *  - Tuplet-on-tuplet: blocked (two distinct tuplet groups cannot overlap).
 *  - Tuplet moving onto regular notes: regular notes get carved out.
 *  - Regular notes moving onto tuplet region: regular notes are trimmed/split
 *    around the stationary tuplet ("other notes dropped on to tuplets are split").
 */
export function moveNotes(
  notes: GridNote[],
  ids: Set<string>,
  deltaRow: number,
  deltaCol: number,
  totalRows: number,
  totalCols: number,
  subsPerBar = 16,
  rhythmGroups: RhythmGroup[] = []
): { notes: GridNote[]; appliedDeltaCol: number; appliedDeltaRow: number } {
  if (deltaRow === 0 && deltaCol === 0) return { notes, appliedDeltaCol: 0, appliedDeltaRow: 0 };

  const expandedIds = new Set(ids);
  const chordIds = new Set<string>();
  for (const n of notes) if (ids.has(n.id) && n.chordId) chordIds.add(n.chordId);
  for (const n of notes) if (n.chordId && chordIds.has(n.chordId)) expandedIds.add(n.id);

  const movingGroupIds = new Set<string>();
  for (const n of notes) if (expandedIds.has(n.id) && n.rhythmGroupId) movingGroupIds.add(n.rhythmGroupId);
  for (const n of notes) if (n.rhythmGroupId && movingGroupIds.has(n.rhythmGroupId)) expandedIds.add(n.id);

  const moving = notes.filter(n => expandedIds.has(n.id));
  const stationary = notes.filter(n => !expandedIds.has(n.id));
  const isMovingTuplet = movingGroupIds.size > 0;

  // Clamp delta — use real group span from rhythmGroups for tuplet notes
  let clampedRow = deltaRow;
  let clampedCol = deltaCol;
  const clampedGroups = new Set<string>();
  for (const n of moving) {
    const newRow = n.row + deltaRow;
    if (newRow < 0) clampedRow = Math.max(clampedRow, -n.row);
    if (newRow >= totalRows) clampedRow = Math.min(clampedRow, totalRows - 1 - n.row);
    if (n.rhythmGroupId) {
      if (clampedGroups.has(n.rhythmGroupId)) continue;
      clampedGroups.add(n.rhythmGroupId);
      const rg = rhythmGroups.find(g => g.id === n.rhythmGroupId);
      const gNotes = moving.filter(m => m.rhythmGroupId === n.rhythmGroupId);
      const gStart = rg ? rg.startSlot : Math.min(...gNotes.map(m => m.startCol));
      const gEnd   = rg ? rg.endSlot   : Math.max(...gNotes.map(m => m.endCol));
      if (gStart + deltaCol < 0) clampedCol = Math.max(clampedCol, -gStart);
      if (gEnd   + deltaCol >= totalCols) clampedCol = Math.min(clampedCol, totalCols - 1 - gEnd);
    } else {
      if (n.startCol + deltaCol < 0) clampedCol = Math.max(clampedCol, -n.startCol);
      if (n.endCol   + deltaCol >= totalCols) clampedCol = Math.min(clampedCol, totalCols - 1 - n.endCol);
    }
  }

  if (isMovingTuplet) {
    const beatSize = Math.max(1, Math.round(subsPerBar / 4));
    for (const gid of movingGroupIds) {
      const rg = rhythmGroups.find(g => g.id === gid);
      const gNotes = moving.filter(n => n.rhythmGroupId === gid);
      const origStart = rg ? rg.startSlot : Math.min(...gNotes.map(n => n.startCol));
      const origEnd   = rg ? rg.endSlot   : Math.max(...gNotes.map(n => n.endCol));
      const spanLen   = origEnd - origStart + 1;
      let destStart   = Math.round((origStart + clampedCol) / beatSize) * beatSize;

      let attempts = 0;
      while (attempts < totalCols) {
        const destEnd = destStart + spanLen - 1;
        if (destEnd >= totalCols) { destStart = origStart; break; }
        const blocked = stationary.some(n => {
          const srg = n.rhythmGroupId ? rhythmGroups.find(g => g.id === n.rhythmGroupId) : null;
          const sStart = srg ? srg.startSlot : n.startCol;
          const sEnd   = srg ? srg.endSlot   : n.endCol;
          return rangesOverlap(destStart, destEnd, sStart, sEnd);
        });
        if (!blocked) break;
        destStart += beatSize;
        attempts++;
      }
      clampedCol = destStart - origStart;
    }
  } else {
    // Regular notes: cancel if landing on a stationary tuplet
    const destFootprint = moving.map(n => ({
      row: n.row + clampedRow,
      startCol: n.startCol + clampedCol,
      endCol: n.endCol + clampedCol,
    }));
    for (const n of stationary) {
      if (!n.rhythmGroupId) continue;
      const srg = rhythmGroups.find(g => g.id === n.rhythmGroupId);
      const sStart = srg ? srg.startSlot : n.startCol;
      const sEnd   = srg ? srg.endSlot   : n.endCol;
      for (const dest of destFootprint) {
        if (dest.row === n.row && rangesOverlap(dest.startCol, dest.endCol, sStart, sEnd)) {
          return { notes, appliedDeltaCol: 0, appliedDeltaRow: 0 };
        }
      }
    }
  }

  const byRow = new Map<number, { startCol: number; endCol: number }[]>();
  for (const n of moving) {
    const row = n.row + clampedRow;
    if (!byRow.has(row)) byRow.set(row, []);
    byRow.get(row)!.push({ startCol: n.startCol + clampedCol, endCol: n.endCol + clampedCol });
  }

  const carved = stationary.flatMap(n => {
    const holes = byRow.get(n.row);
    if (!holes) return [n];
    if (n.rhythmGroupId) return [n]; // never carve stationary tuplets
    let pieces: GridNote[] = [n];
    for (const hole of holes) pieces = pieces.flatMap(p => carveHole(p, hole.startCol, hole.endCol));
    return pieces;
  });

  const moved = moving.map(n => ({
    ...n,
    row: n.row + clampedRow,
    startCol: n.startCol + clampedCol,
    endCol: n.endCol + clampedCol,
  }));

  return {
    notes: sortGridNotes(recomputeChordIds(cleanOrphanChordIds([...carved, ...moved]))),
    appliedDeltaCol: clampedCol,
    appliedDeltaRow: clampedRow,
  };
}

// ─── OPERATION: resizeDuration ────────────────────────────────────────────────

/**
 * Resize the endCol of a note. Clamped to not overlap the next note on the same row.
 */
export function resizeDuration(
  notes: GridNote[],
  id: string,
  newEndCol: number,
  totalCols: number
): GridNote[] {
  const target = notes.find(n => n.id === id);
  if (!target) return notes;

  // Find next note on same row that starts after target's startCol
  const others = notes.filter(n => n.id !== id && n.row === target.row);
  const nextNote = others
    .filter(n => n.startCol > target.startCol)
    .sort((a, b) => a.startCol - b.startCol)[0];

  const maxEnd = nextNote ? nextNote.startCol - 1 : totalCols - 1;
  const clampedEnd = Math.max(target.startCol, Math.min(maxEnd, newEndCol));

  return notes.map(n => n.id === id ? { ...n, endCol: clampedEnd } : n);
}

// ─── OPERATION: combineDuration ───────────────────────────────────────────────

/**
 * Combine notes in a horizontal selection into duration notes (one per row).
 * Only valid when selection is purely horizontal (same startCol..endCol range across rows).
 */
export function combineDuration(
  notes: GridNote[],
  ids: Set<string>,
  totalCols: number
): GridNote[] {
  const selected = notes.filter(n => ids.has(n.id));
  if (selected.length === 0) return notes;

  // No tuplets allowed
  if (selected.some(n => n.rhythmGroupId)) return notes;

  const startCol = Math.min(...selected.map(n => n.startCol));
  const endCol = Math.max(...selected.map(n => n.endCol));
  const rows = [...new Set(selected.map(n => n.row))];

  // Remove all notes that overlap the selection range on selected rows
  const remaining = notes.flatMap(n => {
    if (!rows.includes(n.row)) return [n];
    if (!rangesOverlap(n.startCol, n.endCol, startCol, endCol)) return [n];
    return carveHole(n, startCol, endCol);
  });

  // Place one duration note per row using the fret of the earliest note in that row
  const newNotes: GridNote[] = rows.map(row => {
    const rowNotes = selected.filter(n => n.row === row);
    const fret = rowNotes.sort((a, b) => a.startCol - b.startCol)[0]?.fret ?? 0;
    return {
      id: genNoteId(),
      row,
      startCol,
      endCol: Math.min(endCol, totalCols - 1),
      fret,
      chordId: null,
    };
  });

  return sortGridNotes(recomputeChordIds(cleanOrphanChordIds([...remaining, ...newNotes])));
}

// ─── OPERATION: splitDuration ─────────────────────────────────────────────────

/**
 * Split duration notes back into single-slot notes.
 */
export function splitDuration(
  notes: GridNote[],
  ids: Set<string>
): GridNote[] {
  const result = notes.flatMap(n => {
    if (!ids.has(n.id)) return [n];
    if (n.startCol === n.endCol) return [n]; // already single-slot
    if (n.rhythmGroupId) return [n]; // don't split tuplets
    const slots: GridNote[] = [];
    for (let col = n.startCol; col <= n.endCol; col++) {
      slots.push({ ...n, id: genNoteId(), startCol: col, endCol: col });
    }
    return slots;
  });

  return sortGridNotes(cleanOrphanChordIds(result));
}

// ─── OPERATION: updateFret ────────────────────────────────────────────────────

/**
 * Update the fret value of a specific note by ID.
 */
export function updateFret(
  notes: GridNote[],
  id: string,
  fret: number
): GridNote[] {
  return notes.map(n => n.id === id ? { ...n, fret } : n);
}

// ─── OPERATION: clearCell ─────────────────────────────────────────────────────

/**
 * Clear a single cell at (row, col). Trims any duration note that overlaps.
 */
export function clearCell(
  notes: GridNote[],
  row: number,
  col: number
): GridNote[] {
  const result = notes.flatMap(n => {
    if (n.row !== row) return [n];
    if (!rangesOverlap(n.startCol, n.endCol, col, col)) return [n];
    return carveHole(n, col, col);
  });
  return sortGridNotes(cleanOrphanChordIds(result));
}

// ─── OPERATION: makeTuplet ────────────────────────────────────────────────────

/**
 * Convert a selection of notes into a tuplet group.
 * Returns { notes, group } — caller must add group to riff.rhythmGroups.
 * The group always spans exactly one beat, snapped to the beat boundary at the
 * earliest selected startCol. slotsPerBeat = subsPerBar / beatsPerBar.
 */
export function makeTuplet(
  notes: GridNote[],
  ids: Set<string>,
  tupletRatio: { n: number; d: number },
  subsPerBar: number,
  beatsPerBar: number,
): { notes: GridNote[]; group: RhythmGroup | null } {
  const selected = notes.filter(n => ids.has(n.id));
  if (selected.length === 0) return { notes, group: null };
  if (selected.some(n => n.rhythmGroupId)) return { notes, group: null }; // already in a group

  const slotsPerBeat = beatsPerBar > 0 ? Math.round(subsPerBar / beatsPerBar) : subsPerBar;
  const earliestStart = Math.min(...selected.map(n => n.startCol));
  const startSlot = earliestStart;
  const endSlot = earliestStart + slotsPerBeat - 1;
  const groupId = genGroupId();
  const n = tupletRatio.n;

  // Sort selected notes by startCol then row so fret/row assignment is positionally ordered.
  const sortedSelected = [...selected].sort((a, b) => a.startCol - b.startCol || a.row - b.row);

  // Remove the original selected notes.
  const remainingNotes = notes.filter(note => !ids.has(note.id));

  // Create exactly n new notes distributed across the beat.
  const tupletNotes: GridNote[] = Array.from({ length: n }, (_, i) => {
    const src = sortedSelected[i % sortedSelected.length];
    const col = earliestStart + Math.floor(i * slotsPerBeat / n);
    return {
      id: genNoteId(),
      row: src.row,
      startCol: col,
      endCol: col,
      fret: src.fret,
      chordId: null,
      rhythmGroupId: groupId,
      indexInGroup: i,
    };
  });

  const group: RhythmGroup = {
    id: groupId,
    startSlot,
    endSlot,
    type: 'tuplet',
    tupletRatio,
  };

  return { notes: sortGridNotes([...remainingNotes, ...tupletNotes]), group };
}

// ─── OPERATION: retoggleTuplet ────────────────────────────────────────────────

/**
 * Toggle a tuplet group between triplet (n=3) and sextuplet (n=6).
 * Re-creates the notes at the new count, distributed across the group's existing
 * span. Rows/frets cycle from the current group notes sorted by indexInGroup.
 * Returns updated { notes, rhythmGroups }.
 */
export function retoggleTuplet(
  notes: GridNote[],
  rhythmGroups: RhythmGroup[],
  groupId: string,
): { notes: GridNote[]; rhythmGroups: RhythmGroup[] } {
  const group = rhythmGroups.find(g => g.id === groupId);
  if (!group || !group.tupletRatio) return { notes, rhythmGroups };

  const { n, d } = group.tupletRatio;
  const newN = n === 3 ? 6 : n === 6 ? 3 : n;
  if (newN === n) return { notes, rhythmGroups };

  const groupNotes = notes
    .filter(note => note.rhythmGroupId === groupId)
    .sort((a, b) => (a.indexInGroup ?? 0) - (b.indexInGroup ?? 0));
  if (groupNotes.length === 0) return { notes, rhythmGroups };

  const slotsPerBeat = group.endSlot - group.startSlot + 1;
  const startSlot = group.startSlot;
  const remainingNotes = notes.filter(note => note.rhythmGroupId !== groupId);

  const newTupletNotes: GridNote[] = Array.from({ length: newN }, (_, i) => {
    const src = groupNotes[i % groupNotes.length];
    const col = startSlot + Math.floor(i * slotsPerBeat / newN);
    return {
      id: genNoteId(),
      row: src.row,
      startCol: col,
      endCol: col,
      fret: src.fret,
      chordId: null,
      rhythmGroupId: groupId,
      indexInGroup: i,
    };
  });

  const newRhythmGroups = rhythmGroups.map(g =>
    g.id === groupId ? { ...g, tupletRatio: { n: newN, d } } : g
  );

  return {
    notes: sortGridNotes([...remainingNotes, ...newTupletNotes]),
    rhythmGroups: newRhythmGroups,
  };
}

// ─── OPERATION: copy ─────────────────────────────────────────────────────────

/**
 * Build a clipboard snapshot from the selected notes.
 * Pass rhythmGroups to capture the correct tupletRatio for tuplet groups.
 */
export function buildClipboard(
  notes: GridNote[],
  ids: Set<string>,
  rhythmGroups?: RhythmGroup[]
): ClipboardData | null {
  // Expand to include full rhythm groups
  const expanded = new Set(ids);
  const groupIds = new Set<string>();
  for (const n of notes) {
    if (ids.has(n.id) && n.rhythmGroupId) groupIds.add(n.rhythmGroupId);
  }
  for (const n of notes) {
    if (n.rhythmGroupId && groupIds.has(n.rhythmGroupId)) expanded.add(n.id);
  }

  const selected = notes.filter(n => expanded.has(n.id));
  if (selected.length === 0) return null;

  const originRow = Math.min(...selected.map(n => n.row));
  const originCol = Math.min(...selected.map(n => n.startCol));
  const spanRows = Math.max(...selected.map(n => n.row)) - originRow + 1;
  const spanCols = Math.max(...selected.map(n => n.endCol)) - originCol + 1;

  // Detect single rhythm group
  const singleGroup = groupIds.size === 1
    ? [...groupIds][0]
    : null;
  const groupNotes = singleGroup ? selected.filter(n => n.rhythmGroupId === singleGroup) : [];
  const firstGroup = notes.find(n => n.rhythmGroupId === singleGroup);

  return {
    originRow,
    originCol,
    spanRows,
    spanCols,
    items: selected.map(n => ({
      rowOffset: n.row - originRow,
      colOffset: n.startCol - originCol,
      duration: n.endCol - n.startCol + 1,
      fret: n.fret,
      indexInGroup: n.indexInGroup,
    })),
    ...(singleGroup && groupNotes.length > 0
      ? {
          rhythmGroup: {
            tupletRatio:
              rhythmGroups?.find(g => g.id === singleGroup)?.tupletRatio ?? { n: 3, d: 4 },
            spanCols,
          },
        }
      : {}),
  };
}

// ─── OPERATION: paste ─────────────────────────────────────────────────────────

/**
 * Paste clipboard at (targetRow, targetCol). Returns new notes or original if invalid.
 */
export function pasteClipboard(
  notes: GridNote[],
  clipboard: ClipboardData,
  targetRow: number,
  targetCol: number,
  totalRows: number,
  totalCols: number,
  onNewRhythmGroup?: (group: RhythmGroup) => void
): GridNote[] {
  const { items } = clipboard;
  if (items.length === 0) return notes;

  // Clamp so no pasted note goes out of bounds
  const maxColOffset = Math.max(...items.map(i => i.colOffset + i.duration - 1));
  const maxRowOffset = Math.max(...items.map(i => i.rowOffset));
  const clampedRow = Math.max(0, Math.min(totalRows - 1 - maxRowOffset, targetRow));
  const clampedCol = Math.max(0, Math.min(totalCols - 1 - maxColOffset, targetCol));

  const newGroupId = clipboard.rhythmGroup ? genGroupId() : null;

  const newNotes: GridNote[] = items.map(item => {
    const row = clampedRow + item.rowOffset;
    const startCol = clampedCol + item.colOffset;
    const endCol = Math.min(totalCols - 1, startCol + item.duration - 1);
    return {
      id: genNoteId(),
      row,
      startCol,
      endCol,
      fret: item.fret,
      chordId: null,
      ...(newGroupId ? { rhythmGroupId: newGroupId, indexInGroup: item.indexInGroup } : {}),
    };
  });

  // If pasting a tuplet group: block if destination has existing tuplets
  if (clipboard.rhythmGroup) {
    for (const n of notes) {
      if (!n.rhythmGroupId) continue;
      for (const nn of newNotes) {
        if (nn.row === n.row && rangesOverlap(nn.startCol, nn.endCol, n.startCol, n.endCol)) {
          return notes; // tuplet-on-tuplet: cancel
        }
      }
    }
  }

  // For regular notes pasting onto tuplets: carve the new notes around existing tuplets
  const existingTuplets = notes.filter(n => n.rhythmGroupId);
  const trimmedNewNotes = clipboard.rhythmGroup
    ? newNotes // tuplet paste: no carving needed (blocked above if collision)
    : newNotes.flatMap(nn => {
        let pieces: GridNote[] = [nn];
        for (const st of existingTuplets) {
          if (st.row === nn.row) {
            pieces = pieces.flatMap(p => carveHole(p, st.startCol, st.endCol));
          }
        }
        return pieces;
      });

  if (trimmedNewNotes.length === 0) return notes;

  // Carve out destination from existing regular notes
  const footprint = new Map<number, { startCol: number; endCol: number }[]>();
  for (const nn of trimmedNewNotes) {
    if (!footprint.has(nn.row)) footprint.set(nn.row, []);
    footprint.get(nn.row)!.push({ startCol: nn.startCol, endCol: nn.endCol });
  }

  const carved = notes.flatMap(n => {
    const holes = footprint.get(n.row);
    if (!holes) return [n];
    if (n.rhythmGroupId) return [n]; // preserve existing tuplets
    let pieces: GridNote[] = [n];
    for (const hole of holes) {
      pieces = pieces.flatMap(p => carveHole(p, hole.startCol, hole.endCol));
    }
    return pieces;
  });

  // Register new rhythm group if applicable
  if (newGroupId && clipboard.rhythmGroup && onNewRhythmGroup) {
    const groupSpanStart = clampedCol;
    const groupSpanEnd = clampedCol + clipboard.rhythmGroup.spanCols - 1;
    onNewRhythmGroup({
      id: newGroupId,
      startSlot: groupSpanStart,
      endSlot: Math.min(totalCols - 1, groupSpanEnd),
      type: 'tuplet',
      tupletRatio: clipboard.rhythmGroup.tupletRatio,
    });
  }

  return sortGridNotes(recomputeChordIds(cleanOrphanChordIds([
    ...carved.map(n => ({ ...n })),
    ...trimmedNewNotes,
  ])));
}

// ─── OPERATION: duplicate ─────────────────────────────────────────────────────

/**
 * Duplicate the selected notes immediately to the right of the selection.
 * Supports tuplet groups — each group gets a new ID; calls onNewGroup for each new group.
 */
export function duplicateNotes(
  notes: GridNote[],
  ids: Set<string>,
  totalCols: number,
  rhythmGroups?: RhythmGroup[],
  onNewGroup?: (group: RhythmGroup) => void
): GridNote[] {
  // Expand selection to include full rhythm groups
  const expanded = expandToRhythmGroups(notes, ids);
  const selected = notes.filter(n => expanded.has(n.id));
  if (selected.length === 0) return notes;

  const selMaxEnd = Math.max(...selected.map(n => n.endCol));
  const selMinStart = Math.min(...selected.map(n => n.startCol));
  const offset = selMaxEnd - selMinStart + 1;

  // Build mapping from old rhythmGroupId → new rhythmGroupId
  const groupIdMap = new Map<string, string>();
  const selectedGroupIds = new Set(
    selected.map(n => n.rhythmGroupId).filter(Boolean) as string[]
  );
  for (const gid of selectedGroupIds) {
    groupIdMap.set(gid, genGroupId());
  }

  const dupNotes: GridNote[] = selected
    .flatMap(n => {
      const startCol = n.startCol + offset;
      const endCol = n.endCol + offset;
      if (startCol >= totalCols) return [];
      const newGroupId = n.rhythmGroupId ? groupIdMap.get(n.rhythmGroupId) : undefined;
      return [{
        ...n,
        id: genNoteId(),
        startCol,
        endCol: Math.min(totalCols - 1, endCol),
        chordId: null as string | null,
        ...(newGroupId ? { rhythmGroupId: newGroupId } : {}),
      }];
    });

  if (dupNotes.length === 0) return notes;

  // Tuplet duplicates: block if landing on existing tuplets; regular notes: carve around tuplets
  const existingTuplets = notes.filter(n => n.rhythmGroupId);
  const dupTuplets = dupNotes.filter(n => n.rhythmGroupId);
  if (dupTuplets.length > 0) {
    for (const et of existingTuplets) {
      for (const dt of dupTuplets) {
        if (dt.row === et.row && rangesOverlap(dt.startCol, dt.endCol, et.startCol, et.endCol)) {
          return notes; // tuplet-on-tuplet: cancel
        }
      }
    }
  }

  // Trim non-tuplet duplicates around existing tuplets
  const trimmedDup = dupNotes.flatMap(dn => {
    if (dn.rhythmGroupId) return [dn];
    let pieces: GridNote[] = [dn];
    for (const et of existingTuplets) {
      if (et.row === dn.row) {
        pieces = pieces.flatMap(p => carveHole(p, et.startCol, et.endCol));
      }
    }
    return pieces;
  });

  // Carve regular notes in destination
  const footprint = new Map<number, { startCol: number; endCol: number }[]>();
  for (const dn of trimmedDup) {
    if (!footprint.has(dn.row)) footprint.set(dn.row, []);
    footprint.get(dn.row)!.push({ startCol: dn.startCol, endCol: dn.endCol });
  }
  const carved = notes.flatMap(n => {
    const holes = footprint.get(n.row);
    if (!holes) return [n];
    if (n.rhythmGroupId) return [n];
    let pieces: GridNote[] = [n];
    for (const hole of holes) {
      pieces = pieces.flatMap(p => carveHole(p, hole.startCol, hole.endCol));
    }
    return pieces;
  });

  // Register new rhythm groups
  if (onNewGroup && rhythmGroups) {
    for (const [oldId, newId] of groupIdMap) {
      const origGroup = rhythmGroups.find(g => g.id === oldId);
      if (origGroup) {
        const groupNotes = dupNotes.filter(n => n.rhythmGroupId === newId);
        if (groupNotes.length > 0) {
          onNewGroup({
            ...origGroup,
            id: newId,
            startSlot: Math.min(...groupNotes.map(n => n.startCol)),
            endSlot: Math.max(...groupNotes.map(n => n.endCol)),
          });
        }
      }
    }
  }

  return sortGridNotes(recomputeChordIds(cleanOrphanChordIds([...carved, ...trimmedDup])));
}

// ─── OPERATION: growDuration / shrinkDuration ────────────────────────────────

/**
 * Extend note duration by 1 column (keyboard +/= key).
 * Clamped to not overlap the next note on the same row.
 */
export function growDuration(
  notes: GridNote[],
  id: string,
  totalCols: number
): GridNote[] {
  const target = notes.find(n => n.id === id);
  if (!target) return notes;
  const others = notes.filter(n => n.id !== id && n.row === target.row && n.startCol > target.startCol);
  const nextStart = others.length > 0 ? Math.min(...others.map(n => n.startCol)) : totalCols;
  const maxEnd = Math.min(totalCols - 1, nextStart - 1);
  if (target.endCol >= maxEnd) return notes;
  return notes.map(n => n.id === id ? { ...n, endCol: n.endCol + 1 } : n);
}

/**
 * Shrink note duration by 1 column (keyboard - key). Minimum size 1 slot.
 */
export function shrinkDuration(
  notes: GridNote[],
  id: string
): GridNote[] {
  return notes.map(n => {
    if (n.id !== id) return n;
    if (n.endCol <= n.startCol) return n;
    return { ...n, endCol: n.endCol - 1 };
  });
}

// ─── OPERATION: clampToColumns ────────────────────────────────────────────────

/**
 * When totalColumns shrinks: truncate notes that overlap the new end, drop notes beyond it.
 */
export function clampToColumns(notes: GridNote[], totalCols: number): GridNote[] {
  const lastCol = Math.max(0, totalCols - 1);
  return notes
    .filter(n => n.startCol <= lastCol)
    .map(n => ({ ...n, endCol: Math.min(n.endCol, lastCol) }));
}

// ─── Selection helpers ────────────────────────────────────────────────────────

/** Expand a set of IDs to include full chord mates. */
export function expandToChordMates(notes: GridNote[], ids: Set<string>): Set<string> {
  const expanded = new Set(ids);
  const chordIds = new Set<string>();
  for (const n of notes) {
    if (ids.has(n.id) && n.chordId) chordIds.add(n.chordId);
  }
  for (const n of notes) {
    if (n.chordId && chordIds.has(n.chordId)) expanded.add(n.id);
  }
  return expanded;
}

/** Expand a set of IDs to include all notes in the same rhythm groups. */
export function expandToRhythmGroups(notes: GridNote[], ids: Set<string>): Set<string> {
  const expanded = new Set(ids);
  const groupIds = new Set<string>();
  for (const n of notes) {
    if (ids.has(n.id) && n.rhythmGroupId) groupIds.add(n.rhythmGroupId);
  }
  for (const n of notes) {
    if (n.rhythmGroupId && groupIds.has(n.rhythmGroupId)) expanded.add(n.id);
  }
  return expanded;
}

/** Get all notes that overlap a given (row, startCol, endCol) range. */
export function getNotesInRange(
  notes: GridNote[],
  row: number,
  startCol: number,
  endCol: number
): GridNote[] {
  return notes.filter(
    n => n.row === row && rangesOverlap(n.startCol, n.endCol, startCol, endCol)
  );
}

/** Get notes that overlap a rectangular selection. */
export function getNotesInRect(
  notes: GridNote[],
  minRow: number,
  maxRow: number,
  minCol: number,
  maxCol: number
): GridNote[] {
  return notes.filter(
    n =>
      n.row >= minRow &&
      n.row <= maxRow &&
      rangesOverlap(n.startCol, n.endCol, minCol, maxCol)
  );
}
