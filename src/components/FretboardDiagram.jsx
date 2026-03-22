import { STANDARD_TUNING } from '../data/tunings';
import { getNoteAt, getNoteName, getScale, SCALE_INTERVALS, ROOT_SEMITONES, isRootNote, getStringLabels } from '../core/music';

// Full fretboard range to display
const FRET_RANGE = Array.from({ length: 24 }, (_, i) => i);
// Frets that have marker dots on the neck (bold note labels)
const FRET_DOTS = [3, 5, 7, 9, 12, 15, 17];

// Get all frets for a given string, root, scale type, and tuning
function getScaleFrets(stringIndex, rootSemitone, scaleType, tuning) {
  const intervals = SCALE_INTERVALS[scaleType] || SCALE_INTERVALS.pentatonic;
  const scaleNotes = getScale(rootSemitone, intervals);
  const frets = [];
  for (let fret = 0; fret <= 23; fret++) {
    const note = getNoteAt(stringIndex, fret, tuning);
    if (scaleNotes.includes(note)) frets.push(fret);
  }
  return frets;
}

// Get all root note frets for a given string and tuning
function getRootFrets(stringIndex, rootSemitone, tuning) {
  const frets = [];
  for (let fret = 0; fret <= 23; fret++) {
    const note = getNoteAt(stringIndex, fret, tuning);
    if (isRootNote(note, rootSemitone)) frets.push(fret);
  }
  return frets;
}


// Get power chord frets to display based on exercise
function getPowerChordFrets(rootFret, exerciseId) {
  const frets = {};
  const intervals = [0, 2, 4, 5, 7, 9, 12];
  
  if (exerciseId === 'a-string-climb') {
    frets[4] = [];
    frets[3] = [];
    frets[2] = [];
    
    intervals.forEach(interval => {
      const rootPosition = rootFret + interval;
      if (rootPosition >= 0 && rootPosition <= 24) {
        frets[4].push(rootPosition);
        const fifthPosition = rootPosition + 2;
        if (fifthPosition <= 24) {
          frets[3].push(fifthPosition);
          frets[2].push(fifthPosition);
        }
      }
    });
  } else {
    frets[5] = [];
    frets[4] = [];
    frets[3] = [];
    
    intervals.forEach(interval => {
      const rootPosition = rootFret + interval;
      if (rootPosition >= 0 && rootPosition <= 24) {
        frets[5].push(rootPosition);
        const fifthPosition = rootPosition + 2;
        if (fifthPosition <= 24) {
          frets[4].push(fifthPosition);
          frets[3].push(fifthPosition);
        }
      }
    });
  }
  
  return frets;
}

export function FretboardDiagram({ vizData, currentNotes = [], rootNote = 'A', tuning = STANDARD_TUNING, showFretNotes = false }) {
  const { type, rootFret = 0, exerciseId = '', positionIndex = 0, exerciseNotes = [], positionNotes = [], scaleType = 'pentatonic' } = vizData || {};

  const rootSemitone = ROOT_SEMITONES[rootNote] ?? 9; // Default to A

  const stringLabels = getStringLabels(tuning);
  
  // For power chords, show the chord positions
  const powerChordFrets = type === 'power-chords' ? getPowerChordFrets(rootFret, exerciseId) : null;
  
  // For scale runs, create a lookup of exercise notes
  const scaleRunNotesSet = type === 'scale-runs' 
    ? new Set(exerciseNotes.map(([string, fret]) => `${string}-${fret}`))
    : null;
  
  // For position-based exercises (pentatonic, blues, major, minor), create lookup of position notes
  const positionNotesSet = (type === 'pentatonic' || type === 'blues' || type === 'major-3nps' || type === 'minor-3nps')
    ? new Set(positionNotes.map(([string, fret]) => `${string}-${fret}`))
    : null;
  
  return (
    <div className="bg-secondary rounded-xl p-4 mb-6 overflow-x-auto shadow-xl">
      <div className="flex min-w-[700px]">
        {/* String labels */}
        <div className="flex flex-col pr-2 mt-5">
          {stringLabels.map((label) => (
            <span 
              key={label} 
              className="text-xs font-mono text-muted-foreground h-5 flex items-center"
            >
              {label}
            </span>
          ))}
        </div>

        {/* Fretboard */}
        <div className="flex-1 relative">
          {/* Fret numbers */}
          <div className="flex mb-1">
            {FRET_RANGE.map((fret) => (
              <div 
                key={fret} 
                className="flex-1 text-center text-[10px] text-muted-foreground"
                style={{ minWidth: 36 }}
              >
                {fret}
              </div>
            ))}
          </div>

          {/* Fretboard grid */}
          <div className="relative">
            {/* Strings */}
            {[0, 1, 2, 3, 4, 5].map((stringIndex) => (
              <div key={stringIndex} className="flex h-5 relative">
                {/* String line */}
                <div 
                  className="absolute top-1/2 left-0 right-0 border-t border-slate-700"
                  style={{ borderWidth: stringIndex > 2 ? '2px' : '1px' }}
                />
                
                {/* Fret cells */}
                {FRET_RANGE.map((fret) => {
                  const isPlaying = currentNotes.some(n => n.stringIndex === stringIndex && n.fret === fret);
                  
                  let hasNote = false;
                  let isRoot = false;
                  let inCurrentPosition = false;

                  if (type === 'none') {
                    // Riffs, chord progressions: no scale overlay
                  } else if (type === 'power-chords') {
                    hasNote = powerChordFrets?.[stringIndex]?.includes(fret);
                    const rootString = exerciseId === 'a-string-climb' ? 4 : 5;
                    isRoot = stringIndex === rootString && (fret === rootFret || fret === rootFret + 12);
                    inCurrentPosition = hasNote;
                  } else if (type === 'scale-runs') {
                    // Scale runs - show full scale, exercise notes at 100%, others at 50%
                    const scaleFrets = getScaleFrets(stringIndex, rootSemitone, scaleType, tuning);
                    hasNote = scaleFrets.includes(fret);
                    const rootFretsForString = getRootFrets(stringIndex, rootSemitone, tuning);
                    isRoot = rootFretsForString.includes(fret);
                    inCurrentPosition = scaleRunNotesSet?.has(`${stringIndex}-${fret}`) || false;
                  } else if (type === 'blues' || type === 'major-3nps' || type === 'minor-3nps') {
                    // Other scale types - show full scale, position notes at 100%
                    const scaleFrets = getScaleFrets(stringIndex, rootSemitone, scaleType, tuning);
                    hasNote = scaleFrets.includes(fret);
                    const rootFretsForString = getRootFrets(stringIndex, rootSemitone, tuning);
                    isRoot = rootFretsForString.includes(fret);
                    inCurrentPosition = positionNotesSet?.has(`${stringIndex}-${fret}`) || false;
                  } else {
                    // Pentatonic - show full scale, position notes highlighted via positionNotesSet
                    const scaleFrets = getScaleFrets(stringIndex, rootSemitone, 'pentatonic', tuning);
                    hasNote = scaleFrets.includes(fret);
                    const rootFretsForString = getRootFrets(stringIndex, rootSemitone, tuning);
                    isRoot = rootFretsForString.includes(fret);
                    inCurrentPosition = positionNotesSet?.has(`${stringIndex}-${fret}`) || false;
                  }
                  
                  return (
                    <div
                      key={fret}
                      className={`flex-1 flex items-center justify-center relative ${
                        fret === 0 ? 'border-r-4 border-gray-400' : 'border-r border-gray-700'
                      }`}
                      style={{ minWidth: 36 }}
                    >
                      {hasNote && (
                        <div
                          className={`
                            w-4 h-4 rounded-full z-10 transition-all duration-75 box-border
                            ${isPlaying
                              ? 'bg-white shadow-[0_0_16px_rgba(255,255,255,0.9)]'
                              : inCurrentPosition
                                ? isRoot
                                  ? 'bg-secondary border-2 border-accent'
                                  : 'bg-accent'
                                : isRoot
                                  ? 'bg-secondary border-2 border-slate-700'
                                  : 'bg-slate-700'
                            }
                          `}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            ))}

            {/* Fret markers (dots) */}
            <div className="absolute inset-0 flex pointer-events-none">
              {FRET_RANGE.map((fret) => {
                const showDot = FRET_DOTS.includes(fret);
                const isDoubleDot = fret === 12;
                
                return (
                  <div key={fret} className="flex-1 flex items-center justify-center" style={{ minWidth: 36 }}>
                    {showDot && !isDoubleDot && (
                      <div className="w-1.5 h-1.5 rounded-full bg-gray-600 opacity-30" />
                    )}
                    {isDoubleDot && (
                      <div className="flex flex-col gap-6">
                        <div className="w-1.5 h-1.5 rounded-full bg-gray-600 opacity-30" />
                        <div className="w-1.5 h-1.5 rounded-full bg-gray-600 opacity-30" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Note labels under each fret column (low E string); bold on dot frets */}
          {showFretNotes && (
          <div className="flex mt-1">
            {FRET_RANGE.map((fret) => {
              const noteSemitone = getNoteAt(5, fret, tuning);
              const noteName = getNoteName(noteSemitone);
              const isDotFret = FRET_DOTS.includes(fret);
              return (
                <div
                  key={fret}
                  className={`flex-1 text-center text-[10px] text-muted-foreground ${isDotFret ? 'font-bold text-foreground' : ''}`}
                  style={{ minWidth: 36 }}
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
  );
}
