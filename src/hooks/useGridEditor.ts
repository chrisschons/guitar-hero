/**
 * useGridEditor — owns GridNote[] state, clipboard, undo/redo.
 * All mutations delegate to pure functions in core/gridEngine.
 *
 * Pattern:
 *   - gridNotes + selectedIds are React state (cause re-renders)
 *   - clipboard is a ref (no re-render on copy)
 *   - undo/redo stacks are refs; canUndo/canRedo are state flags
 *   - All callbacks use useRef for latest state to avoid stale closures
 */

import { useState, useRef, useCallback, useMemo } from 'react';
import type { NoteEvent, RhythmGroup } from '../types/riff';
import {
  type GridNote,
  type ClipboardData,
  noteEventsToGridNotes,
  gridNotesToNoteEvents,
  placeNote as enginePlaceNote,
  clearCell as engineClearCell,
  updateFret as engineUpdateFret,
  deleteNotes as engineDeleteNotes,
  moveNotes as engineMoveNotes,
  resizeDuration as engineResizeDuration,
  combineDuration as engineCombineDuration,
  splitDuration as engineSplitDuration,
  growDuration as engineGrowDuration,
  shrinkDuration as engineShrinkDuration,
  duplicateNotes as engineDuplicateNotes,
  makeTuplet as engineMakeTuplet,
  buildClipboard,
  pasteClipboard,
  clampToColumns as engineClampToColumns,
  expandToChordMates,
  expandToRhythmGroups,
  getNotesInRect,
} from '../core/gridEngine';

const MAX_UNDO = 50;

export type GridEditorState = {
  gridNotes: GridNote[];
  selectedIds: Set<string>;
  canUndo: boolean;
  canRedo: boolean;
  hasClipboard: boolean;

  // Load / flush
  loadFromNoteEvents: (events: NoteEvent[], subsPerBar: number, totalCols: number) => void;
  toNoteEvents: (subsPerBar: number) => NoteEvent[];

  // Note mutations
  placeNote: (row: number, col: number, fret: number, totalCols: number) => void;
  clearCell: (row: number, col: number) => void;
  updateFret: (id: string, fret: number) => void;

  // Selection
  selectIds: (ids: Set<string>) => void;
  selectRect: (minRow: number, maxRow: number, minCol: number, maxCol: number, append?: boolean) => void;
  clearSelection: () => void;

  // Operations on selected notes
  deleteSelected: () => void;
  moveSelected: (deltaRow: number, deltaCol: number, totalRows: number, totalCols: number, subsPerBar?: number) => void;
  resizeDuration: (id: string, newEndCol: number, totalCols: number) => void;
  combineDuration: (totalCols: number) => void;
  splitDuration: () => void;
  growSelected: (totalCols: number) => void;
  shrinkSelected: () => void;
  duplicateSelected: (totalCols: number, rhythmGroups?: RhythmGroup[], onNewGroup?: (g: RhythmGroup) => void) => void;
  makeTuplet: (ratio: { n: number; d: number }, subsPerBar: number, beatsPerBar: number, onNewGroup: (g: RhythmGroup) => void) => void;

  // Clipboard
  copy: (rhythmGroups?: RhythmGroup[]) => void;
  cut: (rhythmGroups?: RhythmGroup[]) => void;
  paste: (row: number, col: number, totalRows: number, totalCols: number, onNewGroup?: (g: RhythmGroup) => void) => void;

  // Clear all notes
  clearAll: () => void;

  // Direct commit (e.g. toggleTuplet changes rhythmGroups externally but notes may need rewrite)
  commitNotes: (newNotes: GridNote[]) => void;

  // Undo / redo
  undo: () => void;
  redo: () => void;

  // Column management
  clampToColumns: (totalCols: number) => void;

  // Sync rhythm groups into the hook's ref so move operations can read them
  setRhythmGroups: (groups: RhythmGroup[]) => void;

  // Returns the actual delta applied by the last moveSelected call (may differ from requested due to clamping/snapping)
  getLastAppliedDelta: () => { col: number; row: number };
};

export function useGridEditor(): GridEditorState {
  const [gridNotes, setGridNotes] = useState<GridNote[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [hasClipboard, setHasClipboard] = useState(false);

  // Undo/redo stacks: snapshots of GridNote[]
  const undoStack = useRef<GridNote[][]>([]);
  const redoStack = useRef<GridNote[][]>([]);
  const clipboardRef = useRef<ClipboardData | null>(null);

  // Latest notes ref to avoid stale closures
  const notesRef = useRef<GridNote[]>(gridNotes);
  const selectedRef = useRef<Set<string>>(selectedIds);
  const rhythmGroupsRef = useRef<RhythmGroup[]>([]);
  const lastAppliedDeltaRef = useRef({ col: 0, row: 0 });

  // Commit new notes with undo snapshot
  const commit = useCallback((newNotes: GridNote[], keepSelection = false) => {
    undoStack.current.push(notesRef.current);
    if (undoStack.current.length > MAX_UNDO) undoStack.current.shift();
    redoStack.current = [];
    notesRef.current = newNotes;
    setGridNotes(newNotes);
    setCanUndo(true);
    setCanRedo(false);
    if (!keepSelection) {
      setSelectedIds(new Set());
      selectedRef.current = new Set();
    }
  }, []);

  // Commit without pushing to undo (for load / clamp)
  const commitSilent = useCallback((newNotes: GridNote[]) => {
    notesRef.current = newNotes;
    setGridNotes(newNotes);
  }, []);

  const loadFromNoteEvents = useCallback((events: NoteEvent[], subsPerBar: number, totalCols: number) => {
    const newNotes = noteEventsToGridNotes(events, subsPerBar, totalCols);
    undoStack.current = [];
    redoStack.current = [];
    clipboardRef.current = null;
    setHasClipboard(false);
    notesRef.current = newNotes;
    setGridNotes(newNotes);
    setSelectedIds(new Set());
    selectedRef.current = new Set();
    setCanUndo(false);
    setCanRedo(false);
  }, []);

  const toNoteEvents = useCallback((subsPerBar: number) => {
    return gridNotesToNoteEvents(notesRef.current, subsPerBar);
  }, []);

  const placeNote = useCallback((row: number, col: number, fret: number, totalCols: number) => {
    commit(enginePlaceNote(notesRef.current, row, col, fret, totalCols));
  }, [commit]);

  const clearCell = useCallback((row: number, col: number) => {
    commit(engineClearCell(notesRef.current, row, col));
  }, [commit]);

  const updateFret = useCallback((id: string, fret: number) => {
    commit(engineUpdateFret(notesRef.current, id, fret));
  }, [commit]);

  const selectIds = useCallback((ids: Set<string>) => {
    selectedRef.current = ids;
    setSelectedIds(ids);
  }, []);

  const selectRect = useCallback((minRow: number, maxRow: number, minCol: number, maxCol: number, append = false) => {
    const hits = getNotesInRect(notesRef.current, minRow, maxRow, minCol, maxCol);
    const newIds = new Set(hits.map(n => n.id));
    const merged = append
      ? new Set([...selectedRef.current, ...newIds])
      : newIds;
    selectedRef.current = merged;
    setSelectedIds(merged);
  }, []);

  const clearSelection = useCallback(() => {
    selectedRef.current = new Set();
    setSelectedIds(new Set());
  }, []);

  const deleteSelected = useCallback(() => {
    const expanded = expandToChordMates(notesRef.current, selectedRef.current);
    const result = engineDeleteNotes(notesRef.current, expanded);
    commit(result);
  }, [commit]);

  const moveSelected = useCallback((deltaRow: number, deltaCol: number, totalRows: number, totalCols: number, subsPerBar?: number) => {
    const { notes: newNotes, appliedDeltaCol, appliedDeltaRow } = engineMoveNotes(notesRef.current, selectedRef.current, deltaRow, deltaCol, totalRows, totalCols, subsPerBar, rhythmGroupsRef.current);
    lastAppliedDeltaRef.current = { col: appliedDeltaCol, row: appliedDeltaRow };
    // Re-derive selected IDs after move (IDs stay stable in moveNotes)
    commit(newNotes, true);
  }, [commit]);

  const resizeDuration = useCallback((id: string, newEndCol: number, totalCols: number) => {
    commit(engineResizeDuration(notesRef.current, id, newEndCol, totalCols));
  }, [commit]);

  const combineDuration = useCallback((totalCols: number) => {
    commit(engineCombineDuration(notesRef.current, selectedRef.current, totalCols));
  }, [commit]);

  const splitDuration = useCallback(() => {
    commit(engineSplitDuration(notesRef.current, selectedRef.current));
  }, [commit]);

  const growSelected = useCallback((totalCols: number) => {
    let notes = notesRef.current;
    for (const id of selectedRef.current) {
      notes = engineGrowDuration(notes, id, totalCols);
    }
    commit(notes, true);
  }, [commit]);

  const shrinkSelected = useCallback(() => {
    let notes = notesRef.current;
    for (const id of selectedRef.current) {
      notes = engineShrinkDuration(notes, id);
    }
    commit(notes, true);
  }, [commit]);

  const duplicateSelected = useCallback((totalCols: number, rhythmGroups?: RhythmGroup[], onNewGroup?: (g: RhythmGroup) => void) => {
    commit(engineDuplicateNotes(notesRef.current, selectedRef.current, totalCols, rhythmGroups, onNewGroup));
  }, [commit]);

  const makeTuplet = useCallback((ratio: { n: number; d: number }, subsPerBar: number, beatsPerBar: number, onNewGroup: (g: RhythmGroup) => void) => {
    const { notes: newNotes, group } = engineMakeTuplet(notesRef.current, selectedRef.current, ratio, subsPerBar, beatsPerBar);
    if (group) {
      commit(newNotes);
      onNewGroup(group);
    }
  }, [commit]);

  const copy = useCallback((rhythmGroups?: RhythmGroup[]) => {
    const clipboard = buildClipboard(notesRef.current, selectedRef.current, rhythmGroups);
    if (clipboard) { clipboardRef.current = clipboard; setHasClipboard(true); }
  }, []);

  const cut = useCallback((rhythmGroups?: RhythmGroup[]) => {
    const clipboard = buildClipboard(notesRef.current, selectedRef.current, rhythmGroups);
    if (!clipboard) return;
    clipboardRef.current = clipboard;
    setHasClipboard(true);
    const expanded = expandToRhythmGroups(notesRef.current, selectedRef.current);
    commit(engineDeleteNotes(notesRef.current, expanded));
  }, [commit]);

  const paste = useCallback((row: number, col: number, totalRows: number, totalCols: number, onNewGroup?: (g: RhythmGroup) => void) => {
    const clipboard = clipboardRef.current;
    if (!clipboard) return;
    commit(pasteClipboard(notesRef.current, clipboard, row, col, totalRows, totalCols, onNewGroup));
  }, [commit]);

  const clearAll = useCallback(() => {
    commit([]);
  }, [commit]);

  const commitNotes = useCallback((newNotes: GridNote[]) => {
    commit(newNotes, true);
  }, [commit]);

  const undo = useCallback(() => {
    const prev = undoStack.current.pop();
    if (!prev) return;
    redoStack.current.push(notesRef.current);
    notesRef.current = prev;
    setGridNotes(prev);
    setSelectedIds(new Set());
    selectedRef.current = new Set();
    setCanUndo(undoStack.current.length > 0);
    setCanRedo(true);
  }, []);

  const redo = useCallback(() => {
    const next = redoStack.current.pop();
    if (!next) return;
    undoStack.current.push(notesRef.current);
    notesRef.current = next;
    setGridNotes(next);
    setSelectedIds(new Set());
    selectedRef.current = new Set();
    setCanUndo(true);
    setCanRedo(redoStack.current.length > 0);
  }, []);

  const clampToColumns = useCallback((totalCols: number) => {
    const clamped = engineClampToColumns(notesRef.current, totalCols);
    if (clamped.length !== notesRef.current.length || clamped.some((n, i) => n !== notesRef.current[i])) {
      commitSilent(clamped);
    }
  }, [commitSilent]);

  const setRhythmGroups = useCallback((groups: RhythmGroup[]) => {
    rhythmGroupsRef.current = groups;
  }, []);

  const getLastAppliedDelta = useCallback(() => lastAppliedDeltaRef.current, []);

  return useMemo(() => ({
    gridNotes,
    selectedIds,
    canUndo,
    canRedo,
    hasClipboard,
    loadFromNoteEvents,
    toNoteEvents,
    placeNote,
    clearCell,
    updateFret,
    selectIds,
    selectRect,
    clearSelection,
    deleteSelected,
    moveSelected,
    resizeDuration,
    combineDuration,
    splitDuration,
    growSelected,
    shrinkSelected,
    duplicateSelected,
    makeTuplet,
    copy,
    cut,
    paste,
    clearAll,
    commitNotes,
    undo,
    redo,
    clampToColumns,
    setRhythmGroups,
    getLastAppliedDelta,
  }), [
    gridNotes, selectedIds, canUndo, canRedo, hasClipboard,
    loadFromNoteEvents, toNoteEvents,
    placeNote, clearCell, updateFret,
    selectIds, selectRect, clearSelection,
    deleteSelected, moveSelected, resizeDuration,
    combineDuration, splitDuration,
    growSelected, shrinkSelected,
    duplicateSelected, makeTuplet,
    copy, cut, paste, clearAll, commitNotes,
    undo, redo, clampToColumns,
    setRhythmGroups, getLastAppliedDelta,
  ]);
}
