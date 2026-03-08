import { isRootAt } from '../data/basicChords';
import { STANDARD_TUNING } from '../data/tunings';

const NUM_COLUMNS = 5;
const cellWidth = 28;
const fretRowHeight = 18;
const stringRowHeight = 16;

export function ChordDiagram({ chord, title = '', chordType = '', tuning = STANDARD_TUNING }) {
  if (!chord || !chord.frets || chord.frets.length !== 6) return null;

  const { frets, root, startFret = 0, barre } = chord;
  // Column 0 always present (mute/open); labels: blank, then startFret-based (e.g. B major ['',2,3,4,5])
  const firstFret = startFret || 1;
  const fretLabels = ['', firstFret, firstFret + 1, firstFret + 2, firstFret + 3];

  // Nut = left border of column 1, only when first fret is 1 (open or F major)
  const nutColIndex = firstFret <= 1 ? 1 : -1;
  // Column 0 has no left border (never draw vertical line at i=0)
  const skipLineBeforeCol0 = true;

  // Barre: from chord.barre [colIndex, fromString, toString] or legacy detection
  const barreCol1 =
    barre && barre.length >= 3
      ? { colIndex: barre[0], top: barre[1], bottom: barre[2] }
      : null;

  return (
    <div className="bg-bg-secondary rounded-lg p-3 border border-bg-tertiary inline-block">
      {title && (
        <div className="text-xs font-medium text-text-secondary mb-2 text-center">{title}</div>
      )}
      <div className="flex">
        <div className="relative flex flex-col">
          {/* Vertical lines: no line before column 0 when startFret=0; nut (4px) on column that is fret 1 */}
          {Array.from({ length: NUM_COLUMNS + 1 }, (_, i) => {
            if (skipLineBeforeCol0 && i === 0) return null;
            const isNut = i === nutColIndex;
            return (
              <div
                key={i}
                className="absolute pointer-events-none"
                style={{
                  left: i * cellWidth,
                  top: fretRowHeight,
                  bottom: 0,
                  width: 0,
                  borderLeft: `${isNut ? 4 : 1}px solid rgb(75 85 99)`,
                }}
              />
            );
          })}
          {barreCol1 && (
            <div
              className="absolute pointer-events-none bg-accent z-[5]"
              style={{
                left: barreCol1.colIndex * cellWidth + cellWidth / 2 - 2,
                width: 4,
                top: fretRowHeight + barreCol1.top * stringRowHeight + stringRowHeight / 2 - 2,
                height: (barreCol1.bottom - barreCol1.top) * stringRowHeight + 4,
              }}
            />
          )}
          <div className="flex mb-0.5 h-4">
            {fretLabels.map((label, i) => (
              <div
                key={i}
                className="text-center text-[10px] text-text-secondary shrink-0 flex items-center justify-center"
                style={{ width: cellWidth }}
              >
                {label}
              </div>
            ))}
          </div>
          {[0, 1, 2, 3, 4, 5].map((stringIndex) => {
            const col = frets[stringIndex];
            const isMute = col === -1;
            const isOpen = col === 0 && startFret === 0;
            return (
              <div key={stringIndex} className="flex h-4 relative items-center">
                <div
                  className="absolute top-1/2 -translate-y-px border-t border-gray-600"
                  style={{
                    left: skipLineBeforeCol0 ? cellWidth : 0,
                    right: 0,
                    borderWidth: stringIndex > 2 ? 2 : 1,
                    opacity: 0.5,
                  }}
                />
                {Array.from({ length: NUM_COLUMNS }, (_, colIndex) => {
                  const showMute = colIndex === 0 && isMute;
                  const showOpen = colIndex === 0 && isOpen;
                  // When startFret > 0, data 0 = first fret (col 1), 1 = second (col 2), etc. So display at colIndex = col + 1
                  const displayCol = startFret > 0 && col >= 0 ? col + 1 : col;
                  const showDot = col >= 0 && displayCol === colIndex && !isOpen;
                  const showRoot = showDot && isRootAt(stringIndex, col, startFret, root, tuning);
                  return (
                    <div
                      key={colIndex}
                      className="flex items-center justify-center relative shrink-0"
                      style={{ width: cellWidth }}
                    >
                      {showMute && (
                        <span className="text-xs font-mono text-text-secondary z-10">×</span>
                      )}
                      {showOpen && !showMute && (
                        <span className="text-xs font-mono text-accent z-10">○</span>
                      )}
                      {showDot && (
                        <div
                          className={`rounded-full z-10 box-border w-3 h-3 ${
                            showRoot ? 'bg-bg-secondary border-2 border-accent' : 'bg-accent'
                          }`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
