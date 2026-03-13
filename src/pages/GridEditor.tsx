import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
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

const COLUMN_WIDTH = 48;
const ROW_HEIGHT = 32;
const NUM_STRINGS = 6;

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
      // just focus the cell's input so typing works immediately.
      const inputId = `grid-editor-cell-${stringIndex}-${slotIndex}`;
      const el = document.getElementById(inputId) as HTMLInputElement | null;
      if (el) {
        el.focus();
        el.select?.();
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
          const { notes: newNotes } = moveNotes(riff, riff.notes ?? [], selection, deltaString, deltaSlot);
          setRiffState({ ...riff, notes: newNotes });
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
        <div className="flex flex-col gap-4">
          <ContextMenu>
            <ContextMenuTrigger>
              <div
                ref={gridRootRef}
                className="relative rounded border border-bg-tertiary overflow-x-auto"
                style={{ maxWidth: '100%' }}
                data-grid-editor="grid"
              >
                {/* Header row: string label + bar numbers */}
                <div className="flex border-b border-bg-tertiary/60 text-sm">
                  <div className="w-8 shrink-0 p-1 text-left text-text-secondary font-normal">Str</div>
                  <div
                    className="flex"
                    style={{
                      width: totalColumns * COLUMN_WIDTH,
                    }}
                  >
                    {Array.from({ length: totalColumns }, (_, i) => (
                      <div
                        key={i}
                        className="p-0.5 text-center text-text-secondary font-normal border border-bg-tertiary/40"
                        style={{ width: COLUMN_WIDTH, minWidth: COLUMN_WIDTH }}
                      >
                        {i % subsPerBar === 0 ? Math.floor(i / subsPerBar) + 1 : ''}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Grid body: string labels + CSS grid of cells */}
                <div className="flex text-sm">
                  {/* String labels column */}
                  <div className="flex flex-col">
                    {Array.from({ length: NUM_STRINGS }, (_, s) => (
                      <div
                        key={s}
                        className="w-8 shrink-0 p-1 text-text-secondary"
                        style={{ height: ROW_HEIGHT }}
                      >
                        {s + 1}
                      </div>
                    ))}
                  </div>

                  {/* Cells grid */}
                  <div
                    className="relative"
                    style={{
                      width: totalColumns * COLUMN_WIDTH,
                    }}
                  >
                    {/* Subtle full-row drop highlight while actively dragging notes */}
                    {dragState?.mode === 'move' &&
                      (dragState.current.stringIndex !== dragState.anchor.stringIndex ||
                        dragState.current.slotIndex !== dragState.anchor.slotIndex) &&
                      Array.from({ length: NUM_STRINGS }, (_, s) => {
                        const a = dragState.anchor;
                        const c = dragState.current;
                        const deltaS = c.stringIndex - a.stringIndex;
                        let isDropRow = false;
                        for (const k of selection) {
                          const [ks] = k.split('-').map(Number);
                          if (!Number.isFinite(ks)) continue;
                          if (ks + deltaS === s) {
                            isDropRow = true;
                            break;
                          }
                        }
                        if (!isDropRow) return null;
                        return (
                          <div
                            key={`drop-row-${s}`}
                            className="pointer-events-none absolute left-0 bg-emerald-400/10"
                            style={{
                              top: s * ROW_HEIGHT,
                              height: ROW_HEIGHT,
                              width: totalColumns * COLUMN_WIDTH,
                            }}
                          />
                        );
                      })}

                    <div
                      className="grid"
                      style={{
                        gridTemplateColumns: `repeat(${totalColumns}, ${COLUMN_WIDTH}px)`,
                        gridAutoRows: `${ROW_HEIGHT}px`,
                      }}
                    >
                      {Array.from({ length: NUM_STRINGS }, (_, s) =>
                        Array.from({ length: totalColumns }, (_, col) => {
                      const key = cellKey(s, col);
                      const cell = editorGrid[s]?.[col] ?? null;
                      const isSelected = selection.has(key);
                      const hasSelectedLeft = col > 0 && selection.has(cellKey(s, col - 1));
                      const hasSelectedRight = col < totalColumns - 1 && selection.has(cellKey(s, col + 1));
                      const hasSelectedTop = s > 0 && selection.has(cellKey(s - 1, col));
                      const hasSelectedBottom = s < NUM_STRINGS - 1 && selection.has(cellKey(s + 1, col));
                      // Selection: color-only highlight (no borders/shadows)
                      const selectionColorClass =
                        isSelected
                          ? 'bg-white/10'
                          : '';
                      const isChord = chordCells.has(key);
                      const isDuration = cell && !cell.isNoteStart;
                      const isDropTarget =
                        dragState?.mode === 'move' &&
                        (() => {
                          const a = dragState.anchor;
                          const c = dragState.current;
                          const deltaS = c.stringIndex - a.stringIndex;
                          const deltaSlot = c.slotIndex - a.slotIndex;
                          for (const k of selection) {
                            const [ks, kslot] = k.split('-').map(Number);
                            if (ks + deltaS === s && kslot + deltaSlot === col) return true;
                          }
                          return false;
                        })();
                      // Duration resize preview: derive the resulting span this cell would belong to
                      let isResizePreview = false;
                      let isInResizeRun = false;
                      if (dragState?.mode === 'resize' && dragState.stringIndex === s) {
                        const noteId = dragState.noteId;
                        const rowForResize = editorGrid[s] ?? [];
                        let curStart = -1;
                        let curEnd = -1;
                        for (let idx = 0; idx < rowForResize.length; idx += 1) {
                          const c = rowForResize[idx];
                          if (c && c.noteId === noteId) {
                            if (curStart === -1) curStart = idx;
                            curEnd = idx;
                          } else if (curEnd !== -1) {
                            break;
                          }
                        }
                        if (curStart !== -1 && curEnd !== -1) {
                          if (col >= curStart && col <= curEnd) {
                            isInResizeRun = true;
                          }
                          const anchorSlot = dragState.anchorSlot;
                          const targetSlot = dragState.currentSlot;
                          const minSlot = Math.min(anchorSlot, targetSlot);
                          const maxSlot = Math.max(anchorSlot, targetSlot);

                          let spanStart: number;
                          let spanEnd: number;

                          if (curStart === curEnd) {
                            spanStart = minSlot;
                            spanEnd = maxSlot;
                          } else if (anchorSlot === curStart && targetSlot >= curStart && targetSlot <= curEnd) {
                            // Shrink from left while dragging inward, extend when dragging outward.
                            if (targetSlot >= curStart) {
                              const newStart = Math.min(targetSlot + 1, curEnd);
                              spanStart = newStart;
                              spanEnd = curEnd;
                            } else {
                              spanStart = minSlot;
                              spanEnd = curEnd;
                            }
                          } else if (anchorSlot === curEnd && targetSlot >= curStart && targetSlot <= curEnd) {
                            // Shrink from right while dragging inward, extend when dragging outward.
                            if (targetSlot <= curEnd) {
                              const newEnd = Math.max(targetSlot - 1, curStart);
                              spanStart = curStart;
                              spanEnd = newEnd;
                            } else {
                              spanStart = curStart;
                              spanEnd = maxSlot;
                            }
                          } else {
                            spanStart = Math.min(curStart, minSlot);
                            spanEnd = Math.max(curEnd, maxSlot);
                          }

                          // Preview all cells in the resulting span on this string,
                          // even if they are currently empty, so both shrinking and
                          // extending the group are visible while dragging.
                          isResizePreview = col >= spanStart && col <= spanEnd;
                        }
                      }
                      const isResizeDrag = dragState?.mode === 'resize';

                      // Hover behavior:
                      // - If hovering over a duration note cell on this string, highlight the full run on this string.
                      // - Otherwise, only the hovered cell gets hover styling.
                      let isHoverGroup = false;
                      let isHoverSingle = false;
                      if (!dragState && hoverCell && hoverCell.stringIndex === s) {
                        const hoverCellData = editorGrid[hoverCell.stringIndex]?.[hoverCell.slotIndex] ?? null;
                        if (hoverCellData && (hoverCellData.isNoteStart || hoverCellData.durationIndex > 0)) {
                          // Compute the duration run on this string for the hovered note
                          const row = editorGrid[s] ?? [];
                          let start = hoverCell.slotIndex;
                          let end = hoverCell.slotIndex;
                          while (start - 1 >= 0 && row[start - 1]?.noteId === hoverCellData.noteId) start -= 1;
                          while (end + 1 < totalColumns && row[end + 1]?.noteId === hoverCellData.noteId) end += 1;
                          if (col >= start && col <= end) isHoverGroup = true;
                        } else if (hoverCell.slotIndex === col) {
                          isHoverSingle = true;
                        }
                      }

                      const row = editorGrid[s] ?? [];
                      const prevCellInRow = row[col - 1];
                      const nextCellInRow = row[col + 1];
                      const sameLeft = !!cell && !!prevCellInRow && prevCellInRow.noteId === cell.noteId;
                      const sameRight = !!cell && !!nextCellInRow && nextCellInRow.noteId === cell.noteId;

                      // Internal padding: 2px. Remove on connecting sides so duration groups stay visually connected.
                      // IMPORTANT: set individual paddings explicitly so React overwrites previous values
                      // (otherwise old left/right=0 from a former duration group can linger after split).
                      const pad = 3;
                      const cellPadding: React.CSSProperties = {
                        paddingTop: pad,
                        paddingBottom: pad,
                        paddingLeft: pad,
                        paddingRight: pad,
                      };
                      if (cell) {
                        if (!sameLeft && sameRight) {
                          // start of run
                          cellPadding.paddingRight = 0;
                        } else if (sameLeft && !sameRight) {
                          // end of run
                          cellPadding.paddingLeft = 0;
                        } else if (sameLeft && sameRight) {
                          // middle of run
                          cellPadding.paddingLeft = 0;
                          cellPadding.paddingRight = 0;
                        }
                      }

                      const innerRounded =
                        !cell || (!sameLeft && !sameRight)
                          ? 'rounded-md'
                          : !sameLeft && sameRight
                          ? 'rounded-l-md'
                          : sameLeft && !sameRight
                          ? 'rounded-r-md'
                          : '';

                      const isBeingDragged =
                        dragState?.mode === 'move' &&
                        selection.has(key) &&
                        (dragState.current.stringIndex !== dragState.anchor.stringIndex ||
                          dragState.current.slotIndex !== dragState.anchor.slotIndex);

                      return (
                        <div
                          key={`${s}-${col}`}
                          className={`relative align-top ${col % 2 === 1 ? 'bg-bg-tertiary/10' : ''} ${
                            isResizeDrag ? 'cursor-col-resize' : 'cursor-pointer'
                          }`}
                          style={{ width: COLUMN_WIDTH, minWidth: COLUMN_WIDTH, ...cellPadding }}
                          onMouseEnter={() => {
                            handleMouseEnter(s, col);
                            setHoverCell({ stringIndex: s, slotIndex: col });
                          }}
                          onMouseLeave={() => setHoverCell(null)}
                          onMouseUp={() => handleMouseUp(s, col)}
                          onMouseDown={(e) => {
                            // Let dedicated resize handles own their drags
                            const target = e.target as HTMLElement;
                            if (target.closest('[data-role="resize-handle"]')) return;
                            handleMouseDown(e, s, col, 'cell');
                          }}
                          onClick={(e) => handleCellClick(e, s, col)}
                          onDoubleClick={() => handleCellDoubleClick(s, col)}
                        >
                          <div
                            className={`cell-inner min-h-[28px] w-full h-full relative box-border border-2 border-transparent ${innerRounded} ${
                              isResizePreview ? 'bg-primary text-primary-foreground cursor-col-resize' : ''
                            } ${
                              !isResizePreview &&
                              (isHoverGroup || isHoverSingle) &&
                              (cell
                                ? 'bg-[#b83a50] text-primary-foreground border-accent'
                                : 'bg-primary/20 border-primary')
                            } ${
                              !isResizePreview &&
                              !isHoverGroup &&
                              !isHoverSingle &&
                              isChord
                                ? 'bg-emerald-700'
                                : ''
                            } ${
                              !isResizePreview &&
                              !isHoverGroup &&
                              !isHoverSingle &&
                              !isChord &&
                              cell &&
                              !(dragState?.mode === 'resize' && dragState.stringIndex === s && isInResizeRun)
                                ? 'bg-primary text-primary-foreground'
                                : ''
                            } ${!isResizePreview && selectionColorClass} ${isBeingDragged ? 'opacity-0' : ''}`}
                          >
                            {cell && (
                              <>
                                {cell.isNoteStart && (
                                  <div
                                    className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize z-10"
                                    data-role="resize-handle"
                                    onMouseDown={(ev) => handleMouseDown(ev, s, col, 'resize-left')}
                                  />
                                )}
                                {(() => {
                                  const nextCell = row[col + 1];
                                  const isEnd = !nextCell || nextCell.noteId !== cell.noteId;
                                  return isEnd && (cell.isNoteStart || cell.durationIndex > 0) ? (
                                    <div
                                      className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize z-10"
                                      data-role="resize-handle"
                                      onMouseDown={(ev) => handleMouseDown(ev, s, col, 'resize-right')}
                                    />
                                  ) : null;
                                })()}
                              </>
                            )}
                            <div
                              className="flex items-center justify-center py-0.5 h-full"
                            >
                              <input
                                id={`grid-editor-cell-${s}-${col}`}
                                type="text"
                                inputMode="numeric"
                                className={`w-8 text-center bg-transparent border-none rounded py-0.5 font-mono text-sm focus:outline-none cursor-pointer ${
                                  cell || isHoverGroup || isHoverSingle ? 'text-primary-foreground' : 'text-accent'
                                }`}
                                value={cell ? (cell.isNoteStart ? String(cell.fret) : '') : ''}
                                onChange={(e) => {
                                  if (cell && !cell.isNoteStart) return;
                                  const v = e.target.value.trim();
                                  const parsed = v === '' ? null : Number(v);
                                  handleCellEdit(s, col, Number.isFinite(parsed) ? parsed : null);
                                }}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    const nextString = s + 1;
                                    if (nextString < NUM_STRINGS) {
                                      const nextId = `grid-editor-cell-${nextString}-${col}`;
                                      const el = document.getElementById(nextId) as HTMLInputElement | null;
                                      if (el) {
                                        el.focus();
                                        el.select?.();
                                      }
                                      setSelection(new Set([cellKey(nextString, col)]));
                                      setAnchor({ stringIndex: nextString, slotIndex: col });
                                    }
                                  }
                                }}
                                readOnly={cell ? !cell.isNoteStart : false}
                                tabIndex={cell && !cell.isNoteStart ? -1 : 0}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })
                      )}
                    </div>
                  </div>
                </div>
            {(() => {
              if (!dragGhost || !dragState || dragState.mode !== 'move' || !gridRootRef.current) return null;
              const rect = gridRootRef.current.getBoundingClientRect();
              const x = dragGhost.clientX - rect.left;
              const y = dragGhost.clientY - rect.top;

              let ghostWidth: number;
              let ghostHeight: number;
              let anchorOffsetX = 0;
              let anchorOffsetY = 0;

              if (selection.size > 0) {
                let minS = Infinity,
                  maxS = -Infinity,
                  minSlot = Infinity,
                  maxSlot = -Infinity;
                for (const key of selection) {
                  const [s, slot] = key.split('-').map(Number);
                  minS = Math.min(minS, s);
                  maxS = Math.max(maxS, s);
                  minSlot = Math.min(minSlot, slot);
                  maxSlot = Math.max(maxSlot, slot);
                }
                ghostWidth = (maxSlot - minSlot + 1) * COLUMN_WIDTH;
                ghostHeight = (maxS - minS + 1) * ROW_HEIGHT;

                const relS = dragState.anchor.stringIndex - minS;
                const relSlot = dragState.anchor.slotIndex - minSlot;
                anchorOffsetX = (relSlot + 0.5) * COLUMN_WIDTH;
                anchorOffsetY = (relS + 0.5) * ROW_HEIGHT;
              } else {
                ghostWidth = COLUMN_WIDTH;
                ghostHeight = ROW_HEIGHT;
                anchorOffsetX = COLUMN_WIDTH / 2;
                anchorOffsetY = ROW_HEIGHT / 2;
              }

              const ghostStyle: React.CSSProperties = {
                left: x - anchorOffsetX,
                top: y - anchorOffsetY,
                width: ghostWidth,
                height: ghostHeight,
              };
              return (
                <div
                  className="pointer-events-none absolute z-20 box-border rounded-md bg-violet-500/80 shadow-lg"
                  style={ghostStyle}
                />
              );
            })()}
          </div>
          </ContextMenuTrigger>
          <ContextMenuContent>
                <ContextMenuItem onClick={handleDeleteSelection} disabled={selection.size === 0}>
                  Delete
                </ContextMenuItem>
                <ContextMenuItem onClick={handleCombineDuration} disabled={selection.size === 0}>
                  Combine duration
                </ContextMenuItem>
                <ContextMenuItem onClick={handleSplitDuration} disabled={selection.size === 0}>
                  Split to notes
                </ContextMenuItem>
                <ContextMenuItem onClick={handleCombineChord} disabled={selection.size === 0}>
                  Combine chord
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleDeleteSelection}
              disabled={selection.size === 0}
              className="px-3 py-2 rounded bg-bg-tertiary hover:bg-bg-tertiary/80 disabled:opacity-50 text-sm"
            >
              Delete
            </button>
            <button
              onClick={handleCombineDuration}
              disabled={selection.size === 0}
              className="px-3 py-2 rounded bg-bg-tertiary hover:bg-bg-tertiary/80 disabled:opacity-50 text-sm"
            >
              Combine duration
            </button>
            <button
              onClick={handleSplitDuration}
              disabled={selection.size === 0}
              className="px-3 py-2 rounded bg-bg-tertiary hover:bg-bg-tertiary/80 disabled:opacity-50 text-sm"
            >
              Split to notes
            </button>
            <button
              onClick={handleCombineChord}
              disabled={selection.size === 0}
              className="px-3 py-2 rounded bg-bg-tertiary hover:bg-bg-tertiary/80 disabled:opacity-50 text-sm"
            >
              Combine chord
            </button>
            <button
              onClick={handleClearAll}
              disabled={!riff?.notes?.length}
              className="px-3 py-2 rounded border border-bg-tertiary/70 text-sm text-text-secondary hover:bg-bg-tertiary/80 hover:text-text-primary disabled:opacity-50"
            >
              Clear all
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
