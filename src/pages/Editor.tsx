import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Play, Pause, ArrowLeftToLine, Copy } from 'lucide-react';
import { TabDisplay, COLUMN_WIDTH, INITIAL_SCROLL } from '../components/TabDisplay';
import { useMetronome } from '../hooks/useMetronome';
import { useAnimationLoop } from '../hooks/useAnimationLoop';
import { useNoteTones } from '../hooks/useNoteTones';
import { useRiffPlayback } from '../hooks/useRiffPlayback';
import { getSubdivisionsPerBar, getSubdivisionsPerBeat } from '../core/exercise';
import { getRiff, getMergedRiffList } from '../data/riffs';
import { saveUserRiff, nextUserRiffId } from '../data/riffs/userRiffsStorage';
import { TIME_SIGNATURES } from '../data/exerciseTypes';
import { TUNINGS, STANDARD_TUNING } from '../data/tunings';
import { getStringLabels } from '../core/music';
import type { Riff } from '../types/riff';
import { notesToGrid, gridToNotes, type RiffGrid } from '../core/riffGrid';

const BAR_OPTIONS = [2, 4, 6, 8, 12];

function defaultRiff(id: string, name = 'New riff'): Riff {
  return {
    id,
    name,
    timeSignature: { num: 4, denom: 4 },
    bpmRange: { min: 60, max: 120 },
    style: 'user',
    notes: [],
  };
}

export function Editor() {
  const list = getMergedRiffList();
  const [riffId, setRiffId] = useState<string>(list[0]?.id ?? '');
  const [riff, setRiffState] = useState<Riff | null>(null);
  const [bars, setBars] = useState<number>(8);
  const [bpm, setBpm] = useState<number>(100);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentBeat, setCurrentBeat] = useState(-1);
  const [countIn, setCountIn] = useState(0);
  const [scrollPosition, setScrollPosition] = useState(INITIAL_SCROLL);

  const dragRef = useRef<{ startX: number; startScroll: number }>({ startX: 0, startScroll: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const tuning = TUNINGS.standard?.semitones ?? STANDARD_TUNING;
  const stringLabels = getStringLabels(tuning);

  // Sync riff from selection or new; reset scroll/playback when switching riffs
  useEffect(() => {
    if (riffId) {
      const r = getRiff(riffId);
      if (r) setRiffState({ ...r });
      else setRiffState(null);
    } else setRiffState(null);
    setScrollPosition(INITIAL_SCROLL);
  }, [riffId]);

  const setRiff = useCallback(
    (updater: Riff | ((prev: Riff | null) => Riff | null)) => {
      setRiffState((prev) => {
        const next = typeof updater === 'function' ? (updater as (p: Riff | null) => Riff | null)(prev) : updater;
        if (!next) return prev;
        return next;
      });
    },
    []
  );

  // Autosave when riff changes
  useEffect(() => {
    if (riff) saveUserRiff(riff);
  }, [riff]);

  const subsPerBar = riff && riff.timeSignature ? getSubdivisionsPerBar(riff.timeSignature) : 16;
  const totalColumns = bars * subsPerBar;
  const grid: RiffGrid = useMemo(() => (riff ? notesToGrid(riff, bars) : []), [riff, bars]);

  const updateCell = useCallback(
    (stringIndex: number, slotIndex: number, value: number | null) => {
      if (!riff) return;
      const nextGrid = grid.map((row) => [...row]);
      const v = value === null ? null : Math.max(0, Number(value));
      nextGrid[stringIndex][slotIndex] = Number.isFinite(v) ? v : null;
      const notes = gridToNotes(riff, nextGrid);
      setRiff({ ...riff, notes });
    },
    [riff, grid, setRiff]
  );

  const handleNewRiff = () => {
    const id = nextUserRiffId();
    const r = defaultRiff(id);
    saveUserRiff(r);
    setRiffId(id);
    setRiffState(r);
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
    bpm,
    effectiveSubdivision,
    isPlaying,
    handleBeat,
    handleTick,
    handleCountIn,
    0,
    timeSignatureId,
    0
  );

  const handleAnimationFrame = useCallback(
    (deltaTime: number) => {
      if (activeNoteIndex < 0 || countIn > 0) return;
      const secondsPerBeat = 60 / bpm;
      const secondsPerNote = secondsPerBeat / effectiveSubdivision;
      const pixelsPerSecond = COLUMN_WIDTH / secondsPerNote;
      const loopWidth = (loopTicks > 0 ? loopTicks : tab.length) * COLUMN_WIDTH;
      setScrollPosition((prev) => {
        let newPos = prev + pixelsPerSecond * deltaTime;
        if (newPos >= loopWidth + INITIAL_SCROLL) newPos -= loopWidth;
        return newPos;
      });
    },
    [bpm, effectiveSubdivision, tab.length, loopTicks, activeNoteIndex, countIn]
  );

  useAnimationLoop(handleAnimationFrame, isPlaying);

  const handlePlayToggle = () => setIsPlaying((p) => !p);

  const handleCopyAsJson = useCallback(() => {
    if (!riff) return;
    const json = JSON.stringify(riff, null, 2);
    navigator.clipboard.writeText(json).catch(() => {});
  }, [riff]);

  const handleReset = () => {
    setIsPlaying(false);
    setScrollPosition(INITIAL_SCROLL);
    setCurrentBeat(-1);
    setCountIn(0);
    exerciseReset();
    resetMetronome();
  };

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
      <header className="sticky top-0 z-10 bg-bg-secondary border-b border-bg-tertiary p-3 flex flex-wrap items-center gap-3">
        <a href="#/" className="text-accent hover:underline shrink-0">
          ← Back
        </a>
        <select
          value={riffId}
          onChange={(e) => setRiffId(e.target.value)}
          className="bg-bg-tertiary border border-bg-tertiary rounded px-3 py-2 text-text-primary"
        >
          {list.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <button
          onClick={handleNewRiff}
          className="px-3 py-2 rounded bg-bg-tertiary hover:bg-bg-tertiary/80 text-sm"
        >
          New riff
        </button>
        <input
          type="text"
          value={riff.name}
          onChange={(e) => setRiff({ ...riff, name: e.target.value })}
          className="bg-bg-tertiary border border-bg-tertiary rounded px-3 py-2 max-w-[200px]"
          placeholder="Riff name"
        />
        <div className="flex items-center gap-2 text-sm">
          <span className="text-text-secondary">Time</span>
          <select
            value={timeSignatureId}
            onChange={(e) => {
              const [num, denom] = e.target.value.split('/').map(Number);
              setRiff({ ...riff, timeSignature: { num, denom } });
            }}
            className="bg-bg-tertiary border rounded px-2 py-1"
          >
            {TIME_SIGNATURES.map((ts) => (
              <option key={ts.id} value={ts.id}>
                {ts.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-text-secondary">Bars</span>
          <select
            value={bars}
            onChange={(e) => setBars(Number(e.target.value) || 2)}
            className="bg-bg-tertiary border rounded px-2 py-1"
          >
            {BAR_OPTIONS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-text-secondary">BPM</span>
          <input
            type="number"
            min={riff.bpmRange?.min ?? 40}
            max={riff.bpmRange?.max ?? 220}
            value={bpm}
            onChange={(e) => setBpm(Number(e.target.value) || 100)}
            className="w-14 bg-bg-tertiary border rounded px-2 py-1 text-right"
          />
        </div>
        <button
          onClick={handleCopyAsJson}
          className="flex items-center gap-2 px-3 py-2 rounded bg-bg-tertiary hover:bg-bg-tertiary/80 text-sm"
          title="Copy riff as JSON to clipboard (paste into a preset file)"
        >
          <Copy size={16} />
          Copy as JSON
        </button>
        <div className="flex gap-2 items-center">
          <button
            onClick={handleReset}
            className="p-2 rounded-full bg-bg-tertiary hover:bg-bg-tertiary/80"
            title="Reset"
          >
            <ArrowLeftToLine size={18} />
          </button>
          <button
            onClick={handlePlayToggle}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-accent text-white text-sm font-medium"
          >
            {isPlaying ? (
              <>
                <Pause size={18} /> Pause
              </>
            ) : (
              <>
                <Play size={18} /> Play
              </>
            )}
          </button>
        </div>
      </header>

      <div className="flex-1 flex flex-col p-4">
        <section className="mb-6">
          <div
            className="overflow-x-hidden rounded border border-bg-tertiary select-none"
            style={{ paddingLeft: INITIAL_SCROLL, cursor: isDragging ? 'grabbing' : 'grab' }}
            onMouseDown={handleScrollMouseDown}
          >
            <div
              className="transition-none"
              style={{
                width: totalColumns * COLUMN_WIDTH,
                transform: `translateX(-${Math.max(0, scrollPosition - INITIAL_SCROLL)}px)`,
              }}
            >
              <table className="border-collapse text-sm">
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
                      {grid[s]?.map((fret, col) => (
                        <td
                          key={col}
                          className={`p-0 ${col % subsPerBar === 0 ? 'border-l border-text-secondary/40' : ''}`}
                          style={{ width: COLUMN_WIDTH, minWidth: COLUMN_WIDTH }}
                        >
                          <input
                            type="text"
                            inputMode="numeric"
                            className="w-full text-center bg-bg-tertiary border border-bg-tertiary rounded py-1 text-accent font-mono focus:border-accent focus:outline-none box-border"
                            style={{
                              width: COLUMN_WIDTH - 4,
                              minWidth: COLUMN_WIDTH - 4,
                              maxWidth: COLUMN_WIDTH - 4,
                            }}
                            value={fret === null || fret === undefined ? '' : fret}
                            onChange={(e) => {
                              const v = e.target.value.trim();
                              const parsed = v === '' ? null : Number(v);
                              updateCell(s, col, Number.isFinite(parsed) ? parsed : null);
                            }}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section>
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
        </section>
      </div>
    </div>
  );
}

