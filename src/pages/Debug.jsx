import { PENTATONIC_POSITIONS, BLUES_POSITIONS } from '../data/exerciseTypes';
import { getMajor3NPSPositions, getMinor3NPSPositions } from '../data/scalePositions';
import { PositionDiagram } from '../components/PositionDiagram';
import { getNoteAt, ROOT_SEMITONES, NOTE_NAMES } from '../core/music';
import { STANDARD_TUNING } from '../data/tunings';
import { useLocalStorage } from '../hooks/useLocalStorage';

// Base key is A for existing hardcoded shapes (rootSemitone = 9)
const ROOT_SEMITONE_A = 9;

// Fretboard order (nut to bridge): Position 4, 5, 6, 7, 1, 2, 3 → indices 3,4,5,6,0,1,2
const FRETBOARD_ORDER_INDICES = [3, 4, 5, 6, 0, 1, 2];
const FRETBOARD_ORDER_LABELS = ['Position 4', 'Position 5', 'Position 6', 'Position 7', 'Position 1', 'Position 2', 'Position 3'];

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

function Section({ title, positions, maxPositions }) {
  const count = Math.min(positions.length, maxPositions ?? positions.length);

  return (
    <section className="mb-10">
      <h2 className="text-xl font-semibold text-text-primary mb-3">{title}</h2>
      <p className="text-xs text-text-secondary mb-2">
        Showing {count} hardcoded shapes (base key A), no transposition.
      </p>
      <div className="flex flex-wrap gap-4">
        {positions.slice(0, count).map((notes, idx) => (
          <PositionDiagram
            key={idx}
            notes={notes}
            title={`Shape ${idx + 1}`}
            rootSemitone={ROOT_SEMITONE_A}
          />
        ))}
      </div>
    </section>
  );
}

export function Debug() {
  const [rootId, setRootId] = useLocalStorage('guitar-hero-debug-root', 'C');
  const rootSemitone = ROOT_SEMITONES[rootId] ?? 0;

  const majorFullNotes = fullFretboardScaleNotes(majorPitchSet(rootSemitone));
  const minorFullNotes = fullFretboardScaleNotes(minorPitchSet(rootSemitone));
  const majorByPosition = getMajor3NPSPositions(rootSemitone);
  const minorByPosition = getMinor3NPSPositions(rootSemitone);
  const majorPositions = FRETBOARD_ORDER_INDICES.map((i) => majorByPosition[i]);
  const minorPositions = FRETBOARD_ORDER_INDICES.map((i) => minorByPosition[i]);

  return (
    <div className="min-h-screen flex flex-col bg-bg-primary text-text-primary">
      <header className="sticky top-0 z-10 w-full bg-bg-secondary border-b border-bg-tertiary shrink-0">
        <div className="flex flex-wrap items-center gap-3 p-3">
          <a
            href="#/"
            className="text-accent hover:text-accent-light transition-colors shrink-0"
          >
            ← Back to Guitar Hero
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
        {/* Major 3NPS — full fretboard then 7 positions */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold text-text-primary mb-3">
            {rootId} Major 3NPS
          </h2>
          <p className="text-xs text-text-secondary mb-2">
            Full fretboard, then positions in fretboard order: 4 → 5 → 6 → 7 → 1 → 2 → 3. Root highlighted.
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
            {majorPositions.map((notes, idx) => (
              <PositionDiagram
                key={idx}
                notes={notes}
                title={FRETBOARD_ORDER_LABELS[idx]}
                rootSemitone={rootSemitone}
              />
            ))}
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
            {minorPositions.map((notes, idx) => (
              <PositionDiagram
                key={idx}
                notes={notes}
                title={FRETBOARD_ORDER_LABELS[idx]}
                rootSemitone={rootSemitone}
              />
            ))}
          </div>
        </section>

        <Section
          title="Pentatonic (A minor pentatonic) — hardcoded positions"
          positions={PENTATONIC_POSITIONS}
          maxPositions={5}
        />

        <Section
          title="Blues (A blues) — hardcoded positions"
          positions={BLUES_POSITIONS}
          maxPositions={5}
        />
      </div>
    </div>
  );
}

