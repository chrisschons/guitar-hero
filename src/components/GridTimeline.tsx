import { useCallback, useRef, useState, useEffect } from 'react';
import { COLUMN_WIDTH, INITIAL_SCROLL } from './TabDisplay';
import type { RiffGrid } from '../core/riffGrid';

type GridTimelineProps = {
  grid: RiffGrid;
  totalColumns: number;
  subsPerBar: number;
  scrollPosition: number;
  isDragging: boolean;
  onScrollMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
  onUpdateCell: (stringIndex: number, slotIndex: number, value: number | null) => void;
  onMoveNote: (fromString: number, fromSlot: number, toString: number, toSlot: number) => void;
  selection?: Set<string>;
  onSelectionChange?: (selection: Set<string>) => void;
  selectionType?: 'horizontal' | 'vertical' | 'grid';
  chordCells?: Set<string>;
  durationCells?: Set<string>;
  onResizeDuration?: (stringIndex: number, anchorSlot: number, targetSlot: number) => void;
};

export function GridTimeline({
  grid,
  totalColumns,
  subsPerBar,
  scrollPosition,
  isDragging,
  onScrollMouseDown,
  onUpdateCell,
  onMoveNote,
  selection = new Set(),
  onSelectionChange,
  selectionType = 'grid',
  chordCells = new Set(),
  durationCells = new Set(),
  onResizeDuration,
}: GridTimelineProps) {
  const rootRef = useRef<HTMLElement | null>(null);
  const dragNoteRef = useRef<{
    stringIndex: number;
    slotIndex: number;
    fret: number;
    mode: 'move' | 'duration';
  } | null>(null);
  const [dragGhost, setDragGhost] = useState<{
    originClientX: number;
    originClientY: number;
    clientX: number;
    clientY: number;
  } | null>(null);
  const [dragOver, setDragOver] = useState<{ stringIndex: number; slotIndex: number } | null>(null);
  const [anchor, setAnchor] = useState<{ stringIndex: number; slotIndex: number } | null>(null);
  const [hoverCell, setHoverCell] = useState<{ stringIndex: number; slotIndex: number } | null>(
    null
  );
  const suppressClickRef = useRef(false);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragNoteRef.current) return;
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
      dragNoteRef.current = null;
      setDragOver(null);
      setDragGhost(null);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  const scrollOffset = INITIAL_SCROLL;

  const cellKey = (s: number, col: number) => `${s}-${col}`;
  const isSelected = (s: number, col: number) => selection.has(cellKey(s, col));
  const isChordCell = (s: number, col: number) => chordCells.has(cellKey(s, col));
  const isDurationCell = (s: number, col: number) => durationCells.has(cellKey(s, col));
  const isDurationStart = (s: number, col: number) =>
    isDurationCell(s, col) && (col === 0 || !isDurationCell(s, col - 1));
  const isDurationEnd = (s: number, col: number) =>
    isDurationCell(s, col) &&
    (col === totalColumns - 1 || !isDurationCell(s, col + 1));

  const handleCellMouseDown = useCallback(
    (e: React.MouseEvent, stringIndex: number, slotIndex: number) => {
      if (e.button !== 0) return;
      const fret = grid[stringIndex]?.[slotIndex];
      if (fret !== null && fret !== undefined && Number.isFinite(Number(fret))) {
        // Determine drag mode from the element that initiated the drag
        let mode: 'move' | 'duration' = 'move';
        const handleEl = (e.target as HTMLElement | null)?.closest(
          '[data-drag-mode]'
        ) as HTMLElement | null;
        if (handleEl && handleEl.dataset.dragMode === 'duration') {
          mode = 'duration';
        }
        // For existing duration groups, only allow resize from the start or end cell;
        // dragging from the middle of a duration run should behave like a normal move.
        if (
          mode === 'duration' &&
          isDurationCell(stringIndex, slotIndex) &&
          !isDurationStart(stringIndex, slotIndex) &&
          !isDurationEnd(stringIndex, slotIndex)
        ) {
          mode = 'move';
        }
        dragNoteRef.current = { stringIndex, slotIndex, fret: Number(fret), mode };
        setDragGhost(null);
      }
    },
    [grid, isDurationCell, isDurationStart, isDurationEnd]
  );
  const handleCellMouseEnter = useCallback(
    (stringIndex: number, slotIndex: number) => {
      if (!dragNoteRef.current) return;
      const from = dragNoteRef.current;
      if (from.stringIndex === stringIndex && from.slotIndex === slotIndex) return;
      setDragOver({ stringIndex, slotIndex });
    },
    []
  );

  const handleCellMouseUp = useCallback(
    (e: React.MouseEvent, stringIndex: number, slotIndex: number) => {
      if (e.button !== 0) return;
      const from = dragNoteRef.current;
      if (from) {
        if (from.mode === 'duration') {
          if (onResizeDuration) {
            onResizeDuration(from.stringIndex, from.slotIndex, slotIndex);
            suppressClickRef.current = true;
          }
        } else if (from.stringIndex !== stringIndex || from.slotIndex !== slotIndex) {
          onMoveNote(from.stringIndex, from.slotIndex, stringIndex, slotIndex);
        }
      }
      dragNoteRef.current = null;
      setDragOver(null);
    },
    [onMoveNote, onResizeDuration]
  );

  const translateX = Math.max(0, scrollPosition - scrollOffset);

  const isDropPreviewCell = (s: number, col: number) => {
    if (!dragNoteRef.current || !dragOver) return false;
    const from = dragNoteRef.current;

    if (from.mode === 'duration') {
      // Highlight the horizontal duration span between anchor and current dragOver
      // for all strings that are part of the vertical selection at the anchor column
      const minSlot = Math.min(from.slotIndex, dragOver.slotIndex);
      const maxSlot = Math.max(from.slotIndex, dragOver.slotIndex);
      if (col < minSlot || col > maxSlot) return false;

      // Always include the string we started from
      if (s === from.stringIndex) return true;

      // Also include any other strings that are selected at the anchor column
      let include = false;
      selection.forEach((key) => {
        const [sStr, slotStr] = key.split('-');
        const ss = Number(sStr);
        const slot = Number(slotStr);
        if (!Number.isFinite(ss) || !Number.isFinite(slot)) return;
        if (slot === from.slotIndex && ss === s) {
          include = true;
        }
      });
      return include;
    }

    const sourceKey = cellKey(from.stringIndex, from.slotIndex);
    const hasSelectionGroup = selection.size > 1 && selection.has(sourceKey);
    const deltaString = dragOver.stringIndex - from.stringIndex;
    const deltaSlot = dragOver.slotIndex - from.slotIndex;

    // Decide which cells are being moved: whole selection if dragging from inside it, otherwise just the source cell
    const sources: string[] = hasSelectionGroup ? Array.from(selection) : [sourceKey];

    for (const key of sources) {
      const [sStr, slotStr] = key.split('-');
      const ss = Number(sStr);
      const slot = Number(slotStr);
      if (!Number.isFinite(ss) || !Number.isFinite(slot)) continue;
      const ns = ss + deltaString;
      const nslot = slot + deltaSlot;
      if (ns === s && nslot === col) {
        return true;
      }
    }
    return false;
  };

  const selectRangeFromAnchor = useCallback(
    (targetString: number, targetSlot: number) => {
      if (!onSelectionChange) return;
      if (!anchor) {
        const key = cellKey(targetString, targetSlot);
        onSelectionChange(new Set([key]));
        setAnchor({ stringIndex: targetString, slotIndex: targetSlot });
        return;
      }
      const minString = Math.min(anchor.stringIndex, targetString);
      const maxString = Math.max(anchor.stringIndex, targetString);
      const minSlot = Math.min(anchor.slotIndex, targetSlot);
      const maxSlot = Math.max(anchor.slotIndex, targetSlot);
      const next = new Set<string>();
      for (let s = minString; s <= maxString; s += 1) {
        for (let slot = minSlot; slot <= maxSlot; slot += 1) {
          next.add(cellKey(s, slot));
        }
      }
      onSelectionChange(next);
    },
    [anchor, onSelectionChange]
  );

  const handleCellClick = useCallback(
    (e: React.MouseEvent, stringIndex: number, slotIndex: number) => {
      if (suppressClickRef.current) {
        suppressClickRef.current = false;
        return;
      }
      if (!onSelectionChange) return;
      const key = cellKey(stringIndex, slotIndex);
      if (e.shiftKey) {
        // Range selection from anchor → current cell
        selectRangeFromAnchor(stringIndex, slotIndex);
      } else {
        // If this cell is part of a duration region, select the whole contiguous run on this string
        if (isDurationCell(stringIndex, slotIndex)) {
          let start = slotIndex;
          let end = slotIndex;
          // walk left
          while (start - 1 >= 0 && isDurationCell(stringIndex, start - 1)) {
            start -= 1;
          }
          // walk right
          while (end + 1 < totalColumns && isDurationCell(stringIndex, end + 1)) {
            end += 1;
          }
          const next = new Set<string>();
          for (let col = start; col <= end; col += 1) {
            next.add(cellKey(stringIndex, col));
          }
          onSelectionChange(next);
          setAnchor({ stringIndex, slotIndex: start });
        } else {
          // Single-cell selection and reset anchor
          onSelectionChange(new Set([key]));
          setAnchor({ stringIndex, slotIndex });
        }
      }
    },
    [onSelectionChange, selectRangeFromAnchor, isDurationCell, totalColumns]
  );

  const handleCellDoubleClick = useCallback((stringIndex: number, slotIndex: number) => {
    // For duration groups, always focus the first cell
    let targetSlot = slotIndex;
    if (isDurationCell(stringIndex, slotIndex)) {
      while (targetSlot - 1 >= 0 && isDurationCell(stringIndex, targetSlot - 1)) {
        targetSlot -= 1;
      }
    }
    const el = document.getElementById(
      `cell-${stringIndex}-${targetSlot}`
    ) as HTMLInputElement | null;
    if (el) el.focus();
  }, [isDurationCell]);

  const selectionHighlightClass =
    selectionType === 'horizontal'
      ? 'bg-sky-500/30 ring-2 ring-sky-400 shadow-[0_0_0_1px_rgba(56,189,248,0.8)]'
      : selectionType === 'vertical'
      ? 'bg-emerald-500/30 ring-2 ring-emerald-400 shadow-[0_0_0_1px_rgba(52,211,153,0.8)]'
      : 'bg-violet-500/25 ring-2 ring-violet-400 shadow-[0_0_0_1px_rgba(167,139,250,0.8)]';

  const hoverSelectionHighlightClass =
    selectionType === 'horizontal'
      ? 'hover:bg-sky-500/30 hover:ring-2 hover:ring-sky-400 hover:shadow-[0_0_0_1px_rgba(56,189,248,0.8)]'
      : selectionType === 'vertical'
      ? 'hover:bg-emerald-500/30 hover:ring-2 hover:ring-emerald-400 hover:shadow-[0_0_0_1px_rgba(52,211,153,0.8)]'
      : 'hover:bg-violet-500/25 hover:ring-2 hover:ring-violet-400 hover:shadow-[0_0_0_1px_rgba(167,139,250,0.8)]';

  const hasDragGhost = !!dragGhost && !!dragNoteRef.current;

  let ghostStyle: React.CSSProperties | undefined;
  if (hasDragGhost && dragGhost && rootRef.current) {
    const rect = rootRef.current.getBoundingClientRect();
    const x = dragGhost.clientX - rect.left;
    const y = dragGhost.clientY - rect.top;
    ghostStyle = {
      left: x - COLUMN_WIDTH / 2,
      top: y - 16,
      width: COLUMN_WIDTH,
      height: 32,
    };
  }

  return (
    <section ref={rootRef} className="mb-6 relative">
      <div
        className="overflow-x-hidden rounded border border-bg-tertiary select-none"
        style={{ paddingLeft: scrollOffset }}
      >
        <div
          className="transition-none"
          style={{
            width: totalColumns * COLUMN_WIDTH,
            transform: `translateX(-${translateX}px)`,
          }}
        >
          <table className="border-collapse text-sm relative z-0">
            <thead>
              <tr>
                {Array.from({ length: totalColumns }, (_, i) => (
                  <th
                    key={i}
                    className={`p-0.5 text-center text-text-secondary font-normal ${
                      i % subsPerBar === 0 ? 'border-l border-text-secondary/40' : ''
                    }`}
                    style={{ width: COLUMN_WIDTH, minWidth: COLUMN_WIDTH }}
                  >
                    {i % subsPerBar === 0 ? i / subsPerBar + 1 : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[0, 1, 2, 3, 4, 5].map((s) => (
                <tr key={s}>
                  {grid[s]?.map((fret, col) => {
                    const isDropTarget = isDropPreviewCell(s, col);
                    const durationStart = isDurationStart(s, col);
                    const durationMember = isDurationCell(s, col);
                    const isDragSource =
                      !!dragNoteRef.current &&
                      dragNoteRef.current.stringIndex === s &&
                      dragNoteRef.current.slotIndex === col;
                    const isDurationHover =
                      hoverCell &&
                      hoverCell.stringIndex === s &&
                      isDurationCell(s, hoverCell.slotIndex) &&
                      (() => {
                        // compute full run for this duration group along this string
                        let start = hoverCell.slotIndex;
                        let end = hoverCell.slotIndex;
                        while (start - 1 >= 0 && isDurationCell(s, start - 1)) start -= 1;
                        while (end + 1 < totalColumns && isDurationCell(s, end + 1)) end += 1;
                        return col >= start && col <= end;
                      })();
                    const isDurationDrag =
                      !!dragNoteRef.current && dragNoteRef.current.mode === 'duration';
                    return (
                      <td
                        key={col}
                        className={`p-0 relative border border-bg-tertiary/60 ${
                          isDurationDrag ? 'cursor-col-resize' : 'cursor-pointer'
                        } transition-colors ${
                          col % subsPerBar === 0 ? 'border-l border-text-secondary/40' : ''
                        } ${
                          isDropTarget
                            ? 'ring-2 ring-accent bg-accent/30 shadow-[0_0_0_1px_rgba(233,69,96,0.9)]'
                            : ''
                        } ${
                          isSelected(s, col)
                            ? selectionHighlightClass
                            : isDragSource
                            ? 'ring-2 ring-accent/80 bg-accent/15'
                            : isChordCell(s, col)
                            ? 'bg-emerald-700/15 ring-1 ring-emerald-500/70'
                            : isDurationCell(s, col)
                            ? 'bg-sky-900/20 ring-2 ring-sky-300 shadow-[0_0_0_1px_rgba(125,211,252,0.9)]'
                            : fret !== null && fret !== undefined
                            ? 'bg-sky-900/20'
                            : ''
                        } ${
                          // regular hover for non-duration cells
                          !isDurationCell(s, col) ? hoverSelectionHighlightClass : ''
                        } ${
                          // group hover highlight for entire duration run
                          isDurationHover ? selectionHighlightClass : ''
                        }`}
                        style={{ width: COLUMN_WIDTH, minWidth: COLUMN_WIDTH }}
                        onMouseEnter={() => {
                          handleCellMouseEnter(s, col);
                          setHoverCell({ stringIndex: s, slotIndex: col });
                        }}
                        onMouseLeave={() => {
                          setHoverCell(null);
                        }}
                        onMouseUp={(e) => handleCellMouseUp(e, s, col)}
                        onMouseDown={(e) => {
                          if ((e.target as HTMLElement)?.closest('input')) return;
                          handleCellMouseDown(e, s, col);
                        }}
                        onClick={(e) => handleCellClick(e, s, col)}
                        onDoubleClick={() => handleCellDoubleClick(s, col)}
                      >
                        <div className="relative flex items-center justify-center px-1 py-0.5">
                          {fret !== null && fret !== undefined && (
                            <>
                              {(
                                // Left handle: duration start OR plain note (no duration group yet)
                                (durationMember && durationStart) || (!durationMember && true)
                              ) && (
                                <div
                                  className="absolute inset-y-0 left-0 w-2 cursor-col-resize"
                                  data-drag-mode="duration"
                                  onMouseDown={(e) => handleCellMouseDown(e, s, col)}
                                />
                              )}
                              {(
                                // Right handle: duration end OR plain note (no duration group yet)
                                (durationMember && isDurationEnd(s, col)) || (!durationMember && true)
                              ) && (
                                <div
                                  className="absolute inset-y-0 right-0 w-2 cursor-col-resize"
                                  data-drag-mode="duration"
                                  onMouseDown={(e) => handleCellMouseDown(e, s, col)}
                                />
                              )}
                            </>
                          )}
                          <input
                            type="text"
                            inputMode="numeric"
                            id={`cell-${s}-${col}`}
                            className="w-10 text-center bg-transparent border-none rounded py-0.5 text-accent font-mono text-sm focus:outline-none box-border cursor-pointer"
                            value={
                              durationMember && !durationStart
                                ? ''
                                : fret === null || fret === undefined
                                ? ''
                                : fret
                            }
                            onChange={(e) => {
                              // Only the first cell of a duration run is editable; others are read-only mirrors
                              if (durationMember && !durationStart) {
                                return;
                              }
                              const v = e.target.value.trim();
                              const parsed = v === '' ? null : Number(v);
                              onUpdateCell(s, col, Number.isFinite(parsed) ? parsed : null);
                            }}
                            onMouseDown={(e) => {
                              // Prevent first-click focusing; editing is triggered via double-click handler on the cell.
                              // Still allow this mousedown to initiate a drag.
                              e.preventDefault();
                              handleCellMouseDown(e as unknown as React.MouseEvent, s, col);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const nextString = s + 1;
                                if (nextString <= 5) {
                                  const nextId = `cell-${nextString}-${col}`;
                                  const el = document.getElementById(
                                    nextId
                                  ) as HTMLInputElement | null;
                                  if (el) {
                                    el.focus();
                                    el.select?.();
                                  }
                                }
                              }
                            }}
                            readOnly={durationMember && !durationStart}
                            tabIndex={durationMember && !durationStart ? -1 : 0}
                          />
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {hasDragGhost && ghostStyle && (
        <div
          className="pointer-events-none absolute z-20 rounded border border-accent bg-accent/20 shadow-lg"
          style={ghostStyle}
        />
      )}
    </section>
  );
}
