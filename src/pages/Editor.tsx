import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { TabDisplay, COLUMN_WIDTH, INITIAL_SCROLL } from '../components/TabDisplay';
import { EditorHeader } from '../components/EditorHeader';
import { GridTimeline } from '../components/GridTimeline';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from '../components/ui/context-menu';
import { getEditorChordPresets, type ChordPreset } from '../data/editorChordPresets';
import { useMetronome } from '../hooks/useMetronome';
import { useAnimationLoop } from '../hooks/useAnimationLoop';
import { useNoteTones } from '../hooks/useNoteTones';
import { useRiffPlayback } from '../hooks/useRiffPlayback';
import { useRiffHistory } from '../hooks/useRiffHistory';
import { getSubdivisionsPerBar, getSubdivisionsPerBeat } from '../core/exercise';
import { getRiff, getMergedRiffList } from '../data/riffs';
import { saveUserRiff, nextUserRiffId } from '../data/riffs/userRiffsStorage';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { TUNINGS, STANDARD_TUNING } from '../data/tunings';
import { getStringLabels } from '../core/music';
import type { Riff } from '../types/riff';
import { notesToGrid, gridToNotes, applyCellUpdateToNotes, applyDurationResizeToNotes, type RiffGrid } from '../core/riffGrid';
import { extractDurationSpansFromNotes, durationSpansToCellKeys } from '../core/gridSpans';

function defaultRiff(id: string, name = 'New riff'): Riff {
  return {
    id,
    name,
    timeSignature: { num: 4, denom: 4 },
    tempo: 100,
    bpmRange: { min: 60, max: 120 },
    lengthBars: 8,
    tuningId: 'standard',
    key: 'A',
    scale: 'pentatonic',
    style: 'user',
    notes: [],
  };
}

export function Editor() {
  const list = getMergedRiffList();
  const [riffId, setRiffId] = useState<string>(list[0]?.id ?? '');
  const [riff, setRiffState] = useState<Riff | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentBeat, setCurrentBeat] = useState(-1);
  const [countIn, setCountIn] = useState(0);
  const [scrollPosition, setScrollPosition] = useState(INITIAL_SCROLL);
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState<string>('');
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [chordCells, setChordCells] = useState<Set<string>>(new Set());
  const [editorClipboard, setEditorClipboard] = useState<
    | { type: 'selection'; notes: { string: number; fret: number; bar: number; subdivision: number }[] }
    | { type: 'riff'; riff: Riff }
    | null
  >(null);
  const [metronomeVolume, setMetronomeVolume] = useLocalStorage('guitar-hero-editor-metronome-volume', 0.3);
  const [showTabScroller, setShowTabScroller] = useState(false);
  const chordPresets = useMemo<ChordPreset[]>(() => getEditorChordPresets(), []);

  const dragRef = useRef<{ startX: number; startScroll: number }>({ startX: 0, startScroll: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { push: pushHistory, undo, redo, clear: clearHistory, canUndo, canRedo } = useRiffHistory(riff ?? null);

  const bars = riff?.lengthBars ?? 8;
  const tuning = (riff?.tuningId && TUNINGS[riff.tuningId as keyof typeof TUNINGS]?.semitones)
    ? TUNINGS[riff.tuningId as keyof typeof TUNINGS].semitones
    : STANDARD_TUNING;
  const stringLabels = getStringLabels(tuning);

  // Sync riff from selection or new; reset scroll/playback when switching riffs
  useEffect(() => {
    if (riffId) {
      const r = getRiff(riffId);
      if (r) {
        const normalized = {
          ...r,
          lengthBars: r.lengthBars ?? 8,
          tempo: r.tempo ?? r.bpmRange?.min ?? 100,
          tuningId: r.tuningId ?? 'standard',
          key: r.key ?? 'A',
          scale: r.scale ?? 'pentatonic',
        };
        setRiffState(normalized);
        setLastSavedSnapshot(JSON.stringify(normalized));
      } else setRiffState(null);
    } else setRiffState(null);
    setScrollPosition(INITIAL_SCROLL);
    clearHistory();
    setChordCells(new Set());
  }, [riffId, clearHistory]);

  // Debounced autosave (500ms) and save status
  useEffect(() => {
    if (!riff) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveUserRiff(riff);
      setLastSavedSnapshot(JSON.stringify(riff));
      saveTimeoutRef.current = null;
    }, 500);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [riff]);

  const isUnsaved = riff !== null && JSON.stringify(riff) !== lastSavedSnapshot;
  const effectiveBpm = riff?.tempo ?? riff?.bpmRange?.min ?? 100;

  const subsPerBar = riff && riff.timeSignature ? getSubdivisionsPerBar(riff.timeSignature) : 16;
  const totalColumns = bars * subsPerBar;
  const grid: RiffGrid = useMemo(() => (riff ? notesToGrid(riff, bars) : []), [riff, bars]);

  // Duration cells from notes only (durationSubdivisions > 1). Adjacent same-fret notes stay separate until combined.
  const durationCells = useMemo(
    () =>
      riff?.notes && subsPerBar
        ? durationSpansToCellKeys(extractDurationSpansFromNotes(riff.notes, subsPerBar))
        : new Set<string>(),
    [riff?.notes, subsPerBar]
  );

  const selectionType: 'horizontal' | 'vertical' | 'grid' | 'none' = useMemo(() => {
    if (!selection.size) return 'none';
    let minString = Infinity;
    let maxString = -Infinity;
    let minSlot = Infinity;
    let maxSlot = -Infinity;
    selection.forEach((key) => {
      const [sStr, slotStr] = key.split('-');
      const s = Number(sStr);
      const slot = Number(slotStr);
      if (!Number.isFinite(s) || !Number.isFinite(slot)) return;
      if (s < minString) minString = s;
      if (s > maxString) maxString = s;
      if (slot < minSlot) minSlot = slot;
      if (slot > maxSlot) maxSlot = slot;
    });
    if (!Number.isFinite(minString) || !Number.isFinite(minSlot)) return 'none';
    if (minString === maxString) return 'horizontal';
    if (minSlot === maxSlot) return 'vertical';
    return 'grid';
  }, [selection]);

  // (Duration styling now derived from grid via durationCells useMemo above; no useEffect.)

  const hasCombineTypeOverlap = useMemo(() => {
    if (!selection.size) return false;
    let overlap = false;
    selection.forEach((key) => {
      if (chordCells.has(key) || durationCells.has(key)) {
        overlap = true;
      }
    });
    return overlap;
  }, [selection, chordCells, durationCells]);

  const canConvertDurationSelection = useMemo(() => {
    if (!selection.size) return false;
    if (selectionType !== 'horizontal') return false;
    // All selected cells must currently be duration cells
    let allDuration = true;
    selection.forEach((key) => {
      if (!durationCells.has(key)) {
        allDuration = false;
      }
    });
    return allDuration;
  }, [selection, selectionType, durationCells]);

  const updateCell = useCallback(
    (stringIndex: number, slotIndex: number, value: number | null) => {
      if (!riff) return;
      pushHistory(riff);
      const v = value === null ? null : Math.max(0, Number(value));
      const newNotes = applyCellUpdateToNotes(
        riff,
        riff.notes ?? [],
        stringIndex,
        slotIndex,
        Number.isFinite(v) ? v : null
      );
      setRiffState({ ...riff, notes: newNotes });
    },
    [riff, pushHistory]
  );

  const handleMoveNote = useCallback(
    (fromString: number, fromSlot: number, toString: number, toSlot: number) => {
      if (!riff) return;
      const fromKey = `${fromString}-${fromSlot}`;
      // If dragging from inside a duration group with no explicit multi-selection,
      // treat the entire contiguous duration run as the selection to move.
      let effectiveSelection: Set<string> = selection;
      if (durationCells.has(fromKey) && selection.size <= 1) {
        const next = new Set<string>();
        // Walk left/right from the anchor along this string to find the full run.
        let start = fromSlot;
        let end = fromSlot;
        while (start - 1 >= 0 && durationCells.has(`${fromString}-${start - 1}`)) {
          start -= 1;
        }
        while (end + 1 < grid[fromString].length && durationCells.has(`${fromString}-${end + 1}`)) {
          end += 1;
        }
        for (let slot = start; slot <= end; slot += 1) {
          next.add(`${fromString}-${slot}`);
        }
        effectiveSelection = next;
        // Visually update selection so the whole duration group is shown as moving
        setSelection(next);
      }

      const hasSelectionMove = effectiveSelection.size > 1 && effectiveSelection.has(fromKey);
      const nextGrid = grid.map((row) => [...row]);

      if (hasSelectionMove) {
        const deltaString = toString - fromString;
        const deltaSlot = toSlot - fromSlot;

        const nextChordCells = new Set(chordCells);
        const nextSelection = new Set<string>();

        // Clear all selected cells and remove chord styling
        effectiveSelection.forEach((key) => {
          const [sStr, slotStr] = key.split('-');
          const s = Number(sStr);
          const slot = Number(slotStr);
          if (!Number.isFinite(s) || !Number.isFinite(slot)) return;
          if (nextGrid[s]?.[slot] === undefined) return;
          nextGrid[s][slot] = null;
          nextChordCells.delete(key);
        });

        // Move each selected note by the same delta
        effectiveSelection.forEach((key) => {
          const [sStr, slotStr] = key.split('-');
          const s = Number(sStr);
          const slot = Number(slotStr);
          if (!Number.isFinite(s) || !Number.isFinite(slot)) return;
          const fret = grid[s]?.[slot];
          if (fret === null || fret === undefined) return;

          const ns = s + deltaString;
          const nslot = slot + deltaSlot;
          if (ns < 0 || ns >= nextGrid.length) return;
          if (nslot < 0 || nslot >= nextGrid[ns].length) return;

          nextGrid[ns][nslot] = Number(fret);

          const newKey = `${ns}-${nslot}`;
          nextSelection.add(newKey);
          if (chordCells.has(key)) nextChordCells.add(newKey);
        });

        pushHistory(riff);
        const notes = gridToNotes(riff, nextGrid);
        setRiffState({ ...riff, notes });
        setChordCells(nextChordCells);
        // durationCells are derived from grid; selection follows moved group
        if (nextSelection.size) {
          setSelection(nextSelection);
        } else {
          setSelection(new Set());
        }
      } else {
        const fret = grid[fromString]?.[fromSlot];
        if (fret === null || fret === undefined) return;
        pushHistory(riff);
        nextGrid[fromString][fromSlot] = null;
        nextGrid[toString][toSlot] = Number(fret);
        const notes = gridToNotes(riff, nextGrid);
        setRiffState({ ...riff, notes });
      }
    },
    [riff, grid, pushHistory, selection, chordCells, durationCells]
  );

  const handleRiffChangeFromHeader = useCallback(
    (updater: (prev: Riff) => Riff) => {
      setRiffState((prev) => {
        if (!prev) return prev;
        pushHistory(prev);
        return updater(prev);
      });
    },
    [pushHistory]
  );

  const handleNewRiff = () => {
    const id = nextUserRiffId();
    const r = defaultRiff(id);
    saveUserRiff(r);
    setRiffId(id);
    setRiffState(r);
    setLastSavedSnapshot(JSON.stringify(r));
  };

  const timeSignatureId = riff
    ? `${riff.timeSignature?.num ?? 4}/${riff.timeSignature?.denom ?? 4}`
    : '4/4';
  const effectiveSubdivision = riff?.timeSignature ? getSubdivisionsPerBeat(riff.timeSignature) : 4;
  const notesPerMeasureOverride = subsPerBar;

  const {
    tab,
    activeNoteIndex,
    onTick: exerciseOnTick,
    reset: exerciseReset,
    seek,
    getCurrentColumn,
    getActiveNoteIndex,
    loopTicks,
  } = useRiffPlayback(riff ?? undefined, bars);

  const scrollMax = INITIAL_SCROLL + (loopTicks > 0 ? loopTicks : totalColumns) * COLUMN_WIDTH;

  const handleScrollMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      if ((e.target as HTMLElement).closest('input')) return;
      e.preventDefault();
      dragRef.current = { startX: e.clientX, startScroll: scrollPosition };
      setIsDragging(true);
    },
    [scrollPosition]
  );

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent) => {
      const { startX, startScroll } = dragRef.current;
      const deltaX = e.clientX - startX;
      let newScroll = startScroll - deltaX;
      newScroll = Math.max(INITIAL_SCROLL, Math.min(scrollMax, newScroll));
      setScrollPosition(newScroll);
      const tickIndex = Math.floor((newScroll - INITIAL_SCROLL) / COLUMN_WIDTH);
      seek(Math.max(0, tickIndex));
    };
    const onUp = () => setIsDragging(false);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [isDragging, scrollMax, seek]);

  const handleBeat = useCallback((beat: number) => setCurrentBeat(beat), []);
  const handleCountIn = useCallback((remaining: number) => setCountIn(remaining), []);

  const { playColumn } = useNoteTones(isPlaying, 1, tuning);

  const handleTick = useCallback(() => {
    setCountIn(0);
    exerciseOnTick();
    const column = getCurrentColumn();
    const noteIndex = getActiveNoteIndex();
    if (noteIndex >= 0 && column) setScrollPosition(INITIAL_SCROLL + noteIndex * COLUMN_WIDTH);
    if (column) playColumn(column);
  }, [exerciseOnTick, getActiveNoteIndex, getCurrentColumn, playColumn]);

  const { reset: resetMetronome } = useMetronome(
    effectiveBpm,
    effectiveSubdivision,
    isPlaying,
    handleBeat,
    handleTick,
    handleCountIn,
    metronomeVolume,
    timeSignatureId,
    0
  );

  const handleAnimationFrame = useCallback(
    (deltaTime: number) => {
      if (activeNoteIndex < 0 || countIn > 0) return;
      const secondsPerBeat = 60 / effectiveBpm;
      const secondsPerNote = secondsPerBeat / effectiveSubdivision;
      const pixelsPerSecond = COLUMN_WIDTH / secondsPerNote;
      const loopWidth = (loopTicks > 0 ? loopTicks : tab.length) * COLUMN_WIDTH;
      setScrollPosition((prev) => {
        let newPos = prev + pixelsPerSecond * deltaTime;
        if (newPos >= loopWidth + INITIAL_SCROLL) newPos -= loopWidth;
        return newPos;
      });
    },
    [effectiveBpm, effectiveSubdivision, tab.length, loopTicks, activeNoteIndex, countIn]
  );

  useAnimationLoop(handleAnimationFrame, isPlaying);

  const handlePlayToggle = () => setIsPlaying((p) => !p);

  const handleCopyAsJson = useCallback(() => {
    if (!riff) return;
    const json = JSON.stringify(riff, null, 2);
    navigator.clipboard.writeText(json).catch(() => {});
  }, [riff]);

  const handleExportFile = useCallback(() => {
    if (!riff) return;
    const json = JSON.stringify(riff, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${riff.name.replace(/[^a-z0-9_-]/gi, '_') || 'riff'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [riff]);

  const handleImportFile = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const text = reader.result as string;
          const data = JSON.parse(text);
          if (!data || typeof data !== 'object' || !Array.isArray(data.notes)) return;
          const id = nextUserRiffId();
          const imported = {
            ...data,
            id,
            name: data.name || 'Imported',
            notes: Array.isArray(data.notes) ? data.notes : [],
            metadata: {
              createdAt: new Date().toISOString(),
              modifiedAt: new Date().toISOString(),
            },
            lengthBars: data.lengthBars ?? 8,
            tempo: data.tempo ?? 100,
            tuningId: data.tuningId ?? 'standard',
            key: data.key ?? 'A',
            scale: data.scale ?? 'pentatonic',
            timeSignature: data.timeSignature ?? { num: 4, denom: 4 },
            style: 'user',
          };
          saveUserRiff(imported);
          setRiffId(id);
          setRiffState(imported);
          setLastSavedSnapshot(JSON.stringify(imported));
          clearHistory();
        } catch {
          // ignore invalid file
        }
      };
      reader.readAsText(file);
    },
    [clearHistory]
  );

  const handleCopy = useCallback(() => {
    if (!riff) return;
    if (selection.size > 0) {
      const notes: { string: number; fret: number; bar: number; subdivision: number }[] = [];
      selection.forEach((key) => {
        const [s, slotStr] = key.split('-').map(Number);
        const slot = Number(slotStr);
        if (!Number.isFinite(s) || !Number.isFinite(slot)) return;
        const fret = grid[s]?.[slot];
        if (fret === null || fret === undefined) return;
        const bar = Math.floor(slot / subsPerBar) + 1;
        const subdivision = (slot % subsPerBar) + 1;
        notes.push({ string: s + 1, fret: Number(fret), bar, subdivision });
      });
      setEditorClipboard({ type: 'selection', notes });
    } else {
      setEditorClipboard({ type: 'riff', riff });
    }
  }, [riff, selection, grid, subsPerBar]);

  const handlePaste = useCallback(() => {
    if (!riff || !editorClipboard) return;
    if (editorClipboard.type === 'selection') {
      const pastedNotes = editorClipboard.notes;
      if (pastedNotes.length === 0) return;
      // Prefer current grid selection as paste target; fall back to playback index
      let targetSlot = 0;
      let targetBaseString = 1;
      if (selection.size > 0) {
        let minSelSlot = Infinity;
        let minSelString = Infinity;
        selection.forEach((key) => {
          const [sStr, slotStr] = key.split('-');
          const s = Number(sStr);
          const slot = Number(slotStr);
          if (Number.isFinite(slot) && slot < minSelSlot) minSelSlot = slot;
          if (Number.isFinite(s) && s < minSelString) minSelString = s;
        });
        if (minSelSlot !== Infinity) targetSlot = minSelSlot;
        if (minSelString !== Infinity) targetBaseString = minSelString + 1; // strings are 1-based in notes
        else if (activeNoteIndex >= 0) targetSlot = activeNoteIndex;
      } else if (activeNoteIndex >= 0) {
        targetSlot = activeNoteIndex;
      }
      // Find source anchor (top-left of copied block)
      let minSourceSlot = Infinity;
      let minSourceString = Infinity;
      pastedNotes.forEach((n) => {
        const slot = (n.bar - 1) * subsPerBar + (n.subdivision - 1);
        if (slot < minSourceSlot) minSourceSlot = slot;
        if (n.string < minSourceString) minSourceString = n.string;
      });
      if (minSourceSlot === Infinity || minSourceString === Infinity) return;
      const newNotes = pastedNotes
        .map((n) => {
          const sourceSlot = (n.bar - 1) * subsPerBar + (n.subdivision - 1);
          const deltaSlot = sourceSlot - minSourceSlot;
          const deltaString = n.string - minSourceString;
          const newSlot = Math.max(0, targetSlot + deltaSlot);
          const newString = targetBaseString + deltaString;
          if (newString < 1 || newString > 6) return null;
          const bar = Math.floor(newSlot / subsPerBar) + 1;
          const subdivision = (newSlot % subsPerBar) + 1;
          return { string: newString, fret: n.fret, bar, subdivision };
        })
        .filter((n): n is { string: number; fret: number; bar: number; subdivision: number } => n !== null);
      if (!newNotes.length) return;
      pushHistory(riff);
      setRiffState({ ...riff, notes: [...riff.notes, ...newNotes] });
    } else if (editorClipboard.type === 'riff') {
      const data = editorClipboard.riff;
      const imported = {
        ...data,
        id: nextUserRiffId(),
        name: (data.name || 'Imported') + ' (copy)',
        metadata: { createdAt: new Date().toISOString(), modifiedAt: new Date().toISOString() },
        lengthBars: data.lengthBars ?? riff.lengthBars ?? 8,
        tempo: data.tempo ?? riff.tempo ?? 100,
      };
      saveUserRiff(imported);
      setRiffId(imported.id);
      setRiffState(imported);
      setLastSavedSnapshot(JSON.stringify(imported));
    }
  }, [riff, editorClipboard, activeNoteIndex, subsPerBar, pushHistory, selection]);

  const handleDeleteSelected = useCallback(() => {
    if (!riff || selection.size === 0) return;
    pushHistory(riff);
    const nextGrid = grid.map((row) => [...row]);
    selection.forEach((key) => {
      const [s, slot] = key.split('-').map(Number);
      if (Number.isFinite(s) && Number.isFinite(slot)) nextGrid[s]![slot] = null;
    });
    const notes = gridToNotes(riff, nextGrid);
    setRiffState({ ...riff, notes });
    // Clear any chord styling that covered deleted cells (duration is derived from grid)
    if (chordCells.size) {
      const nextChord = new Set(chordCells);
      selection.forEach((key) => nextChord.delete(key));
      setChordCells(nextChord);
    }
    setSelection(new Set());
  }, [riff, grid, selection, pushHistory, chordCells]);

  const handleCut = useCallback(() => {
    handleCopy();
    handleDeleteSelected();
  }, [handleCopy, handleDeleteSelected]);

  const handleCombineDuration = useCallback(() => {
    if (!riff || selectionType !== 'horizontal' || selection.size === 0) return;
    // Disallow combining when any selected cell already has a chord/duration type
    let hasOverlap = false;
    selection.forEach((key) => {
      if (chordCells.has(key) || durationCells.has(key)) {
        hasOverlap = true;
      }
    });
    if (hasOverlap) return;
    pushHistory(riff);
    const nextGrid = grid.map((row) => [...row]);
    // Persist duration styling for these cells (grid already has the run; durationCells derive from grid)
    // So we only need to ensure the grid has the run - it does from selection. So just update notes.
    setRiffState({ ...riff, notes: gridToNotes(riff, nextGrid) });
  }, [riff, selectionType, selection.size, grid, pushHistory, selection, chordCells, durationCells]);

  const handleCombineChord = useCallback(() => {
    if (!riff || selectionType !== 'vertical' || selection.size === 0) return;
    // Disallow combining when any selected cell already has a chord/duration type
    let hasOverlap = false;
    selection.forEach((key) => {
      if (chordCells.has(key) || durationCells.has(key)) {
        hasOverlap = true;
      }
    });
    if (hasOverlap) return;
    pushHistory(riff);
    const nextGrid = grid.map((row) => [...row]);
    // Nothing special structurally: multiple strings at same slot already form a chord.
    // We just preserve the grid and round-trip.
    const notes = gridToNotes(riff, nextGrid);
    setRiffState({ ...riff, notes });
    // Persist chord styling for these cells
    setChordCells((prev) => new Set([...prev, ...selection]));
  }, [riff, selectionType, selection.size, grid, pushHistory, selection, chordCells, durationCells]);

  const handleResizeDuration = useCallback(
    (stringIndex: number, anchorSlot: number, targetSlot: number) => {
      if (!riff) return;
      const totalSlots = grid[0]?.length ?? 0;
      if (totalSlots === 0) return;

      // Determine which strings to affect:
      // - Always include the string we dragged from
      // - If there's a vertical selection at the anchor column, include those strings too
      const stringsToResize = new Set<number>();
      stringsToResize.add(stringIndex);
      selection.forEach((key) => {
        const [sStr, slotStr] = key.split('-');
        const s = Number(sStr);
        const slot = Number(slotStr);
        if (!Number.isFinite(s) || !Number.isFinite(slot)) return;
        if (slot === anchorSlot) stringsToResize.add(s);
      });

      pushHistory(riff);
      let currentNotes = riff.notes ?? [];
      const nextSelection = new Set<string>();

      stringsToResize.forEach((s) => {
        const fret = grid[s]?.[anchorSlot];
        if (fret === null || fret === undefined) return;
        const { notes: nextNotes, selection: sel } = applyDurationResizeToNotes(
          riff,
          currentNotes,
          s,
          anchorSlot,
          targetSlot,
          totalSlots
        );
        currentNotes = nextNotes;
        sel.forEach((k) => nextSelection.add(k));
      });

      setRiffState({ ...riff, notes: currentNotes });
      setSelection(nextSelection);
    },
    [riff, grid, selection, pushHistory]
  );

  const handleConvertDurationToNotes = useCallback(() => {
    if (!riff || !selection.size) return;
    // Break duration by clearing all but the first slot of each run so grid has single-cell notes.
    pushHistory(riff);
    const nextGrid = grid.map((row) => [...row]);
    const seen = new Set<string>();
    selection.forEach((key) => {
      const [sStr, slotStr] = key.split('-');
      const s = Number(sStr);
      const slot = Number(slotStr);
      if (!Number.isFinite(s) || !Number.isFinite(slot)) return;
      if (!durationCells.has(key)) return;
      const runKey = `${s}-${slot}`;
      if (seen.has(runKey)) return;
      // Find run extent on this string
      let start = slot;
      while (start - 1 >= 0 && durationCells.has(`${s}-${start - 1}`)) start -= 1;
      let end = slot;
      while (end + 1 < nextGrid[s].length && durationCells.has(`${s}-${end + 1}`)) end += 1;
      for (let c = start; c <= end; c += 1) seen.add(`${s}-${c}`);
      // Keep first slot, clear the rest of the run
      for (let c = start + 1; c <= end; c += 1) nextGrid[s][c] = null;
    });
    const notes = gridToNotes(riff, nextGrid);
    setRiffState({ ...riff, notes });
    setSelection(new Set());
  }, [riff, grid, selection, durationCells, pushHistory]);

  const handleInsertChordPreset = useCallback(() => {
    if (!riff || !chordPresets.length) return;
    const preset = chordPresets[0]; // simple: first preset (Open E) for now
    const targetSlot = Math.max(0, activeNoteIndex ?? 0);
    const subsPerBar = riff.timeSignature ? getSubdivisionsPerBar(riff.timeSignature) : 16;
    const bar = Math.floor(targetSlot / subsPerBar) + 1;
    const subdivision = (targetSlot % subsPerBar) + 1;
    const newNotes = [...riff.notes];
    preset.frets.forEach((fret, stringIndex) => {
      if (fret === null || fret === undefined) return;
      newNotes.push({
        string: stringIndex + 1,
        fret,
        bar,
        subdivision,
      });
    });
    pushHistory(riff);
    setRiffState({ ...riff, notes: newNotes });
    // Mark inserted chord column as chord cells
    const newChordCells = new Set(chordCells);
    preset.frets.forEach((fret, stringIndex) => {
      if (fret === null || fret === undefined) return;
      newChordCells.add(`${stringIndex}-${targetSlot}`);
    });
    setChordCells(newChordCells);
  }, [riff, chordPresets, activeNoteIndex, pushHistory, chordCells]);

  const handleReset = () => {
    setIsPlaying(false);
    setScrollPosition(INITIAL_SCROLL);
    setCurrentBeat(-1);
    setCountIn(0);
    exerciseReset();
    resetMetronome();
  };

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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.('input') || (e.target as HTMLElement)?.closest?.('select')) return;
      if (e.code === 'Space') {
        e.preventDefault();
        handlePlayToggle();
        return;
      }
      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        handleDeleteSelected();
        return;
      }
      if (e.metaKey || e.ctrlKey) {
        if (e.key === 'z') {
          e.preventDefault();
          if (e.shiftKey) handleRedo();
          else handleUndo();
          return;
        }
        if (e.key === 'y' && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          handleRedo();
          return;
        }
        if (e.key === 'c') {
          e.preventDefault();
          handleCopy();
          return;
        }
        if (e.key === 'v') {
          e.preventDefault();
          handlePaste();
          return;
        }
        if (e.key === 'x') {
          e.preventDefault();
          handleCut();
          return;
        }
      }
      // If a single cell is selected and a number key is pressed, populate that cell
      if (!e.metaKey && !e.ctrlKey && selection.size === 1) {
        const selKey = Array.from(selection)[0];
        const [sStr, slotStr] = selKey.split('-');
        const s = Number(sStr);
        const slot = Number(slotStr);
        if (Number.isFinite(s) && Number.isFinite(slot)) {
          if (e.key >= '0' && e.key <= '9') {
            e.preventDefault();
            const value = Number(e.key);
            updateCell(s, slot, value);
            return;
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePlayToggle, handleDeleteSelected, handleUndo, handleRedo, handleCopy, handlePaste, handleCut, selection, updateCell]);

  if (!riff) {
    return (
      <div className="min-h-screen flex flex-col bg-bg-primary text-text-primary p-6">
        <a href="#/" className="text-accent hover:underline mb-4">
          ← Back
        </a>
        <p className="text-text-secondary">No riff selected. Create one or pick from the list.</p>
        <div className="flex gap-2 mt-4">
          <select
            value=""
            onChange={(e) => setRiffId(e.target.value)}
            className="bg-bg-secondary border border-bg-tertiary rounded px-3 py-2"
          >
            <option value="">Select riff…</option>
            {list.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <button
            onClick={handleNewRiff}
            className="px-4 py-2 rounded bg-accent text-white font-medium"
          >
            New riff
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-bg-primary text-text-primary">
      <EditorHeader
        riff={riff}
        riffId={riffId}
        riffList={list}
        onRiffIdChange={setRiffId}
        onRiffChange={handleRiffChangeFromHeader}
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
        metronomeVolume={metronomeVolume}
        onMetronomeVolumeChange={setMetronomeVolume}
        onExportFile={handleExportFile}
        onImportFile={handleImportFile}
        onInsertChordPreset={handleInsertChordPreset}
        showTabScroller={showTabScroller}
        onShowTabScrollerChange={setShowTabScroller}
      />

      <div className="flex-1 flex flex-col p-4">
        <ContextMenu>
          <ContextMenuTrigger>
            <div>
              <GridTimeline
                grid={grid}
                totalColumns={totalColumns}
                subsPerBar={subsPerBar}
                scrollPosition={scrollPosition}
                isDragging={isDragging}
                onScrollMouseDown={handleScrollMouseDown}
                onUpdateCell={updateCell}
                onMoveNote={handleMoveNote}
                selection={selection}
                onSelectionChange={setSelection}
                selectionType={selectionType === 'none' ? 'grid' : selectionType}
                chordCells={chordCells}
                durationCells={durationCells}
                onResizeDuration={handleResizeDuration}
              />
              <div className="mt-3 flex items-start justify-between gap-4">
                <details className="text-xs text-text-secondary bg-bg-secondary/60 border border-bg-tertiary/60 rounded px-3 py-2 max-w-[60%]">
                  <summary className="cursor-pointer font-medium text-text-primary mb-1">
                    Debug: duration / selection
                  </summary>
                  <div className="mt-1 space-y-1">
                    <div>
                      <span className="font-semibold">Selection type:</span>{' '}
                      <span>{selectionType}</span>
                    </div>
                    <div>
                      <span className="font-semibold">Selected cells:</span>{' '}
                      <span className="break-all">
                        {Array.from(selection).sort().join(', ') || '—'}
                      </span>
                    </div>
                    <div>
                      <span className="font-semibold">Duration cells:</span>{' '}
                      <span className="break-all">
                        {Array.from(durationCells).sort().join(', ') || '—'}
                      </span>
                    </div>
                    <div>
                      <span className="font-semibold">Grid size:</span>{' '}
                      <span>
                        strings {grid.length} × slots {grid[0]?.length ?? 0}
                      </span>
                    </div>
                  </div>
                </details>
                <button
                  type="button"
                  onClick={() => {
                    if (!riff) return;
                    if (!riff.notes?.length) return;
                    pushHistory(riff);
                    setRiffState({ ...riff, notes: [] });
                    setSelection(new Set());
                    setChordCells(new Set());
                  }}
                  className="px-3 py-1.5 rounded border border-bg-tertiary/70 text-xs text-text-secondary hover:bg-bg-secondary/70 hover:text-text-primary transition-colors"
                >
                  Clear all notes
                </button>
              </div>
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem onClick={handleCut} disabled={!selection.size}>
              Cut
              <ContextMenuShortcut>⌘X</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem onClick={handleCopy} disabled={!selection.size}>
              Copy
              <ContextMenuShortcut>⌘C</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem onClick={handlePaste}>
              Paste
              <ContextMenuShortcut>⌘V</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem onClick={handleDeleteSelected} disabled={!selection.size}>
              Clear
              <ContextMenuShortcut>⌫</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem
              disabled={selectionType !== 'horizontal' || hasCombineTypeOverlap}
              onClick={handleCombineDuration}
            >
              Combine (duration)
            </ContextMenuItem>
            <ContextMenuItem
              disabled={selectionType !== 'vertical' || hasCombineTypeOverlap}
              onClick={handleCombineChord}
            >
              Combine as chord
            </ContextMenuItem>
            <ContextMenuItem
              disabled={!canConvertDurationSelection}
              onClick={handleConvertDurationToNotes}
            >
              Convert to notes
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
        <section>
          {showTabScroller && (
            <div
              className="select-none rounded overflow-hidden"
              style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
              onMouseDown={handleScrollMouseDown}
            >
              <TabDisplay
                tab={tab}
                scrollPosition={scrollPosition}
                scrollMode={true}
                showBeatIndicator={false}
                currentBeat={currentBeat}
                countIn={countIn}
                activeNoteIndex={activeNoteIndex}
                subdivision={effectiveSubdivision}
                timeSignatureId={timeSignatureId}
                notesPerMeasureOverride={notesPerMeasureOverride}
                loopTicks={loopTicks}
                tuning={tuning}
              />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

