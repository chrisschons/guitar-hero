import { useState, useEffect, useRef } from 'react';
import { startTuner } from '../core/audio';

const CENTS_IN_TUNE = 5;

type PitchResult = {
  noteName: string;
  cents: number;
  frequency: number;
};

export function Tuner() {
  const [pitch, setPitch] = useState<PitchResult | null>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stopRef = useRef<(() => void) | null>(null);

  const handleStart = async () => {
    setError(null);
    try {
      const { stop } = await startTuner({
        onPitch: (result: PitchResult) => setPitch(result),
      });
      stopRef.current = stop;
      setActive(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not access microphone');
    }
  };

  useEffect(() => {
    return () => {
      stopRef.current?.();
      stopRef.current = null;
    };
  }, []);

  const inTune = pitch && Math.abs(pitch.cents) <= CENTS_IN_TUNE;

  return (
    <div className="min-h-screen p-8 max-w-lg mx-auto flex flex-col items-center">
      <header className="mb-8 w-full">
        <h1 className="text-3xl font-bold text-foreground mb-2">Tuner</h1>
        <p className="text-muted-foreground text-sm mb-4">
          Play a string or note. Allow microphone access when prompted.
        </p>
        <a
          href="#/"
          className="inline-block text-accent hover:text-accent-light transition-colors"
        >
          ← Back to Guitar Hero
        </a>
      </header>

      {error && (
        <div className="mb-4 px-4 py-2 rounded-lg bg-red-900/30 text-red-200 text-sm">
          {error}
        </div>
      )}

      {!active ? (
        <button
          type="button"
          onClick={handleStart}
          className="px-6 py-3 rounded-full bg-accent text-white font-medium hover:bg-accent-light transition-colors"
        >
          Start tuner
        </button>
      ) : (
        <>
          <button
            type="button"
            onClick={() => {
              stopRef.current?.();
              stopRef.current = null;
              setActive(false);
              setPitch(null);
            }}
            className="mb-6 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Stop
          </button>

          <div className="w-full bg-secondary rounded-xl p-8 border border-border text-center">
            <div className="text-5xl font-bold text-foreground tabular-nums mb-2">
              {pitch ? pitch.noteName : '—'}
            </div>
            {pitch && (
              <div className="text-lg text-muted-foreground mb-4">
                {pitch.frequency.toFixed(1)} Hz
              </div>
            )}
            <div className="relative h-12 mx-4 mb-2">
              <div className="absolute inset-0 flex">
                <div className="flex-1 bg-slate-700 rounded-l" />
                <div className="w-1 bg-accent shrink-0" />
                <div className="flex-1 bg-slate-700 rounded-r" />
              </div>
              {pitch && (
                <div
                  className="absolute top-0 bottom-0 w-1 bg-white rounded-full transition-transform duration-75 ease-out pointer-events-none"
                  style={{
                    left: `${50 + pitch.cents}%`,
                    transform: 'translateX(-50%)',
                  }}
                />
              )}
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground px-4">
              <span>-50¢</span>
              <span>0</span>
              <span>+50¢</span>
            </div>
            {pitch && (
              <div
                className={`mt-4 text-sm font-medium ${
                  inTune ? 'text-green-400' : pitch.cents > 0 ? 'text-amber-400' : 'text-amber-400'
                }`}
              >
                {inTune ? 'In tune' : pitch.cents > 0 ? 'Sharp' : 'Flat'}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

