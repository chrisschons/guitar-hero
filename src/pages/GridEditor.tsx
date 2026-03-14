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
import { GridNoteChip } from '../components/GridNoteChip';
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
};

function genNoteId() {
  return `note-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function StateTestGrid() {
  const TEST_ROWS = 4;
  const TEST_COLS = 10;

  const [notes, setNotes] = useState<StateTestNote[]>(() => [
    { id: genNoteId(), row: 0, startCol: 1, endCol: 1, value: 0, selected: false },
    { id: genNoteId(), row: 1, startCol: 3, endCol: 4, value: 5, selected: false },
    { id: genNoteId(), row: 2, startCol: 5, endCol: 5, value: 7, selected: false },
  ]);

  const [hover, setHover] = useState<{ row: number; col: number } | null>(null);
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
  const digitBufferRef = useRef('');
  const suppressClickAfterDragRef = useRef(false);
  const gridWrapperRef = useRef<HTMLDivElement>(null);
  const pendingDragRef = useRef<{
    noteId: string;
    anchorRow: number;
    anchorCol: number;
    clientX: number;
    clientY: number;
    wasOnlySelected: boolean;
  } | null>(null);
  const handleCellClickRef = useRef<(row: number, col: number) => void>(() => {});
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

  const findNoteAt = useCallback(
    (r: number, c: number) =>
      notes.find((n) => n.row === r && c >= n.startCol && c <= n.endCol) ?? null,
    [notes]
  );

  const handleCellClick = useCallback(
    (row: number, col: number) => {
      if (suppressClickAfterDragRef.current) {
        suppressClickAfterDragRef.current = false;
        return;
      }
      const note = findNoteAt(row, col);
      if (!note) {
        setNotes((prev) => {
          const next = prev.map((n) => ({ ...n, selected: false }));
          next.push({
            id: genNoteId(),
            row,
            startCol: col,
            endCol: col,
            value: 0,
            selected: true,
          });
          return next;
        });
        digitBufferRef.current = '';
        return;
      }
      const wasOnlySelected =
        note.selected && notes.filter((n) => n.selected).length === 1;
      if (wasOnlySelected) {
        setNotes((prev) =>
          prev.map((n) =>
            n.id === note.id ? { ...n, selected: false } : n
          )
        );
      } else {
        setNotes((prev) =>
          prev.map((n) => ({
            ...n,
            selected: n.id === note.id,
          }))
        );
      }
      digitBufferRef.current = '';
    },
    [notes, findNoteAt]
  );
  handleCellClickRef.current = handleCellClick;

  const DRAG_THRESHOLD_PX = 5;

  const handleNoteMouseDown = (note: StateTestNote, row: number, col: number, e: React.MouseEvent) => {
    if (dragState || resizeState) return;
    const wasOnlySelected =
      note.selected && notes.filter((n) => n.selected).length === 1;
    setNotes((prev) =>
      prev.map((n) => ({
        ...n,
        selected: n.id === note.id,
      }))
    );
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
    setNotes((prev) =>
      prev.map((n) => ({ ...n, selected: n.id === note.id }))
    );
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
          const currentRow = Math.max(0, Math.min(TEST_ROWS - 1, row));
          const currentCol = Math.max(0, Math.min(TEST_COLS - 1, col));
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
          setNotes((prev) => {
            const note = prev.find((n) => n.id === noteId);
            if (!note) return prev;
            return prev.map((n) => {
              if (n.id !== noteId) return n;
              if (edge === 'right') {
                const visualRightPx = Math.max(
                  (anchorStartCol + 1) * COLUMN_WIDTH,
                  Math.min(localX, TEST_COLS * COLUMN_WIDTH)
                );
                const newEndCol = Math.min(
                  TEST_COLS - 1,
                  Math.max(anchorStartCol, Math.max(0, Math.round(visualRightPx / COLUMN_WIDTH) - 1))
                );
                return { ...n, endCol: newEndCol };
              } else {
                const noteRightPx = (anchorEndCol + 1) * COLUMN_WIDTH;
                const visualLeftPx = Math.min(
                  noteRightPx - COLUMN_WIDTH,
                  Math.max(0, localX)
                );
                const newStartCol = Math.min(
                  anchorEndCol,
                  Math.max(0, Math.min(Math.round(visualLeftPx / COLUMN_WIDTH), TEST_COLS - 1))
                );
                return { ...n, startCol: newStartCol };
              }
            });
          });
        }
        setResizeState(null);
        return;
      }
      if (pendingResizeRef.current) {
        pendingResizeRef.current = null;
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
          const deltaCol = currentCol - anchorCol;
          const newStartCol = Math.max(
            0,
            Math.min(TEST_COLS - 1, anchorStartCol + deltaCol)
          );
          const span = anchorEndCol - anchorStartCol + 1;
          const newEndCol = Math.max(
            newStartCol,
            Math.min(TEST_COLS - 1, newStartCol + span - 1)
          );
          setNotes((prev) =>
            prev.map((n) =>
              n.id === noteId
                ? {
                    ...n,
                    row: currentRow,
                    startCol: newStartCol,
                    endCol: newEndCol,
                    selected: false,
                  }
                : n
            )
          );
          suppressClickAfterDragRef.current = true;
        } else {
          setNotes((prev) =>
            prev.map((n) => ({ ...n, selected: false }))
          );
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
        suppressClickAfterDragRef.current = true;
      }
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, resizeState, TEST_ROWS, TEST_COLS]);

  // When exactly one note is selected: digit keys update value (0–24); Backspace/Delete removes the note
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

      if (key === 'Backspace' || key === 'Delete') {
        e.preventDefault();
        if (e.repeat) return;
        setNotes((prev) => {
          const selected = prev.find((n) => n.selected);
          if (!selected) return prev;
          return prev.filter((n) => n.id !== selected.id);
        });
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

      setNotes((prev) => {
        const selected = prev.filter((n) => n.selected);
        if (selected.length !== 1) return prev;
        return prev.map((n) =>
          n.id === selected[0].id ? { ...n, value } : n
        );
      });
      e.preventDefault();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Cursor during resize (col-resize) and during drag (grabbing); use !important so it overrides child cursor styles
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
  }, [resizeState, dragState]);

  return (
    <div className="inline-block rounded-lg border border-bg-tertiary bg-bg-secondary/80 p-4">
      <div
        ref={gridWrapperRef}
        className={`relative select-none${dragState ? ' state-test-grid-cursor-grabbing' : ''}${resizeState ? ' state-test-grid-cursor-col-resize' : ''}`}
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

        {/* Drop target: full area that will be replaced, relative to click (anchor) position */}
        {dragState &&
          dragState.currentRow >= 0 &&
          dragState.currentCol >= 0 &&
          (dragState.currentRow !== dragState.anchorRow ||
            dragState.currentCol !== dragState.anchorCol) && (
            (() => {
              const span = dragState.anchorEndCol - dragState.anchorStartCol + 1;
              const clickOffsetInNote = dragState.anchorCol - dragState.anchorStartCol;
              const dropStartCol = dragState.currentCol - clickOffsetInNote;
              const clampedStart = Math.max(0, Math.min(dropStartCol, TEST_COLS - span));
              if (span <= 0) return null;
              return (
                <div
                  className="absolute border border-pink-100/20 bg-pink-400/20 pointer-events-none"
                  style={{
                    left: clampedStart * COLUMN_WIDTH,
                    top: dragState.currentRow * ROW_HEIGHT,
                    width: span * COLUMN_WIDTH,
                    height: ROW_HEIGHT,
                  }}
                  aria-hidden
                />
              );
            })()
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
              return (
                <div
                  key={`${r}-${c}`}
                  className="relative flex items-center justify-center cursor-pointer"
                  onClick={() => handleCellClick(r, c)}
                  onMouseEnter={() => handleCellMouseEnter(r, c)}
                  onMouseLeave={() => setHover(null)}
                >
                  {!hasNote && isHover && !dragState && !resizeState && (
                    <GridNoteChip value="" slots={1} state="empty" />
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Notes layer: spanning chips with resize handles */}
        {notes.map((note) => {
          const isDragging = dragState?.noteId === note.id;
          const isResizing = resizeState?.noteId === note.id;
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
          const isHoverNote =
            hover &&
            note.row === hover.row &&
            hover.col >= note.startCol &&
            hover.col <= note.endCol;
          const chipState = isResizing
            ? 'resizing'
            : note.selected
            ? isHoverNote && !isDragging
              ? 'selectedHover'
              : 'selected'
            : isHoverNote && !isDragging
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
        {dragGhost && dragState && (() => {
          const note = notes.find((n) => n.id === dragState.noteId);
          if (!note) return null;
          const span = note.endCol - note.startCol + 1;
          const ghostWidthPx = span * COLUMN_WIDTH - 2 * NOTE_CHIP_PADDING_PX;
          return (
            <div
              className="pointer-events-none fixed z-50"
              style={{
                left: dragGhost.clientX - dragState.anchorOffsetX,
                top: dragGhost.clientY - dragState.anchorOffsetY,
              }}
            >
              <GridNoteChip
                value={note.value}
                slots={1}
                widthPx={ghostWidthPx}
                state="dragGhost"
              />
            </div>
          );
        })()}
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
                      const selectionColorClass = isSelected ? 'bg-blue-500 text-primary-foreground' : '';
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
                              // 1) Active resize preview always wins
                              isResizePreview
                                ? 'bg-primary text-primary-foreground cursor-col-resize'
                                : // 2) Otherwise, persistent selection color wins
                                selectionColorClass ||
                                  // 3) Then hover states for non-selected cells
                                  ((isHoverGroup || isHoverSingle) &&
                                  (cell
                                    ? 'bg-[#b83a50] text-primary-foreground border-accent'
                                    : 'bg-primary/20 border-primary')) ||
                                  // 4) Then chord styling
                                  (isChord ? 'bg-emerald-700' : '') ||
                                  // 5) Finally, base note styling for non-selected, non-hover, non-chord cells
                                  (cell &&
                                  !(dragState?.mode === 'resize' && dragState.stringIndex === s && isInResizeRun)
                                    ? 'bg-primary text-primary-foreground'
                                    : '')
                            } ${isBeingDragged ? 'opacity-0' : ''}`}
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
                  className="pointer-events-none absolute z-20 box-border rounded-md bg-blue-500/60 shadow-lg"
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
        <div className="flex flex-col gap-4 p-12">
          <div>
            <p>ui elements</p>
            {/* Single-slot default notes */}
            <GridNoteChip slots={1} state="empty" value="" />
            <GridNoteChip value={0} slots={1} state="default" />
           
            <GridNoteChip value={12} slots={1} state="selected" />
          </div>
          <div>
            <p className="mb-2 text-sm text-text-secondary">
              state test grid (4×10, click empty to add value, click note to toggle selection)
            </p>
            <StateTestGrid />
          </div>
        </div>
      </main>
    </div>
  );
}
