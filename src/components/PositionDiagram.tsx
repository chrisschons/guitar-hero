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

  const notesSet = new Set(notes.map(([s, f]) => `${s}-${f}`));
  const frets = notes.map(([, f]) => f);
  const minFret = fullScale ? 0 : Math.min(...frets);
  const maxFret = fullScale ? 23 : Math.max(...frets);
  const fretRange = maxFret - minFret + 1;
  const cellWidth = fullScale ? undefined : 28;
  const showZeroColumn = minFret === 0;

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
                {Array.from({ length: fretRange }, (_, i) => minFret + i).map((fret) => (
                  <div
                    key={fret}
                    className={`text-center text-[10px] text-muted-foreground ${
                      fullScale ? 'flex-1 min-w-0' : 'shrink-0'
                    }`}
                    style={!fullScale ? { width: cellWidth } : undefined}
                  >
                    {showZeroColumn && fret === 0 ? '' : fret}
                  </div>
                ))}
              </div>
            )}
            {[0, 1, 2, 3, 4, 5].map((stringIndex) => (
              <div key={stringIndex} className="flex h-4 relative w-full">
                <div
                  className="absolute top-1/2 border-t border-gray-600"
                  style={{
                    left: showZeroColumn ? (fullScale ? `${100 / fretRange}%` : cellWidth) : 0,
                    right: 0,
                    borderWidth: stringIndex > 2 ? '2px' : '1px',
                    opacity: 0.5,
                  }}
                />
                {Array.from({ length: fretRange }, (_, i) => minFret + i).map((fret) => {
                  const hasNote = notesSet.has(`${stringIndex}-${fret}`);
                  const isRoot = hasNote && isRootNoteInScale(stringIndex, fret, rootSemitone, tuning);
                  const isFirstCol = fret === minFret;
                  const isNut = minFret === 0 && isFirstCol;
                  const isFirstLineBold = minFret === 1 && isFirstCol;
                  return (
                    <div
                      key={fret}
                      className={`flex items-center justify-center relative ${
                        isNut ? 'border-r-4 border-gray-500' : 'border-r border-gray-700'
                      } ${
                        isFirstLineBold
                          ? 'border-l-4 border-gray-500'
                          : isFirstCol && minFret > 1
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
                {Array.from({ length: fretRange }, (_, i) => minFret + i).map((fret) => {
                  const noteSemitone = getNoteAt(5, fret, tuning);
                  const noteName = getNoteName(noteSemitone);
                  const isDotFret = FRET_DOTS.includes(fret);
                  return (
                    <div
                      key={fret}
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

