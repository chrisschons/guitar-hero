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
import { useRiffPlayback } from '../hooks/useRiffPlayback';
import { useNoteTones } from '../hooks/useNoteTones';
import { buildNoteLookup } from '../core/exercise';
import { useMetronome } from '../hooks/useMetronome';
import { useAnimationLoop } from '../hooks/useAnimationLoop';
import { resumeAudioContext } from '../core/audio';
import { STANDARD_TUNING } from '../data/tunings';
import { getStringLabels } from '../core/music';
import { getBeatsPerBarForDots } from '../data/exerciseTypes';
import type { Riff, RhythmGroup } from '../types/riff';
import {
  notesToEditorGrid,
  cellKey,
  getSubsPerBar,
  gridNotesToRiffNotes,
  riffNotesToGridNotes,
  applyCellUpdateToNotes,
  updateNoteFretAtSlot,
  createNotesInSelection,
  deleteSelectionFromNotes,
  moveNotes,
  combineDurationInSelection,
  makeTupletInSelection,
  splitDurationToNotes,
} from '../core/gridEditorModel';
import type { GridNoteForRiff } from '../core/gridEditorModel';
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
  ListChevronsDownUp,
  ListChevronsUpDown,
  Play,
  Pause,
  ArrowLeftToLine,
  Metronome,
  SquareCenterlineDashedHorizontal,
  LayersPlus,
  RotateCcw,
} from 'lucide-react';
import { Slider } from '../components/ui/Slider';
import { Switch } from '../components/ui/Switch';
import { Button } from '../components/ui/button';
import {Kbd, KbdGroup} from '../components/ui/kbd';
import { ButtonGroup } from '../components/ui/button-group';
import { Footer } from '../components/Footer';
const COLUMN_WIDTH = 68;
const ROW_HEIGHT = 32;
const NUM_STRINGS = 6;
const STRING_LABEL_WIDTH = 28;
const HEADER_ROW_HEIGHT = 24;
/** Fixed height for the grid + bar header so string labels don't resize (header + 6 rows). */
const GRID_FIXED_HEIGHT = HEADER_ROW_HEIGHT + NUM_STRINGS * ROW_HEIGHT;
/** Space below the grid for the horizontal scrollbar so it doesn't overlap notes. */
const GRID_SCROLLBAR_GAP = 36;

type StateTestNote = {
  id: string;
  row: number;
  startCol: number;
  endCol: number;
  value: number;
  selected: boolean;
  /** Notes with the same chordId move/resize/cut/copy/delete as a vertical chord group. */
  chordId: string | null;
  /** If set, this note belongs to a RhythmGroup (e.g. combined duration or tuplet). */
  rhythmGroupId?: string;
  indexInGroup?: number;
};

function genNoteId() {
  return `note-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function genChordId() {
  return `chord-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Convert GridNoteForRiff[] (from riffNotesToGridNotes) to StateTestNote[] for grid display. */
function gridNotesToStateTestNotes(g: GridNoteForRiff[]): StateTestNote[] {
  return g.map((n) => ({
    id: n.id ?? genNoteId(),
    row: n.row,
    startCol: n.startCol,
    endCol: n.endCol,
    value: n.value,
    selected: false,
    chordId: null,
    rhythmGroupId: n.rhythmGroupId,
    indexInGroup: n.indexInGroup,
  }));
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

const DEFAULT_STRING_LABELS = ['e', 'B', 'G', 'D', 'A', 'E'];

type StateTestGridProps = {
  totalColumns: number;
  subsPerBar: number;
  timeSignature?: { num: number; denom: number };
  stringLabels?: string[];
  notes: StateTestNote[];
  onNotesChange: (updater: (prev: StateTestNote[]) => StateTestNote[]) => void;
  /** Rhythm groups (tuplets etc.) for bracket + compressed note rendering */
  rhythmGroups?: RhythmGroup[];
  /** Cell-key selection for rhythm actions (triplet/sextuplet). */
  selection?: Set<string>;
  /** Called when user changes selection (click cell or note) so parent can enable triplet/sextuplet etc. */
  onSelectionChange?: (cellKeys: Set<string>) => void;
  /** True when selection is a single note or duration group (enables triplet/sextuplet). */
  canApplyTuplet?: boolean;
  onMakeTriplet?: () => void;
  onMakeSextuplet?: () => void;
  /** Current playback column index for playhead; -1 when not playing. */
  activeColumnIndex?: number;
  /** Ref for the horizontal scroll container (used for auto-scroll). */
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
  /** When pasting a tuplet, call with the new group so parent can add it to riff.rhythmGroups. */
  onPasteRhythmGroup?: (group: RhythmGroup) => void;
};

function StateTestGrid({
  totalColumns,
  subsPerBar,
  timeSignature = { num: 4, denom: 4 },
  stringLabels = DEFAULT_STRING_LABELS,
  notes,
  onNotesChange,
  rhythmGroups = [],
  selection,
  onSelectionChange,
  canApplyTuplet = false,
  onMakeTriplet,
  onMakeSextuplet,
  activeColumnIndex = -1,
  scrollContainerRef,
  onPasteRhythmGroup,
}: StateTestGridProps) {
  const TEST_ROWS = 6;
  const tupletGroupsById = useMemo(() => {
    const map = new Map<string, RhythmGroup>();
    for (const g of rhythmGroups) {
      if (g.type === 'tuplet' && g.tupletRatio) map.set(g.id, g);
    }
    return map;
  }, [rhythmGroups]);

  /** Per-group span from actual note positions (so drop moves the visual; not tied to group.startSlot/endSlot). */
  const tupletSpanFromNotes = useMemo(() => {
    const map = new Map<string, { startCol: number; endCol: number }>();
    for (const g of rhythmGroups) {
      if (g.type !== 'tuplet' || !g.tupletRatio) continue;
      const notesInGroup = notes.filter((n) => n.rhythmGroupId === g.id);
      if (notesInGroup.length === 0) {
        map.set(g.id, { startCol: g.startSlot, endCol: g.endSlot });
        continue;
      }
      const startCol = Math.min(...notesInGroup.map((n) => n.startCol));
      const endCol = Math.max(...notesInGroup.map((n) => n.endCol));
      map.set(g.id, { startCol, endCol });
    }
    return map;
  }, [rhythmGroups, notes]);

  /** Visual leftPx and widthPx for a note (tuplet-compressed or normal). Uses notes' positions for tuplets. */
  const getNoteVisualBounds = useCallback(
    (note: StateTestNote): { leftPx: number; widthPx: number } => {
      const g = note.rhythmGroupId ? tupletGroupsById.get(note.rhythmGroupId) : null;
      if (g && g.tupletRatio) {
        const span = note.rhythmGroupId ? tupletSpanFromNotes.get(note.rhythmGroupId) : null;
        const startCol = span?.startCol ?? g.startSlot;
        const endCol = span?.endCol ?? g.endSlot;
        const spanSlots = endCol - startCol + 1;
        const nNotes = g.tupletRatio.n;
        const idx = note.indexInGroup ?? 0;
        const leftCol = startCol + (idx / nNotes) * spanSlots;
        const slotWidth = spanSlots / nNotes;
        return {
          leftPx: leftCol * COLUMN_WIDTH,
          widthPx: slotWidth * COLUMN_WIDTH,
        };
      }
      return {
        leftPx: note.startCol * COLUMN_WIDTH,
        widthPx: (note.endCol - note.startCol + 1) * COLUMN_WIDTH,
      };
    },
    [tupletGroupsById, tupletSpanFromNotes]
  );

  /** Rest positions in tuplet groups: (row, indexInGroup) missing a note → (leftPx, topPx). */
  const tupletRestPositions = useMemo(() => {
    const positions: { row: number; leftPx: number; topPx: number }[] = [];
    for (const g of rhythmGroups) {
      if (g.type !== 'tuplet' || !g.tupletRatio) continue;
      const n = g.tupletRatio.n;
      const span = tupletSpanFromNotes.get(g.id);
      const startCol = span?.startCol ?? g.startSlot;
      const endCol = span?.endCol ?? g.endSlot;
      const spanSlots = endCol - startCol + 1;
      const notesInGroup = notes.filter((n) => n.rhythmGroupId === g.id);
      const byString = new Map<number, Set<number>>();
      for (const note of notesInGroup) {
        const r = note.row;
        if (!byString.has(r)) byString.set(r, new Set());
        const idx = note.indexInGroup ?? 0;
        byString.get(r)!.add(idx);
      }
      byString.forEach((indices, row) => {
        for (let i = 0; i < n; i++) {
          if (indices.has(i)) continue;
          const leftCol = startCol + (i / n) * spanSlots;
          positions.push({
            row,
            leftPx: leftCol * COLUMN_WIDTH,
            topPx: row * ROW_HEIGHT,
          });
        }
      });
    }
    return positions;
  }, [rhythmGroups, notes, tupletSpanFromNotes]);

  /** Tuplet connector dots: between consecutive notes in the same row within a rhythm group (like chord dots). */
  const tupletConnectorDots = useMemo(() => {
    const dots: { centerX: number; centerY: number; rhythmGroupId: string; selected: boolean }[] = [];
    for (const g of rhythmGroups) {
      if (g.type !== 'tuplet' || !g.tupletRatio) continue;
      const notesInGroup = notes.filter((n) => n.rhythmGroupId === g.id);
      const groupSelected = notesInGroup.some((n) => n.selected);
      const span = tupletSpanFromNotes.get(g.id);
      const startCol = span?.startCol ?? g.startSlot;
      const endCol = span?.endCol ?? g.endSlot;
      const spanSlots = endCol - startCol + 1;
      const nNotes = g.tupletRatio.n;
      const byRow = new Map<number, StateTestNote[]>();
      for (const n of notesInGroup) {
        if (!byRow.has(n.row)) byRow.set(n.row, []);
        byRow.get(n.row)!.push(n);
      }
      byRow.forEach((rowNotes, row) => {
        const sorted = [...rowNotes].sort((a, b) => (a.indexInGroup ?? 0) - (b.indexInGroup ?? 0));
        for (let i = 0; i < sorted.length - 1; i++) {
          const a = sorted[i];
          const b = sorted[i + 1];
          const idxA = a.indexInGroup ?? 0;
          const idxB = b.indexInGroup ?? 0;
          const leftColA = startCol + (idxA / nNotes) * spanSlots;
          const slotWidth = spanSlots / nNotes;
          const leftPxA = leftColA * COLUMN_WIDTH;
          const widthPxA = slotWidth * COLUMN_WIDTH;
          const leftColB = startCol + (idxB / nNotes) * spanSlots;
          const leftPxB = leftColB * COLUMN_WIDTH;
          const centerX = (leftPxA + widthPxA + leftPxB) / 2;
          const centerY = row * ROW_HEIGHT + ROW_HEIGHT / 2;
          dots.push({ centerX, centerY, rhythmGroupId: g.id, selected: groupSelected });
        }
      });
    }
    return dots;
  }, [rhythmGroups, notes, tupletSpanFromNotes]);

  type ClipboardItem = {
    rowOffset: number;
    startCol: number;
    endCol: number;
    value: number;
    indexInGroup?: number;
  };
  type ClipboardRhythmGroup = { tupletRatio: { n: number; d: number }; spanCols: number };
  const [clipboard, setClipboard] = useState<{
    originRow: number;
    originCol: number;
    items: ClipboardItem[];
    rhythmGroup?: ClipboardRhythmGroup;
  } | null>(null);
  const [undoStack, setUndoStack] = useState<StateTestNote[][]>([]);
  const [redoStack, setRedoStack] = useState<StateTestNote[][]>([]);
  const isUndoRedoRef = useRef(false);

  const applyMutation = useCallback(
    (updater: (prev: StateTestNote[]) => StateTestNote[]) => {
      if (isUndoRedoRef.current) {
        onNotesChange(updater);
        return;
      }
      setUndoStack((s) => [...s, notesRef.current]);
      setRedoStack([]);
      onNotesChange(updater);
    },
    [onNotesChange]
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

  // Sync selection to parent so triplet/sextuplet buttons can be enabled
  useEffect(() => {
    if (!onSelectionChange) return;
    const keys = new Set<string>();
    if (selectedCell != null) keys.add(cellKey(selectedCell.row, selectedCell.col));
    notes.filter((n) => n.selected).forEach((n) => {
      for (let c = n.startCol; c <= n.endCol; c++) keys.add(cellKey(n.row, c));
    });
    onSelectionChange(keys);
  }, [selectedCell, notes, onSelectionChange]);

  const [dragState, setDragState] = useState<{
    noteId: string;
    anchorRow: number;
    anchorCol: number;
    anchorStartCol: number;
    anchorEndCol: number;
    /** Visual left/width (px) of the anchor note for ghost-relative positioning and drop target */
    anchorVisualLeftPx: number;
    anchorVisualWidthPx: number;
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
  /** Last mouse position during drag (updated every mousemove) so mouseup computes drop position from it. */
  const dragLastMouseRef = useRef<{ clientX: number; clientY: number } | null>(null);
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
  const pendingMarqueeRef = useRef<{
    startRow: number;
    startCol: number;
    clientX: number;
    clientY: number;
  } | null>(null);
  /** True while marquee is active so mouseup/mouseleave always clear even if handler closure is stale. */
  const marqueeActiveRef = useRef(false);
  /** Latest marquee state so mousemove handler can read it without effect re-running (keeps mouseup listener attached). */
  const marqueeStateRef = useRef(marqueeState);
  marqueeStateRef.current = marqueeState;
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

  /** Allowed paste position so that all clipboard items stay within the grid (no partial paste). */
  function getPastePositionBounds(
    items: ClipboardItem[],
    cols: number,
    rows: number,
    spanColsOverride?: number
  ): { pasteRowMin: number; pasteRowMax: number; pasteColMin: number; pasteColMax: number } | null {
    if (items.length === 0) return null;
    const minRowOffset = Math.min(...items.map((i) => i.rowOffset));
    const maxRowOffset = Math.max(...items.map((i) => i.rowOffset));
    const minStartCol = spanColsOverride != null ? 0 : Math.min(...items.map((i) => i.startCol));
    const maxEndCol =
      spanColsOverride != null ? spanColsOverride - 1 : Math.max(...items.map((i) => i.endCol));
    const pasteRowMin = -minRowOffset;
    const pasteRowMax = rows - 1 - maxRowOffset;
    const pasteColMin = -minStartCol;
    const pasteColMax = cols - 1 - maxEndCol;
    if (pasteRowMin > pasteRowMax || pasteColMin > pasteColMax) return null;
    return { pasteRowMin, pasteRowMax, pasteColMin, pasteColMax };
  }

  /** Allowed drag delta so that all selected notes stay within the grid. */
  function getDragDeltaBounds(
    selectedNotes: StateTestNote[],
    cols: number,
    rows: number
  ): { deltaRowMin: number; deltaRowMax: number; deltaColMin: number; deltaColMax: number } {
    if (selectedNotes.length === 0) {
      return { deltaRowMin: 0, deltaRowMax: 0, deltaColMin: 0, deltaColMax: 0 };
    }
    let deltaRowMin = -selectedNotes[0].row;
    let deltaRowMax = rows - 1 - selectedNotes[0].row;
    let deltaColMin = -selectedNotes[0].startCol;
    let deltaColMax = cols - 1 - selectedNotes[0].endCol;
    for (let i = 1; i < selectedNotes.length; i++) {
      const n = selectedNotes[i];
      deltaRowMin = Math.max(deltaRowMin, -n.row);
      deltaRowMax = Math.min(deltaRowMax, rows - 1 - n.row);
      deltaColMin = Math.max(deltaColMin, -n.startCol);
      deltaColMax = Math.min(deltaColMax, cols - 1 - n.endCol);
    }
    return { deltaRowMin, deltaRowMax, deltaColMin, deltaColMax };
  }

  /** Expand a set of selected note ids to include chord mates (not rhythm-group: notes are selected individually). */
  const expandSelectionWithChordMates = useCallback(
    (noteList: StateTestNote[], selectedIds: Set<string>): Set<string> => {
      const expanded = new Set(selectedIds);
      for (const n of noteList) {
        if (!selectedIds.has(n.id)) continue;
        if (n.chordId) {
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

  /** Expand a set of selected note ids to include full rhythm groups (tuplets, duration groups). */
  const expandSelectionWithRhythmGroups = useCallback(
    (noteList: StateTestNote[], selectedIds: Set<string>): Set<string> => {
      const expanded = new Set(selectedIds);
      // First collect all rhythmGroupIds that are touched by the current selection.
      const groupIds = new Set<string>();
      for (const n of noteList) {
        if (!selectedIds.has(n.id)) continue;
        if (n.rhythmGroupId) groupIds.add(n.rhythmGroupId);
      }
      if (groupIds.size === 0) return expanded;
      // Add every note that belongs to any of those groups.
      for (const n of noteList) {
        if (n.rhythmGroupId && groupIds.has(n.rhythmGroupId)) {
          expanded.add(n.id);
        }
      }
      return expanded;
    },
    []
  );

  const handleCopyRef = useRef<() => void>(() => {});
  const handleCutRef = useRef<() => void>(() => {});
  const handlePasteRef = useRef<() => void>(() => {});
  const handleUndoRef = useRef<() => void>(() => {});
  const handleRedoRef = useRef<() => void>(() => {});
  const handleSplitIntoNotesRef = useRef<() => void>(() => {});
  const handleCombineIntoChordRef = useRef<() => void>(() => {});

  /** Expand selected notes to include full rhythm groups (so copy/cut includes entire tuplet). */
  const notesToCopyOrCut = useMemo(() => {
    const selected = notes.filter((n) => n.selected);
    if (selected.length === 0) return [];
    const ids = new Set(selected.map((n) => n.id));
    for (const n of selected) {
      if (n.rhythmGroupId) {
        for (const m of notes) {
          if (m.rhythmGroupId === n.rhythmGroupId) ids.add(m.id);
        }
      }
    }
    return notes.filter((n) => ids.has(n.id));
  }, [notes]);

  const handleCopy = useCallback(() => {
    const toCopy = notesToCopyOrCut;
    if (toCopy.length === 0) return;
    const originRow = Math.min(...toCopy.map((n) => n.row));
    const originCol = Math.min(...toCopy.map((n) => n.startCol));
    const gid = toCopy[0]?.rhythmGroupId;
    const group = gid && toCopy.every((n) => n.rhythmGroupId === gid) ? tupletGroupsById.get(gid) : null;
    const rhythmGroup: ClipboardRhythmGroup | undefined =
      group?.tupletRatio != null
        ? {
            tupletRatio: group.tupletRatio,
            spanCols: Math.min(totalColumns, group.endSlot - group.startSlot + 1),
          }
        : undefined;
    setClipboard({
      originRow,
      originCol,
      items: toCopy.map((n) => ({
        rowOffset: n.row - originRow,
        startCol: n.startCol - originCol,
        endCol: n.endCol - originCol,
        value: n.value,
        indexInGroup: rhythmGroup != null ? (n.indexInGroup ?? 0) : undefined,
      })),
      rhythmGroup,
    });
  }, [notesToCopyOrCut, tupletGroupsById, totalColumns]);
  handleCopyRef.current = handleCopy;

  const handleCut = useCallback(() => {
    const toCut = notesToCopyOrCut;
    if (toCut.length === 0) return;
    const originRow = Math.min(...toCut.map((n) => n.row));
    const originCol = Math.min(...toCut.map((n) => n.startCol));
    const gid = toCut[0]?.rhythmGroupId;
    const group = gid && toCut.every((n) => n.rhythmGroupId === gid) ? tupletGroupsById.get(gid) : null;
    const rhythmGroup: ClipboardRhythmGroup | undefined =
      group?.tupletRatio != null
        ? {
            tupletRatio: group.tupletRatio,
            spanCols: Math.min(totalColumns, group.endSlot - group.startSlot + 1),
          }
        : undefined;
    const toCutIds = new Set(toCut.map((n) => n.id));
    setClipboard({
      originRow,
      originCol,
      items: toCut.map((n) => ({
        rowOffset: n.row - originRow,
        startCol: n.startCol - originCol,
        endCol: n.endCol - originCol,
        value: n.value,
        indexInGroup: rhythmGroup != null ? (n.indexInGroup ?? 0) : undefined,
      })),
      rhythmGroup,
    });
    applyMutation((prev) => prev.filter((n) => !toCutIds.has(n.id)));
  }, [notesToCopyOrCut, tupletGroupsById, totalColumns, applyMutation]);
  handleCutRef.current = handleCut;

  const handlePaste = useCallback(() => {
    if (!clipboard || clipboard.items.length === 0) return;
    const rg = clipboard.rhythmGroup;
    const bounds = getPastePositionBounds(
      clipboard.items,
      totalColumns,
      TEST_ROWS,
      rg?.spanCols
    );
    if (!bounds) return;
    const selected = notes.filter((n) => n.selected);
    const desiredPasteRow =
      selected.length > 0
        ? Math.min(...selected.map((n) => n.row))
        : selectedCell?.row ?? 0;
    const desiredPasteCol =
      selected.length > 0
        ? Math.min(...selected.map((n) => n.startCol))
        : selectedCell?.col ?? 0;
    const pasteRow = Math.max(bounds.pasteRowMin, Math.min(bounds.pasteRowMax, desiredPasteRow));
    const pasteCol = Math.max(bounds.pasteColMin, Math.min(bounds.pasteColMax, desiredPasteCol));
    const newGroupId = rg ? `rg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}` : null;
    applyMutation((prev) => {
      const pastedChordId = genChordId();
      let newNotes: StateTestNote[] =
        rg != null && newGroupId != null
          ? (() => {
              const n = rg.tupletRatio.n;
              const spanCols = rg.spanCols;
              return clipboard.items.map((item) => {
                const row = pasteRow + item.rowOffset;
                const idx = item.indexInGroup ?? 0;
                const onsetCol = Math.floor((idx * spanCols) / n);
                const nextOnsetCol =
                  idx < n - 1 ? Math.floor(((idx + 1) * spanCols) / n) : spanCols;
                const duration = Math.max(1, nextOnsetCol - onsetCol);
                const startCol = pasteCol + onsetCol;
                const endCol = pasteCol + onsetCol + duration - 1;
                return {
                  id: genNoteId(),
                  row,
                  startCol: Math.min(startCol, totalColumns - 1),
                  endCol: Math.min(endCol, totalColumns - 1),
                  value: item.value,
                  selected: true,
                  chordId: pastedChordId,
                  rhythmGroupId: newGroupId,
                  indexInGroup: idx,
                };
              });
            })()
          : clipboard.items.map((item) => {
              const row = pasteRow + item.rowOffset;
              const startCol = pasteCol + item.startCol;
              const endCol = pasteCol + item.endCol;
              return {
                id: genNoteId(),
                row,
                startCol,
                endCol,
                value: item.value,
                selected: true,
                // Treat pasted non-tuplet notes as independent notes, not a single chord group.
                chordId: null,
              };
            });
      // If any of the new notes would overlap a tuplet/rhythm-group note, disallow the drop entirely.
      if (newNotes.length > 0) {
        const protectedByRow = new Map<number, [number, number][]>();
        for (const n of prev) {
          if (!n.rhythmGroupId) continue;
          const row = n.row;
          if (!protectedByRow.has(row)) protectedByRow.set(row, []);
          protectedByRow.get(row)!.push([n.startCol, n.endCol]);
        }
        for (const row of protectedByRow.keys()) {
          protectedByRow.set(row, mergeColumnRanges(protectedByRow.get(row)!));
        }
        let hasTupletOverlap = false;
        outer: for (const note of newNotes) {
          const protectedIntervals = protectedByRow.get(note.row) ?? [];
          for (const [ps, pe] of protectedIntervals) {
            if (note.endCol >= ps && note.startCol <= pe) {
              hasTupletOverlap = true;
              break outer;
            }
          }
        }
        if (hasTupletOverlap) {
          // Cancel paste/drag if it would land on any tuplet cells.
          return prev;
        }
      }
      const dropFootprint = new Map<number, [number, number][]>();
      for (const n of newNotes) {
        const start = Math.max(0, n.startCol);
        const end = Math.min(totalColumns - 1, n.endCol);
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

        // Tuplets / rhythm-group notes: only allow full replacement, never partial carve.
        if (n.rhythmGroupId) {
          // Determine if every column of this note is covered by some drop range.
          let fullyCovered = true;
          for (let c = n.startCol; c <= n.endCol; c += 1) {
            let covered = false;
            for (const [a, b] of dropRanges) {
              if (c >= a && c <= b) {
                covered = true;
                break;
              }
            }
            if (!covered) {
              fullyCovered = false;
              break;
            }
          }
          // If not fully covered, leave tuplet note entirely unchanged.
          if (!fullyCovered) return [n];
          // Fully covered: allow removal.
          if (n.chordId) brokenChordIds.add(n.chordId);
          return [];
        }

        // Non-tuplet notes keep existing drop-to-split behavior.
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
    if (clipboard.rhythmGroup != null && newGroupId != null && onPasteRhythmGroup) {
      const strings = [
        ...new Set(clipboard.items.map((i) => pasteRow + i.rowOffset + 1)),
      ].sort((a, b) => a - b);
      onPasteRhythmGroup({
        id: newGroupId,
        startSlot: pasteCol,
        endSlot: pasteCol + clipboard.rhythmGroup.spanCols - 1,
        type: 'tuplet',
        tupletRatio: clipboard.rhythmGroup.tupletRatio,
        strings,
      });
    }
    if (selected.length === 0 && selectedCell != null) setSelectedCell(null);
  }, [clipboard, notes, selectedCell, applyMutation, TEST_ROWS, totalColumns, onPasteRhythmGroup]);
  handlePasteRef.current = handlePaste;

  const handleSplitIntoNotes = useCallback(() => {
    const selected = notes.filter((n) => n.selected);
    if (selected.length === 0) return;
    // Do not allow splitting notes that belong to tuplets or other rhythm groups.
    if (selected.some((n) => n.rhythmGroupId)) return;
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
    // Do not allow combining notes that belong to tuplets or other rhythm groups.
    if (selected.some((n) => n.rhythmGroupId)) return;
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
    const snapshot = undoStack[undoStack.length - 1];
    setRedoStack((r) => [...r, notes]);
    onNotesChange(() => snapshot);
    setUndoStack((s) => s.slice(0, -1));
    isUndoRedoRef.current = false;
  }, [undoStack, notes, onNotesChange]);
  handleUndoRef.current = handleUndo;

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    isUndoRedoRef.current = true;
    const snapshot = redoStack[redoStack.length - 1];
    setUndoStack((s) => [...s, notes]);
    onNotesChange(() => snapshot);
    setRedoStack((r) => r.slice(0, -1));
    isUndoRedoRef.current = false;
  }, [redoStack, notes, onNotesChange]);
  handleRedoRef.current = handleRedo;

  const findNoteAt = useCallback(
    (r: number, c: number) =>
      notes.find((n) => n.row === r && c >= n.startCol && c <= n.endCol) ?? null,
    [notes]
  );

  // Whether the current drag position would drop onto any tuplet / rhythm-group cells.
  const isInvalidDropPreview = useMemo(() => {
    if (!dragState) return false;
    const anchorNote = notes.find((n) => n.id === dragState.noteId);
    if (!anchorNote) return false;
    const selectedNow = notes.filter((n) => n.selected);
    const notesToMove =
      selectedNow.length > 0
        ? selectedNow
        : anchorNote.rhythmGroupId
        ? notes.filter((n) => n.rhythmGroupId === anchorNote.rhythmGroupId)
        : [anchorNote];
    if (notesToMove.length === 0) return false;
    const deltaRow = dragState.currentRow - dragState.anchorRow;
    const deltaCol = dragState.currentCol - dragState.anchorCol;
    if (deltaRow === 0 && deltaCol === 0) return false;

    const dropFootprint = new Map<number, [number, number][]>();
    for (const n of notesToMove) {
      const newRow = Math.max(0, Math.min(TEST_ROWS - 1, n.row + deltaRow));
      const newStartCol = Math.max(
        0,
        Math.min(totalColumns - 1, n.startCol + deltaCol)
      );
      const span = n.endCol - n.startCol + 1;
      const newEndCol = Math.max(
        newStartCol,
        Math.min(totalColumns - 1, newStartCol + span - 1)
      );
      if (!dropFootprint.has(newRow)) dropFootprint.set(newRow, []);
      dropFootprint.get(newRow)!.push([newStartCol, newEndCol]);
    }
    for (const row of dropFootprint.keys()) {
      dropFootprint.set(row, mergeColumnRanges(dropFootprint.get(row)!));
    }

    for (const [row, ranges] of dropFootprint.entries()) {
      for (const n of notes) {
        if (!n.rhythmGroupId || n.row !== row) continue;
        for (const [a, b] of ranges) {
          if (n.endCol >= a && n.startCol <= b) {
            // Any overlap with a tuplet cell makes this drop disallowed.
            return true;
          }
        }
      }
    }
    return false;
  }, [dragState, notes, totalColumns]);

  // Clear any residual hover when the current drag position becomes invalid for dropping.
  useEffect(() => {
    if (isInvalidDropPreview) {
      setHover(null);
    }
  }, [isInvalidDropPreview]);

  // Drop preview always shows; tuplets are protected in drop handlers themselves.

  const handleCellClick = useCallback(
    (row: number, col: number, e: React.MouseEvent) => {
      const note = findNoteAt(row, col);
      if (!note) {
        if (e.shiftKey) return;
        setSelectedCell({ row, col });
        onNotesChange((prev) => prev.map((n) => ({ ...n, selected: false })));
        digitBufferRef.current = '';
        return;
      }
      setSelectedCell(null);
      if (e.shiftKey) {
        onNotesChange((prev) => {
          const currentIds = new Set(prev.filter((n) => n.selected).map((n) => n.id));
          // Expand current selection to include chord mates and rhythm groups.
          const withChords = expandSelectionWithChordMates(prev, currentIds);
          const expanded = expandSelectionWithRhythmGroups(prev, withChords);
          const noteInSelection = expanded.has(note.id);
          const chordMateIds = note.chordId
            ? prev.filter((n) => n.chordId === note.chordId).map((n) => n.id)
            : [note.id];
          const groupIds =
            note.rhythmGroupId != null && note.rhythmGroupId !== ''
              ? prev.filter((n) => n.rhythmGroupId === note.rhythmGroupId).map((n) => n.id)
              : [];
          const idsForToggle = new Set([...chordMateIds, ...groupIds]);
          const nextIds = new Set(expanded);
          if (noteInSelection) idsForToggle.forEach((id) => nextIds.delete(id));
          else idsForToggle.forEach((id) => nextIds.add(id));
          return prev.map((n) => ({ ...n, selected: nextIds.has(n.id) }));
        });
        digitBufferRef.current = '';
        return;
      }
      const wasOnlySelected =
        note.selected && notes.filter((n) => n.selected).length === 1;
      if (wasOnlySelected) {
        onNotesChange((prev) => {
          const deselectIds = note.chordId
            ? new Set(prev.filter((n) => n.chordId === note.chordId).map((n) => n.id))
            : new Set([note.id]);
          return prev.map((n) => ({ ...n, selected: n.selected && !deselectIds.has(n.id) }));
        });
      } else {
        onNotesChange((prev) => {
          const primaryIds = new Set([note.id]);
          const withChords = expandSelectionWithChordMates(prev, primaryIds);
          const expanded = expandSelectionWithRhythmGroups(prev, withChords);
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
      onNotesChange((prev) => {
        const currentIds = new Set(prev.filter((n) => n.selected).map((n) => n.id));
        const withChords = expandSelectionWithChordMates(prev, currentIds);
        const expanded = expandSelectionWithRhythmGroups(prev, withChords);
        const chordMateIds = note.chordId
          ? prev.filter((n) => n.chordId === note.chordId).map((n) => n.id)
          : [note.id];
        const groupIds =
          note.rhythmGroupId != null && note.rhythmGroupId !== ''
            ? prev.filter((n) => n.rhythmGroupId === note.rhythmGroupId).map((n) => n.id)
            : [];
        const idsForToggle = new Set([...chordMateIds, ...groupIds]);
        const nextIds = new Set(expanded);
        if (expanded.has(note.id)) idsForToggle.forEach((id) => nextIds.delete(id));
        else idsForToggle.forEach((id) => nextIds.add(id));
        return prev.map((n) => ({ ...n, selected: nextIds.has(n.id) }));
      });
    } else if (!note.selected) {
      onNotesChange((prev) => {
        const primaryIds = new Set([note.id]);
        const withChords = expandSelectionWithChordMates(prev, primaryIds);
        const expanded = expandSelectionWithRhythmGroups(prev, withChords);
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
    if (note.rhythmGroupId) return;
    setSelectedCell(null);
    onNotesChange((prev) => {
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
    // During disallowed drop positions, don't update hover from cell enter.
    if (isInvalidDropPreview) {
      return;
    }
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
              const visualRight = Math.max(noteLeftPx + minW, Math.min(localX, totalColumns * COLUMN_WIDTH));
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
            const currentCol = Math.max(0, Math.min(totalColumns - 1, col));
            marqueeActiveRef.current = true;
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
      const currentMarquee = marqueeStateRef.current;
      if (currentMarquee) {
        const gridEl = gridWrapperRef.current;
        if (gridEl) {
          const rect = gridEl.getBoundingClientRect();
          const localX = e.clientX - rect.left;
          const localY = e.clientY - rect.top;
          const col = Math.floor(localX / COLUMN_WIDTH);
          const row = Math.floor(localY / ROW_HEIGHT);
          const currentRow = Math.max(0, Math.min(TEST_ROWS - 1, row));
          const currentCol = Math.max(0, Math.min(totalColumns - 1, col));
          const minRow = Math.min(currentMarquee.startRow, currentRow);
          const maxRow = Math.max(currentMarquee.startRow, currentRow);
          const minCol = Math.min(currentMarquee.startCol, currentCol);
          const maxCol = Math.max(currentMarquee.startCol, currentCol);
          onNotesChange((prev) => {
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
            // First expand to include chord mates, then expand to include full rhythm groups (tuplets).
            const withChords = expandSelectionWithChordMatesRef.current(prev, intersectsIds);
            const expanded = expandSelectionWithRhythmGroups(prev, withChords);
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
        const scrollEl = scrollContainerRef?.current ?? (gridEl?.parentElement?.parentElement as HTMLDivElement | null) ?? null;
        if (gridEl) {
          const scrollLeft = scrollEl?.scrollLeft ?? 0;
          const scrollRect = scrollEl?.getBoundingClientRect() ?? gridEl.getBoundingClientRect();
          const gridRect = gridEl.getBoundingClientRect();
          const cursorLocalX = e.clientX - scrollRect.left + scrollLeft;
          const cursorLocalY = e.clientY - gridRect.top;
          const grabPointLocalX = cursorLocalX - dragState.anchorOffsetX;
          let col = Math.round(grabPointLocalX / COLUMN_WIDTH);
          const row = Math.floor(cursorLocalY / ROW_HEIGHT);
          let desiredRow = Math.max(0, Math.min(TEST_ROWS - 1, row));
          const anchorNote = notesRef.current.find((n) => n.id === dragState.noteId);
          const selectedNow = notesRef.current.filter((n) => n.selected);
          const notesToMove =
            selectedNow.length > 1
              ? selectedNow
              : anchorNote?.rhythmGroupId
              ? notesRef.current.filter((n) => n.rhythmGroupId === anchorNote.rhythmGroupId)
              : selectedNow;
          let desiredCol = Math.max(0, Math.min(totalColumns - 1, col));
          const note = notesRef.current.find((n) => n.id === dragState.noteId);
          const isFullHeightChord =
            note?.chordId &&
            notesRef.current.filter((n) => n.chordId === note.chordId).length === TEST_ROWS;
          if (isFullHeightChord) desiredRow = dragState.anchorRow;
          const bounds = getDragDeltaBounds(notesToMove, totalColumns, TEST_ROWS);
          const rawDeltaRow = desiredRow - dragState.anchorRow;
          const rawDeltaCol = desiredCol - dragState.anchorCol;
          const deltaRow = Math.max(bounds.deltaRowMin, Math.min(bounds.deltaRowMax, rawDeltaRow));
          const deltaCol = Math.max(bounds.deltaColMin, Math.min(bounds.deltaColMax, rawDeltaCol));
          const currentRow = dragState.anchorRow + deltaRow;
          const currentCol = dragState.anchorCol + deltaCol;
          dragLastMouseRef.current = { clientX: e.clientX, clientY: e.clientY };
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
        const scrollEl = scrollContainerRef?.current;
        const gridEl = gridWrapperRef.current;
        const { leftPx: anchorVisualLeftPx, widthPx: anchorVisualWidthPx } = getNoteVisualBounds(note);
        let anchorOffsetX = 0;
        let anchorOffsetY = 0;
        if (scrollEl && gridEl) {
          const scrollRect = scrollEl.getBoundingClientRect();
          const scrollLeft = scrollEl.scrollLeft;
          const anchorNoteScreenLeft = scrollRect.left - scrollLeft + anchorVisualLeftPx;
          const anchorNoteScreenTop = gridEl.getBoundingClientRect().top + note.row * ROW_HEIGHT;
          anchorOffsetX = pending.clientX - anchorNoteScreenLeft;
          anchorOffsetY = pending.clientY - anchorNoteScreenTop;
        }
        setDragGhost({ clientX: e.clientX, clientY: e.clientY });
        dragLastMouseRef.current = { clientX: e.clientX, clientY: e.clientY };
        setDragState({
          noteId: note.id,
          anchorRow: pending.anchorRow,
          anchorCol: pending.anchorCol,
          anchorStartCol: note.startCol,
          anchorEndCol: note.endCol,
          anchorVisualLeftPx,
          anchorVisualWidthPx,
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
                  Math.min(localX, totalColumns * COLUMN_WIDTH)
                );
                newEndCol = Math.min(
                  totalColumns - 1,
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
                  Math.max(0, Math.min(Math.round(visualLeftPx / COLUMN_WIDTH), totalColumns - 1))
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
      if (marqueeActiveRef.current || marqueeState) {
        marqueeActiveRef.current = false;
        setMarqueeState(null);
        setMarqueePointerDownRef.current(false);
        setSelectedCell(null);
        return;
      }
      if (pendingMarqueeRef.current) {
        pendingMarqueeRef.current = null;
        setMarqueePointerDownRef.current(false);
      }
      if (dragState) {
        setDragGhost(null);
        const { anchorRow, anchorCol } = dragState;
        const anchorNote = notesRef.current.find((n) => n.id === dragState.noteId);
        const selectedNow = notesRef.current.filter((n) => n.selected);
        const notesToMove =
          selectedNow.length > 1
            ? selectedNow
            : anchorNote?.rhythmGroupId
            ? notesRef.current.filter((n) => n.rhythmGroupId === anchorNote.rhythmGroupId)
            : selectedNow;
        const notesToMoveIds = new Set(notesToMove.map((n) => n.id));
        const bounds = getDragDeltaBounds(notesToMove, totalColumns, TEST_ROWS);
        let deltaRow = Math.max(bounds.deltaRowMin, Math.min(bounds.deltaRowMax, dragState.currentRow - anchorRow));
        let deltaCol = Math.max(bounds.deltaColMin, Math.min(bounds.deltaColMax, dragState.currentCol - anchorCol));
        const lastMouse = dragLastMouseRef.current;
        dragLastMouseRef.current = null;
        if (lastMouse) {
          const gridEl = gridWrapperRef.current;
          const scrollEl = scrollContainerRef?.current ?? (gridEl?.parentElement?.parentElement as HTMLDivElement | null) ?? null;
          if (gridEl) {
            const scrollLeft = scrollEl?.scrollLeft ?? 0;
            const scrollRect = scrollEl?.getBoundingClientRect() ?? gridEl.getBoundingClientRect();
            const gridRect = gridEl.getBoundingClientRect();
            const cursorLocalX = lastMouse.clientX - scrollRect.left + scrollLeft;
            const cursorLocalY = lastMouse.clientY - gridRect.top;
            const grabPointLocalX = cursorLocalX - dragState.anchorOffsetX;
            const col = Math.round(grabPointLocalX / COLUMN_WIDTH);
            const row = Math.floor(cursorLocalY / ROW_HEIGHT);
            let desiredRow = Math.max(0, Math.min(TEST_ROWS - 1, row));
            const note = notesRef.current.find((n) => n.id === dragState.noteId);
            const isFullHeightChord =
              note?.chordId &&
              notesRef.current.filter((n) => n.chordId === note.chordId).length === TEST_ROWS;
            if (isFullHeightChord) desiredRow = dragState.anchorRow;
            const desiredCol = Math.max(0, Math.min(totalColumns - 1, col));
            const rawDeltaRow = desiredRow - anchorRow;
            const rawDeltaCol = desiredCol - anchorCol;
            deltaRow = Math.max(bounds.deltaRowMin, Math.min(bounds.deltaRowMax, rawDeltaRow));
            deltaCol = Math.max(bounds.deltaColMin, Math.min(bounds.deltaColMax, rawDeltaCol));
          }
        }
        const isValidDrop =
          (deltaRow !== 0 || deltaCol !== 0);

        if (isValidDrop) {
          // Build the new notes array here so we use the delta we just computed (no closure).
          const prev = notesRef.current;
          const dropFootprint = new Map<number, [number, number][]>();
          for (const n of prev) {
            if (!notesToMoveIds.has(n.id)) continue;
            const newRow = Math.max(0, Math.min(TEST_ROWS - 1, n.row + deltaRow));
            const newStartCol = Math.max(
              0,
              Math.min(totalColumns - 1, n.startCol + deltaCol)
            );
            const span = n.endCol - n.startCol + 1;
            const newEndCol = Math.max(
              newStartCol,
              Math.min(totalColumns - 1, newStartCol + span - 1)
            );
            if (!dropFootprint.has(newRow)) dropFootprint.set(newRow, []);
            dropFootprint.get(newRow)!.push([newStartCol, newEndCol]);
          }
          for (const row of dropFootprint.keys()) {
            dropFootprint.set(row, mergeColumnRanges(dropFootprint.get(row)!));
          }

          // Disallow dropping moved notes onto any tuplet/rhythm-group cells (no partial or full replacement).
          let hasTupletOverlap = false;
          outerDropCheck: for (const [row, ranges] of dropFootprint.entries()) {
            for (const n of prev) {
              if (!n.rhythmGroupId || n.row !== row) continue;
              for (const [a, b] of ranges) {
                if (n.endCol >= a && n.startCol <= b) {
                  hasTupletOverlap = true;
                  break outerDropCheck;
                }
              }
            }
          }
          if (hasTupletOverlap) {
            // Cancel the drag: leave all notes (including tuplets) unchanged and clear selection.
            onNotesChange((prevNotes) =>
              prevNotes.map((n) => ({ ...n, selected: false }))
            );
            setSelectedCellRef.current(null);
            setDragState(null);
            return;
          }

          const brokenChordIds = new Set<string>();
          const result = prev.flatMap((n) => {
            if (notesToMoveIds.has(n.id)) {
              const newRow = Math.max(0, Math.min(TEST_ROWS - 1, n.row + deltaRow));
              const newStartCol = Math.max(
                0,
                Math.min(totalColumns - 1, n.startCol + deltaCol)
              );
              const span = n.endCol - n.startCol + 1;
              const newEndCol = Math.max(
                newStartCol,
                Math.min(totalColumns - 1, newStartCol + span - 1)
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
            // For tuplets / rhythm-group notes, disallow any partial carve by drag-drop.
            if (n.rhythmGroupId) {
              // If *every* column of this note is covered by some drop range, allow full removal.
              // Otherwise, leave the note completely unchanged.
              let fullyCovered = true;
              for (let c = n.startCol; c <= n.endCol; c += 1) {
                let covered = false;
                for (const [a, b] of dropRanges) {
                  if (c >= a && c <= b) {
                    covered = true;
                    break;
                  }
                }
                if (!covered) {
                  fullyCovered = false;
                  break;
                }
              }
              if (!fullyCovered) return [n];
              if (n.chordId) brokenChordIds.add(n.chordId);
              return [];
            }
            let intervals: [number, number][] = [[n.startCol, n.endCol]];
            for (const hole of dropRanges) {
              intervals = subtractRangeFromIntervals(intervals, hole);
            }
            if (intervals.length === 0) {
              if (n.chordId) brokenChordIds.add(n.chordId);
              return [];
            }
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
          const resultWithChordsCleared = result.map((n) =>
            n.chordId && brokenChordIds.has(n.chordId) ? { ...n, chordId: null } : n
          );
          applyMutationRef.current((_prev) => resultWithChordsCleared);
        } else {
          onNotesChange((prev) =>
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
            onNotesChange((prev) =>
              prev.map((n) => (n.id === note.id ? { ...n, selected: false } : n))
            );
          }
        }
      }
    };

    const clearMarqueeIfActive = () => {
      if (!marqueeActiveRef.current && !pendingMarqueeRef.current) return;
      marqueeActiveRef.current = false;
      pendingMarqueeRef.current = null;
      setMarqueeState(null);
      setMarqueePointerDownRef.current(false);
      setSelectedCell(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp, true);
    window.addEventListener('mouseleave', clearMarqueeIfActive);
    window.addEventListener('blur', clearMarqueeIfActive);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp, true);
      window.removeEventListener('mouseleave', clearMarqueeIfActive);
      window.removeEventListener('blur', clearMarqueeIfActive);
    };
  }, [dragState, resizeState, TEST_ROWS, totalColumns, getNoteVisualBounds]);

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
          let selected = prev.filter((n) => n.selected);
          // If nothing is selected yet, but a cell is active, treat +/- as acting on the note under that cell.
          if (selected.length === 0 && selectedCellRef.current) {
            const { row, col } = selectedCellRef.current;
            const noteAt =
              prev.find((n) => n.row === row && col >= n.startCol && col <= n.endCol) ?? null;
            if (noteAt) {
              selected = [noteAt];
            }
          }
          if (selected.length === 0) return prev;
          const expandedIds = expandSelectionWithChordMatesRef.current(
            prev,
            new Set(selected.map((n) => n.id))
          );
          return prev.map((n) => {
            if (!expandedIds.has(n.id)) return n;
            const newEndCol = Math.min(totalColumns - 1, n.endCol + 1);
            return { ...n, endCol: newEndCol };
          });
        });
        return;
      }
      if (key === '-') {
        e.preventDefault();
        if (e.repeat) return;
        applyMutationRef.current((prev) => {
          let selected = prev.filter((n) => n.selected);
          // If nothing is selected yet, but a cell is active, treat +/- as acting on the note under that cell.
          if (selected.length === 0 && selectedCellRef.current) {
            const { row, col } = selectedCellRef.current;
            const noteAt =
              prev.find((n) => n.row === row && col >= n.startCol && col <= n.endCol) ?? null;
            if (noteAt) {
              selected = [noteAt];
            }
          }
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
  }, [totalColumns]);

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
    if (marqueeState) {
      document.body.style.setProperty('cursor', 'crosshair', 'important');
      return () => {
        document.body.style.removeProperty('cursor');
      };
    }
  }, [resizeState, dragState, marqueeState]);

  return (
    <div className="flex flex-col flex-1 min-h-0 w-full">
    
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden ">
      <div
        className="flex shrink-0 border-b-4 border-border/60"
        style={{ height: GRID_FIXED_HEIGHT + GRID_SCROLLBAR_GAP }}
      >
        {/* Left: time signature + string labels (fixed, no horizontal scroll) */}
        <div
          className="shrink-0 flex flex-col border-r-6 border-border/60 pr-2 justify-start"
          style={{ width: STRING_LABEL_WIDTH }}
        >
          <div
            className="flex items-center justify-end text-muted-foreground text-xs font-medium"
            style={{ height: HEADER_ROW_HEIGHT }}
          >
            {timeSignature.num}/{timeSignature.denom}
          </div>
          {stringLabels.slice(0, TEST_ROWS).map((label, r) => (
            <div
              key={r}
              className="flex items-center justify-end text-muted-foreground text-xs font-medium"
              style={{ height: ROW_HEIGHT }}
            >
              {label}
            </div>
          ))}
        </div>
        {/* Right: scrollable bar numbers + grid (horizontal scroll only, scrollbar in gap below) */}
        <div
          ref={scrollContainerRef}
          className="grid-horizontal-scroll flex-1 min-w-0 overflow-x-auto overflow-y-hidden flex flex-col"
        >
          <div
            className="shrink-0"
            style={{ width: totalColumns * COLUMN_WIDTH, height: GRID_FIXED_HEIGHT }}
          >
            {/* Bar/measure numbers row with beat lines */}
            <div
              className="flex border-b border-border/60"
              style={{ height: HEADER_ROW_HEIGHT }}
            >
              {Array.from({ length: Math.ceil(totalColumns / subsPerBar) }, (_, i) => {
                const startCol = i * subsPerBar;
                const span = Math.min(subsPerBar, totalColumns - startCol);
                const timeSignatureId = `${timeSignature.num}/${timeSignature.denom}`;
                const beatsPerBar = getBeatsPerBarForDots(timeSignatureId);
                const subsPerBeat = Math.max(1, Math.floor(subsPerBar / beatsPerBar));
                return (
                  <div
                    key={i}
                    className="relative flex items-center justify-start text-muted-foreground text-md font-medium border-l-2 border-border/60 first:border-l-0"
                    style={{ width: span * COLUMN_WIDTH, minWidth: span * COLUMN_WIDTH }}
                  >
                    {/* Beat lines within the bar (lighter than bar boundary) */}
                    {beatsPerBar > 1 &&
                      Array.from({ length: beatsPerBar - 1 }, (_, b) => {
                        const beatCol = (b + 1) * subsPerBeat;
                        if (beatCol >= span) return null;
                        return (
                          <div
                            key={b}
                            className="absolute top-0 bottom-0 border-l-3 border-text-secondary/25 pointer-events-none"
                            style={{ left: beatCol * COLUMN_WIDTH }}
                            aria-hidden
                          />
                        );
                      })}
                    <span className="relative z-1 pl-1">{i + 1}</span>
                  </div>
                );
              })}
            </div>
      <div
        ref={gridWrapperRef}
        className={`relative select-none${dragState ? ' state-test-grid-cursor-grabbing' : ''}${resizeState ? ' state-test-grid-cursor-col-resize' : ''}${marqueeState ? ' state-test-grid-cursor-crosshair' : ''}`}
        style={{
          width: totalColumns * COLUMN_WIDTH,
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
        {/* Vertical beat lines (time signature beats within each bar) */}
        {(() => {
          const timeSignatureId = `${timeSignature.num}/${timeSignature.denom}`;
          const beatsPerBar = getBeatsPerBarForDots(timeSignatureId);
          const subsPerBeat = Math.max(1, Math.floor(subsPerBar / beatsPerBar));
          const beatCols: number[] = [];
          for (let c = subsPerBeat; c < totalColumns; c += subsPerBeat) {
            if (c % subsPerBar !== 0) beatCols.push(c);
          }
          return beatCols.map((c) => (
            <div
              key={`beat-${c}`}
              className="absolute top-0 bottom-0 border-l border-text-secondary/25 pointer-events-none"
              style={{ left: c * COLUMN_WIDTH }}
              aria-hidden
            />
          ));
        })()}
        {/* Vertical bar/measure lines */}
        {Array.from({ length: Math.floor(totalColumns / subsPerBar) + 1 }, (_, i) => {
          const c = i * subsPerBar;
          if (c > totalColumns) return null;
          return (
            <div
              key={`bar-${c}`}
              className="absolute top-0 bottom-0 border-l border-text-secondary/40 pointer-events-none"
              style={{ left: c * COLUMN_WIDTH }}
            />
          );
        })}
        {/* Playhead: vertical line at current playback column */}
        {activeColumnIndex >= 0 && activeColumnIndex < totalColumns && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-accent pointer-events-none z-10"
            style={{
              left: activeColumnIndex * COLUMN_WIDTH,
              boxShadow: '0 0 8px rgba(233,69,96,0.5)',
            }}
            aria-hidden
          />
        )}
        {/* SMuFL rest glyphs in tuplet gaps */}
        {tupletRestPositions.map((pos, i) => (
          <div
            key={`rest-${i}`}
            className="absolute pointer-events-none z-5 flex items-center justify-center text-muted-foreground"
            style={{
              left: pos.leftPx,
              top: pos.topPx,
              width: COLUMN_WIDTH,
              height: ROW_HEIGHT,
              fontFamily: 'Bravura',
              fontSize: 20,
            }}
            aria-label="Rest"
          >
            {'\uE4E7'}
          </div>
        ))}
        {/* Dot grid at intersections */}
        {Array.from({ length: TEST_ROWS + 1 }, (_, r) =>
          Array.from({ length: totalColumns + 1 }, (_, c) => (
            <div
              key={`dot-${r}-${c}`}
              className="absolute rounded-full bg-muted/80"
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

        {/* Drop targets: for rhythm groups always one 4-cell beat; otherwise one per note */}
        {dragState && !isInvalidDropPreview &&
          dragState.currentRow >= 0 &&
          dragState.currentCol >= 0 &&
          (dragState.currentRow !== dragState.anchorRow ||
            dragState.currentCol !== dragState.anchorCol) &&
          (() => {
            const anchorNote = notes.find((n) => n.id === dragState.noteId);
            const notesToShow =
              anchorNote?.rhythmGroupId
                ? notes.filter((n) => n.rhythmGroupId === anchorNote.rhythmGroupId)
                : notes.filter((n) => n.selected);
            const deltaRow = dragState.currentRow - dragState.anchorRow;
            const deltaCol = dragState.currentCol - dragState.anchorCol;
            const currentRow = Math.max(0, Math.min(TEST_ROWS - 1, dragState.anchorRow + deltaRow));

            if (anchorNote?.rhythmGroupId && notesToShow.length > 0) {
              const minStartCol = Math.min(...notesToShow.map((n) => n.startCol));
              const leftmostCol = Math.max(0, Math.min(totalColumns - 4, minStartCol + deltaCol));
              const cellsPerBeat = 4;
              const widthCols = Math.min(cellsPerBeat, totalColumns - leftmostCol);
              if (widthCols <= 0) return null;
              return (
                <div
                  key="rhythm-group-drop"
                  className="absolute border border-pink-100/20 bg-pink-400/20 pointer-events-none"
                  style={{
                    left: leftmostCol * COLUMN_WIDTH,
                    top: currentRow * ROW_HEIGHT,
                    width: widthCols * COLUMN_WIDTH,
                    height: ROW_HEIGHT,
                  }}
                  aria-hidden
                />
              );
            }

            return notesToShow.map((note) => {
              const newRow = Math.max(0, Math.min(TEST_ROWS - 1, note.row + deltaRow));
              const newStartCol = Math.max(
                0,
                Math.min(totalColumns - 1, note.startCol + deltaCol)
              );
              const span = note.endCol - note.startCol + 1;
              const newEndCol = Math.max(
                newStartCol,
                Math.min(totalColumns - 1, newStartCol + span - 1)
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
            });
          })()}

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
            gridTemplateColumns: `repeat(${totalColumns}, ${COLUMN_WIDTH}px)`,
            gridTemplateRows: `repeat(${TEST_ROWS}, ${ROW_HEIGHT}px)`,
          }}
        >
          {Array.from({ length: TEST_ROWS }, (_, r) =>
            Array.from({ length: totalColumns }, (_, c) => {
              const isHover = !isInvalidDropPreview && hover?.row === r && hover?.col === c;
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
          const anchorNote = dragState != null ? notes.find((n) => n.id === dragState.noteId) : null;
          const isDragging = dragState?.noteId === note.id;
          const chordIsBeingDragged =
            dragState != null &&
            (note.chordId != null
              ? notes.some(
                  (n) => n.id === dragState.noteId && n.chordId === note.chordId
                )
              : isDragging);
          const groupIsBeingDragged =
            dragState != null &&
            anchorNote?.rhythmGroupId != null &&
            note.rhythmGroupId === anchorNote.rhythmGroupId;
          const isInMultiSelectionBeingDragged =
            dragState != null &&
            notes.some((n) => n.id === note.id && n.selected);
          if (chordIsBeingDragged || groupIsBeingDragged || isInMultiSelectionBeingDragged) return null;
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
            const tupletGroup = note.rhythmGroupId ? tupletGroupsById.get(note.rhythmGroupId) : null;
            if (tupletGroup) {
              const span = note.rhythmGroupId ? tupletSpanFromNotes.get(note.rhythmGroupId) : null;
              const startCol = span?.startCol ?? tupletGroup.startSlot;
              const endCol = span?.endCol ?? tupletGroup.endSlot;
              const spanSlots = endCol - startCol + 1;
              const nNotes = tupletGroup.tupletRatio?.n ?? 3;
              const idx = note.indexInGroup ?? 0;
              const leftCol = startCol + (idx / nNotes) * spanSlots;
              const slotWidth = spanSlots / nNotes;
              leftPx = leftCol * COLUMN_WIDTH;
              widthPx = slotWidth * COLUMN_WIDTH;
            } else {
              leftPx = note.startCol * COLUMN_WIDTH;
              widthPx = (note.endCol - note.startCol + 1) * COLUMN_WIDTH;
            }
          }
          const hoveredNote =
            hover != null && !isInvalidDropPreview ? findNoteAt(hover.row, hover.col) : null;
          const isChordHovered =
            hoveredNote != null &&
            (hoveredNote.chordId != null
              ? note.chordId === hoveredNote.chordId
              : note.id === hoveredNote.id);
          const chipState = isResizing
            ? 'resizing'
            : note.selected
            ? isChordHovered && !isDragging && !isInvalidDropPreview
              ? 'selectedHover'
              : 'selected'
            : isChordHovered && !isDragging && !isInvalidDropPreview
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
              // When dragging and the current drop is invalid, suppress pointer/hover behavior
              // so chips don't show hover states under a disallowed drop.
              pointerEvents: isDragging || isInvalidDropPreview ? 'none' : 'auto',
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
                  {!note.rhythmGroupId && (
                    <>
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
                </>
              )}
            </div>
          );
        })}
        {/* Chord connector dots: centered on grid border between consecutive chord notes */}
        {(() => {
          const hoveredNote =
            hover != null && !isInvalidDropPreview ? findNoteAt(hover.row, hover.col) : null;
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
        {/* Tuplet connector: vertical line between consecutive notes in a group on the same row */}
        {tupletConnectorDots.map((d, i) => {
          const anchorNote = dragState != null ? notes.find((n) => n.id === dragState.noteId) : null;
          if (dragState != null) {
            // Hide connector dots for any tuplet group that is currently being dragged
            // (either as the anchor group or as part of the multi-selection).
            const selectedGroupIds = new Set(
              notes
                .filter((n) => n.selected && n.rhythmGroupId)
                .map((n) => n.rhythmGroupId as string)
            );
            if (
              anchorNote?.rhythmGroupId === d.rhythmGroupId ||
              selectedGroupIds.has(d.rhythmGroupId)
            ) {
              return null;
            }
          }
          const hoveredNote = hover != null ? findNoteAt(hover.row, hover.col) : null;
          const isGroupHovered =
            hoveredNote?.rhythmGroupId != null && hoveredNote.rhythmGroupId === d.rhythmGroupId;
          const lineWidth = 2;
          const lineHeight = ROW_HEIGHT;
          const dotClass = d.selected
            ? 'bg-cyan-400'
            : isGroupHovered
              ? 'bg-rose-400'
              : 'bg-pink-500/50';
          return (
            <div
              key={`tuplet-dot-${i}`}
              className={`absolute rounded-full pointer-events-none ${dotClass}`}
              style={{
                left: d.centerX - lineWidth / 2,
                top: d.centerY - lineHeight / 4,
                width: lineWidth,
                height: lineHeight/2,
              }}
            />
          );
        })}
        {dragGhost && dragState && (() => {
          const anchorNote = notes.find((n) => n.id === dragState.noteId);
          const selectedNow = notes.filter((n) => n.selected);
          const notesToMove =
            selectedNow.length > 1
              ? selectedNow
              : anchorNote?.rhythmGroupId
              ? notes.filter((n) => n.rhythmGroupId === anchorNote.rhythmGroupId)
              : selectedNow;
          if (notesToMove.length === 0) return null;
          const { anchorRow, anchorVisualLeftPx, anchorOffsetX, anchorOffsetY } = dragState;
          const pad = NOTE_CHIP_PADDING_PX;
          return (
            <div
              className="pointer-events-none fixed z-50"
              style={{
                left: dragGhost.clientX - anchorOffsetX,
                top: dragGhost.clientY - anchorOffsetY,
                position: 'fixed',
              }}
            >
              {notesToMove.map((n) => {
                const { leftPx, widthPx } = getNoteVisualBounds(n);
                const ghostWidthPx = Math.max(0, widthPx - 2 * pad);
                return (
                  <div
                    key={n.id}
                    className="absolute flex items-center justify-center"
                    style={{
                      left: leftPx - anchorVisualLeftPx,
                      top: (n.row - anchorRow) * ROW_HEIGHT,
                      padding: `${pad}px`,
                      height: ROW_HEIGHT,
                      minHeight: ROW_HEIGHT,
                      width: widthPx,
                    }}
                  >
                    <GridNoteChip
                      value={n.value}
                      slots={1}
                      widthPx={ghostWidthPx}
                      state="dragGhost"
                    />
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>
          </div>
        </div>
      </div>
      <div className="shrink-0 flex flex-wrap items-center gap-1 mt-2 p-4 mx-auto">
        <Button
          type="button"
          onClick={handleUndo}
          disabled={undoStack.length === 0}
          title="Undo"
          aria-label="Undo"
          size="lg"
          className="rounded-full"
        >
          <Undo2 className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          onClick={handleRedo}
          disabled={redoStack.length === 0}
          title="Redo"
          aria-label="Redo"
          size="lg"
          className="rounded-full"

        >
          <Redo2 className="w-4 h-4" />
        </Button>
        <ButtonGroup aria-label="Button group">
        <Button
          type="button"
          variant="secondary"
          onClick={handleCopy}
          disabled={!notes.some((n) => n.selected)}
          title="Copy"
          aria-label="Copy"
          size="lg"
        >
          <Copy className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={handleCut}
          disabled={!notes.some((n) => n.selected)}
          title="Cut"
          aria-label="Cut"
          size="lg"
        >
          <Scissors className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={handlePaste}
          disabled={!clipboard?.items?.length}
          title="Paste"
          aria-label="Paste"
          size="lg"
        >
          <ClipboardPaste className="w-4 h-4" />
        </Button>
        </ButtonGroup>
        <Button
          type="button"
          variant="secondary"
          onClick={handleCombineIntoChord}
          disabled={
            // Need at least 2 selected notes and none may belong to a rhythm group (e.g. tuplets)
            notes.filter((n) => n.selected).length < 2 ||
            notes.some((n) => n.selected && n.rhythmGroupId)
          }
          title="Combine into chord"
          aria-label="Combine into chord"
          size="lg"
        >
          <ListChevronsDownUp className="w-4 h-4" />
        </Button>
        <Button
          type="button" 
          variant="secondary"
          onClick={handleSplitIntoNotes}
          disabled={
            // Require at least one spanning note selected and disallow any rhythm-group notes.
            !notes.some((n) => n.selected && n.startCol < n.endCol) ||
            notes.some((n) => n.selected && n.rhythmGroupId)
          }
          title="Split into notes"
          aria-label="Split into notes"
          size="lg"
        >
          <SquareCenterlineDashedHorizontal className="w-4 h-4" />
        </Button>
        <Button
          type="button" 
          variant="secondary"
          onClick={onMakeTriplet}
          disabled={!canApplyTuplet || !onMakeTriplet}
          title="Make triplet (3 in 4)"
          aria-label="Make triplet"
          size="lg"
        >
          <svg
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="M14.38 16.24V5.669" />
  <path d="M7.25 17.79V7.5L21.5 3.84v10.29" />
  <circle cx="12" cy="16.24" r="2.38" />
  <circle cx="19.12" cy="14.13" r="2.38" />
  <circle cx="4.88" cy="17.79" r="2.38" />
</svg> Triplet
            </Button>
        <Button
          type="button" 
          variant="secondary"
          onClick={onMakeSextuplet}
          disabled={!canApplyTuplet || !onMakeSextuplet}
          title="Make sextuplet (6 in 4)"
          aria-label="Make sextuplet"
          size="lg"
        >
          <svg
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
> 
  <path d="M14.42 16.32V5.545" />
  <path d="m7.16 10.95 14.52-3.73" />
  <path d="M7.16 17.9V7.41l14.52-3.73v10.49" />
  <circle cx="12" cy="16.32" r="2.42" />
  <circle cx="19.26" cy="14.17" r="2.42" />
  <circle cx="4.74" cy="17.9" r="2.42" />
</svg> Sextuplet
        </Button>
        <Button
          type="button"   
          variant="secondary"
          onClick={handleClearAll}
          disabled={notes.length === 0}
          title="Clear all"
          aria-label="Clear all"
          size="lg"
          >
          <Trash2 className="w-4 h-4" />
        </Button>
      
      </div>
      <div className="text-sm text-muted-foreground max-w-3xl mx-auto"> 
        <div className="grid grid-cols-4 gap-2">
          <div className="col-span-2">
            <ul>
              <li>- click any cell an enter a note</li>
              <li>- drag and drop to move</li>
              <li>- shift click to select multiple notes</li>
              <li>- drag a note to resize notes</li>
              <li>- drag to select notes</li>
            </ul>
          </div>
          <div> 
          <p className="text-sm">
            <Kbd>⌘ + Z</Kbd>
          to undo
        </p>
        <p className="text-sm">
        <KbdGroup>
        <Kbd>⌘</Kbd>
        <span>+</span>
        <Kbd>C</Kbd> to copy
      </KbdGroup>
        </p>
            <ul>
              <li>cmd Z - to undo</li>
              <li>cmd shift Z - to redo</li>
              <li>cmd c - to copy</li>
              <li>cmd v - to paste</li>
              <li>cmd x - to cut</li>
            </ul>
          </div>
          <div>
          <p className="text-sm">
           <KbdGroup>
        <Kbd>+</Kbd>
        <Kbd>-</Kbd> change duration
        </KbdGroup>
        </p>
        C - to combine into chord
        S - to split into notes
      Delete - to delete
            </div>
        
      
      </div>
        </div>

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

export function Editor() {
  const list = getMergedRiffList();
  const [riffId, setRiffId] = useState<string>(list[0]?.id ?? '');
  const [riff, setRiffState] = useState<Riff | null>(null);
  const [gridNotes, setGridNotes] = useState<StateTestNote[]>(() => []);
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(100);
  const [metronomeOn, setMetronomeOn] = useState(true);

  const bars = riff?.lengthBars ?? 8;
  const subsPerBar = riff ? getSubsPerBar(riff) : 16;
  const totalColumns = bars * subsPerBar;
  const timeSignature = riff?.timeSignature ?? { num: 4, denom: 4 };

  const effectiveRiff = useMemo(
    () => ({
      ...defaultRiff('grid-phase1', 'Phrase'),
      notes: gridNotesToRiffNotes(gridNotes, bars, subsPerBar),
      rhythmGroups: riff?.rhythmGroups ?? [],
      lengthBars: bars,
      timeSignature,
      tempo: bpm,
    }),
    [gridNotes, riff?.rhythmGroups, bpm, bars, subsPerBar, timeSignature]
  );
  const {
    onTick: playbackOnTick,
    reset: playbackReset,
    getCurrentColumn,
    getActiveNoteIndex,
    activeNoteIndex,
    loopTicks,
  } = useRiffPlayback(effectiveRiff, bars);
  const gridScrollContainerRef = useRef<HTMLDivElement>(null);
  const [smoothColumn, setSmoothColumn] = useState(0);
  const getNoteInfo = useMemo(() => buildNoteLookup(effectiveRiff), [effectiveRiff]);
  const { playColumnWithDuration, stopAllSustained } = useNoteTones(isPlaying, 0.3, STANDARD_TUNING);
  const handleTick = useCallback(() => {
    if (!isPlaying) return;
    playbackOnTick();
    const slotIndex = getActiveNoteIndex();
    const column = getCurrentColumn();
    if (column) {
      const noteInfoPerString: { fret: number; duration: number; startSlot: number; onsetSlot?: number }[][] = [
        getNoteInfo(slotIndex, 0),
        getNoteInfo(slotIndex, 1),
        getNoteInfo(slotIndex, 2),
        getNoteInfo(slotIndex, 3),
        getNoteInfo(slotIndex, 4),
        getNoteInfo(slotIndex, 5),
      ];
      const slotDurationSec = timeSignature?.num != null && timeSignature.num > 0
        ? 60 / (bpm * Math.max(1, Math.round(subsPerBar / timeSignature.num)))
        : 60 / (bpm * 4);
      playColumnWithDuration(slotIndex, column, noteInfoPerString, slotDurationSec);
    }
  }, [isPlaying, playbackOnTick, getActiveNoteIndex, getCurrentColumn, getNoteInfo, playColumnWithDuration, bpm, subsPerBar, timeSignature]);
  const handleBeat = useCallback(() => {}, []);
  const handleCountIn = useCallback(() => {}, []);
  const timeSignatureId = `${timeSignature.num}/${timeSignature.denom}`;
  const metronomeSubdivision = timeSignature.num > 0 ? Math.max(1, Math.round(subsPerBar / timeSignature.num)) : 4;
  const { reset: metronomeReset } = useMetronome(
    bpm,
    metronomeSubdivision,
    isPlaying,
    handleBeat,
    handleTick,
    handleCountIn,
    metronomeOn ? 0.3 : 0,
    timeSignatureId,
    0
  );
  const handlePlayToggle = useCallback(() => {
    setIsPlaying((p) => {
      if (p) stopAllSustained();
      else resumeAudioContext(); // resume on Play so first tick has running context
      return !p;
    });
  }, [stopAllSustained]);
  const handleReset = useCallback(() => {
    stopAllSustained();
    playbackReset();
    metronomeReset();
    setSmoothColumn(0);
    gridScrollContainerRef.current?.scrollTo(0, 0);
  }, [playbackReset, metronomeReset, stopAllSustained]);

  useEffect(() => {
    if (isPlaying) setSmoothColumn(Math.max(0, activeNoteIndex));
  }, [isPlaying]);

  useEffect(() => {
    if (!isPlaying) stopAllSustained();
  }, [isPlaying, stopAllSustained]);

  useEffect(() => {
    // When totalColumns shrinks (e.g. bars/time signature change), apply a stricter rule:
    // - Notes fully beyond the new last column are removed.
    // - Notes that overlap the new end are truncated so endCol === lastCol, but startCol is preserved.
    // - Notes fully inside the new range are left untouched.
    setGridNotes((prev) => {
      const lastCol = Math.max(0, totalColumns - 1);
      return prev
        .map((n) => {
          // Drop notes that start entirely after the new last column
          if (n.startCol > lastCol) {
            return null;
          }
          const clampedEndCol = Math.min(n.endCol, lastCol);
          if (clampedEndCol < n.startCol) {
            return null;
          }
          return {
            ...n,
            endCol: clampedEndCol,
          };
        })
        .filter((n): n is StateTestNote => n !== null);
    });
  }, [totalColumns]);

  const PLAYHEAD_OFFSET_PX = 80;
  const handleAnimationFrame = useCallback(
    (deltaTime: number) => {
      if (!isPlaying || !gridScrollContainerRef.current) return;
      const secondsPerSubdivision = 60 / bpm / 4;
      const loop = loopTicks > 0 ? loopTicks : totalColumns;
      setSmoothColumn((prev) => {
        const next = prev + deltaTime / secondsPerSubdivision;
        if (next >= loop) return next - loop;
        return next;
      });
    },
    [isPlaying, bpm, loopTicks, totalColumns]
  );
  useAnimationLoop(handleAnimationFrame, isPlaying);

  useEffect(() => {
    if (!isPlaying || smoothColumn < 0) return;
    const el = gridScrollContainerRef.current;
    if (!el) return;
    const targetScroll = smoothColumn * COLUMN_WIDTH - PLAYHEAD_OFFSET_PX;
    el.scrollLeft = Math.max(0, Math.min(el.scrollWidth - el.clientWidth, targetScroll));
  }, [isPlaying, smoothColumn]);

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

  // Build editor grid from gridNotes so it matches the displayed grid; selection and canApplyTuplet stay in sync.
  const editorGrid = useMemo(() => {
    if (!riff) return [] as ReturnType<typeof notesToEditorGrid>;
    const notesFromGrid = gridNotesToRiffNotes(gridNotes, bars, subsPerBar);
    const riffWithGridNotes = { ...riff, notes: notesFromGrid };
    return notesToEditorGrid(riffWithGridNotes, bars);
  }, [riff, gridNotes, bars, subsPerBar]);

  // Enable triplet/sextuplet when selection touches exactly one note or one rhythm group.
  // Use gridNotes so a tuplet group (multiple notes, one rhythmGroupId) counts as one.
  const canApplyTuplet = useMemo(() => {
    if (selection.size === 0) return false;
    const overlappingNotes: StateTestNote[] = [];
    for (const key of selection) {
      const [sStr, slotStr] = key.split('-');
      const s = Number(sStr);
      const slot = Number(slotStr);
      if (!Number.isFinite(s) || !Number.isFinite(slot)) continue;
      for (const n of gridNotes) {
        if (n.row !== s) continue;
        if (slot >= n.startCol && slot <= n.endCol) {
          overlappingNotes.push(n);
          break;
        }
      }
    }
    if (overlappingNotes.length === 0) return false;
    const logicalIds = new Set<string>(
      overlappingNotes.map((n) => (n.rhythmGroupId != null && n.rhythmGroupId !== '' ? n.rhythmGroupId : n.id))
    );
    return logicalIds.size === 1;
  }, [selection, gridNotes]);

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
        const bars = normalized.lengthBars ?? 8;
        const subs = getSubsPerBar(normalized);
        setGridNotes(
          gridNotesToStateTestNotes(riffNotesToGridNotes(normalized.notes ?? [], bars, subs))
        );
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
    const { notes: newNotes, addedGroup } = combineDurationInSelection(
      riff,
      riff.notes ?? [],
      selection
    );
    const nextRiff: Riff = {
      ...riff,
      notes: newNotes,
      rhythmGroups: [...(riff.rhythmGroups ?? []), ...(addedGroup ? [addedGroup] : [])],
    };
    setRiffState(nextRiff);
    setGridNotes(
      gridNotesToStateTestNotes(riffNotesToGridNotes(nextRiff.notes, bars, subsPerBar))
    );
  }, [riff, selection, pushHistory, bars, subsPerBar]);

  const handleSplitDuration = useCallback(() => {
    if (!riff || selection.size === 0) return;
    pushHistory(riff);
    const newNotes = splitDurationToNotes(riff, riff.notes ?? [], selection);
    setRiffState({ ...riff, notes: newNotes });
    setSelection(new Set());
  }, [riff, selection, pushHistory]);

  const handleMakeTriplet = useCallback(() => {
    if (!riff || selection.size === 0) return;
    let minSlot = Infinity;
    const stringsInSelection = new Set<number>();
    for (const key of selection) {
      const [sStr, slotStr] = key.split('-');
      const s = Number(sStr);
      const slot = Number(slotStr);
      if (!Number.isFinite(s) || !Number.isFinite(slot)) continue;
      stringsInSelection.add(s);
      minSlot = Math.min(minSlot, slot);
    }
    if (minSlot === Infinity || stringsInSelection.size === 0) return;
    // Tuplet starts at selected note, spans 4 cells (one beat); can cross measures.
    const startSlot = minSlot;
    const endSlot = Math.min(minSlot + 3, totalColumns - 1);
    const alignedCellKeys = new Set<string>();
    for (const s of stringsInSelection) {
      for (let slot = startSlot; slot <= endSlot; slot++) alignedCellKeys.add(cellKey(s, slot));
    }
    pushHistory(riff);
    const baseNotes = gridNotesToRiffNotes(gridNotes, bars, subsPerBar);
    const baseRiff = { ...riff, notes: baseNotes };
    const { notes: newNotes, addedGroup } = makeTupletInSelection(
      baseRiff,
      baseRiff.notes,
      alignedCellKeys,
      { n: 3, d: 4 }
    );
    if (!addedGroup) return;
    const nextRiff: Riff = {
      ...riff,
      notes: newNotes,
      rhythmGroups: [...(riff.rhythmGroups ?? []), addedGroup],
    };
    setRiffState(nextRiff);
    setGridNotes(
      gridNotesToStateTestNotes(riffNotesToGridNotes(nextRiff.notes, bars, subsPerBar))
    );
  }, [riff, gridNotes, selection, pushHistory, bars, subsPerBar, totalColumns]);

  const handleMakeSextuplet = useCallback(() => {
    if (!riff || selection.size === 0) return;
    let minSlot = Infinity;
    const stringsInSelection = new Set<number>();
    for (const key of selection) {
      const [sStr, slotStr] = key.split('-');
      const s = Number(sStr);
      const slot = Number(slotStr);
      if (!Number.isFinite(s) || !Number.isFinite(slot)) continue;
      stringsInSelection.add(s);
      minSlot = Math.min(minSlot, slot);
    }
    if (minSlot === Infinity || stringsInSelection.size === 0) return;
    // Tuplet starts at selected note, spans 4 cells (one beat); can cross measures.
    const startSlot = minSlot;
    const endSlot = Math.min(minSlot + 3, totalColumns - 1);
    const alignedCellKeys = new Set<string>();
    for (const s of stringsInSelection) {
      for (let slot = startSlot; slot <= endSlot; slot++) alignedCellKeys.add(cellKey(s, slot));
    }
    pushHistory(riff);
    const baseNotes = gridNotesToRiffNotes(gridNotes, bars, subsPerBar);
    const baseRiff = { ...riff, notes: baseNotes };
    const { notes: newNotes, addedGroup } = makeTupletInSelection(
      baseRiff,
      baseRiff.notes,
      alignedCellKeys,
      { n: 6, d: 4 }
    );
    if (!addedGroup) return;
    const nextRiff: Riff = {
      ...riff,
      notes: newNotes,
      rhythmGroups: [...(riff.rhythmGroups ?? []), addedGroup],
    };
    setRiffState(nextRiff);
    setGridNotes(
      gridNotesToStateTestNotes(riffNotesToGridNotes(nextRiff.notes, bars, subsPerBar))
    );
  }, [riff, gridNotes, selection, pushHistory, bars, subsPerBar, totalColumns]);

  const handlePasteRhythmGroup = useCallback((group: RhythmGroup) => {
    setRiffState((r) => (r ? { ...r, rhythmGroups: [...(r.rhythmGroups ?? []), group] } : r));
  }, []);

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

      if (e.key === 't') {
        e.preventDefault();
        handleMakeTriplet();
        return;
      }

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
  }, [riff, selection, handleCellEdit, pushHistory, totalColumns, editorGrid, handleMakeTriplet]);

  if (!riff) {
    return (
      <div className="min-h-screen flex flex-col bg-background text-foreground p-6">
        <a href="#/" className="text-accent hover:underline mb-4">← Back</a>
        <p className="text-muted-foreground">No riff selected. Create one or pick from the list.</p>
        <div className="mt-4 flex gap-2">
          <select
            value={riffId}
            onChange={(e) => setRiffId(e.target.value)}
            className="bg-secondary border border-border rounded px-3 py-2"
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
      data-editor-section="editor-root"
      className="h-screen flex flex-col overflow-hidden overscroll-none bg-primary text-foreground"
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
        data-editor-section="editor-header"
        riff={riff}
        riffId={riffId}
        riffList={list}
        onRiffIdChange={setRiffId}
        onRiffChange={handleRiffChange}
        onNewRiff={handleNewRiff}
        isPlaying={isPlaying}
        onPlayToggle={handlePlayToggle}
        onReset={handleReset}
        onCopyAsJson={handleCopyAsJson}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={canUndo}
        canRedo={canRedo}
        isUnsaved={isUnsaved}
        showTabScroller={false}
        onShowTabScrollerChange={() => {}}
        showBackButton={false}
      />

      <main
        data-editor-section="editor-main"
        className="flex-1 min-h-0 flex flex-col py-4 pb-24 overflow-hidden overscroll-none"
      >
        <div
          data-editor-section="editor-grid-shell"
          className="flex flex-col flex-1 min-h-0 gap-4"
        >
          <div
            data-editor-section="editor-grid"
            className="flex flex-col flex-1 min-h-0"
          >
            <StateTestGrid
              totalColumns={totalColumns}
              subsPerBar={subsPerBar}
              timeSignature={timeSignature}
              stringLabels={getStringLabels(STANDARD_TUNING)}
              notes={gridNotes}
              onNotesChange={(updater) => setGridNotes((prev) => updater(prev))}
              rhythmGroups={riff?.rhythmGroups ?? []}
              selection={selection}
              onSelectionChange={setSelection}
              canApplyTuplet={canApplyTuplet}
              onMakeTriplet={handleMakeTriplet}
              onMakeSextuplet={handleMakeSextuplet}
              activeColumnIndex={isPlaying ? smoothColumn : -1}
              scrollContainerRef={gridScrollContainerRef}
              onPasteRhythmGroup={handlePasteRhythmGroup}
            />
          </div>
        </div>
      </main>

      <Footer
        bpm={bpm}
        onBpmChange={(value) => setBpm(value)}
        metronomeOn={metronomeOn}
        onMetronomeOnChange={(checked) => setMetronomeOn(!!checked)}
        isPlaying={isPlaying}
        onPlayToggle={handlePlayToggle}
        onReset={handleReset}
      />
    </div>
  );
}
