import { useState } from 'react';
import { Play, Pause, ArrowLeftToLine, Undo2, Redo2, Metronome, Download, Upload, Trash2 } from 'lucide-react';
import { TIME_SIGNATURES } from '../data/exerciseTypes';
import { Slider } from './ui/Slider';
import { Switch } from './ui/Switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/Select';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader as DialogHeaderUI, DialogTitle, DialogTrigger } from './ui/dialog';
import { Input } from './ui/input';
import { deleteUserRiff } from '../data/riffs/userRiffsStorage';

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
  onNewRiff: (name: string) => void;
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
  /** When false, hide the "← Back" link (e.g. when page uses fixed footer nav). Default true. */
  showBackButton?: boolean;
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
  showBackButton = true,
}: EditorHeaderProps) {
  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false);
  const [newRiffName, setNewRiffName] = useState('');
  const timeSignatureId = riff.timeSignature
    ? `${riff.timeSignature.num}/${riff.timeSignature.denom}`
    : '4/4';
  const bars = riff.lengthBars ?? 8;
  const bpm = riff.tempo ?? 100;
  const minBpm = 40;
  const maxBpm = 220;

  return (
    <header className="sticky top-0 z-10 bg-secondary border-b border-border p-3 flex flex-wrap items-center gap-3 bg-secondary">
      {showBackButton && (
        <a href="#/" className="text-accent hover:underline shrink-0">
          ← Back
        </a>
      )}
      <Select value={riffId} onValueChange={onRiffIdChange}>
        <SelectTrigger className="min-w-[200px]">
          <SelectValue placeholder="Select riff" />
        </SelectTrigger>
        <SelectContent>
          {riffList.map((r) => {
            const isUserRiff = r.id.startsWith('user-riff-');
            const isCurrent = r.id === riffId;
            const canDelete = isUserRiff && isCurrent;
            return (
              <SelectItem key={r.id} value={r.id}>
                <div className="flex items-center justify-between gap-2 w-full">
                  <span className="truncate">{r.name}</span>
                  <button
                    type="button"
                    className={`inline-flex items-center justify-center rounded p-0.5 ${
                      canDelete
                    ? 'text-muted-foreground hover:text-red-400'
                    : 'text-muted-foreground/40 cursor-default'
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!canDelete) return;
                      if (!window.confirm('Delete this riff from your library? This cannot be undone.')) return;
                      deleteUserRiff(r.id);
                      const remaining = riffList.filter((x) => x.id !== r.id);
                      const next = remaining[0];
                      onRiffIdChange(next ? next.id : '');
                    }}
                    aria-label={canDelete ? 'Delete riff' : undefined}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
      {/*}
      <Dialog
        open={isNewDialogOpen}
        onOpenChange={(open) => {
          setIsNewDialogOpen(open);
          if (open) setNewRiffName('');
        }}
      >
        
        <DialogTrigger
          render={
            <Button
              variant="outline"
              size="sm"
              className="rounded-full bg-muted text-sm"
            >
              New riff
            </Button>
          }
        />
        <DialogContent>
          <DialogHeaderUI>
            <DialogTitle>Create new riff</DialogTitle>
            <DialogDescription>Give your riff a name so you can find it later.</DialogDescription>
          </DialogHeaderUI>
          <div className="mt-2">
            <Input
              autoFocus
              placeholder="Riff name"
              value={newRiffName}
              onChange={(e) => setNewRiffName(e.target.value)}
            />
          </div>
          <DialogFooter className="mt-4 justify-end">
            <Button
              variant="outline"
              type="button"
              onClick={() => setIsNewDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                const name = newRiffName.trim() || 'New riff';
                onNewRiff(name);
                setIsNewDialogOpen(false);
              }}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      */}
      {/*}
      <span
        className="text-xs text-muted-foreground shrink-0"
        title={isUnsaved ? 'Unsaved changes' : 'Saved'}
      >
        {isUnsaved ? 'Unsaved' : 'Saved'}
      </span>
      */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Time</span>
        <Select
          value={timeSignatureId}
          onValueChange={(value) => {
            const [num, denom] = value.split('/').map(Number);
            onRiffChange((p) => ({ ...p, timeSignature: { num, denom } }));
          }}
        >
          <SelectTrigger size="sm" className="min-w-[80px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIME_SIGNATURES.map((ts) => (
              <SelectItem key={ts.id} value={ts.id}>
                {ts.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Bars</span>
        <Select
          value={String(bars)}
          onValueChange={(value) => {
            const v = Number(value) || 2;
            onRiffChange((p) => ({ ...p, lengthBars: v }));
          }}
        >
          <SelectTrigger size="sm" className="min-w-[72px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BAR_OPTIONS.map((b) => (
              <SelectItem key={b} value={String(b)}>
                {b}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {/*}
      <button
        onClick={onCopyAsJson}
        className="flex items-center gap-2 px-3 py-2 rounded bg-muted hover:bg-muted/80 text-sm"
        title="Copy riff as JSON to clipboard (paste into a preset file)"
      >
        <Copy size={16} />
        Copy as JSON
      </button>*/}
      {onExportFile && (
        <button
          onClick={onExportFile}
          className="flex items-center gap-2 px-3 py-2 rounded bg-muted hover:bg-muted/80 text-sm"
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
            className="flex items-center gap-2 px-3 py-2 rounded bg-muted hover:bg-muted/80 text-sm cursor-pointer"
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
          className="px-3 py-2 rounded bg-muted hover:bg-muted/80 text-sm"
          title="Insert chord preset at current position"
        >
          Chord+
        </button>
      )}
      {/*}
      {onUndo && onRedo && (
        <div className="flex gap-1">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className="p-2 rounded bg-muted hover:bg-muted/80 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 size={16} />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className="p-2 rounded bg-muted hover:bg-muted/80 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Redo (Ctrl+Shift+Z)"
          >
            <Redo2 size={16} />
          </button>
        </div>
      )}
      */}
      <div className="flex gap-2 items-center">
        {/*}
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <span>Tab Scroller</span>
          <Switch
            checked={showTabScroller}
            onCheckedChange={(v) => onShowTabScrollerChange(Boolean(v))}
          />
        </div>
        */}
        {onMetronomeVolumeChange != null && (
          <div className="flex items-center gap-2">
            <Metronome size={18} className="text-muted-foreground shrink-0" />
            <Slider
              value={[metronomeVolume]}
              onValueChange={(vals) => {
                const v = Array.isArray(vals) ? vals[0] : vals;
                onMetronomeVolumeChange(v);
              }}
              min={0}
              max={1}
              step={0.05}
              className="w-20"
            />
          </div>
        )}
      
      </div>
    </header>
  );
}
