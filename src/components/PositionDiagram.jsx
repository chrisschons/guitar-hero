import { STRING_SEMITONES } from '../data/exerciseTypes';

const ROOT_SEMITONE_A = 9;

function isRootNote(stringIndex, fret) {
  const openNote = STRING_SEMITONES[stringIndex];
  return (openNote + fret) % 12 === ROOT_SEMITONE_A;
}

export function PositionDiagram({ notes, title = '', fullScale = false }) {
  if (!notes.length) return null;

  const notesSet = new Set(notes.map(([s, f]) => `${s}-${f}`));
  const frets = notes.map(([, f]) => f);
  const minFret = fullScale ? 0 : Math.min(...frets);
  const maxFret = fullScale ? 23 : Math.max(...frets);
  const fretRange = maxFret - minFret + 1;
  const cellWidth = fullScale ? undefined : 28;

  return (
    <div className={`bg-bg-secondary rounded-lg p-3 border border-bg-tertiary ${fullScale ? 'w-full' : ''}`}>
      {title && (
        <div className="text-xs font-medium text-text-secondary mb-2 text-center">{title}</div>
      )}
      <div className="flex">
        <div className="flex-1 min-w-0">
          <div className="flex flex-col w-full">
            <div className="flex mb-0.5 w-full">
              {Array.from({ length: fretRange }, (_, i) => minFret + i).map((fret) => (
                <div
                  key={fret}
                  className={`text-center text-[10px] text-text-secondary ${fullScale ? 'flex-1 min-w-0' : 'shrink-0'}`}
                  style={!fullScale ? { width: cellWidth } : undefined}
                >
                  {fret}
                </div>
              ))}
            </div>
            {[0, 1, 2, 3, 4, 5].map((stringIndex) => (
              <div key={stringIndex} className="flex h-4 relative w-full">
                <div
                  className="absolute top-1/2 left-0 right-0 border-t border-gray-600"
                  style={{ borderWidth: stringIndex > 2 ? '2px' : '1px', opacity: 0.5 }}
                />
                {Array.from({ length: fretRange }, (_, i) => minFret + i).map((fret) => {
                  const hasNote = notesSet.has(`${stringIndex}-${fret}`);
                  const isRoot = hasNote && isRootNote(stringIndex, fret);
                  const isFirstCol = fret === minFret;
                  const isNut = minFret === 0 && isFirstCol;
                  return (
                    <div
                      key={fret}
                      className={`flex items-center justify-center relative ${
                        isNut ? 'border-r-[3px] border-gray-500' : 'border-r border-gray-700'
                      } ${fullScale ? 'flex-1 min-w-0' : 'shrink-0'}`}
                      style={!fullScale ? { width: cellWidth } : undefined}
                    >
                      {hasNote && (
                        <div
                          className={`
                            rounded-full z-10 box-border w-3 h-3
                            ${isRoot ? 'bg-bg-secondary border-2 border-accent' : 'bg-accent'}
                          `}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
