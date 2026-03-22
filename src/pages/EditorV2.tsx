/**
 * Editor.tsx — Riff editor, v2 rebuild.
 *
 * Data flow:
 *   Load:  riff.notes[] → useGridEditor.loadFromNoteEvents() → gridNotes[]  (once on riff change)
 *   Edit:  all operations mutate gridNotes[] only via useGridEditor
 *   Flush: gridNotes[] → useGridEditor.toNoteEvents() → riff.notes[]
 *            - on save (debounced 500ms after any change)
 *            - for playback (useMemo of effectiveRiff)
 *
 * The riff object is NEVER read during an edit operation. It is only:
 *   - Loaded from on riff switch
 *   - Written to on flush
 *   - Passed to EditorHeader for metadata display
 */

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { EditorHeader } from '../components/EditorHeader';
import { GridEditor, COL_W, NUM_ROWS } from '../components/GridEditor';
import { Footer } from '../components/Footer';
import { Button } from '../components/ui/button';
import { ButtonGroup } from '../components/ui/button-group';
import { Undo2, Redo2, Copy, Scissors, ClipboardPaste, CopyPlus, Trash2, ListChevronsDownUp, ListChevronsUpDown } from 'lucide-react';
import { Triplet, Sextuplet } from '../components/icons/CustomIcons';
import { useGridEditor } from '../hooks/useGridEditor';
import { useRiffPlayback } from '../hooks/useRiffPlayback';
import { useNoteTones } from '../hooks/useNoteTones';
import { useMetronome } from '../hooks/useMetronome';
import { useAnimationLoop } from '../hooks/useAnimationLoop';
import { resumeAudioContext } from '../core/audio';
import { buildNoteLookup } from '../core/exercise';
import { getRiff, getMergedRiffList } from '../data/riffs';
import { saveUserRiff, nextUserRiffId } from '../data/riffs/userRiffsStorage';
import { getStringLabels } from '../core/music';
import { STANDARD_TUNING } from '../data/tunings';
import { getSubsPerBar } from '../core/gridEditorModel';
import { getBeatsPerBarForDots } from '../data/exerciseTypes';
import { retoggleTuplet } from '../core/gridEngine';
import type { Riff, RhythmGroup } from '../types/riff';

const PLAYHEAD_OFFSET_PX = 80;

function shiftRhythmGroups(groups: RhythmGroup[], groupIds: Set<string>, deltaCol: number): RhythmGroup[] {
  return groups.map(g =>
    groupIds.has(g.id) ? { ...g, startSlot: g.startSlot + deltaCol, endSlot: g.endSlot + deltaCol } : g
  );
}

function defaultRiff(id: string, name = 'New Riff'): Riff {
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

export function EditorV2() {
  const list = getMergedRiffList();

  // ── Riff metadata (lightweight: only metadata, not note data) ────────────
  const [riffId, setRiffId] = useState<string>(list[0]?.id ?? '');
  const [riff, setRiff] = useState<Riff | null>(null);
  const [rhythmGroups, setRhythmGroups] = useState<RhythmGroup[]>([]);

  // ── Grid editor — owns all note state ────────────────────────────────────
  const editor = useGridEditor();

  useEffect(() => { editor.setRhythmGroups(rhythmGroups); }, [rhythmGroups, editor]);

  // ── Playback ──────────────────────────────────────────────────────────────
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(100);
  const [metronomeOn, setMetronomeOn] = useState(true);
  const [smoothColumn, setSmoothColumn] = useState(0);
  const gridScrollContainerRef = useRef<HTMLDivElement>(null);

  // Derived riff shape: flush gridNotes → NoteEvents for playback
  const bars = riff?.lengthBars ?? 8;
  const subsPerBar = riff ? getSubsPerBar(riff) : 16;
  const totalColumns = bars * subsPerBar;
  const timeSignature = riff?.timeSignature ?? { num: 4, denom: 4 };

  const effectiveRiff = useMemo((): Riff => ({
    ...defaultRiff(riff?.id ?? 'draft', riff?.name ?? 'Draft'),
    notes: editor.toNoteEvents(subsPerBar),
    rhythmGroups,
    lengthBars: bars,
    timeSignature,
    tempo: bpm,
  }), [editor, riff, rhythmGroups, bars, subsPerBar, timeSignature, bpm]);

  const {
    onTick: playbackOnTick,
    reset: playbackReset,
    getCurrentColumn,
    getActiveNoteIndex,
    activeNoteIndex,
    loopTicks,
  } = useRiffPlayback(effectiveRiff, bars);

  const getNoteInfo = useMemo(() => buildNoteLookup(effectiveRiff), [effectiveRiff]);
  const { playColumnWithDuration, stopAllSustained } = useNoteTones(isPlaying, 0.3, STANDARD_TUNING);
  const lastColumnRef = useRef<number | null>(null);

  const handleTick = useCallback(() => {
    if (!isPlaying) return;
    playbackOnTick();
    const slotIndex = getActiveNoteIndex();
    const column = getCurrentColumn();
    if (typeof column === 'number') {
      const prevCol = lastColumnRef.current;
      if (prevCol != null && column < prevCol) stopAllSustained();
      const noteInfoPerString = Array.from({ length: 6 }, (_, s) => getNoteInfo(slotIndex, s));
      const slotDurationSec = 60 / (bpm * Math.max(1, Math.round(subsPerBar / timeSignature.num)));
      playColumnWithDuration(slotIndex, column, noteInfoPerString, slotDurationSec);
      lastColumnRef.current = column;
    }
  }, [isPlaying, playbackOnTick, getActiveNoteIndex, getCurrentColumn, getNoteInfo, playColumnWithDuration, stopAllSustained, bpm, subsPerBar, timeSignature]);

  const handleBeat = useCallback(() => {}, []);
  const handleCountIn = useCallback(() => {}, []);
  const timeSignatureId = `${timeSignature.num}/${timeSignature.denom}`;
  const metronomeSubdivision = timeSignature.num > 0 ? Math.max(1, Math.round(subsPerBar / timeSignature.num)) : 4;

  const { reset: metronomeReset } = useMetronome(
    bpm, metronomeSubdivision, isPlaying,
    handleBeat, handleTick, handleCountIn,
    metronomeOn ? 0.3 : 0,
    timeSignatureId, 0
  );

  const handlePlayToggle = useCallback(() => {
    setIsPlaying(p => {
      if (p) stopAllSustained();
      else resumeAudioContext();
      lastColumnRef.current = null;
      return !p;
    });
  }, [stopAllSustained]);

  const handleReset = useCallback(() => {
    stopAllSustained();
    playbackReset();
    metronomeReset();
    lastColumnRef.current = null;
    setSmoothColumn(0);
    gridScrollContainerRef.current?.scrollTo(0, 0);
  }, [playbackReset, metronomeReset, stopAllSustained]);

  // Smooth playhead scroll
  const handleAnimationFrame = useCallback((deltaTime: number) => {
    if (!isPlaying) return;
    const secondsPerSubdivision = 60 / bpm / 4;
    const loop = loopTicks > 0 ? loopTicks : totalColumns;
    setSmoothColumn(prev => {
      const next = prev + deltaTime / secondsPerSubdivision;
      return next >= loop ? next - loop : next;
    });
  }, [isPlaying, bpm, loopTicks, totalColumns]);
  useAnimationLoop(handleAnimationFrame, isPlaying);

  useEffect(() => {
    if (!isPlaying || smoothColumn < 0) return;
    const el = gridScrollContainerRef.current;
    if (!el) return;
    const targetScroll = smoothColumn * COL_W - PLAYHEAD_OFFSET_PX;
    el.scrollLeft = Math.max(0, Math.min(el.scrollWidth - el.clientWidth, targetScroll));
  }, [isPlaying, smoothColumn]);

  useEffect(() => {
    if (isPlaying) setSmoothColumn(Math.max(0, activeNoteIndex));
  }, [isPlaying]);

  useEffect(() => {
    if (!isPlaying) stopAllSustained();
  }, [isPlaying, stopAllSustained]);

  // ── Load riff → grid (only when riffId changes) ───────────────────────────

  useEffect(() => {
    const r = riffId ? getRiff(riffId) : null;
    if (r) {
      const normalized: Riff = {
        ...r,
        lengthBars: r.lengthBars ?? 8,
        tempo: r.tempo ?? 100,
      };
      setRiff(normalized);
      setRhythmGroups(normalized.rhythmGroups ?? []);
      const subs = getSubsPerBar(normalized);
      const cols = (normalized.lengthBars ?? 8) * subs;
      // ── LOAD: riff.notes → gridNotes (one-way, once) ──────────────────
      editor.loadFromNoteEvents(normalized.notes ?? [], subs, cols);
    } else {
      setRiff(null);
      setRhythmGroups([]);
      editor.loadFromNoteEvents([], 16, 128);
    }
  }, [riffId]); // intentionally NOT including editor — loadFromNoteEvents is stable

  // ── Flush: gridNotes → riff.notes (debounced, for save) ──────────────────

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!riff) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      // ── FLUSH: gridNotes → riff.notes ──────────────────────────────────
      const flushedNotes = editor.toNoteEvents(subsPerBar);
      const updatedRiff: Riff = { ...riff, notes: flushedNotes, rhythmGroups };
      saveUserRiff(updatedRiff);
    }, 500);
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, [editor.gridNotes, riff, rhythmGroups, subsPerBar]);

  // Clamp gridNotes when totalColumns shrinks
  useEffect(() => {
    editor.clampToColumns(totalColumns);
  }, [totalColumns]);

  // ── Riff metadata operations ───────────────────────────────────────────────

  const handleRiffChange = useCallback((updater: (prev: Riff) => Riff) => {
    setRiff(prev => prev ? updater(prev) : prev);
  }, []);

  const handleNewRiff = useCallback(() => {
    const id = nextUserRiffId();
    const r = defaultRiff(id);
    saveUserRiff(r);
    setRiffId(id);
  }, []);

  const handleCopyAsJson = useCallback(() => {
    if (!riff) return;
    const flushedNotes = editor.toNoteEvents(subsPerBar);
    const full: Riff = { ...riff, notes: flushedNotes, rhythmGroups };
    navigator.clipboard.writeText(JSON.stringify(full, null, 2));
  }, [riff, editor, subsPerBar, rhythmGroups]);

  // ── Rhythm group management ───────────────────────────────────────────────

  const handleNewRhythmGroup = useCallback((group: RhythmGroup) => {
    setRhythmGroups(prev => [...prev, group]);
  }, []);

  // ── Grid editor callbacks (stable, passed to GridEditor) ─────────────────

  const stringLabels = getStringLabels(STANDARD_TUNING);

  const handlePlaceNote = useCallback((row: number, col: number, fret: number) => {
    editor.placeNote(row, col, fret, totalColumns);
  }, [editor, totalColumns]);

  const handleClearCell = useCallback((row: number, col: number) => {
    editor.clearCell(row, col);
  }, [editor]);

  const handleUpdateFret = useCallback((id: string, fret: number) => {
    editor.updateFret(id, fret);
  }, [editor]);

  const handleSelectIds = useCallback((ids: Set<string>) => {
    editor.selectIds(ids);
  }, [editor]);

  const handleSelectRect = useCallback((minRow: number, maxRow: number, minCol: number, maxCol: number, append?: boolean) => {
    editor.selectRect(minRow, maxRow, minCol, maxCol, append);
  }, [editor]);

  const handleClearSelection = useCallback(() => {
    editor.clearSelection();
  }, [editor]);

  const handleDeleteSelected = useCallback(() => {
    editor.deleteSelected();
  }, [editor]);

  const handleMoveSelected = useCallback((deltaRow: number, deltaCol: number) => {
    editor.moveSelected(deltaRow, deltaCol, NUM_ROWS, totalColumns, subsPerBar);
    if (deltaCol !== 0) {
      const movedGroupIds = new Set<string>();
      for (const n of editor.gridNotes) {
        if (editor.selectedIds.has(n.id) && n.rhythmGroupId) movedGroupIds.add(n.rhythmGroupId);
      }
      if (movedGroupIds.size > 0) {
        const { col: appliedCol } = editor.getLastAppliedDelta();
        setRhythmGroups(prev => shiftRhythmGroups(prev, movedGroupIds, appliedCol));
      }
    }
  }, [editor, totalColumns, subsPerBar]);

  const handleResizeDuration = useCallback((id: string, newEndCol: number) => {
    editor.resizeDuration(id, newEndCol, totalColumns);
  }, [editor, totalColumns]);

  const handleCombineDuration = useCallback(() => {
    editor.combineDuration(totalColumns);
  }, [editor, totalColumns]);

  const handleSplitDuration = useCallback(() => {
    editor.splitDuration();
  }, [editor]);

  const handleGrowSelected = useCallback(() => {
    editor.growSelected(totalColumns);
  }, [editor, totalColumns]);

  const handleShrinkSelected = useCallback(() => {
    editor.shrinkSelected();
  }, [editor]);

  const handleDuplicateSelected = useCallback(() => {
    editor.duplicateSelected(totalColumns, rhythmGroups, handleNewRhythmGroup);
  }, [editor, totalColumns, rhythmGroups, handleNewRhythmGroup]);

  const handleMakeTriplet = useCallback(() => {
    editor.makeTuplet({ n: 3, d: 4 }, subsPerBar, timeSignature.num, handleNewRhythmGroup);
  }, [editor, subsPerBar, timeSignature.num, handleNewRhythmGroup]);

  const handleMakeSextuplet = useCallback(() => {
    editor.makeTuplet({ n: 6, d: 4 }, subsPerBar, timeSignature.num, handleNewRhythmGroup);
  }, [editor, subsPerBar, timeSignature.num, handleNewRhythmGroup]);

  const handleCopy = useCallback(() => { editor.copy(rhythmGroups); }, [editor, rhythmGroups]);
  const handleCut = useCallback(() => { editor.cut(rhythmGroups); }, [editor, rhythmGroups]);

  const handleToggleTuplet = useCallback(() => {
    const selectedNote = editor.gridNotes.find(
      n => editor.selectedIds.has(n.id) && n.rhythmGroupId
    );
    if (!selectedNote?.rhythmGroupId) return;
    const groupId = selectedNote.rhythmGroupId;
    const { notes: newNotes, rhythmGroups: newGroups } = retoggleTuplet(
      editor.gridNotes, rhythmGroups, groupId
    );
    editor.commitNotes(newNotes);
    setRhythmGroups(newGroups);
  }, [editor, rhythmGroups]);

  const handlePaste = useCallback((row: number, col: number) => {
    editor.paste(row, col, NUM_ROWS, totalColumns, handleNewRhythmGroup);
  }, [editor, totalColumns, handleNewRhythmGroup]);

  const handleUndo = useCallback(() => { editor.undo(); }, [editor]);
  const handleRedo = useCallback(() => { editor.redo(); }, [editor]);

  // ── No riff selected ──────────────────────────────────────────────────────

  if (!riff) {
    return (
      <div className="min-h-screen flex flex-col bg-background text-foreground p-6">
        <a href="#/" className="text-accent hover:underline mb-4">← Back</a>
        <p className="text-muted-foreground mb-4">No riff selected. Create one or pick from the list.</p>
        <div className="flex gap-2 flex-wrap">
          <select
            value={riffId}
            onChange={e => setRiffId(e.target.value)}
            className="bg-secondary border border-border rounded px-3 py-2"
          >
            {list.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <button
            className="bg-accent text-white px-4 py-2 rounded"
            onClick={handleNewRiff}
          >
            New Riff
          </button>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className="h-screen flex flex-col overflow-hidden overscroll-none bg-primary text-foreground"
      onMouseDown={e => {
        const target = e.target as HTMLElement;
        const inGrid = target.closest('[data-grid-editor]');
        const isInteractive =
          target.tagName === 'BUTTON' ||
          target.tagName === 'INPUT' ||
          target.tagName === 'SELECT' ||
          target.closest('button') ||
          target.closest('a');
        if (!inGrid && !isInteractive) {
          editor.clearSelection();
        }
      }}
    >
      {/* Sticky header */}
      <EditorHeader
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
        canUndo={editor.canUndo}
        canRedo={editor.canRedo}
        isUnsaved={true}
        showTabScroller={false}
        onShowTabScrollerChange={() => {}}
        showBackButton={false}
      />

      {/* Editor toolbar */}
      {(() => {
        const hasSelection = editor.selectedIds.size > 0;
        const hasTupletSelected = hasSelection && editor.gridNotes.some(
          n => editor.selectedIds.has(n.id) && n.rhythmGroupId
        );
        const canMakeTuplet = hasSelection && !hasTupletSelected;
        return (
          <div className="shrink-0 flex flex-wrap items-center gap-1 px-3 py-1.5 border-b border-border bg-secondary">
            <Button size="lg" onClick={handleUndo} disabled={!editor.canUndo} title="Undo (⌘Z)" aria-label="Undo">
              <Undo2 className="w-4 h-4" />
            </Button>
            <Button size="lg" onClick={handleRedo} disabled={!editor.canRedo} title="Redo (⌘⇧Z)" aria-label="Redo">
              <Redo2 className="w-4 h-4" />
            </Button>
            <ButtonGroup>
              <Button size="lg" variant="secondary" onClick={handleCut} disabled={!hasSelection} title="Cut (⌘X)" aria-label="Cut">
                <Scissors className="w-4 h-4" /><span className="text-[12px]">Cut</span>
              </Button>
              <Button size="lg" variant="secondary" onClick={handleCopy} disabled={!hasSelection} title="Copy (⌘C)" aria-label="Copy">
                <Copy className="w-4 h-4" /><span className="text-[12px]">Copy</span>
              </Button>
              <Button size="lg" variant="secondary" onClick={() => {
                const first = editor.gridNotes.find(n => editor.selectedIds.has(n.id));
                handlePaste(first?.row ?? 0, first?.startCol ?? 0);
              }} disabled={!editor.hasClipboard} title="Paste (⌘V)" aria-label="Paste">
                <ClipboardPaste className="w-4 h-4" /><span className="text-[12px]">Paste</span>
              </Button>
            </ButtonGroup>
            <Button size="lg" variant="secondary" onClick={handleDuplicateSelected} disabled={!hasSelection} title="Duplicate (⌘D)" aria-label="Duplicate">
              <CopyPlus className="w-4 h-4" /><span className="text-[12px]">Duplicate</span>
            </Button>
            <Button size="lg" variant="secondary" onClick={handleDeleteSelected} disabled={!hasSelection} title="Delete" aria-label="Delete">
              <Trash2 className="w-4 h-4" /><span className="text-[12px]">Delete</span>
            </Button>
            <Button size="lg" variant="secondary" onClick={() => editor.clearAll()} disabled={editor.gridNotes.length === 0} title="Clear all notes" aria-label="Clear all">
              <span className="text-[12px]">Clear all</span>
            </Button>
            <ButtonGroup>
              <Button size="lg" variant="secondary" onClick={handleCombineDuration} disabled={!hasSelection || hasTupletSelected} title="Combine duration (C)" aria-label="Combine">
                <ListChevronsDownUp className="w-4 h-4" /><span className="text-[12px]">Combine</span>
              </Button>
              <Button size="lg" variant="secondary" onClick={handleSplitDuration} disabled={!hasSelection || hasTupletSelected} title="Split duration (S)" aria-label="Split">
                <ListChevronsUpDown className="w-4 h-4" /><span className="text-[12px]">Split</span>
              </Button>
            </ButtonGroup>
            <ButtonGroup>
              <Button size="lg" variant="secondary" onClick={handleMakeTriplet} disabled={!canMakeTuplet} title="Make triplet" aria-label="Triplet">
                <Triplet className="w-4 h-4" /><span className="text-[12px]">Triplet</span>
              </Button>
              <Button size="lg" variant="secondary" onClick={handleMakeSextuplet} disabled={!canMakeTuplet} title="Make sextuplet" aria-label="Sextuplet">
                <Sextuplet className="w-4 h-4" /><span className="text-[12px]">Sextuplet</span>
              </Button>
              <Button size="lg" variant="secondary" onClick={handleToggleTuplet} disabled={!hasTupletSelected} title="Toggle triplet ↔ sextuplet (T)" aria-label="Toggle tuplet">
                <span className="text-[12px] font-mono">3↔6</span>
              </Button>
            </ButtonGroup>
          </div>
        );
      })()}

      {/* Grid scroll container */}
      <main className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <div
          ref={gridScrollContainerRef}
          className="flex-1 overflow-x-auto overflow-y-hidden grid-horizontal-scroll"
          data-grid-editor="scroll"
        >
          <div className="py-4 px-2" data-grid-editor="grid">
            <GridEditor
              totalColumns={totalColumns}
              subsPerBar={subsPerBar}
              timeSignature={timeSignature}
              stringLabels={stringLabels}
              gridNotes={editor.gridNotes}
              selectedIds={editor.selectedIds}
              rhythmGroups={rhythmGroups}
              activeColumnIndex={isPlaying ? Math.floor(smoothColumn) : -1}
              scrollContainerRef={gridScrollContainerRef}
              onPlaceNote={handlePlaceNote}
              onClearCell={handleClearCell}
              onUpdateFret={handleUpdateFret}
              onSelectIds={handleSelectIds}
              onSelectRect={handleSelectRect}
              onClearSelection={handleClearSelection}
              onDeleteSelected={handleDeleteSelected}
              onMoveSelected={handleMoveSelected}
              onResizeDuration={handleResizeDuration}
              onCombineDuration={handleCombineDuration}
              onSplitDuration={handleSplitDuration}
              onGrowSelected={handleGrowSelected}
              onShrinkSelected={handleShrinkSelected}
              onDuplicateSelected={handleDuplicateSelected}
              onMakeTriplet={handleMakeTriplet}
              onMakeSextuplet={handleMakeSextuplet}
              onToggleTuplet={handleToggleTuplet}
              onCopy={handleCopy}
              onCut={handleCut}
              onPaste={handlePaste}
              onUndo={handleUndo}
              onRedo={handleRedo}
            />
          </div>
        </div>
      </main>

      <Footer
        bpm={bpm}
        onBpmChange={setBpm}
        metronomeOn={metronomeOn}
        onMetronomeOnChange={checked => setMetronomeOn(!!checked)}
        isPlaying={isPlaying}
        onPlayToggle={handlePlayToggle}
        onReset={handleReset}
      />
    </div>
  );
}
