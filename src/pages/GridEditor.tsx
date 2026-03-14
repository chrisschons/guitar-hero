import { useState, useMemo, useEffect, useCallback, useRef, Fragment } from 'react';
import { EditorHeader } from '../components/EditorHeader';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '../components/ui/context-menu';
import { getRiff, getMergedRiffList } from '../data/riffs';
import { saveUserRiff, nextUserRiffId } from '../data/riffs/userRiffsStorage';
import { useRiffHistory } from '../hooks/useRiffHistory';
import type { Riff } from '../types/riff';
import {
  notesToEditorGrid,
  cellKey,
  getSubsPerBar,
  applyCellUpdateToNotes,
  updateNoteFretAtSlot,
  createNotesInSelection,
  deleteSelectionFromNotes,
  moveNotes,
  combineDurationInSelection,
  splitDurationToNotes,
} from '../core/gridEditorModel';
import { applyDurationResizeToNotes } from '../core/riffGrid';
import { GridNoteChip } from '../components/GridNoteChip';
import {
  Undo2,
  Redo2,
  Copy,
  Scissors,
  ClipboardPaste,
  Maximize2,
  Minimize2,
  Trash2,
} from 'lucide-react';
const COLUMN_WIDTH = 68;
const ROW_HEIGHT = 32;
const NUM_STRINGS = 6;

type StateTestNote = {
  id: string;
  row: number;
  startCol: number;
  endCol: number;
  value: number;
  selected: boolean;
  /** Notes with the same chordId move/resize/cut/copy/delete as a vertical chord group. */
  chordId: string | null;
};

function genNoteId() {
  return `note-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function genChordId() {
  return `chord-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Merge overlapping or adjacent column ranges [startCol, endCol] into disjoint ranges. */
function mergeColumnRanges(ranges: [number, number][]): [number, number][] {
  if (ranges.length === 0) return [];
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [[...sorted[0]]];
  for (let i = 1; i < sorted.length; i++) {
    const [s, e] = sorted[i];
    const last = merged[merged.length - 1];
    if (s <= last[1] + 1) {
      last[1] = Math.max(last[1], e);
    } else {
      merged.push([s, e]);
    }
  }
  return merged;
}

/** Punch out a hole [hStart, hEnd] from a list of disjoint intervals. */
function subtractRangeFromIntervals(
  intervals: [number, number][],
  hole: [number, number]
): [number, number][] {
  const [hStart, hEnd] = hole;
  const result: [number, number][] = [];
  for (const [lo, hi] of intervals) {
    if (hi < hStart || lo > hEnd) {
      result.push([lo, hi]);
    } else {
      if (lo < hStart) result.push([lo, hStart - 1]);
      if (hi > hEnd) result.push([hEnd + 1, hi]);
    }
  }
  return result;
}

function StateTestGrid() {
  const TEST_ROWS = 6;
  const TEST_COLS = 12;

  const [notes, setNotes] = useState<StateTestNote[]>(() => [
    { id: genNoteId(), row: 0, startCol: 1, endCol: 1, value: 0, selected: false, chordId: null },
    { id: genNoteId(), row: 1, startCol: 3, endCol: 4, value: 5, selected: false, chordId: null },
    { id: genNoteId(), row: 2, startCol: 5, endCol: 5, value: 7, selected: false, chordId: null },
  ]);

  type ClipboardItem = { rowOffset: number; startCol: number; endCol: number; value: number };
  const [clipboard, setClipboard] = useState<{ originRow: number; originCol: number; items: ClipboardItem[] } | null>(null);
  const [undoStack, setUndoStack] = useState<StateTestNote[][]>([]);
  const [redoStack, setRedoStack] = useState<StateTestNote[][]>([]);
  const isUndoRedoRef = useRef(false);

  const applyMutation = useCallback(
    (updater: (prev: StateTestNote[]) => StateTestNote[]) => {
      if (isUndoRedoRef.current) {
        setNotes(updater);
        return;
      }
      setUndoStack((s) => [...s, notesRef.current]);
      setRedoStack([]);
      setNotes(updater);
    },
    []
  );
  const applyMutationRef = useRef(applyMutation);
  applyMutationRef.current = applyMutation;

  const [hover, setHover] = useState<{ row: number; col: number } | null>(null);
  /** When user clicks an empty cell, we select the cell (no note yet). Digit then creates a note. */
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const selectedCellRef = useRef(selectedCell);
  selectedCellRef.current = selectedCell;
  const setSelectedCellRef = useRef(setSelectedCell);
  setSelectedCellRef.current = setSelectedCell;
  const [dragState, setDragState] = useState<{
    noteId: string;
    anchorRow: number;
    anchorCol: number;
    anchorStartCol: number;
    anchorEndCol: number;
    anchorOffsetX: number;
    anchorOffsetY: number;
    currentRow: number;
    currentCol: number;
  } | null>(null);
  const [resizeState, setResizeState] = useState<{
    noteId: string;
    edge: 'left' | 'right';
    anchorStartCol: number;
    anchorEndCol: number;
    startClientX: number;
    currentClientX: number;
    /** Pixel width of the note during resize (from grid left to current X or vice versa) */
    visualWidthPx: number;
  } | null>(null);
  const [dragGhost, setDragGhost] = useState<{ clientX: number; clientY: number } | null>(null);
  const [marqueeState, setMarqueeState] = useState<{
    startRow: number;
    startCol: number;
    currentRow: number;
    currentCol: number;
  } | null>(null);
  const [marqueePointerDown, setMarqueePointerDown] = useState(false);
  const setMarqueePointerDownRef = useRef(setMarqueePointerDown);
  setMarqueePointerDownRef.current = setMarqueePointerDown;
  const digitBufferRef = useRef('');
  const suppressClickAfterDragRef = useRef(false);
  const suppressClickAfterMarqueeRef = useRef(false);
  const pendingMarqueeRef = useRef<{
    startRow: number;
    startCol: number;
    clientX: number;
    clientY: number;
  } | null>(null);
  const gridWrapperRef = useRef<HTMLDivElement>(null);
  const pendingDragRef = useRef<{
    noteId: string;
    anchorRow: number;
    anchorCol: number;
    clientX: number;
    clientY: number;
    wasOnlySelected: boolean;
  } | null>(null);
  const handleCellClickRef = useRef<(row: number, col: number, e: React.MouseEvent) => void>(() => {});
  const notesRef = useRef(notes);
  notesRef.current = notes;
  const resizeLatestRef = useRef<{ localX: number } | null>(null);
  const pendingResizeRef = useRef<{
    noteId: string;
    edge: 'left' | 'right';
    anchorStartCol: number;
    anchorEndCol: number;
    startClientX: number;
    startClientY: number;
  } | null>(null);
  const RESIZE_HANDLE_WIDTH_PX = 14;
  const NOTE_CHIP_PADDING_PX = 3;

  /** Expand a set of selected note ids to include all chord mates (notes with same chordId). */
  const expandSelectionWithChordMates = useCallback(
    (noteList: StateTestNote[], selectedIds: Set<string>): Set<string> => {
      const expanded = new Set(selectedIds);
      for (const n of noteList) {
        if (n.chordId && selectedIds.has(n.id)) {
          for (const m of noteList) {
            if (m.chordId === n.chordId) expanded.add(m.id);
          }
        }
      }
      return expanded;
    },
    []
  );
  const expandSelectionWithChordMatesRef = useRef(expandSelectionWithChordMates);
  expandSelectionWithChordMatesRef.current = expandSelectionWithChordMates;

  const handleCopyRef = useRef<() => void>(() => {});
  const handleCutRef = useRef<() => void>(() => {});
  const handlePasteRef = useRef<() => void>(() => {});
  const handleUndoRef = useRef<() => void>(() => {});
  const handleRedoRef = useRef<() => void>(() => {});
  const handleSplitIntoNotesRef = useRef<() => void>(() => {});
  const handleCombineIntoChordRef = useRef<() => void>(() => {});

  const handleCopy = useCallback(() => {
    const selected = notes.filter((n) => n.selected);
    if (selected.length === 0) return;
    const originRow = Math.min(...selected.map((n) => n.row));
    const originCol = Math.min(...selected.map((n) => n.startCol));
    setClipboard({
      originRow,
      originCol,
      items: selected.map((n) => ({
        rowOffset: n.row - originRow,
        startCol: n.startCol - originCol,
        endCol: n.endCol - originCol,
        value: n.value,
      })),
    });
  }, [notes]);
  handleCopyRef.current = handleCopy;

  const handleCut = useCallback(() => {
    const selected = notes.filter((n) => n.selected);
    if (selected.length === 0) return;
    const originRow = Math.min(...selected.map((n) => n.row));
    const originCol = Math.min(...selected.map((n) => n.startCol));
    setClipboard({
      originRow,
      originCol,
      items: selected.map((n) => ({
        rowOffset: n.row - originRow,
        startCol: n.startCol - originCol,
        endCol: n.endCol - originCol,
        value: n.value,
      })),
    });
    applyMutation((prev) => prev.filter((n) => !n.selected));
  }, [notes, applyMutation]);
  handleCutRef.current = handleCut;

  const handlePaste = useCallback(() => {
    if (!clipboard || clipboard.items.length === 0) return;
    const selected = notes.filter((n) => n.selected);
    const pasteRow =
      selected.length > 0
        ? Math.min(...selected.map((n) => n.row))
        : selectedCell?.row ?? 0;
    const pasteCol =
      selected.length > 0
        ? Math.min(...selected.map((n) => n.startCol))
        : selectedCell?.col ?? 0;
    applyMutation((prev) => {
      const pastedChordId = genChordId();
      const newNotes: StateTestNote[] = clipboard.items.map((item) => {
        const row = Math.max(0, Math.min(TEST_ROWS - 1, pasteRow + item.rowOffset));
        const startCol = Math.max(0, Math.min(TEST_COLS - 1, pasteCol + item.startCol));
        const endCol = Math.max(startCol, Math.min(TEST_COLS - 1, pasteCol + item.endCol));
        return {
          id: genNoteId(),
          row,
          startCol,
          endCol,
          value: item.value,
          selected: true,
          chordId: pastedChordId,
        };
      });
      const dropFootprint = new Map<number, [number, number][]>();
      for (const n of newNotes) {
        const start = Math.max(0, n.startCol);
        const end = Math.min(TEST_COLS - 1, n.endCol);
        if (!dropFootprint.has(n.row)) dropFootprint.set(n.row, []);
        dropFootprint.get(n.row)!.push([start, end]);
      }
      for (const row of dropFootprint.keys()) {
        dropFootprint.set(row, mergeColumnRanges(dropFootprint.get(row)!));
      }
      const brokenChordIds = new Set<string>();
      const existing = prev.flatMap((n) => {
        if (!dropFootprint.has(n.row)) return [n];
        const dropRanges = dropFootprint.get(n.row)!;
        let intervals: [number, number][] = [[n.startCol, n.endCol]];
        for (const hole of dropRanges) {
          intervals = subtractRangeFromIntervals(intervals, hole);
        }
        if (intervals.length === 0) {
          if (n.chordId) brokenChordIds.add(n.chordId);
          return [];
        }
        // No actual overlap: footprint didn't touch this note, leave it unchanged
        if (
          intervals.length === 1 &&
          intervals[0][0] === n.startCol &&
          intervals[0][1] === n.endCol
        )
          return [n];
        if (n.chordId) brokenChordIds.add(n.chordId);
        return intervals.map(([a, b]) => ({
          ...n,
          id: genNoteId(),
          startCol: a,
          endCol: b,
          chordId: null,
        }));
      });
      const existingCleaned = existing.map((n) =>
        n.chordId && brokenChordIds.has(n.chordId) ? { ...n, chordId: null } : n
      );
      return [...existingCleaned.map((n) => ({ ...n, selected: false })), ...newNotes];
    });
    if (selected.length === 0 && selectedCell != null) setSelectedCell(null);
  }, [clipboard, notes, selectedCell, applyMutation, TEST_ROWS, TEST_COLS]);
  handlePasteRef.current = handlePaste;

  const handleSplitIntoNotes = useCallback(() => {
    const selected = notes.filter((n) => n.selected);
    if (selected.length === 0) return;
    const hasSpanning = selected.some((n) => n.startCol < n.endCol);
    if (!hasSpanning) return;
    applyMutation((prev) =>
      prev.flatMap((n) => {
        if (!n.selected || n.startCol >= n.endCol) return [n];
        return Array.from(
          { length: n.endCol - n.startCol + 1 },
          (_, i) => ({
            ...n,
            id: genNoteId(),
            startCol: n.startCol + i,
            endCol: n.startCol + i,
            chordId: null,
          })
        );
      })
    );
  }, [notes, applyMutation]);
  handleSplitIntoNotesRef.current = handleSplitIntoNotes;

  const handleCombineIntoChord = useCallback(() => {
    const selected = notes.filter((n) => n.selected);
    if (selected.length < 2) return;
    applyMutation((prev) => {
      const selectedIds = new Set(selected.map((n) => n.id));
      const minStart = Math.min(...selected.map((n) => n.startCol));
      const maxEnd = Math.max(...selected.map((n) => n.endCol));
      const chordId = genChordId();
      return prev.map((n) =>
        selectedIds.has(n.id)
          ? { ...n, chordId, startCol: minStart, endCol: maxEnd }
          : n
      );
    });
  }, [notes, applyMutation]);
  handleCombineIntoChordRef.current = handleCombineIntoChord;

  const handleClearAll = useCallback(() => {
    applyMutation(() => []);
  }, [applyMutation]);

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    isUndoRedoRef.current = true;
    setRedoStack((r) => [...r, notes]);
    setNotes(undoStack[undoStack.length - 1]);
    setUndoStack((s) => s.slice(0, -1));
    isUndoRedoRef.current = false;
  }, [undoStack, notes]);
  handleUndoRef.current = handleUndo;

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    isUndoRedoRef.current = true;
    setUndoStack((s) => [...s, notes]);
    setNotes(redoStack[redoStack.length - 1]);
    setRedoStack((r) => r.slice(0, -1));
    isUndoRedoRef.current = false;
  }, [redoStack, notes]);
  handleRedoRef.current = handleRedo;

  const findNoteAt = useCallback(
    (r: number, c: number) =>
      notes.find((n) => n.row === r && c >= n.startCol && c <= n.endCol) ?? null,
    [notes]
  );

  const handleCellClick = useCallback(
    (row: number, col: number, e: React.MouseEvent) => {
      if (suppressClickAfterDragRef.current) {
        suppressClickAfterDragRef.current = false;
        return;
      }
      if (suppressClickAfterMarqueeRef.current) {
        suppressClickAfterMarqueeRef.current = false;
        return;
      }
      const note = findNoteAt(row, col);
      if (!note) {
        if (e.shiftKey) return;
        setSelectedCell({ row, col });
        setNotes((prev) => prev.map((n) => ({ ...n, selected: false })));
        digitBufferRef.current = '';
        return;
      }
      setSelectedCell(null);
      if (e.shiftKey) {
        setNotes((prev) => {
          const currentIds = new Set(prev.filter((n) => n.selected).map((n) => n.id));
          const expanded = expandSelectionWithChordMates(prev, currentIds);
          const noteInSelection = expanded.has(note.id);
          const chordMateIds = note.chordId
            ? prev.filter((n) => n.chordId === note.chordId).map((n) => n.id)
            : [note.id];
          const nextIds = new Set(expanded);
          if (noteInSelection) chordMateIds.forEach((id) => nextIds.delete(id));
          else chordMateIds.forEach((id) => nextIds.add(id));
          return prev.map((n) => ({ ...n, selected: nextIds.has(n.id) }));
        });
        digitBufferRef.current = '';
        return;
      }
      const wasOnlySelected =
        note.selected && notes.filter((n) => n.selected).length === 1;
      if (wasOnlySelected) {
        setNotes((prev) => {
          const deselectIds = note.chordId
            ? new Set(prev.filter((n) => n.chordId === note.chordId).map((n) => n.id))
            : new Set([note.id]);
          return prev.map((n) => ({ ...n, selected: n.selected && !deselectIds.has(n.id) }));
        });
      } else {
        setNotes((prev) => {
          const primaryIds = new Set([note.id]);
          const expanded = expandSelectionWithChordMates(prev, primaryIds);
          return prev.map((n) => ({ ...n, selected: expanded.has(n.id) }));
        });
      }
      digitBufferRef.current = '';
    },
    [notes, findNoteAt, applyMutation, expandSelectionWithChordMates]
  );
  handleCellClickRef.current = handleCellClick;

  const DRAG_THRESHOLD_PX = 5;

  const handleNoteMouseDown = (note: StateTestNote, row: number, col: number, e: React.MouseEvent) => {
    if (dragState || resizeState) return;
    setSelectedCell(null);
    const wasOnlySelected =
      note.selected && notes.filter((n) => n.selected).length === 1;
    if (e.shiftKey) {
      setNotes((prev) => {
        const currentIds = new Set(prev.filter((n) => n.selected).map((n) => n.id));
        const expanded = expandSelectionWithChordMates(prev, currentIds);
        const chordMateIds = note.chordId
          ? prev.filter((n) => n.chordId === note.chordId).map((n) => n.id)
          : [note.id];
        const nextIds = new Set(expanded);
        if (expanded.has(note.id)) chordMateIds.forEach((id) => nextIds.delete(id));
        else chordMateIds.forEach((id) => nextIds.add(id));
        return prev.map((n) => ({ ...n, selected: nextIds.has(n.id) }));
      });
    } else if (!note.selected) {
      setNotes((prev) => {
        const primaryIds = new Set([note.id]);
        const expanded = expandSelectionWithChordMates(prev, primaryIds);
        return prev.map((n) => ({ ...n, selected: expanded.has(n.id) }));
      });
    }
    // If note already selected (and no shift): keep current selection so group drag moves all
    digitBufferRef.current = '';
    pendingDragRef.current = {
      noteId: note.id,
      anchorRow: row,
      anchorCol: col,
      clientX: e.clientX,
      clientY: e.clientY,
      wasOnlySelected,
    };
  };

  const handleResizeHandleMouseDown = (note: StateTestNote, edge: 'left' | 'right', e: React.MouseEvent) => {
    e.stopPropagation();
    if (resizeState || dragState) return;
    setSelectedCell(null);
    setNotes((prev) => {
      const primaryIds = new Set([note.id]);
      const expanded = expandSelectionWithChordMates(prev, primaryIds);
      return prev.map((n) => ({ ...n, selected: expanded.has(n.id) }));
    });
    digitBufferRef.current = '';
    pendingResizeRef.current = {
      noteId: note.id,
      edge,
      anchorStartCol: note.startCol,
      anchorEndCol: note.endCol,
      startClientX: e.clientX,
      startClientY: e.clientY,
    };
  };

  const handleCellMouseEnter = (row: number, col: number) => {
    setHover({ row, col });
    // During drag, drop cell is computed from anchor point in mousemove, not from cursor cell
    if (dragState) return;
    setDragState((prev) =>
      prev ? { ...prev, currentRow: row, currentCol: col } : null
    );
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (resizeState) {
        const gridEl = gridWrapperRef.current;
        if (gridEl) {
          const rect = gridEl.getBoundingClientRect();
          const localX = e.clientX - rect.left;
          resizeLatestRef.current = { localX };
          setResizeState((prev) => {
            if (!prev) return null;
            const { edge, anchorStartCol, anchorEndCol } = prev;
            const noteLeftPx = anchorStartCol * COLUMN_WIDTH;
            const noteRightPx = (anchorEndCol + 1) * COLUMN_WIDTH;
            const minW = COLUMN_WIDTH;
            let visualWidthPx: number;
            if (edge === 'right') {
              const visualRight = Math.max(noteLeftPx + minW, Math.min(localX, TEST_COLS * COLUMN_WIDTH));
              visualWidthPx = visualRight - noteLeftPx;
            } else {
              const visualLeft = Math.min(noteRightPx - minW, Math.max(0, localX));
              visualWidthPx = noteRightPx - visualLeft;
            }
            return { ...prev, currentClientX: e.clientX, visualWidthPx };
          });
        }
        return;
      }
      const pendingMarquee = pendingMarqueeRef.current;
      if (pendingMarquee) {
        const dx = e.clientX - pendingMarquee.clientX;
        const dy = e.clientY - pendingMarquee.clientY;
        if (dx * dx + dy * dy > DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) {
          const gridEl = gridWrapperRef.current;
          if (gridEl) {
            const rect = gridEl.getBoundingClientRect();
            const localX = e.clientX - rect.left;
            const localY = e.clientY - rect.top;
            const col = Math.floor(localX / COLUMN_WIDTH);
            const row = Math.floor(localY / ROW_HEIGHT);
            const currentRow = Math.max(0, Math.min(TEST_ROWS - 1, row));
            const currentCol = Math.max(0, Math.min(TEST_COLS - 1, col));
            setMarqueeState({
              startRow: pendingMarquee.startRow,
              startCol: pendingMarquee.startCol,
              currentRow,
              currentCol,
            });
          }
          pendingMarqueeRef.current = null;
        }
        return;
      }
      if (marqueeState) {
        const gridEl = gridWrapperRef.current;
        if (gridEl) {
          const rect = gridEl.getBoundingClientRect();
          const localX = e.clientX - rect.left;
          const localY = e.clientY - rect.top;
          const col = Math.floor(localX / COLUMN_WIDTH);
          const row = Math.floor(localY / ROW_HEIGHT);
          const currentRow = Math.max(0, Math.min(TEST_ROWS - 1, row));
          const currentCol = Math.max(0, Math.min(TEST_COLS - 1, col));
          const minRow = Math.min(marqueeState.startRow, currentRow);
          const maxRow = Math.max(marqueeState.startRow, currentRow);
          const minCol = Math.min(marqueeState.startCol, currentCol);
          const maxCol = Math.max(marqueeState.startCol, currentCol);
          setNotes((prev) => {
            const intersectsIds = new Set(
              prev
                .filter(
                  (n) =>
                    n.row >= minRow &&
                    n.row <= maxRow &&
                    n.startCol <= maxCol &&
                    n.endCol >= minCol
                )
                .map((n) => n.id)
            );
            const expanded = expandSelectionWithChordMatesRef.current(prev, intersectsIds);
            return prev.map((n) => ({ ...n, selected: expanded.has(n.id) }));
          });
          setMarqueeState((prev) =>
            prev ? { ...prev, currentRow, currentCol } : null
          );
        }
        return;
      }
      if (dragState) {
        setDragGhost({ clientX: e.clientX, clientY: e.clientY });
        const gridEl = gridWrapperRef.current;
        if (gridEl) {
          const rect = gridEl.getBoundingClientRect();
          const anchorPointClientX =
            e.clientX -
            dragState.anchorOffsetX +
            (dragState.anchorCol - dragState.anchorStartCol) * COLUMN_WIDTH +
            COLUMN_WIDTH / 2;
          const anchorPointClientY =
            e.clientY - dragState.anchorOffsetY + ROW_HEIGHT / 2;
          const localX = anchorPointClientX - rect.left;
          const localY = anchorPointClientY - rect.top;
          const col = Math.floor(localX / COLUMN_WIDTH);
          const row = Math.floor(localY / ROW_HEIGHT);
          let currentRow = Math.max(0, Math.min(TEST_ROWS - 1, row));
          const currentCol = Math.max(0, Math.min(TEST_COLS - 1, col));
          const note = notesRef.current.find((n) => n.id === dragState.noteId);
          const isFullHeightChord =
            note?.chordId &&
            notesRef.current.filter((n) => n.chordId === note.chordId).length === TEST_ROWS;
          if (isFullHeightChord) currentRow = dragState.anchorRow;
          setDragState((prev) =>
            prev ? { ...prev, currentRow, currentCol } : null
          );
        }
        return;
      }
      const pendingResize = pendingResizeRef.current;
      if (pendingResize) {
        const dx = e.clientX - pendingResize.startClientX;
        const dy = e.clientY - pendingResize.startClientY;
        if (dx * dx + dy * dy > DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) {
          const note = notesRef.current.find((n) => n.id === pendingResize.noteId);
          if (note) {
            const initialWidthPx = (note.endCol - note.startCol + 1) * COLUMN_WIDTH;
            setResizeState({
              noteId: note.id,
              edge: pendingResize.edge,
              anchorStartCol: pendingResize.anchorStartCol,
              anchorEndCol: pendingResize.anchorEndCol,
              startClientX: pendingResize.startClientX,
              currentClientX: e.clientX,
              visualWidthPx: initialWidthPx,
            });
          }
          pendingResizeRef.current = null;
        }
        return;
      }
      const pending = pendingDragRef.current;
      if (!pending) return;
      const dx = e.clientX - pending.clientX;
      const dy = e.clientY - pending.clientY;
      if (dx * dx + dy * dy <= DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) return;
      const note = notesRef.current.find((n) => n.id === pending.noteId);
      if (note) {
        const gridEl = gridWrapperRef.current;
        let anchorOffsetX = 0;
        let anchorOffsetY = 0;
        if (gridEl) {
          const rect = gridEl.getBoundingClientRect();
          const noteLeft = rect.left + note.startCol * COLUMN_WIDTH;
          const noteTop = rect.top + note.row * ROW_HEIGHT;
          anchorOffsetX = pending.clientX - noteLeft;
          anchorOffsetY = pending.clientY - noteTop;
        }
        setDragGhost({ clientX: e.clientX, clientY: e.clientY });
        setDragState({
          noteId: note.id,
          anchorRow: pending.anchorRow,
          anchorCol: pending.anchorCol,
          anchorStartCol: note.startCol,
          anchorEndCol: note.endCol,
          anchorOffsetX,
          anchorOffsetY,
          currentRow: pending.anchorRow,
          currentCol: pending.anchorCol,
        });
      }
      pendingDragRef.current = null;
    };

    const handleMouseUp = () => {
      if (resizeState) {
        const gridEl = gridWrapperRef.current;
        const latest = resizeLatestRef.current;
        resizeLatestRef.current = null;
        if (gridEl) {
          const rect = gridEl.getBoundingClientRect();
          const { noteId, edge, anchorStartCol, anchorEndCol } = resizeState;
          const localX = latest ? latest.localX : resizeState.currentClientX - rect.left;
          applyMutationRef.current((prev) => {
            const note = prev.find((n) => n.id === noteId);
            if (!note) return prev;
            let newStartCol: number;
            let newEndCol: number;
            if (edge === 'right') {
                const visualRightPx = Math.max(
                  (anchorStartCol + 1) * COLUMN_WIDTH,
                  Math.min(localX, TEST_COLS * COLUMN_WIDTH)
                );
                newEndCol = Math.min(
                  TEST_COLS - 1,
                  Math.max(anchorStartCol, Math.max(0, Math.round(visualRightPx / COLUMN_WIDTH) - 1))
                );
                newStartCol = note.startCol;
              } else {
                const noteRightPx = (anchorEndCol + 1) * COLUMN_WIDTH;
                const visualLeftPx = Math.min(
                  noteRightPx - COLUMN_WIDTH,
                  Math.max(0, localX)
                );
                newStartCol = Math.min(
                  anchorEndCol,
                  Math.max(0, Math.min(Math.round(visualLeftPx / COLUMN_WIDTH), TEST_COLS - 1))
                );
                newEndCol = note.endCol;
              }
            const chordMateIds = note.chordId
              ? new Set(prev.filter((m) => m.chordId === note.chordId).map((m) => m.id))
              : new Set([note.id]);
            const resizeFootprint = new Map<number, [number, number][]>();
            for (const m of prev) {
              if (chordMateIds.has(m.id)) {
                if (!resizeFootprint.has(m.row)) resizeFootprint.set(m.row, []);
                resizeFootprint.get(m.row)!.push([newStartCol, newEndCol]);
              }
            }
            for (const row of resizeFootprint.keys()) {
              resizeFootprint.set(row, mergeColumnRanges(resizeFootprint.get(row)!));
            }
            const brokenChordIds = new Set<string>();
            const result = prev.flatMap((n) => {
              if (chordMateIds.has(n.id)) {
                return [{ ...n, startCol: newStartCol, endCol: newEndCol }];
              }
              if (!resizeFootprint.has(n.row)) return [n];
              const dropRanges = resizeFootprint.get(n.row)!;
              let intervals: [number, number][] = [[n.startCol, n.endCol]];
              for (const hole of dropRanges) {
                intervals = subtractRangeFromIntervals(intervals, hole);
              }
              if (intervals.length === 0) {
                if (n.chordId) brokenChordIds.add(n.chordId);
                return [];
              }
              // No actual overlap: footprint didn't touch this note, leave it unchanged
              if (
                intervals.length === 1 &&
                intervals[0][0] === n.startCol &&
                intervals[0][1] === n.endCol
              )
                return [n];
              if (n.chordId) brokenChordIds.add(n.chordId);
              return intervals.map(([a, b]) => ({
                ...n,
                id: genNoteId(),
                startCol: a,
                endCol: b,
                chordId: null,
              }));
            });
            return result.map((n) =>
              n.chordId && brokenChordIds.has(n.chordId) ? { ...n, chordId: null } : n
            );
          });
        }
        setResizeState(null);
        return;
      }
      if (pendingResizeRef.current) {
        pendingResizeRef.current = null;
      }
      if (marqueeState) {
        setMarqueeState(null);
        setMarqueePointerDownRef.current(false);
        setSelectedCell(null);
        suppressClickAfterMarqueeRef.current = true;
        return;
      }
      if (pendingMarqueeRef.current) {
        pendingMarqueeRef.current = null;
        setMarqueePointerDownRef.current(false);
      }
      if (dragState) {
        setDragGhost(null);
        const {
          noteId,
          anchorRow,
          anchorCol,
          anchorStartCol,
          anchorEndCol,
          currentRow,
          currentCol,
        } = dragState;
        const isValidDrop =
          currentRow >= 0 &&
          currentRow < TEST_ROWS &&
          currentCol >= 0 &&
          currentCol < TEST_COLS &&
          (currentRow !== anchorRow || currentCol !== anchorCol);

        if (isValidDrop) {
          const deltaRow = currentRow - anchorRow;
          const deltaCol = currentCol - anchorCol;
          applyMutationRef.current((prev) => {
            const dropFootprint = new Map<number, [number, number][]>();
            for (const n of prev) {
              if (!n.selected) continue;
              const newRow = Math.max(0, Math.min(TEST_ROWS - 1, n.row + deltaRow));
              const newStartCol = Math.max(
                0,
                Math.min(TEST_COLS - 1, n.startCol + deltaCol)
              );
              const span = n.endCol - n.startCol + 1;
              const newEndCol = Math.max(
                newStartCol,
                Math.min(TEST_COLS - 1, newStartCol + span - 1)
              );
              if (!dropFootprint.has(newRow)) dropFootprint.set(newRow, []);
              dropFootprint.get(newRow)!.push([newStartCol, newEndCol]);
            }
            for (const row of dropFootprint.keys()) {
              dropFootprint.set(row, mergeColumnRanges(dropFootprint.get(row)!));
            }
            const brokenChordIds = new Set<string>();
            const result = prev.flatMap((n) => {
              if (n.selected) {
                const newRow = Math.max(0, Math.min(TEST_ROWS - 1, n.row + deltaRow));
                const newStartCol = Math.max(
                  0,
                  Math.min(TEST_COLS - 1, n.startCol + deltaCol)
                );
                const span = n.endCol - n.startCol + 1;
                const newEndCol = Math.max(
                  newStartCol,
                  Math.min(TEST_COLS - 1, newStartCol + span - 1)
                );
                return [
                  {
                    ...n,
                    row: newRow,
                    startCol: newStartCol,
                    endCol: newEndCol,
                    selected: false,
                  },
                ];
              }
              if (!dropFootprint.has(n.row)) return [n];
              const dropRanges = dropFootprint.get(n.row)!;
              let intervals: [number, number][] = [[n.startCol, n.endCol]];
              for (const hole of dropRanges) {
                intervals = subtractRangeFromIntervals(intervals, hole);
              }
              if (intervals.length === 0) {
                if (n.chordId) brokenChordIds.add(n.chordId);
                return [];
              }
              // No actual overlap: footprint didn't touch this note, leave it unchanged
              if (
                intervals.length === 1 &&
                intervals[0][0] === n.startCol &&
                intervals[0][1] === n.endCol
              )
                return [n];
              if (n.chordId) brokenChordIds.add(n.chordId);
              return intervals.map(([a, b]) => ({
                ...n,
                id: genNoteId(),
                startCol: a,
                endCol: b,
                chordId: null,
              }));
            });
            return result.map((n) =>
              n.chordId && brokenChordIds.has(n.chordId) ? { ...n, chordId: null } : n
            );
          });
          suppressClickAfterDragRef.current = true;
        } else {
          setNotes((prev) =>
            prev.map((n) => ({ ...n, selected: false }))
          );
          setSelectedCellRef.current(null);
        }
        setDragState(null);
      } else if (pendingDragRef.current) {
        const { anchorRow, anchorCol, wasOnlySelected } = pendingDragRef.current;
        pendingDragRef.current = null;
        if (wasOnlySelected) {
          const note = notes.find(
            (n) =>
              n.row === anchorRow &&
              anchorCol >= n.startCol &&
              anchorCol <= n.endCol
          );
          if (note) {
            setNotes((prev) =>
              prev.map((n) => (n.id === note.id ? { ...n, selected: false } : n))
            );
          }
        }
      }
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, resizeState, marqueeState, TEST_ROWS, TEST_COLS]);

  // Digit keys: create note at selected empty cell, or update single selected note. Backspace/Delete: clear selected cell or remove selected notes.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const active = document.activeElement as HTMLElement | null;
      if (
        active?.tagName === 'INPUT' ||
        active?.tagName === 'TEXTAREA' ||
        active?.tagName === 'SELECT'
      )
        return;

      const key = e.key;
      const mod = e.metaKey || e.ctrlKey;

      if (mod) {
        if (key === 'z') {
          e.preventDefault();
          if (e.shiftKey) handleRedoRef.current();
          else handleUndoRef.current();
          return;
        }
        if (key === 'y') {
          e.preventDefault();
          handleRedoRef.current();
          return;
        }
        if (key === 'x') {
          e.preventDefault();
          handleCutRef.current();
          return;
        }
        if (key === 'c') {
          e.preventDefault();
          handleCopyRef.current();
          return;
        }
        if (key === 'v') {
          e.preventDefault();
          handlePasteRef.current();
          return;
        }
      }

      if (key === 's' || key === 'S') {
        e.preventDefault();
        handleSplitIntoNotesRef.current();
        return;
      }
      if (key === 'c' || key === 'C') {
        if (!mod) {
          e.preventDefault();
          handleCombineIntoChordRef.current();
          return;
        }
      }

      if (key === '+' || key === '=') {
        e.preventDefault();
        if (e.repeat) return;
        applyMutationRef.current((prev) => {
          const selected = prev.filter((n) => n.selected);
          if (selected.length === 0) return prev;
          const expandedIds = expandSelectionWithChordMatesRef.current(
            prev,
            new Set(selected.map((n) => n.id))
          );
          return prev.map((n) => {
            if (!expandedIds.has(n.id)) return n;
            const newEndCol = Math.min(TEST_COLS - 1, n.endCol + 1);
            return { ...n, endCol: newEndCol };
          });
        });
        return;
      }
      if (key === '-') {
        e.preventDefault();
        if (e.repeat) return;
        applyMutationRef.current((prev) => {
          const selected = prev.filter((n) => n.selected);
          if (selected.length === 0) return prev;
          const expandedIds = expandSelectionWithChordMatesRef.current(
            prev,
            new Set(selected.map((n) => n.id))
          );
          return prev.map((n) => {
            if (!expandedIds.has(n.id)) return n;
            const newEndCol = Math.max(n.startCol, n.endCol - 1);
            return { ...n, endCol: newEndCol };
          });
        });
        return;
      }

      const sel = selectedCellRef.current;

      if (key === 'Escape') {
        e.preventDefault();
        setSelectedCellRef.current(null);
        applyMutationRef.current((prev) => prev.map((n) => ({ ...n, selected: false })));
        return;
      }

      if (key === 'Enter') {
        e.preventDefault();
        if (e.repeat) return;
        const notesNow = notesRef.current;
        const selectedNotes = notesNow.filter((n) => n.selected);
        let nextRow: number;
        let col: number;
        if (sel) {
          nextRow = Math.min(sel.row + 1, TEST_ROWS - 1);
          col = sel.col;
        } else if (selectedNotes.length === 1) {
          const n = selectedNotes[0];
          nextRow = Math.min(n.row + 1, TEST_ROWS - 1);
          col = n.startCol;
        } else {
          return;
        }
        const noteAt =
          notesNow.find((n) => n.row === nextRow && col >= n.startCol && col <= n.endCol) ?? null;
        if (noteAt) {
          const expanded = expandSelectionWithChordMatesRef.current(notesNow, new Set([noteAt.id]));
          applyMutationRef.current((prev) =>
            prev.map((n) => ({ ...n, selected: expanded.has(n.id) }))
          );
          setSelectedCellRef.current(null);
        } else {
          setSelectedCellRef.current({ row: nextRow, col });
          applyMutationRef.current((prev) => prev.map((n) => ({ ...n, selected: false })));
        }
        digitBufferRef.current = '';
        return;
      }

      if (key === 'Backspace' || key === 'Delete') {
        e.preventDefault();
        if (e.repeat) return;
        if (sel) {
          setSelectedCellRef.current(null);
          digitBufferRef.current = '';
          return;
        }
        applyMutationRef.current((prev) => prev.filter((n) => !n.selected));
        digitBufferRef.current = '';
        return;
      }

      if (key.length !== 1 || !/^[0-9]$/.test(key)) return;
      if (e.repeat) return;

      digitBufferRef.current = (digitBufferRef.current + key).slice(-2);
      const parsed = parseInt(digitBufferRef.current, 10);
      const value = Number.isFinite(parsed)
        ? Math.min(24, Math.max(0, parsed))
        : 0;

      if (sel) {
        const notesNow = notesRef.current;
        const hasNote = notesNow.some(
          (n) => n.row === sel.row && sel.col >= n.startCol && sel.col <= n.endCol
        );
        if (!hasNote) {
          applyMutationRef.current((prev) => {
            const next = prev.map((n) => ({ ...n, selected: false }));
            next.push({
              id: genNoteId(),
              row: sel.row,
              startCol: sel.col,
              endCol: sel.col,
              value,
              selected: true,
              chordId: null,
            });
            return next;
          });
          setSelectedCellRef.current(null);
          digitBufferRef.current = '';
          e.preventDefault();
          return;
        }
      }

      applyMutationRef.current((prev) => {
        const selected = prev.filter((n) => n.selected);
        if (selected.length === 0) return prev;
        const selectedIds = new Set(selected.map((n) => n.id));
        return prev.map((n) =>
          selectedIds.has(n.id) ? { ...n, value } : n
        );
      });
      e.preventDefault();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Cursor during resize (col-resize), drag (grabbing), and marquee (crosshair); use !important so it overrides child cursor styles
  useEffect(() => {
    if (resizeState) {
      document.body.style.setProperty('cursor', 'col-resize', 'important');
      return () => {
        document.body.style.removeProperty('cursor');
      };
    }
    if (dragState) {
      document.body.style.setProperty('cursor', 'grabbing', 'important');
      return () => {
        document.body.style.removeProperty('cursor');
      };
    }
    if (marqueeState || marqueePointerDown) {
      document.body.style.setProperty('cursor', 'crosshair', 'important');
      return () => {
        document.body.style.removeProperty('cursor');
      };
    }
  }, [resizeState, dragState, marqueeState, marqueePointerDown]);

  return (
    <div className="inline-block">
      <div className="flex flex-wrap items-center gap-1 mb-2">
        <button
          type="button"
          onClick={handleUndo}
          disabled={undoStack.length === 0}
          title="Undo"
          aria-label="Undo"
          className="p-2 rounded bg-bg-tertiary hover:bg-bg-tertiary/80 disabled:opacity-50 text-text-primary"
        >
          <Undo2 className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={handleRedo}
          disabled={redoStack.length === 0}
          title="Redo"
          aria-label="Redo"
          className="p-2 rounded bg-bg-tertiary hover:bg-bg-tertiary/80 disabled:opacity-50 text-text-primary"
        >
          <Redo2 className="w-4 h-4" />
        </button>
        <span className="w-px h-4 bg-bg-tertiary" aria-hidden />
        <button
          type="button"
          onClick={handleCopy}
          disabled={!notes.some((n) => n.selected)}
          title="Copy"
          aria-label="Copy"
          className="p-2 rounded bg-bg-tertiary hover:bg-bg-tertiary/80 disabled:opacity-50 text-text-primary"
        >
          <Copy className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={handleCut}
          disabled={!notes.some((n) => n.selected)}
          title="Cut"
          aria-label="Cut"
          className="p-2 rounded bg-bg-tertiary hover:bg-bg-tertiary/80 disabled:opacity-50 text-text-primary"
        >
          <Scissors className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={handlePaste}
          disabled={!clipboard?.items?.length}
          title="Paste"
          aria-label="Paste"
          className="p-2 rounded bg-bg-tertiary hover:bg-bg-tertiary/80 disabled:opacity-50 text-text-primary"
        >
          <ClipboardPaste className="w-4 h-4" />
        </button>
        <span className="w-px h-4 bg-bg-tertiary" aria-hidden />
        <button
          type="button"
          onClick={handleSplitIntoNotes}
          disabled={!notes.some((n) => n.selected && n.startCol < n.endCol)}
          title="Split into notes"
          aria-label="Split into notes"
          className="p-2 rounded bg-bg-tertiary hover:bg-bg-tertiary/80 disabled:opacity-50 text-text-primary"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={handleCombineIntoChord}
          disabled={notes.filter((n) => n.selected).length < 2}
          title="Combine into chord"
          aria-label="Combine into chord"
          className="p-2 rounded bg-bg-tertiary hover:bg-bg-tertiary/80 disabled:opacity-50 text-text-primary"
        >
          <Minimize2 className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={handleClearAll}
          disabled={notes.length === 0}
          title="Clear all"
          aria-label="Clear all"
          className="p-2 rounded border border-bg-tertiary/70 text-text-secondary hover:bg-bg-tertiary/80 hover:text-text-primary disabled:opacity-50"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      <div className="rounded-lg border border-bg-tertiary bg-bg-secondary/80 p-4">
      <div
        ref={gridWrapperRef}
        className={`relative select-none${dragState ? ' state-test-grid-cursor-grabbing' : ''}${resizeState ? ' state-test-grid-cursor-col-resize' : ''}${marqueeState || marqueePointerDown ? ' state-test-grid-cursor-crosshair' : ''}`}
        style={{
          width: TEST_COLS * COLUMN_WIDTH,
          height: TEST_ROWS * ROW_HEIGHT,
        }}
        onMouseLeave={() => {
          if (dragState)
            setDragState((prev) =>
              prev ? { ...prev, currentRow: -1, currentCol: -1 } : null
            );
          if (resizeState) setResizeState(null);
        }}
      >
        {/* Dot grid at intersections */}
        {Array.from({ length: TEST_ROWS + 1 }, (_, r) =>
          Array.from({ length: TEST_COLS + 1 }, (_, c) => (
            <div
              key={`dot-${r}-${c}`}
              className="absolute rounded-full bg-bg-tertiary/70"
              style={{
                width: 4,
                height: 4,
                left: c * COLUMN_WIDTH,
                top: r * ROW_HEIGHT,
                transform: 'translate(-50%, -50%)',
              }}
            />
          ))
        )}

        {/* Drop targets: one per selected note, each moved by same delta as primary */}
        {dragState &&
          dragState.currentRow >= 0 &&
          dragState.currentCol >= 0 &&
          (dragState.currentRow !== dragState.anchorRow ||
            dragState.currentCol !== dragState.anchorCol) &&
          notes
            .filter((n) => n.selected)
            .map((note) => {
              const deltaRow = dragState.currentRow - dragState.anchorRow;
              const deltaCol = dragState.currentCol - dragState.anchorCol;
              const newRow = Math.max(0, Math.min(TEST_ROWS - 1, note.row + deltaRow));
              const newStartCol = Math.max(
                0,
                Math.min(TEST_COLS - 1, note.startCol + deltaCol)
              );
              const span = note.endCol - note.startCol + 1;
              const newEndCol = Math.max(
                newStartCol,
                Math.min(TEST_COLS - 1, newStartCol + span - 1)
              );
              const widthCols = newEndCol - newStartCol + 1;
              if (widthCols <= 0) return null;
              return (
                <div
                  key={note.id}
                  className="absolute border border-pink-100/20 bg-pink-400/20 pointer-events-none"
                  style={{
                    left: newStartCol * COLUMN_WIDTH,
                    top: newRow * ROW_HEIGHT,
                    width: widthCols * COLUMN_WIDTH,
                    height: ROW_HEIGHT,
                  }}
                  aria-hidden
                />
              );
            })}

        {/* Marquee selection rectangle */}
        {marqueeState && (
          <div
            className="absolute border border-pink-100/20 bg-pink-400/20 pointer-events-none"
            style={{
              left: Math.min(marqueeState.startCol, marqueeState.currentCol) * COLUMN_WIDTH,
              top: Math.min(marqueeState.startRow, marqueeState.currentRow) * ROW_HEIGHT,
              width: (Math.abs(marqueeState.currentCol - marqueeState.startCol) + 1) * COLUMN_WIDTH,
              height: (Math.abs(marqueeState.currentRow - marqueeState.startRow) + 1) * ROW_HEIGHT,
            }}
            aria-hidden
          />
        )}

        {/* Interactive cells overlay: empty cells, hover */}
        <div
          className="absolute inset-0 grid"
          style={{
            gridTemplateColumns: `repeat(${TEST_COLS}, ${COLUMN_WIDTH}px)`,
            gridTemplateRows: `repeat(${TEST_ROWS}, ${ROW_HEIGHT}px)`,
          }}
        >
          {Array.from({ length: TEST_ROWS }, (_, r) =>
            Array.from({ length: TEST_COLS }, (_, c) => {
              const isHover = hover?.row === r && hover?.col === c;
              const hasNote = findNoteAt(r, c);
              const isSelectedEmpty =
                !hasNote && selectedCell?.row === r && selectedCell?.col === c;
              const cursorClass =
                hasNote || isSelectedEmpty ? 'cursor-pointer' : 'cursor-default';
              return (
                <div
                  key={`${r}-${c}`}
                  className={`relative flex items-center justify-center ${cursorClass}`}
                  onClick={(e) => handleCellClick(r, c, e)}
                  onMouseDown={(e) => {
                    if (hasNote || dragState || resizeState || marqueeState) return;
                    setMarqueePointerDown(true);
                    pendingMarqueeRef.current = {
                      startRow: r,
                      startCol: c,
                      clientX: e.clientX,
                      clientY: e.clientY,
                    };
                  }}
                  onMouseEnter={() => handleCellMouseEnter(r, c)}
                  onMouseLeave={() => setHover(null)}
                >
                  {!hasNote && isHover && !dragState && !resizeState && (
                    <div className="absolute inset-0 bg-pink-400/10 rounded pointer-events-none" />
                  )}
                  {!hasNote && selectedCell?.row === r && selectedCell?.col === c && (
                    <GridNoteChip value="" slots={1} state="emptySelected" />
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* All notes as individual chips (including chord notes) */}
        {notes.map((note) => {
          const isDragging = dragState?.noteId === note.id;
          const chordIsBeingDragged =
            dragState != null &&
            (note.chordId != null
              ? notes.some(
                  (n) => n.id === dragState.noteId && n.chordId === note.chordId
                )
              : isDragging);
          if (chordIsBeingDragged) return null;
          const resizeNote = resizeState ? notes.find((n) => n.id === resizeState.noteId) : null;
          const isResizing =
            resizeState?.noteId === note.id ||
            (resizeNote?.chordId && note.chordId === resizeNote.chordId && resizeState != null);
          let leftPx: number;
          let widthPx: number;
          if (isResizing && resizeState) {
            widthPx = resizeState.visualWidthPx;
            if (resizeState.edge === 'left') {
              leftPx = (resizeState.anchorEndCol + 1) * COLUMN_WIDTH - widthPx;
            } else {
              leftPx = resizeState.anchorStartCol * COLUMN_WIDTH;
            }
          } else {
            leftPx = note.startCol * COLUMN_WIDTH;
            widthPx = (note.endCol - note.startCol + 1) * COLUMN_WIDTH;
          }
          const hoveredNote =
            hover != null ? findNoteAt(hover.row, hover.col) : null;
          const isChordHovered =
            hoveredNote != null &&
            (hoveredNote.chordId != null
              ? note.chordId === hoveredNote.chordId
              : note.id === hoveredNote.id);
          const chipState = isResizing
            ? 'resizing'
            : note.selected
            ? isChordHovered && !isDragging
              ? 'selectedHover'
              : 'selected'
            : isChordHovered && !isDragging
            ? 'hover'
            : 'default';

          const chipWidthPx = widthPx - 2 * NOTE_CHIP_PADDING_PX;

          return (
            <div
              key={note.id}
              className="absolute"
              style={{
                left: leftPx,
                top: note.row * ROW_HEIGHT,
                width: widthPx,
                height: ROW_HEIGHT,
                pointerEvents: isDragging ? 'none' : 'auto',
              }}
              onMouseEnter={() => setHover({ row: note.row, col: note.startCol })}
              onMouseLeave={() => setHover(null)}
            >
              {!isDragging && (
                <>
                  <div
                    className="absolute left-0 top-0 bottom-0 flex items-center justify-center cursor-pointer z-0 box-border"
                    style={{
                      width: widthPx,
                      padding: `${NOTE_CHIP_PADDING_PX}px`,
                    }}
                    onMouseDown={(e) => handleNoteMouseDown(note, note.row, note.startCol, e)}
                  >
                    <GridNoteChip
                      value={note.value}
                      slots={1}
                      widthPx={chipWidthPx}
                      state={chipState}
                    />
                  </div>
                  <div
                    className="absolute left-0 top-0 bottom-0 cursor-col-resize z-10"
                    style={{ width: RESIZE_HANDLE_WIDTH_PX }}
                    onMouseDown={(e) => handleResizeHandleMouseDown(note, 'left', e)}
                    aria-label="Resize left"
                  />
                  <div
                    className="absolute right-0 top-0 bottom-0 cursor-col-resize z-10"
                    style={{ width: RESIZE_HANDLE_WIDTH_PX }}
                    onMouseDown={(e) => handleResizeHandleMouseDown(note, 'right', e)}
                    aria-label="Resize right"
                  />
                </>
              )}
            </div>
          );
        })}
        {/* Chord connector dots: centered on grid border between consecutive chord notes */}
        {(() => {
          const hoveredNote =
            hover != null ? findNoteAt(hover.row, hover.col) : null;
          const byChord = new Map<string, StateTestNote[]>();
          for (const n of notes) {
            if (!n.chordId) continue;
            const key = `${n.chordId}:${n.startCol}:${n.endCol}`;
            if (!byChord.has(key)) byChord.set(key, []);
            byChord.get(key)!.push(n);
          }
          const draggedNoteId = dragState?.noteId ?? null;
          const dots: { centerX: number; centerY: number; chordId: string; selected: boolean }[] = [];
          for (const group of byChord.values()) {
            if (draggedNoteId != null && group.some((n) => n.id === draggedNoteId)) continue;
            const sorted = [...group].sort((a, b) => a.row - b.row);
            const chordSelected = group.some((n) => n.selected);
            for (let i = 0; i < sorted.length - 1; i++) {
              if (sorted[i + 1].row !== sorted[i].row + 1) continue;
              const primary = sorted[i];
              const resizeNote = resizeState ? notes.find((n) => n.id === resizeState.noteId) : null;
              const chordIsResizing =
                resizeNote?.chordId && primary.chordId === resizeNote.chordId && resizeState != null;
              let leftPx: number;
              let widthPx: number;
              if (chordIsResizing && resizeState) {
                widthPx = resizeState.visualWidthPx;
                leftPx =
                  resizeState.edge === 'left'
                    ? (resizeState.anchorEndCol + 1) * COLUMN_WIDTH - widthPx
                    : resizeState.anchorStartCol * COLUMN_WIDTH;
              } else {
                leftPx = primary.startCol * COLUMN_WIDTH;
                widthPx = (primary.endCol - primary.startCol + 1) * COLUMN_WIDTH;
              }
              const centerX = leftPx + widthPx / 2;
              const centerY = (primary.row + 1) * ROW_HEIGHT;
              dots.push({ centerX, centerY, chordId: primary.chordId!, selected: chordSelected });
            }
          }
          const dotWidth = COLUMN_WIDTH * 0.5;
          const dotHeight = 2;
          return dots.map((d, i) => {
            const isChordHovered =
              hoveredNote?.chordId != null && hoveredNote.chordId === d.chordId;
            const dotClass = d.selected
              ? 'bg-cyan-400'
              : isChordHovered
                ? 'bg-rose-400'
                : 'bg-pink-500/50';
            return (
              <div
                key={`chord-dot-${i}`}
                className={`absolute rounded-full pointer-events-none ${dotClass}`}
                style={{
                  left: d.centerX - dotWidth / 2,
                  top: d.centerY - dotHeight / 2,
                  width: dotWidth,
                  height: dotHeight,
                }}
              />
            );
          });
        })()}
        {dragGhost && dragState && (() => {
          const note = notes.find((n) => n.id === dragState.noteId);
          if (!note) return null;
          const chordNotes = note.chordId
            ? notes
                .filter((n) => n.chordId === note.chordId)
                .sort((a, b) => a.row - b.row)
            : [note];
          const anchorIndex = chordNotes.findIndex((n) => n.id === dragState.noteId);
          const span = note.endCol - note.startCol + 1;
          const ghostWidthPx = span * COLUMN_WIDTH - 2 * NOTE_CHIP_PADDING_PX;
          const pad = NOTE_CHIP_PADDING_PX;
          const ghostDotHeight = 2;
          const ghostRowWithDot = ROW_HEIGHT + ghostDotHeight;
          const dotWidth = COLUMN_WIDTH * 0.5;
          return (
            <div
              className="pointer-events-none fixed z-50 flex flex-col"
              style={{
                left: dragGhost.clientX - dragState.anchorOffsetX,
                top: dragGhost.clientY - dragState.anchorOffsetY - anchorIndex * ghostRowWithDot,
              }}
            >
              {chordNotes.map((chordNote, i) => (
                <Fragment key={chordNote.id}>
                  {i > 0 && (
                    <div
                      className="flex items-center justify-center shrink-0"
                      style={{ height: ghostDotHeight, width: '100%' }}
                    >
                      <div
                        className="rounded-full bg-cyan-400 shrink-0"
                        style={{ width: dotWidth, height: ghostDotHeight }}
                      />
                    </div>
                  )}
                  <div
                    className="flex items-center justify-center shrink-0"
                    style={{
                      padding: `${pad}px`,
                      height: ROW_HEIGHT,
                      minHeight: ROW_HEIGHT,
                    }}
                  >
                    <GridNoteChip
                      value={chordNote.value}
                      slots={1}
                      widthPx={ghostWidthPx}
                      state="dragGhost"
                    />
                  </div>
                </Fragment>
              ))}
            </div>
          );
        })()}
      </div>
      </div>
    </div>
  );
}

function defaultRiff(id: string, name = 'New riff'): Riff {
  return {
    id,
    name,
    timeSignature: { num: 4, denom: 4 },
    tempo: 100,
    lengthBars: 8,
    style: 'user',
    notes: [],
  };
}

type DragState =
  | null
  | {
      mode: 'move';
      anchor: { stringIndex: number; slotIndex: number };
      current: { stringIndex: number; slotIndex: number };
    }
  | {
      mode: 'resize';
      stringIndex: number;
      noteId: string;
      anchorSlot: number;
      currentSlot: number;
    };

export function GridEditor() {
  const list = getMergedRiffList();
  const [riffId, setRiffId] = useState<string>(list[0]?.id ?? '');
  const [riff, setRiffState] = useState<Riff | null>(null);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [chordCells, setChordCells] = useState<Set<string>>(new Set());
  const [dragState, setDragState] = useState<DragState>(null);
  const [anchor, setAnchor] = useState<{ stringIndex: number; slotIndex: number } | null>(null);
  const [hoverCell, setHoverCell] = useState<{ stringIndex: number; slotIndex: number } | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressClickRef = useRef(false);
  const [dragGhost, setDragGhost] = useState<{
    originClientX: number;
    originClientY: number;
    clientX: number;
    clientY: number;
  } | null>(null);
  const gridRootRef = useRef<HTMLDivElement | null>(null);

  const { push: pushHistory, undo, redo, clear: clearHistory, canUndo, canRedo } = useRiffHistory(riff ?? null);

  const bars = riff?.lengthBars ?? 8;
  const subsPerBar = riff ? getSubsPerBar(riff) : 16;
  const totalColumns = bars * subsPerBar;

  const editorGrid = useMemo(
    () => (riff ? notesToEditorGrid(riff, bars) : [] as ReturnType<typeof notesToEditorGrid>),
    [riff, bars, riff?.notes]
  );

  // Drag ghost follows the cursor while dragging notes or durations
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragState) return;
      setDragGhost((prev) =>
        prev
          ? { ...prev, clientX: e.clientX, clientY: e.clientY }
          : {
              originClientX: e.clientX,
              originClientY: e.clientY,
              clientX: e.clientX,
              clientY: e.clientY,
            }
      );
    };
    const onUp = () => {
      setDragGhost(null);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragState]);

  useEffect(() => {
    if (riffId) {
      const r = getRiff(riffId);
      if (r) {
        const normalized: Riff = {
          ...r,
          lengthBars: r.lengthBars ?? 8,
          tempo: r.tempo ?? 100,
        };
        setRiffState(normalized);
      } else setRiffState(null);
    } else setRiffState(null);
    clearHistory();
    setSelection(new Set());
    setChordCells(new Set());
  }, [riffId, clearHistory]);

  useEffect(() => {
    if (!riff) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveUserRiff(riff);
      saveTimeoutRef.current = null;
    }, 500);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [riff]);

  const isUnsaved = riff !== null;

  const handleRiffChange = useCallback(
    (updater: (prev: Riff) => Riff) => {
      setRiffState((prev) => {
        if (!prev) return prev;
        pushHistory(prev);
        return updater(prev);
      });
    },
    [pushHistory]
  );

  const handleNewRiff = useCallback(() => {
    const id = nextUserRiffId();
    const r = defaultRiff(id);
    saveUserRiff(r);
    setRiffId(id);
    setRiffState(r);
    clearHistory();
    setSelection(new Set());
    setChordCells(new Set());
  }, [clearHistory]);

  const handleUndo = useCallback(() => {
    if (!riff) return;
    const prev = undo(riff);
    if (prev !== riff) setRiffState(prev);
  }, [riff, undo]);

  const handleRedo = useCallback(() => {
    if (!riff) return;
    const next = redo(riff);
    if (next !== riff) setRiffState(next);
  }, [riff, redo]);

  const handleCellEdit = useCallback(
    (stringIndex: number, slotIndex: number, value: number | null) => {
      if (!riff) return;
      pushHistory(riff);
      const newNotes = applyCellUpdateToNotes(riff, riff.notes ?? [], stringIndex, slotIndex, value);
      setRiffState({ ...riff, notes: newNotes });
    },
    [riff, pushHistory]
  );

  const handleCellClick = useCallback(
    (e: React.MouseEvent, stringIndex: number, slotIndex: number) => {
      if (suppressClickRef.current) {
        suppressClickRef.current = false;
        return;
      }
      if (e.shiftKey && anchor != null) {
        // Shift+click: extend rectangular selection from anchor to this cell
        const minS = Math.min(anchor.stringIndex, stringIndex);
        const maxS = Math.max(anchor.stringIndex, stringIndex);
        const minSlot = Math.min(anchor.slotIndex, slotIndex);
        const maxSlot = Math.max(anchor.slotIndex, slotIndex);
        const next = new Set<string>();
        for (let s = minS; s <= maxS; s += 1) {
          for (let slot = minSlot; slot <= maxSlot; slot += 1) next.add(cellKey(s, slot));
        }
        setSelection(next);
        return;
      }

      // Regular click anywhere in the cell (no shift):
      // keep whatever selection was established by mousedown (note span etc),
      // just focus the cell's input so typing works immediately, without
      // showing a full text selection highlight.
      const inputId = `grid-editor-cell-${stringIndex}-${slotIndex}`;
      const el = document.getElementById(inputId) as HTMLInputElement | null;
      if (el) {
        el.focus();
        const len = el.value.length;
        try {
          el.setSelectionRange?.(len, len);
        } catch {
          // setSelectionRange may throw on some input types; ignore.
        }
      }
    },
    [anchor]
  );

  const handleCellDoubleClick = useCallback((stringIndex: number, slotIndex: number) => {
    const inputId = `grid-editor-cell-${stringIndex}-${slotIndex}`;
    const el = document.getElementById(inputId) as HTMLInputElement | null;
    if (el) {
      el.focus();
      el.select?.();
    }
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, stringIndex: number, slotIndex: number, kind: 'cell' | 'resize-left' | 'resize-right') => {
      if (e.button !== 0) return;
      const active = document.activeElement as HTMLElement | null;
      if (active && active.tagName === 'INPUT') active.blur();
      const cell = editorGrid[stringIndex]?.[slotIndex];
      const key = cellKey(stringIndex, slotIndex);
      const hasNotesInSelection =
        selection.size > 0 &&
        Array.from(selection).some((k) => {
          const [sStr, colStr] = k.split('-');
          const s = Number(sStr);
          const col = Number(colStr);
          if (!Number.isFinite(s) || !Number.isFinite(col)) return false;
          return !!editorGrid[s]?.[col];
        });

      if ((kind === 'resize-right' || kind === 'resize-left') && cell) {
        // Begin a duration resize from either edge of the note.
        // Anchor at the true start/end of the note span so the preview and
        // final resize use the correct edge, even if the click is near it.
        const row = editorGrid[stringIndex] ?? [];
        let startSlot = slotIndex;
        let endSlot = slotIndex;
        while (startSlot - 1 >= 0 && row[startSlot - 1]?.noteId === cell.noteId) startSlot -= 1;
        while (endSlot + 1 < totalColumns && row[endSlot + 1]?.noteId === cell.noteId) endSlot += 1;
        const anchorSlot = kind === 'resize-right' ? endSlot : startSlot;

        // Ensure the full duration group is selected when interacting with
        // the resize handle so edits and keyboard input target this group.
        const nextSel = new Set<string>();
        for (let slot = startSlot; slot <= endSlot; slot += 1) {
          nextSel.add(cellKey(stringIndex, slot));
        }
        setSelection(nextSel);
        setAnchor({ stringIndex, slotIndex: startSlot });

        setDragGhost(null);
        setDragState({
          mode: 'resize',
          stringIndex,
          noteId: cell.noteId,
          anchorSlot,
          currentSlot: anchorSlot,
        });
        return;
      }
      // If current selection (containing any notes) includes this cellKey,
      // start a move drag for the whole selection, even if this cell is empty.
      if (kind === 'cell' && selection.size > 0 && selection.has(key) && hasNotesInSelection) {
        setDragGhost(null);
        setDragState({
          mode: 'move',
          anchor: { stringIndex, slotIndex },
          current: { stringIndex, slotIndex },
        });
        return;
      }
      if (cell) {
        const isInMultiSelection = selection.size > 1 && selection.has(key);
        setDragGhost(null);
        setDragState({
          mode: 'move',
          anchor: { stringIndex, slotIndex },
          current: { stringIndex, slotIndex },
        });
        if (!e.shiftKey && !isInMultiSelection) {
          // No existing multi-selection anchored here: select this note (or its duration span) only.
          let startSlot = slotIndex - cell.durationIndex;
          let endSlot = slotIndex;
          const row = editorGrid[stringIndex] ?? [];
          while (row[endSlot + 1]?.noteId === cell.noteId) endSlot += 1;
          const next = new Set<string>();
          for (let slot = startSlot; slot <= endSlot; slot += 1) next.add(cellKey(stringIndex, slot));
          setSelection(next);
          setAnchor({ stringIndex, slotIndex: startSlot });
        }
      } else if (!e.shiftKey) {
        // Empty cell: start a new single-cell selection (no drag state)
        setSelection(new Set([key]));
        setAnchor({ stringIndex, slotIndex });
      }
    },
    [editorGrid, selection, totalColumns]
  );

  const handleMouseEnter = useCallback(
    (stringIndex: number, slotIndex: number) => {
      if (dragState == null) return;
      if (dragState.mode === 'move') {
        setDragState((d) => (d && d.mode === 'move' ? { ...d, current: { stringIndex, slotIndex } } : d));
      } else if (dragState.mode === 'resize') {
        setDragState((d) =>
          d && d.mode === 'resize' ? { ...d, currentSlot: slotIndex, stringIndex: d.stringIndex } : d
        );
      }
    },
    [dragState]
  );

  const handleMouseUp = useCallback(
    (stringIndex: number, slotIndex: number) => {
      if (dragState == null) return;
      if (dragState.mode === 'move') {
        const deltaString = stringIndex - dragState.anchor.stringIndex;
        const deltaSlot = slotIndex - dragState.anchor.slotIndex;
        if ((deltaString !== 0 || deltaSlot !== 0) && riff && selection.size > 0) {
          pushHistory(riff);
          const { notes: newNotes } = moveNotes(
            riff,
            riff.notes ?? [],
            selection,
            deltaString,
            deltaSlot
          );
          setRiffState({ ...riff, notes: newNotes });
          // After a drag-and-drop, return to an unselected state so the user
          // can clearly see the result and start a fresh interaction.
          setSelection(new Set());
        }
      } else if (dragState.mode === 'resize' && riff) {
        pushHistory(riff);
        const { notes: newNotes } = applyDurationResizeToNotes(
          riff,
          riff.notes ?? [],
          dragState.stringIndex,
          dragState.anchorSlot,
          dragState.currentSlot,
          totalColumns
        );
        setRiffState({ ...riff, notes: newNotes });
        // After resizing a duration group, clear selection to reset visual state.
        setSelection(new Set());
        suppressClickRef.current = true;
      }
      setDragState(null);
      setDragGhost(null);
    },
    [dragState, riff, selection, pushHistory, totalColumns]
  );

  useEffect(() => {
    const onUp = () => {
      if (dragState != null) setDragState(null);
    };
    window.addEventListener('mouseup', onUp);
    return () => window.removeEventListener('mouseup', onUp);
  }, [dragState]);

  const handleDeleteSelection = useCallback(() => {
    if (!riff || selection.size === 0) return;
    pushHistory(riff);
    const newNotes = deleteSelectionFromNotes(riff, riff.notes ?? [], selection);
    setRiffState({ ...riff, notes: newNotes });
    setSelection(new Set());
  }, [riff, selection, pushHistory]);

  const handleCombineDuration = useCallback(() => {
    if (!riff || selection.size === 0) return;
    pushHistory(riff);
    const newNotes = combineDurationInSelection(riff, riff.notes ?? [], selection);
    setRiffState({ ...riff, notes: newNotes });
  }, [riff, selection, pushHistory]);

  const handleSplitDuration = useCallback(() => {
    if (!riff || selection.size === 0) return;
    pushHistory(riff);
    const newNotes = splitDurationToNotes(riff, riff.notes ?? [], selection);
    setRiffState({ ...riff, notes: newNotes });
    setSelection(new Set());
  }, [riff, selection, pushHistory]);

  const handleCombineChord = useCallback(() => {
    setChordCells((prev) => new Set([...prev, ...selection]));
  }, [selection]);

  const handleClearAll = useCallback(() => {
    if (!riff) return;
    if (!riff.notes?.length) return;
    pushHistory(riff);
    setRiffState({ ...riff, notes: [] });
    setSelection(new Set());
    setChordCells(new Set());
  }, [riff, pushHistory]);

  const handleCopyAsJson = useCallback(() => {
    if (riff) navigator.clipboard.writeText(JSON.stringify(riff, null, 2));
  }, [riff]);

  // When a single cell is selected:
  // - typing 0-9 enters that number in the cell
  // - Backspace clears it
  // - Enter moves selection/focus one row down
  // - Arrow keys move the selection to the adjacent cell
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!riff) return;
      const active = document.activeElement;
      if (active?.tagName === 'INPUT' || active?.tagName === 'TEXTAREA' || active?.tagName === 'SELECT') return;
      if (selection.size === 0) return;

      // Determine which cell should receive numeric edits:
      // - If a single cell is selected, use that cell.
      // - If a duration group on one string for a single note is selected,
      //   treat it like a single note and edit the note's fret.
      let editS: number | null = null;
      let editSlot: number | null = null;

      if (selection.size === 1) {
        const selKey = Array.from(selection)[0];
        const [sStr, slotStr] = selKey.split('-');
        const s = Number(sStr);
        const slot = Number(slotStr);
        if (Number.isFinite(s) && Number.isFinite(slot)) {
          editS = s;
          editSlot = slot;
        }
      } else {
        // Possible duration group: all cells on same string, same noteId.
        const keys = Array.from(selection);
        const [firstSStr, firstSlotStr] = keys[0].split('-');
        const baseS = Number(firstSStr);
        if (!Number.isFinite(baseS)) return;
        const row = editorGrid[baseS] ?? [];
        const firstCell = row[Number(firstSlotStr)] ?? null;
        if (!firstCell) {
          // Multi-cell selection with at least one empty: will use createNotesInSelection
          editS = null;
          editSlot = null;
        } else {
          const noteId = firstCell.noteId;
          let minSlot = Infinity;
          let maxSlot = -Infinity;
          let isDurationGroup = true;
          for (const key of keys) {
            const [sStr, slotStr] = key.split('-');
            const s = Number(sStr);
            const slot = Number(slotStr);
            if (!Number.isFinite(s) || !Number.isFinite(slot)) return;
            if (s !== baseS) {
              isDurationGroup = false;
              break;
            }
            const cell = row[slot] ?? null;
            if (!cell || cell.noteId !== noteId) {
              isDurationGroup = false;
              break;
            }
            minSlot = Math.min(minSlot, slot);
            maxSlot = Math.max(maxSlot, slot);
          }
          if (isDurationGroup) {
            let targetSlot = minSlot;
            for (let sl = minSlot; sl <= maxSlot; sl += 1) {
              const c = row[sl];
              if (c && c.isNoteStart) {
                targetSlot = sl;
                break;
              }
            }
            editS = baseS;
            editSlot = targetSlot;
          }
        }
      }

      // For single cell we need editS/editSlot; for multi we might have duration group or create-notes
      if (selection.size === 1 && (editS == null || editSlot == null)) return;

      const isDurationGroup = selection.size > 1 && editS != null && editSlot != null;

      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        if (isDurationGroup) {
          pushHistory(riff);
          const newNotes = updateNoteFretAtSlot(riff, riff.notes ?? [], editS!, editSlot!, Number(e.key));
          setRiffState({ ...riff, notes: newNotes });
        } else if (selection.size > 1) {
          pushHistory(riff);
          const newNotes = createNotesInSelection(riff, riff.notes ?? [], selection, Number(e.key));
          setRiffState({ ...riff, notes: newNotes });
        } else {
          handleCellEdit(editS!, editSlot!, Number(e.key));
        }
        return;
      }

      if (e.key === 'Backspace') {
        e.preventDefault();
        if (isDurationGroup) {
          pushHistory(riff);
          const newNotes = updateNoteFretAtSlot(riff, riff.notes ?? [], editS!, editSlot!, null);
          setRiffState({ ...riff, notes: newNotes });
        } else if (selection.size > 1) {
          pushHistory(riff);
          const newNotes = deleteSelectionFromNotes(riff, riff.notes ?? [], selection);
          setRiffState({ ...riff, notes: newNotes });
        } else {
          handleCellEdit(editS!, editSlot!, null);
        }
        return;
      }

      // Navigation (Enter/arrows) only makes sense for a single anchor cell.
      if (selection.size !== 1) return;

      const selKey = Array.from(selection)[0];
      const [sStr, slotStr] = selKey.split('-');
      const s = Number(sStr);
      const slot = Number(slotStr);
      if (!Number.isFinite(s) || !Number.isFinite(slot)) return;

      if (e.key === 'Enter') {
        e.preventDefault();
        const nextString = s + 1;
        if (nextString < NUM_STRINGS) {
          const nextId = `grid-editor-cell-${nextString}-${slot}`;
          const el = document.getElementById(nextId) as HTMLInputElement | null;
          if (el) {
            el.focus();
            el.select?.();
          }
          setSelection(new Set([cellKey(nextString, slot)]));
          setAnchor({ stringIndex: nextString, slotIndex: slot });
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const nextS = s - 1;
        if (nextS >= 0) {
          setSelection(new Set([cellKey(nextS, slot)]));
          setAnchor({ stringIndex: nextS, slotIndex: slot });
          setHoverCell(null);
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        const nextS = s + 1;
        if (nextS < NUM_STRINGS) {
          setSelection(new Set([cellKey(nextS, slot)]));
          setAnchor({ stringIndex: nextS, slotIndex: slot });
          setHoverCell(null);
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const nextSlot = slot - 1;
        if (nextSlot >= 0) {
          setSelection(new Set([cellKey(s, nextSlot)]));
          setAnchor({ stringIndex: s, slotIndex: nextSlot });
          setHoverCell(null);
        }
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        const nextSlot = slot + 1;
        if (nextSlot < totalColumns) {
          setSelection(new Set([cellKey(s, nextSlot)]));
          setAnchor({ stringIndex: s, slotIndex: nextSlot });
          setHoverCell(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [riff, selection, handleCellEdit, pushHistory, totalColumns, editorGrid]);

  if (!riff) {
    return (
      <div className="min-h-screen flex flex-col bg-bg-primary text-text-primary p-6">
        <a href="#/" className="text-accent hover:underline mb-4">← Back</a>
        <p className="text-text-secondary">No riff selected. Create one or pick from the list.</p>
        <div className="mt-4 flex gap-2">
          <select
            value={riffId}
            onChange={(e) => setRiffId(e.target.value)}
            className="bg-bg-secondary border border-bg-tertiary rounded px-3 py-2"
          >
            {list.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col bg-bg-primary text-text-primary"
      onMouseDown={(e) => {
        const target = e.target as HTMLElement;
        const inGrid = target.closest('[data-grid-editor="grid"]');
        const tag = target.tagName;
        const isInteractive =
          tag === 'BUTTON' ||
          tag === 'INPUT' ||
          tag === 'SELECT' ||
          tag === 'TEXTAREA' ||
          tag === 'LABEL' ||
          target.closest('button') ||
          target.closest('a');
        if (!inGrid && !isInteractive) {
          setSelection(new Set());
          setAnchor(null);
          const active = document.activeElement as HTMLElement | null;
          if (active && active.tagName === 'INPUT') active.blur();
        }
      }}
    >
      <EditorHeader
        riff={riff}
        riffId={riffId}
        riffList={list}
        onRiffIdChange={setRiffId}
        onRiffChange={handleRiffChange}
        onNewRiff={handleNewRiff}
        isPlaying={false}
        onPlayToggle={() => {}}
        onReset={() => {}}
        onCopyAsJson={handleCopyAsJson}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={canUndo}
        canRedo={canRedo}
        isUnsaved={isUnsaved}
        showTabScroller={false}
        onShowTabScrollerChange={() => {}}
      />

      <main className="flex-1 p-4 overflow-auto">
        <div className="flex flex-col gap-4 p-12">
         
          <div>
           
            <StateTestGrid />
            <p className="mb-2 text-xs text-text-secondary">
              state test grid (6×12, click empty to add value, click note to toggle selection)
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
