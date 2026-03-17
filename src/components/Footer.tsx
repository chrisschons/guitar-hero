import { Play, Pause, ArrowLeftToLine, Metronome, SlidersHorizontal, Music4, HandMetal, Moon, Sun, Palette } from 'lucide-react';
import { useState, useEffect } from 'react';
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
  keySelector?: React.ReactNode;
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
  keySelector,
}: FooterProps) {
  const showMetronome = !disableMetronome && bpm !== undefined && onBpmChange;
  const showTransport = !disableTransport && onPlayToggle;
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === 'undefined') return false;
    const hasDarkClass = document.documentElement.classList.contains('dark');
    const hasLightClass = document.documentElement.classList.contains('light');
    // If explicitly set, use that. Otherwise use system preference
    if (hasLightClass) return false;
    if (hasDarkClass) return true;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    const handleDarkModeChange = () => {
      setIsDark(document.documentElement.classList.contains('dark'));
    };
    document.documentElement.addEventListener('classchange', handleDarkModeChange);
    return () => document.documentElement.removeEventListener('classchange', handleDarkModeChange);
  }, []);

  const toggleDarkMode = () => {
    const html = document.documentElement;
    const willBeDark = !isDark;
    if (willBeDark) {
      html.classList.add('dark');
      html.classList.remove('light');
    } else {
      html.classList.add('light');
      html.classList.remove('dark');
    }
    setIsDark(willBeDark);
  };

  return (
    <footer className="fixed bottom-0 left-0 right-0 w-full border-t border-border bg-secondary py-6 z-20">
      <div className="mx-auto px-5 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4 flex-wrap">
          {showMetronome && (
            <div className="flex items-center gap-2">
              <Metronome
                className={`h-5 w-5 shrink-0 ${
                  metronomeOn ? 'text-accent' : 'text-muted-foreground'
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
              <span className="text-sm font-medium text-foreground tabular-nums w-8 text-right">
                {bpm}
              </span>
            </div>
          )}
          {keySelector && (
            <div className="pl-2">
              {keySelector}
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          {showTransport && (
            <>
              {onReset && (
                <button
                  onClick={onReset}
                  className="flex items-center justify-center p-2 rounded-full bg-muted text-foreground cursor-pointer transition-all hover:bg-muted/80"
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
          <a href="#/" className="text-accent hover:text-accent-light transition-colors flex flex-col items-center gap-1">
            <HandMetal />
            Practice
          </a>
          <a href="#/scales" className="text-accent hover:text-accent-light transition-colors flex flex-col items-center gap-1">
            <Music4 />
            Scales
          </a>
          <a href="#/chords" className="text-accent hover:text-accent-light transition-colors flex flex-col items-center gap-1">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14.78 3.71v16.68" />
              <path d="M20.34 5.19v-.33a1.85 1.85 0 0 0-1.85-1.85H5.51a1.85 1.85 0 0 0-1.85 1.85v.33z" />
              <path d="M3.66 12.05h16.68" />
              <path d="M9.22 3.71v16.68" />
              <circle cx="14.78" cy="20.2" r="2.68" />
              <circle cx="9.22" cy="12.05" r="2.68" />
              <rect x="3.66" y="3.71" width="16.68" height="16.68" rx="2" />
            </svg>
            Chords
          </a>
         
          <a
            href="#/editor"
            className="text-accent hover:text-accent-light transition-colors flex flex-col items-center gap-1"
          >
            <SlidersHorizontal />
            Editor
          </a>
          <a
            href="#/design-guide"
            className="text-accent hover:text-accent-light transition-colors flex flex-col items-center gap-1"
          >
            <Palette />
            Guide
          </a>
          {/*}
          <button
            onClick={toggleDarkMode}
            className="text-accent hover:text-accent-light transition-colors flex flex-col items-center gap-1"
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? <Sun size={20} /> : <Moon size={20} />}
            
          </button>
          */}
        </div>
      </div>
    </footer>
  );
}

