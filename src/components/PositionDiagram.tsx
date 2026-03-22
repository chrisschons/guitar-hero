import { getNoteAt, getNoteName, isRootNote as isRootNoteEngine } from '../core/music';
import { STANDARD_TUNING } from '../data/tunings';

const FRET_DOTS = [3, 5, 7, 9, 12, 15, 17];

function isRootNoteInScale(
  stringIndex: number,
  fret: number,
  rootSemitone: number,
  tuning: number[]
): boolean {
  const semitone = getNoteAt(stringIndex, fret, tuning);
  return isRootNoteEngine(semitone, rootSemitone);
}

type PositionDiagramProps = {
  notes: [number, number][];
  title?: string;
  fullScale?: boolean;
  rootSemitone?: number;
  tuning?: number[];
  showFretNumbers?: boolean;
  showNoteLabels?: boolean;
};

export function PositionDiagram({
  notes,
  title = '',
  fullScale = false,
  rootSemitone = 9,
  tuning = STANDARD_TUNING,
  showFretNumbers = true,
  showNoteLabels = true,
}: PositionDiagramProps) {
  if (!notes.length) return null;

  const frets = notes.map(([, f]) => f);
  const minFret = fullScale ? 0 : Math.min(...frets);

  // Neutral (non-fullScale): always exactly 5 columns, notes normalized to [0–4].
  // fullScale: derive range from content as before.
  const NEUTRAL_COLS = 5;
  const columns = fullScale
    ? Array.from({ length: 24 - minFret + 1 }, (_, i) => i)   // absolute cols
    : Array.from({ length: NEUTRAL_COLS }, (_, col) => col);   // normalized cols 0-4

  const notesSet = new Set(
    notes.map(([s, f]) => `${s}-${fullScale ? f : f - minFret}`)
  );
  const cellWidth = fullScale ? undefined : 28;
  const showZeroColumn = fullScale && minFret === 0;

  return (
    <div
      className={`bg-secondary rounded-lg p-3 border border-border ${
        fullScale ? 'w-full' : ''
      } relative z-0`}
    >
      {title && (
        <div className="text-xs font-medium text-muted-foreground mb-2 text-center">{title}</div>
      )}
      <div className="flex">
        <div className="flex-1 min-w-0">
          <div className="flex flex-col w-full">
            {showFretNumbers && (
              <div className="flex mb-0.5 w-full">
                {columns.map((col) => {
                  const absFret = fullScale ? col : col + minFret;
                  return (
                    <div
                      key={col}
                      className={`text-center text-[10px] text-muted-foreground ${
                        fullScale ? 'flex-1 min-w-0' : 'shrink-0'
                      }`}
                      style={!fullScale ? { width: cellWidth } : undefined}
                    >
                      {showZeroColumn && col === 0 ? '' : absFret}
                    </div>
                  );
                })}
              </div>
            )}
            {[0, 1, 2, 3, 4, 5].map((stringIndex) => (
              <div key={stringIndex} className="flex h-4 relative w-full">
                <div
                  className="absolute top-1/2 border-t border-gray-600"
                  style={{
                    left: showZeroColumn ? `${100 / columns.length}%` : 0,
                    right: 0,
                    borderWidth: stringIndex > 2 ? '2px' : '1px',
                    opacity: 0.5,
                  }}
                />
                {columns.map((col) => {
                  const absFret = fullScale ? col : col + minFret;
                  const hasNote = notesSet.has(`${stringIndex}-${col}`);
                  const isRoot = hasNote && isRootNoteInScale(stringIndex, absFret, rootSemitone, tuning);
                  const isFirstCol = col === columns[0];
                  const isNut = showZeroColumn && isFirstCol;
                  const isFirstLineBold = fullScale && minFret === 1 && isFirstCol;
                  return (
                    <div
                      key={col}
                      className={`flex items-center justify-center relative ${
                        isNut ? 'border-r-4 border-gray-500' : 'border-r border-gray-700'
                      } ${
                        isFirstLineBold
                          ? 'border-l-4 border-gray-500'
                          : isFirstCol && fullScale && minFret > 1
                          ? 'border-l border-gray-700'
                          : ''
                      } ${fullScale ? 'flex-1 min-w-0' : 'shrink-0'}`}
                      style={!fullScale ? { width: cellWidth } : undefined}
                    >
                      {hasNote && (
                        <div
                          className={`
                            rounded-full z-10 box-border w-3 h-3
                            ${isRoot ? 'bg-secondary border-2 border-accent' : 'bg-accent'}
                          `}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
            {showNoteLabels && (
              <div className="flex w-full mt-0.5">
                {columns.map((col) => {
                  const absFret = fullScale ? col : col + minFret;
                  const noteSemitone = getNoteAt(5, absFret, tuning);
                  const noteName = getNoteName(noteSemitone);
                  const isDotFret = FRET_DOTS.includes(absFret);
                  return (
                    <div
                      key={col}
                      className={`text-center text-[10px] text-muted-foreground ${
                        fullScale ? 'flex-1 min-w-0' : 'shrink-0'
                      } ${isDotFret ? 'font-bold text-foreground' : ''}`}
                      style={!fullScale ? { width: cellWidth } : undefined}
                    >
                      {noteName}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

