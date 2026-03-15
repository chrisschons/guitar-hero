import { ArrowLeft } from 'lucide-react';
import { Footer } from '../components/Footer';
import { BASIC_CHORDS, BASIC_CHORD_LABELS } from '../data/basicChords';
import { ChordDiagram } from '../components/ChordDiagram';

const CHORD_TYPES = ['major', 'minor', 'seventh'] as const;

export function Chords() {
  return (
    <div className="min-h-screen flex flex-col bg-bg-primary text-text-primary">
      <div className="flex-1 p-8 pb-24 max-w-6xl mx-auto w-full">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-text-primary mb-2">Chords</h1>
          <p className="text-text-secondary">
            Common open and moveable chord shapes. Root notes use the outline style; ○ = open
            string, × = mute.
          </p>
        </div>

        {CHORD_TYPES.map((typeId) => {
          const chords = BASIC_CHORDS[typeId] || [];
          if (!chords.length) return null;
          const label = BASIC_CHORD_LABELS[typeId] || typeId;
          return (
            <section key={typeId} className="mb-10">
              <h2 className="text-xl font-semibold text-text-primary mb-4">{label}</h2>
              <div className="flex flex-wrap gap-6">
                {chords.map((chord) => (
                  <ChordDiagram
                    key={`${typeId}-${chord.root}`}
                    chord={chord}
                    chordType={typeId}
                    title={`${chord.root}${
                      typeId === 'seventh' ? '7' : typeId === 'minor' ? 'm' : ''
                    }`}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <Footer disableMetronome disableTransport />
    </div>
  );
}

