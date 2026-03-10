import { PENTATONIC_POSITIONS, BLUES_POSITIONS } from '../data/exerciseTypes';
import { C_MAJOR_3NPS_POSITIONS, getMajor3NPSPositions, getMinor3NPSPositions, get3NPSStartingOrder } from '../data/scalePositions';
import { PositionDiagram } from '../components/PositionDiagram';
import { getNoteAt, ROOT_SEMITONES, NOTE_NAMES } from '../core/music';
import { STANDARD_TUNING } from '../data/tunings';
import { useLocalStorage } from '../hooks/useLocalStorage';

// Base key is A for existing hardcoded shapes (rootSemitone = 9)
const ROOT_SEMITONE_A = 9;

/** All scale notes on the full fretboard: every [string, fret] where pitch is in scale (frets 0–23). */
function fullFretboardScaleNotes(pitchSet, tuning = STANDARD_TUNING) {
  const notes = [];
  for (let stringIndex = 0; stringIndex < 6; stringIndex++) {
    for (let fret = 0; fret <= 23; fret++) {
      const pitch = getNoteAt(stringIndex, fret, tuning);
      if (pitchSet.has(pitch)) notes.push([stringIndex, fret]);
    }
  }
  return notes;
}

// Scale pitch classes for any root (0–11). Major: 1,2,3,4,5,6,7; minor: 1,2,b3,4,5,b6,b7
function majorPitchSet(rootSemitone) {
  return new Set([0, 2, 4, 5, 7, 9, 11].map((i) => (i + rootSemitone) % 12));
}
function minorPitchSet(rootSemitone) {
  return new Set([0, 2, 3, 5, 7, 8, 10].map((i) => (i + rootSemitone) % 12));
}

// A minor pentatonic: 1, b3, 4, 5, b7 → 0,3,5,7,10 from A (9)
const A_PENTATONIC_PITCHES = new Set([0, 3, 5, 7, 10].map((i) => (i + (ROOT_SEMITONE_A ?? 9)) % 12));
// A blues: 1, b3, 4, b5, 5, b7 → 0,3,5,6,7,10 from A
const A_BLUES_PITCHES = new Set([0, 3, 5, 6, 7, 10].map((i) => (i + (ROOT_SEMITONE_A ?? 9)) % 12));

export function Scales() {
  const [rootId, setRootId] = useLocalStorage('guitar-hero-debug-root', 'C');
  const rootSemitone = ROOT_SEMITONES[rootId] ?? 0;

  const majorFullNotes = fullFretboardScaleNotes(majorPitchSet(rootSemitone));
  const minorFullNotes = fullFretboardScaleNotes(minorPitchSet(rootSemitone));
  const majorByPosition = getMajor3NPSPositions(rootSemitone);
  const minorByPosition = getMinor3NPSPositions(rootSemitone);
  const majorOrder = get3NPSStartingOrder(rootSemitone, 'major');
  const minorOrder = get3NPSStartingOrder(rootSemitone, 'minor');
  const majorPositions = majorOrder.map((i) => majorByPosition[i]);
  const minorPositions = minorOrder.map((i) => minorByPosition[i]);

  return (
    <div className="min-h-screen flex flex-col bg-bg-primary text-text-primary relative">
      <header className="sticky top-0 z-20 w-full bg-bg-secondary border-b border-bg-tertiary shrink-0">
        <div className="flex flex-wrap items-center gap-3 p-3">
          <a
            href="#/"
            className="text-accent hover:text-accent-light transition-colors shrink-0"
          >
            ← Back
          </a>
          <h1 className="text-lg font-semibold text-text-primary">
            Scales
          </h1>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-text-secondary">Key</span>
            <select
              value={rootId}
              onChange={(e) => setRootId(e.target.value)}
              className="bg-bg-tertiary border border-bg-tertiary rounded px-2 py-1.5 text-text-primary"
            >
              {NOTE_NAMES.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      <div className="flex-1 p-6 max-w-6xl mx-auto w-full">
        {/* Canonical C major 3NPS positions 1–7 (reference strip, no labels) */}
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-text-secondary mb-2">
            C Major 3NPS — canonical positions (1–7)
          </h2>
          <div className="flex flex-wrap gap-3 justify-start">
            {C_MAJOR_3NPS_POSITIONS.map((notes, idx) => (
              <PositionDiagram
                key={idx}
                notes={notes}
                title={`Position ${idx + 1}`}
                rootSemitone={ROOT_SEMITONES.C ?? 0}
                showFretNumbers={false}
                showNoteLabels={false}
              />
            ))}
          </div>
        </section>

        {/* Major 3NPS — full fretboard then 7 positions */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold text-text-primary mb-3">
            {rootId} Major 3NPS
          </h2>
          <p className="text-xs text-text-secondary mb-2">
            Full fretboard, then positions ordered by lowest fret (closest to nut first). Root highlighted. Labels remain canonical (Position 1–7).
          </p>
          <div className="mb-4">
            <PositionDiagram
              notes={majorFullNotes}
              title={`${rootId} major 3NPS — full fretboard`}
              fullScale
              rootSemitone={rootSemitone}
            />
          </div>
          <div className="flex flex-wrap gap-4 justify-start">
            {majorPositions.map((notes, idx) => {
              const canonicalIndex = majorOrder[idx] ?? idx;
              return (
                <PositionDiagram
                  key={idx}
                  notes={notes}
                  title={`Position ${canonicalIndex + 1}`}
                  rootSemitone={rootSemitone}
                />
              );
            })}
          </div>
        </section>

        {/* Natural minor 3NPS — full fretboard then 7 positions */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold text-text-primary mb-3">
            {rootId} natural minor 3NPS
          </h2>
          <p className="text-xs text-text-secondary mb-2">
            Derived from major (b3). Full fretboard, then positions in fretboard order. Root highlighted.
          </p>
          <div className="mb-4">
            <PositionDiagram
              notes={minorFullNotes}
              title={`${rootId} natural minor 3NPS — full fretboard`}
              fullScale
              rootSemitone={rootSemitone}
            />
          </div>
          <div className="flex flex-wrap gap-4 justify-start">
            {minorPositions.map((notes, idx) => {
              const canonicalIndex = minorOrder[idx] ?? idx;
              return (
                <PositionDiagram
                  key={idx}
                  notes={notes}
                  title={`Position ${canonicalIndex + 1}`}
                  rootSemitone={rootSemitone}
                />
              );
            })}
          </div>
        </section>

        {/* A minor pentatonic — full fretboard then 5 positions */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold text-text-primary mb-3">
            A minor pentatonic
          </h2>
          <p className="text-xs text-text-secondary mb-2">
            Full fretboard for A minor pentatonic (A, C, D, E, G), then the 5 hardcoded positions.
          </p>
          <div className="mb-4">
            <PositionDiagram
              notes={fullFretboardScaleNotes(A_PENTATONIC_PITCHES)}
              title="A minor pentatonic — full fretboard"
              fullScale
              rootSemitone={ROOT_SEMITONE_A}
            />
          </div>
          <div className="flex flex-wrap gap-4 justify-start">
            {PENTATONIC_POSITIONS.map((notes, idx) => (
              <PositionDiagram
                key={idx}
                notes={notes}
                title={`Position ${idx + 1}`}
                rootSemitone={ROOT_SEMITONE_A}
              />
            ))}
          </div>
        </section>

        {/* A blues — full fretboard then 5 positions */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold text-text-primary mb-3">
            A blues
          </h2>
          <p className="text-xs text-text-secondary mb-2">
            Full fretboard for A blues (A, C, D, D♯, E, G), then the 5 hardcoded positions.
          </p>
          <div className="mb-4">
            <PositionDiagram
              notes={fullFretboardScaleNotes(A_BLUES_PITCHES)}
              title="A blues — full fretboard"
              fullScale
              rootSemitone={ROOT_SEMITONE_A}
            />
          </div>
          <div className="flex flex-wrap gap-4 justify-start">
            {BLUES_POSITIONS.map((notes, idx) => (
              <PositionDiagram
                key={idx}
                notes={notes}
                title={`Position ${idx + 1}`}
                rootSemitone={ROOT_SEMITONE_A}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

