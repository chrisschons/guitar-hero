import { Play, Pause, ArrowLeftToLine, Metronome } from 'lucide-react';
import { Slider } from './ui/Slider';
import { Switch } from './ui/Switch';

type FooterProps = {
  bpm?: number;
  onBpmChange?: (value: number) => void;
  metronomeOn?: boolean;
  onMetronomeOnChange?: (value: boolean) => void;
  isPlaying?: boolean;
  onPlayToggle?: () => void;
  onReset?: () => void;
  disableMetronome?: boolean;
  disableTransport?: boolean;
};

export function Footer({
  bpm,
  onBpmChange,
  metronomeOn,
  onMetronomeOnChange,
  isPlaying,
  onPlayToggle,
  onReset,
  disableMetronome,
  disableTransport,
}: FooterProps) {
  const showMetronome = !disableMetronome && bpm !== undefined && onBpmChange;
  const showTransport = !disableTransport && onPlayToggle;

  return (
    <footer className="fixed bottom-0 left-0 right-0 w-full border-t border-bg-tertiary bg-bg-secondary py-6 z-20">
      <div className="mx-auto px-5 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4 flex-wrap">
          {showMetronome && (
            <div className="flex items-center gap-2">
              <Metronome
                className={`h-5 w-5 shrink-0 ${
                  metronomeOn ? 'text-accent' : 'text-text-secondary'
                }`}
                aria-hidden
              />
              <Switch
                checked={!!metronomeOn}
                onCheckedChange={(checked) => onMetronomeOnChange?.(!!checked)}
                aria-label="Metronome click on or off"
                disabled={!onMetronomeOnChange}
              />
              <Slider
                defaultValue={[bpm]}
                onValueChange={(values) => {
                  if (!onBpmChange) return;
                  const value = Array.isArray(values) ? values[0] : bpm;
                  if (typeof value === 'number') onBpmChange(value);
                }}
                min={40}
                max={220}
                step={1}
                className="w-[100px]"
              />
              <span className="text-sm font-medium text-text-primary tabular-nums w-8 text-right">
                {bpm}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          {showTransport && (
            <>
              {onReset && (
                <button
                  onClick={onReset}
                  className="flex items-center justify-center p-2 rounded-full bg-bg-tertiary text-text-primary cursor-pointer transition-all hover:bg-bg-tertiary/80"
                  title="Reset to start"
                  aria-label="Reset to start"
                >
                  <ArrowLeftToLine size={18} />
                </button>
              )}
              <button
                onClick={onPlayToggle}
                className="flex items-center gap-2 px-5 py-2 rounded-full bg-accent text-white text-sm font-medium cursor-pointer transition-all hover:bg-accent-light disabled:opacity-50 disabled:cursor-default"
                disabled={!onPlayToggle}
              >
                {isPlaying ? (
                  <>
                    <Pause size={18} />
                    <span>Pause</span>
                  </>
                ) : (
                  <>
                    <Play size={18} />
                    <span>Play</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>

        <div className="flex items-center gap-4 flex-wrap justify-end text-xs">
          <a href="#/" className="text-accent hover:text-accent-light transition-colors">
            Home
          </a>
          <a href="#/scales" className="text-accent hover:text-accent-light transition-colors">
            Scales
          </a>
          <a href="#/chords" className="text-accent hover:text-accent-light transition-colors">
            Chords
          </a>
          <a
            href="#/editor"
            className="text-accent hover:text-accent-light transition-colors"
          >
            Editor
          </a>
          <a
            href="#/bravura-demo"
            className="text-accent hover:text-accent-light transition-colors"
          >
            Bravura
          </a>
        </div>
      </div>
    </footer>
  );
}

