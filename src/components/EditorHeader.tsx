import { Play, Pause, ArrowLeftToLine, Copy, Undo2, Redo2, Metronome, Download, Upload } from 'lucide-react';
import { TIME_SIGNATURES } from '../data/exerciseTypes';
import { TUNINGS_LIST } from '../data/tunings';
import { NOTE_NAMES } from '../core/music';
import { Slider } from './ui/Slider';
import { Switch } from './ui/Switch';

const BAR_OPTIONS = [2, 4, 6, 8, 12];

const SCALE_OPTIONS = [
  { id: 'pentatonic', name: 'Pentatonic' },
  { id: 'major', name: 'Major' },
  { id: 'minor', name: 'Minor' },
  { id: 'blues', name: 'Blues' },
];

type Riff = import('../types/riff').Riff;

type EditorHeaderProps = {
  riff: Riff;
  riffId: string;
  riffList: { id: string; name: string }[];
  onRiffIdChange: (id: string) => void;
  onRiffChange: (updater: (prev: Riff) => Riff) => void;
  onNewRiff: () => void;
  isPlaying: boolean;
  onPlayToggle: () => void;
  onReset: () => void;
  onCopyAsJson: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  isUnsaved: boolean;
  metronomeVolume?: number;
  onMetronomeVolumeChange?: (value: number) => void;
  onExportFile?: () => void;
  onImportFile?: (file: File) => void;
  onInsertChordPreset?: () => void;
  showTabScroller: boolean;
  onShowTabScrollerChange: (value: boolean) => void;
};

export function EditorHeader({
  riff,
  riffId,
  riffList,
  onRiffIdChange,
  onRiffChange,
  onNewRiff,
  isPlaying,
  onPlayToggle,
  onReset,
  onCopyAsJson,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  isUnsaved,
  metronomeVolume = 0.3,
  onMetronomeVolumeChange,
  onExportFile,
  onImportFile,
  onInsertChordPreset,
  showTabScroller,
  onShowTabScrollerChange,
}: EditorHeaderProps) {
  const timeSignatureId = riff.timeSignature
    ? `${riff.timeSignature.num}/${riff.timeSignature.denom}`
    : '4/4';
  const bars = riff.lengthBars ?? 8;
  const bpm = riff.tempo ?? riff.bpmRange?.min ?? 100;
  const minBpm = riff.bpmRange?.min ?? 40;
  const maxBpm = riff.bpmRange?.max ?? 220;

  return (
    <header className="sticky top-0 z-10 bg-bg-secondary border-b border-bg-tertiary p-3 flex flex-wrap items-center gap-3">
      <a href="#/" className="text-accent hover:underline shrink-0">
        ← Back
      </a>
      <select
        value={riffId}
        onChange={(e) => onRiffIdChange(e.target.value)}
        className="bg-bg-tertiary border border-bg-tertiary rounded px-3 py-2 text-text-primary"
      >
        {riffList.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>
      <button
        onClick={onNewRiff}
        className="px-3 py-2 rounded bg-bg-tertiary hover:bg-bg-tertiary/80 text-sm"
      >
        New riff
      </button>
      <input
        type="text"
        value={riff.name}
        onChange={(e) => onRiffChange((p) => ({ ...p, name: e.target.value }))}
        className="bg-bg-tertiary border border-bg-tertiary rounded px-3 py-2 max-w-[200px]"
        placeholder="Riff name"
      />
      <span
        className="text-xs text-text-secondary shrink-0"
        title={isUnsaved ? 'Unsaved changes' : 'Saved'}
      >
        {isUnsaved ? 'Unsaved' : 'Saved'}
      </span>
      <div className="flex items-center gap-2 text-sm">
        <span className="text-text-secondary">Time</span>
        <select
          value={timeSignatureId}
          onChange={(e) => {
            const [num, denom] = e.target.value.split('/').map(Number);
            onRiffChange((p) => ({ ...p, timeSignature: { num, denom } }));
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
          onChange={(e) => {
            const v = Number(e.target.value) || 2;
            onRiffChange((p) => ({ ...p, lengthBars: v }));
          }}
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
          min={minBpm}
          max={maxBpm}
          value={bpm}
          onChange={(e) => {
            const v = Number(e.target.value) || 100;
            onRiffChange((p) => ({ ...p, tempo: v }));
          }}
          className="w-14 bg-bg-tertiary border rounded px-2 py-1 text-right"
        />
      </div>
      <div className="flex items-center gap-2 text-sm">
        <span className="text-text-secondary">Key</span>
        <select
          value={riff.key ?? 'A'}
          onChange={(e) => onRiffChange((p) => ({ ...p, key: e.target.value }))}
          className="bg-bg-tertiary border rounded px-2 py-1"
        >
          {NOTE_NAMES.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-2 text-sm">
        <span className="text-text-secondary">Scale</span>
        <select
          value={riff.scale ?? 'pentatonic'}
          onChange={(e) => onRiffChange((p) => ({ ...p, scale: e.target.value }))}
          className="bg-bg-tertiary border rounded px-2 py-1"
        >
          {SCALE_OPTIONS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-2 text-sm">
        <span className="text-text-secondary">Tuning</span>
        <select
          value={riff.tuningId ?? 'standard'}
          onChange={(e) => onRiffChange((p) => ({ ...p, tuningId: e.target.value }))}
          className="bg-bg-tertiary border rounded px-2 py-1"
        >
          {TUNINGS_LIST.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>
      <button
        onClick={onCopyAsJson}
        className="flex items-center gap-2 px-3 py-2 rounded bg-bg-tertiary hover:bg-bg-tertiary/80 text-sm"
        title="Copy riff as JSON to clipboard (paste into a preset file)"
      >
        <Copy size={16} />
        Copy as JSON
      </button>
      {onExportFile && (
        <button
          onClick={onExportFile}
          className="flex items-center gap-2 px-3 py-2 rounded bg-bg-tertiary hover:bg-bg-tertiary/80 text-sm"
          title="Download riff as JSON file"
        >
          <Download size={16} />
          Export
        </button>
      )}
      {onImportFile && (
        <>
          <input
            type="file"
            accept=".json,application/json"
            className="hidden"
            id="editor-import-riff"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onImportFile(file);
              e.target.value = '';
            }}
          />
          <label
            htmlFor="editor-import-riff"
            className="flex items-center gap-2 px-3 py-2 rounded bg-bg-tertiary hover:bg-bg-tertiary/80 text-sm cursor-pointer"
            title="Import riff from JSON file"
          >
            <Upload size={16} />
            Import
          </label>
        </>
      )}
      {onInsertChordPreset && (
        <button
          onClick={onInsertChordPreset}
          className="px-3 py-2 rounded bg-bg-tertiary hover:bg-bg-tertiary/80 text-sm"
          title="Insert chord preset at current position"
        >
          Chord+
        </button>
      )}
      {onUndo && onRedo && (
        <div className="flex gap-1">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className="p-2 rounded bg-bg-tertiary hover:bg-bg-tertiary/80 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 size={16} />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className="p-2 rounded bg-bg-tertiary hover:bg-bg-tertiary/80 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Redo (Ctrl+Shift+Z)"
          >
            <Redo2 size={16} />
          </button>
        </div>
      )}
      <div className="flex gap-2 items-center">
        <div className="flex items-center gap-1 text-xs text-text-secondary">
          <span>Tab Scroller</span>
          <Switch
            checked={showTabScroller}
            onCheckedChange={(v) => onShowTabScrollerChange(Boolean(v))}
          />
        </div>
        <button
          onClick={onReset}
          className="p-2 rounded-full bg-bg-tertiary hover:bg-bg-tertiary/80"
          title="Reset"
        >
          <ArrowLeftToLine size={18} />
        </button>
        {onMetronomeVolumeChange != null && (
          <div className="flex items-center gap-2">
            <Metronome size={18} className="text-text-secondary shrink-0" title="Metronome volume" />
            <Slider
              value={[metronomeVolume]}
              onValueChange={([v]) => onMetronomeVolumeChange(v)}
              min={0}
              max={1}
              step={0.05}
              className="w-20"
            />
          </div>
        )}
        <button
          onClick={onPlayToggle}
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
  );
}
