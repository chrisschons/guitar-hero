import { EXERCISE_TYPES, getReferencePosition, getReferenceFullScale } from '../data/exerciseTypes';
import { BASIC_CHORDS, BASIC_CHORD_LABELS } from '../data/basicChords';
import { PositionDiagram } from '../components/PositionDiagram';
import { ChordDiagram } from '../components/ChordDiagram';

const SCALE_REFERENCE_IDS = ['pentatonic', 'blues', 'major-3nps', 'minor-3nps'];
const CHORD_TYPES = ['major', 'minor', 'seventh'];

export function Reference() {
  return (
    <div className="min-h-screen p-8 max-w-6xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-text-primary mb-2">
          Scale Reference
        </h1>
        <p className="text-text-secondary">
          Position diagrams for each scale type (neutral / key of A). Root notes use the outline style; other scale notes use the solid accent. Matches the app visualizer data.
        </p>
        <a
          href="#/"
          className="inline-block mt-4 text-accent hover:text-accent-light transition-colors"
        >
          ← Back to Guitar Hero
        </a>
      </header>

      {SCALE_REFERENCE_IDS.map((scaleTypeId) => {
        const type = EXERCISE_TYPES.find((t) => t.id === scaleTypeId);
        if (!type || !type.exercises.some((e) => e.positionIndex !== undefined))
          return null;

        const positionExercises = type.exercises.filter((e) => e.positionIndex !== undefined);
        if (!positionExercises.length) return null;

        const { notes: fullScaleNotes } = getReferenceFullScale(scaleTypeId);

        return (
          <section key={scaleTypeId} className="mb-10">
            <h2 className="text-xl font-semibold text-text-primary mb-4">
              {type.name}
            </h2>
            {fullScaleNotes.length > 0 && (
              <div className="mb-6">
                <PositionDiagram
                  notes={fullScaleNotes}
                  title="Full scale (frets 0–23)"
                  fullScale
                />
              </div>
            )}
            <h3 className="text-sm font-medium text-text-secondary mb-3">Positions</h3>
            <div className="flex flex-wrap gap-6">
              {positionExercises.map((ex) => {
                const { notes } = getReferencePosition(scaleTypeId, ex.positionIndex);
                return (
                  <PositionDiagram
                    key={ex.id}
                    notes={notes}
                    title={ex.name}
                  />
                );
              })}
            </div>
          </section>
        );
      })}

      {/* Basic Chords */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold text-text-primary mb-4">Basic Chords</h2>
        <p className="text-text-secondary text-sm mb-4">
          Common open and moveable chord shapes. Root notes use the outline style; ○ = open string, × = mute.
        </p>
        {CHORD_TYPES.map((typeId) => {
          const chords = BASIC_CHORDS[typeId] || [];
          if (!chords.length) return null;
          const label = BASIC_CHORD_LABELS[typeId] || typeId;
          return (
            <div key={typeId} className="mb-8">
              <h3 className="text-sm font-medium text-text-secondary mb-3">{label}</h3>
              <div className="flex flex-wrap gap-6">
                {chords.map((chord) => (
                  <ChordDiagram
                    key={`${typeId}-${chord.root}`}
                    chord={chord}
                    chordType={typeId}
                    title={`${chord.root}${typeId === 'seventh' ? '7' : typeId === 'minor' ? 'm' : ''}`}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
