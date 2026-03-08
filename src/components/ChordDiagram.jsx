import { isRootAt } from '../data/basicChords';

export function ChordDiagram({ chord, title = '', chordType = '' }) {
  if (!chord || !chord.frets || chord.frets.length !== 6) return null;

  const { frets, root, startFret = 0 } = chord;
  const numFrets = 5;
  const cellWidth = 28; // Match PositionDiagram
  const fretNumbers = Array.from({ length: numFrets }, (_, i) => startFret + i);
  // Display fret labels: open position no label for 0, then 1,2,3,4; barre 1,2,3,4,5
  const fretLabels = startFret === 0 ? ['', 1, 2, 3, 4] : [1, 2, 3, 4, 5];

  // Bold nut only when diagram starts at frets 0 and 1 (same rule as other diagrams)
  const nutIsBold = startFret === 0;
  const fretRowHeight = 18; // h-4 + mb-0.5 so vertical lines start below fret numbers
  const stringRowHeight = 16; // h-4

  // Barre: only for B and F major/minor, and only on the first fret (barre fret)
  const showBarreOnFirstFret =
    (chordType === 'major' || chordType === 'minor') && (root === 'B' || root === 'F');
  const barres = fretNumbers
    .map((fret, colIndex) => {
      const stringIndices = [0, 1, 2, 3, 4, 5].filter((si) => frets[si] > 0 && frets[si] === fret);
      if (stringIndices.length < 2) return null;
      if (showBarreOnFirstFret && colIndex !== 0) return null; // only first fret for B/F major/minor
      if (!showBarreOnFirstFret) return null; // no barre for other chords
      const top = Math.min(...stringIndices);
      const bottom = Math.max(...stringIndices);
      return { colIndex, top, bottom };
    })
    .filter(Boolean);

  return (
    <div className="bg-bg-secondary rounded-lg p-3 border border-bg-tertiary inline-block">
      {title && (
        <div className="text-xs font-medium text-text-secondary mb-2 text-center">{title}</div>
      )}
      <div className="flex">
        <div className="relative flex flex-col">
          {/* Full-height vertical fret lines (below fret numbers row, match scale diagrams) */}
          {fretNumbers.map((_, i) => {
            if (nutIsBold && i === 0) return null; // no line before fret 0
            const isNut = nutIsBold && i === 1;
            return (
              <div
                key={i}
                className="absolute pointer-events-none"
                style={{
                  left: i * cellWidth,
                  top: fretRowHeight,
                  bottom: 0,
                  width: 0,
                  borderLeft: `${isNut ? 3 : 1}px solid rgb(75 85 99)`,
                }}
              />
            );
          })}
          <div
            className="absolute pointer-events-none border-r border-gray-700"
            style={{ left: numFrets * cellWidth, top: fretRowHeight, bottom: 0 }}
          />
          {/* Barre chord indicator: solid line connecting top and bottom dots on same fret (over string lines) */}
          {barres.map(({ colIndex, top, bottom }) => (
            <div
              key={colIndex}
              className="absolute pointer-events-none bg-accent z-[5]"
              style={{
                left: colIndex * cellWidth + cellWidth / 2 - 2,
                width: 4,
                top: fretRowHeight + top * stringRowHeight + stringRowHeight / 2 - 2,
                height: (bottom - top) * stringRowHeight + 4,
              }}
            />
          ))}
          {/* Fret numbers row - no borders, match scale diagrams */}
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
          {/* String rows */}
          {[0, 1, 2, 3, 4, 5].map((stringIndex) => {
            const f = frets[stringIndex];
            const isOpen = f === 0;
            const isMute = f === -1;
            return (
              <div key={stringIndex} className="flex h-4 relative items-center">
                <div
                  className="absolute top-1/2 -translate-y-px border-t border-gray-600"
                  style={{
                    left: nutIsBold ? cellWidth : 0,
                    right: 0,
                    borderWidth: stringIndex > 2 ? 2 : 1,
                    opacity: 0.5,
                  }}
                />
                {fretNumbers.map((fret) => {
                  const isFirstCol = fret === startFret;
                  const showOpen = isFirstCol && isOpen;
                  const showMute = isFirstCol && isMute;
                  const showDot = f > 0 && f === fret;
                  const showRoot = showDot && isRootAt(stringIndex, f, root);
                  return (
                    <div
                      key={fret}
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
