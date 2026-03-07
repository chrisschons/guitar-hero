import { STRING_LABELS, SCALE_INTERVALS } from '../data/exerciseTypes';

// Full fretboard range to display
const FRET_RANGE = Array.from({ length: 24 }, (_, i) => i);

// String open note semitones from C (E=4, A=9, D=2, G=7, B=11, e=4)
const STRING_SEMITONES = [4, 11, 7, 2, 9, 4]; // e, B, G, D, A, E

// Get all frets for a given string, root note, and scale type
function getScaleFrets(stringIndex, rootSemitone, scaleType = 'pentatonic') {
  const frets = [];
  const openNote = STRING_SEMITONES[stringIndex];
  const intervals = SCALE_INTERVALS[scaleType] || SCALE_INTERVALS.pentatonic;
  
  for (let fret = 0; fret <= 23; fret++) {
    const noteSemitone = (openNote + fret) % 12;
    const intervalFromRoot = (noteSemitone - rootSemitone + 12) % 12;
    if (intervals.includes(intervalFromRoot)) {
      frets.push(fret);
    }
  }
  return frets;
}

// Get all root note frets for a given string
function getRootFrets(stringIndex, rootSemitone) {
  const frets = [];
  const openNote = STRING_SEMITONES[stringIndex];
  
  for (let fret = 0; fret <= 23; fret++) {
    const noteSemitone = (openNote + fret) % 12;
    if (noteSemitone === rootSemitone) {
      frets.push(fret);
    }
  }
  return frets;
}

// Root note semitones from C
const ROOT_SEMITONES = {
  'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5,
  'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11
};

// Pentatonic position frets in A (base) - which frets belong to each position per string
// String indices: 0=e, 1=B, 2=G, 3=D, 4=A, 5=E
// Verified against actual A minor pentatonic notes: A, C, D, E, G
const BASE_POSITION_FRETS = [
  // Position 1 (frets 5-8 in A)
  { 0: [5, 8], 1: [5, 8], 2: [5, 7], 3: [5, 7], 4: [5, 7], 5: [5, 8] },
  // Position 2 (frets 7-10 in A)
  { 0: [8, 10], 1: [8, 10], 2: [7, 9], 3: [7, 10], 4: [7, 10], 5: [8, 10] },
  // Position 3 (frets 10-13 in A)
  { 0: [10, 12], 1: [10, 13], 2: [9, 12], 3: [10, 12], 4: [10, 12], 5: [10, 12] },
  // Position 4 (frets 12-15 in A)
  { 0: [12, 15], 1: [13, 15], 2: [12, 14], 3: [12, 14], 4: [12, 15], 5: [12, 15] },
  // Position 5 (frets 15-17 in A)
  { 0: [15, 17], 1: [15, 17], 2: [14, 17], 3: [14, 17], 4: [15, 17], 5: [15, 17] },
];

// Check if a fret is in the current position (with offset for different keys)
function isInPosition(stringIndex, fret, positionIndex, offset) {
  const position = BASE_POSITION_FRETS[positionIndex];
  if (!position || !position[stringIndex]) return false;
  
  const [fret1, fret2] = position[stringIndex];
  const offsetFret1 = fret1 + offset;
  const offsetFret2 = fret2 + offset;
  
  return fret === offsetFret1 || fret === offsetFret2;
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

export function FretboardDiagram({ vizData, currentNotes = [], rootNote = 'A' }) {
  const { type, rootFret = 0, exerciseId = '', positionIndex = 0, offset = 0, exerciseNotes = [], positionNotes = [], scaleType = 'pentatonic' } = vizData || {};
  
  const rootSemitone = ROOT_SEMITONES[rootNote] ?? 9; // Default to A
  
  // For power chords, show the chord positions
  const powerChordFrets = type === 'power-chords' ? getPowerChordFrets(rootFret, exerciseId) : null;
  
  // For scale runs, create a lookup of exercise notes
  const scaleRunNotesSet = type === 'scale-runs' 
    ? new Set(exerciseNotes.map(([string, fret]) => `${string}-${fret}`))
    : null;
  
  // For position-based exercises (blues, major, minor), create lookup of position notes
  const positionNotesSet = (type === 'blues' || type === 'major-3nps' || type === 'minor-3nps')
    ? new Set(positionNotes.map(([string, fret]) => `${string}-${fret}`))
    : null;
  
  return (
    <div className="bg-bg-secondary rounded-xl p-4 mb-6 overflow-x-auto">
      <div className="flex min-w-[700px]">
        {/* String labels */}
        <div className="flex flex-col pr-2 mt-5">
          {STRING_LABELS.map((label) => (
            <span 
              key={label} 
              className="text-xs font-mono text-text-secondary h-5 flex items-center"
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
                className="flex-1 text-center text-[10px] text-text-secondary"
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
                  
                  if (type === 'power-chords') {
                    hasNote = powerChordFrets?.[stringIndex]?.includes(fret);
                    const rootString = exerciseId === 'a-string-climb' ? 4 : 5;
                    isRoot = stringIndex === rootString && (fret === rootFret || fret === rootFret + 12);
                    inCurrentPosition = hasNote;
                  } else if (type === 'scale-runs') {
                    // Scale runs - show full scale, exercise notes at 100%, others at 50%
                    const scaleFrets = getScaleFrets(stringIndex, rootSemitone, scaleType);
                    hasNote = scaleFrets.includes(fret);
                    const rootFretsForString = getRootFrets(stringIndex, rootSemitone);
                    isRoot = rootFretsForString.includes(fret);
                    inCurrentPosition = scaleRunNotesSet?.has(`${stringIndex}-${fret}`) || false;
                  } else if (type === 'blues' || type === 'major-3nps' || type === 'minor-3nps') {
                    // Other scale types - show full scale, position notes at 100%
                    const scaleFrets = getScaleFrets(stringIndex, rootSemitone, scaleType);
                    hasNote = scaleFrets.includes(fret);
                    const rootFretsForString = getRootFrets(stringIndex, rootSemitone);
                    isRoot = rootFretsForString.includes(fret);
                    inCurrentPosition = positionNotesSet?.has(`${stringIndex}-${fret}`) || false;
                  } else {
                    // Pentatonic - check if this fret is in the scale
                    const scaleFrets = getScaleFrets(stringIndex, rootSemitone, 'pentatonic');
                    hasNote = scaleFrets.includes(fret);
                    const rootFretsForString = getRootFrets(stringIndex, rootSemitone);
                    isRoot = rootFretsForString.includes(fret);
                    inCurrentPosition = isInPosition(stringIndex, fret, positionIndex, offset);
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
                                  ? 'bg-bg-secondary border-2 border-accent'
                                  : 'bg-accent'
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
                const showDot = [3, 5, 7, 9, 12, 15, 17].includes(fret);
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
        </div>
      </div>
    </div>
  );
}
