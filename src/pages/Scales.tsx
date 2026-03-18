import { useState } from 'react';
import { Footer } from '../components/Footer';
import { Button } from '../components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/Select';
import { PENTATONIC_POSITIONS, BLUES_POSITIONS } from '../data/exerciseTypes';
import {
  C_MAJOR_3NPS_POSITIONS,
  getMajor3NPSPositions,
  getMinor3NPSPositions,
  get3NPSStartingOrder,
} from '../data/scalePositions';
import {
  getMajorFirstNPositionNotes,
} from '../data/neutral3NPS';
import { MAJOR_CAGED_POSITIONS, MINOR_CAGED_POSITIONS } from '../data/scaleCagedPositions';
import { PositionDiagram } from '../components/PositionDiagram';
import { getNoteAt, ROOT_SEMITONES, NOTE_NAMES } from '../core/music';
import { STANDARD_TUNING, TUNINGS_LIST } from '../data/tunings';
import { useLocalStorage } from '../hooks/useLocalStorage';

const ROOT_SEMITONE_A = 9;

type PitchSet = Set<number>;

type BoxStart = {
  position: 1 | 2 | 3 | 4 | 5;
  fret: number;
};

const MAJOR_BOX_OFFSETS: Record<1 | 2 | 3 | 4 | 5, number> = {
  1: 2, // 1→2
  2: 3, // 2→3
  3: 2, // 3→4
  4: 2, // 4→5
  5: 3, // 5→1
};

const MINOR_BOX_OFFSETS: Record<1 | 2 | 3 | 4 | 5, number> = {
  // Minor position reference correction:
  // their p1 -> our p4, their p2 -> our p5 (rotated numbering).
  // Their minor offsets: 2 3 2 2 3 are applied after remapping positions.
  1: 3, // 1→2 (compensates the 5→1 fix)
  2: 2, // 2→3
  3: 3, // 3→4
  4: 2, // 4→5
  5: 2, // 5→1 (fixed +1 fret drift)
};

const MAJOR_BOX_START: Record<number, BoxStart> = {
  0: { position: 3, fret: 0 }, // C
  1: { position: 3, fret: 1 }, // C#
  2: { position: 3, fret: 2 }, // D
  3: { position: 2, fret: 0 }, // D#
  4: { position: 2, fret: 1 }, // E
  5: { position: 1, fret: 0 }, // F
  6: { position: 1, fret: 1 }, // F#
  7: { position: 2, fret: 4 }, // G
  8: { position: 5, fret: 0 }, // G#
  9: { position: 5, fret: 1 }, // A
  10: { position: 4, fret: 0 }, // A#
  11: { position: 4, fret: 1 }, // B
};

const MINOR_BOX_START: Record<number, BoxStart> = {
  // Your provided table (pitch class → start position/fret)
  // Position remap implied by: their p1 -> our p4, their p2 -> our p5
  // (rotation by +3): their p3 -> our p1, their p4 -> our p2, their p5 -> our p3.
  0: { position: 3, fret: 0 }, // C (their p5 -> our p3)
  1: { position: 3, fret: 1 }, // C#
  2: { position: 2, fret: 0 }, // D (their p4 -> our p2)
  3: { position: 2, fret: 1 }, // D#
  4: { position: 2, fret: 2 }, // E
  5: { position: 1, fret: 0 }, // F (their p3 -> our p1)
  6: { position: 1, fret: 1 }, // F#
  7: { position: 5, fret: 0 }, // G (their p2 -> our p5)
  8: { position: 5, fret: 1 }, // G#
  9: { position: 4, fret: 0 }, // A (their p1 -> our p4)
  10: { position: 4, fret: 1 }, // A#
  11: { position: 4, fret: 2 }, // B
};

const CAGED_SHAPE_NAME_BY_POS: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: 'E',
  2: 'D',
  3: 'C',
  4: 'A',
  5: 'G',
};

function cagedShapeLabel(pos: 1 | 2 | 3 | 4 | 5): string {
  return `${CAGED_SHAPE_NAME_BY_POS[pos]}-Shape (pattern ${pos})`;
}

function asNotePairs(notes: unknown): [number, number][] {
  if (!Array.isArray(notes)) return [];
  return (notes as unknown[]).flatMap((n) => {
    if (!Array.isArray(n) || n.length < 2) return [];
    const a = Number(n[0]);
    const b = Number(n[1]);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return [];
    return [[a, b] as [number, number]];
  });
}

function fullFretboardScaleNotes(pitchSet: PitchSet, tuning = STANDARD_TUNING): [number, number][] {
  const notes: [number, number][] = [];
  for (let stringIndex = 0; stringIndex < 6; stringIndex++) {
    for (let fret = 0; fret <= 23; fret++) {
      const pitch = getNoteAt(stringIndex, fret, tuning);
      if (pitchSet.has(pitch)) notes.push([stringIndex, fret]);
    }
  }
  return notes;
}

function majorPitchSet(rootSemitone: number): PitchSet {
  return new Set([0, 2, 4, 5, 7, 9, 11].map((i) => (i + rootSemitone) % 12));
}

function minorPitchSet(rootSemitone: number): PitchSet {
  return new Set([0, 2, 3, 5, 7, 8, 10].map((i) => (i + rootSemitone) % 12));
}

function getLowEAnchor(notes: [number, number][]): number | null {
  let anchor: number | null = null;
  for (const [stringIndex, fret] of notes) {
    if (stringIndex === 5 && (anchor === null || fret < anchor)) {
      anchor = fret;
    }
  }
  if (anchor === null) {
    for (const [, fret] of notes) {
      if (anchor === null || fret < anchor) {
        anchor = fret;
      }
    }
  }
  return anchor;
}

const A_PENTATONIC_PITCHES: PitchSet = new Set(
  [0, 3, 5, 7, 10].map((i) => (i + (ROOT_SEMITONE_A ?? 9)) % 12)
);
const A_BLUES_PITCHES: PitchSet = new Set(
  [0, 3, 5, 6, 7, 10].map((i) => (i + (ROOT_SEMITONE_A ?? 9)) % 12)
);
const A_MINOR_FULL_NOTES: [number, number][] = fullFretboardScaleNotes(
  minorPitchSet(ROOT_SEMITONE_A)
);

export function Scales() {
  const [rootId, setRootId] = useLocalStorage('guitar-hero-debug-root', 'C');
  const [scaleTab, setScaleTab] = useState<'mapper' | 'major' | 'minor'>('major');
  const [showCanonicalMajor, setShowCanonicalMajor] = useState(false);
  const [showCanonicalMinor, setShowCanonicalMinor] = useState(false);
  const [mapperTuningId, setMapperTuningId] = useLocalStorage('guitar-hero-scale-mapper-tuning', 'standard');
  const rootSemitone = ROOT_SEMITONES[rootId] ?? 0;
  const neutralRootSemitone = ROOT_SEMITONES.C ?? 0;

  const mapperTuning = TUNINGS_LIST.find((t) => t.id === mapperTuningId)?.semitones ?? STANDARD_TUNING;

  const majorFullNotes = fullFretboardScaleNotes(majorPitchSet(rootSemitone));
  const minorFullNotes = fullFretboardScaleNotes(minorPitchSet(rootSemitone));
  const majorPositions = getMajor3NPSPositions(rootSemitone);
  const minorPositions = getMinor3NPSPositions(rootSemitone);
  const majorOrder = get3NPSStartingOrder(rootSemitone, 'major');
  const minorOrder = get3NPSStartingOrder(rootSemitone, 'minor');
  const majorFirstSevenNotes = asNotePairs(getMajorFirstNPositionNotes(rootSemitone, 7).flat());
  const minorFirstSevenNotes = asNotePairs(minorPositions.flat());
  const mapperMajorPitchSet = majorPitchSet(rootSemitone);
  const mapperMinorPitchSet = minorPitchSet(rootSemitone);
  const neutralMajorPitchSet = majorPitchSet(neutralRootSemitone);
  const neutralMinorPitchSet = minorPitchSet(neutralRootSemitone);

  function mapCagedPatternToNotes(
    patternRows: string[],
    rootPc: number,
    scalePitchSet: PitchSet,
    tuning = STANDARD_TUNING,
    explicitBaseFret: number | null = null,
    minBaseFret: number | null = null
  ): [number, number][] {
    const rows = patternRows.slice(0, 6);
    const maxCols =
      rows.reduce((max, r) => (typeof r === 'string' ? Math.max(max, r.length) : max), 0) || 0;
    // Prefer anchoring off low string (5) if it contains an 'r', otherwise first row that has 'r'.
    let anchorString = 5;
    let anchorCol = rows[5]?.indexOf('r') ?? -1;
    if (anchorCol < 0) {
      for (let s = 5; s >= 0; s -= 1) {
        const idx = rows[s]?.indexOf('r') ?? -1;
        if (idx >= 0) {
          anchorString = s;
          anchorCol = idx;
          break;
        }
      }
    }
    if (anchorCol < 0) anchorCol = 0;

    let baseFret = 0;
    if (explicitBaseFret != null) {
      baseFret = explicitBaseFret;
    } else {
      const candidates: { rootFret: number; baseFret: number; boxMin: number; boxMax: number }[] = [];
      for (let fret = 0; fret <= 23; fret += 1) {
        const pitch = getNoteAt(anchorString, fret, tuning);
        if (pitch !== rootPc) continue;
        const bf = fret - anchorCol;
        const boxMin = bf;
        const boxMax = bf + maxCols - 1;
        candidates.push({ rootFret: fret, baseFret: bf, boxMin, boxMax });
      }

      if (candidates.length === 0) {
        baseFret = 0;
      } else {
        // Default: pick the lowest non-negative baseFret (keeps Position 1 correct, e.g. C at fret 0).
        const nonNegative = candidates
          .filter((c) => c.baseFret >= 0)
          .sort((a, b) => a.baseFret - b.baseFret);

        // When mapping a sequence of boxes, keep them from wrapping backwards by enforcing a minimum.
        const meetsMin =
          minBaseFret == null
            ? nonNegative
            : nonNegative.filter((c) => c.baseFret >= minBaseFret);

        if (meetsMin.length) {
          baseFret = meetsMin[0].baseFret;
        } else if (nonNegative.length) {
          baseFret = nonNegative[0].baseFret;
        } else {
          // Fallback: everything is negative (rare); pick the highest (closest to 0).
          baseFret = candidates.reduce(
            (best, c) => Math.max(best, c.baseFret),
            candidates[0].baseFret
          );
        }
      }
    }

    const notes: [number, number][] = [];
    for (let s = 0; s < 6; s += 1) {
      const row = rows[s] ?? '';
      for (let c = 0; c < maxCols; c += 1) {
        const ch = row[c] ?? '-';
        if (ch === '-') continue;
        const fret = baseFret + c;
        if (fret < 0 || fret > 23) continue;
        const pitch = getNoteAt(s, fret, tuning);
        if (ch === 'r') {
          notes.push([s, fret]);
          continue;
        }
        // Only include if it matches the scale pitch set.
        if (scalePitchSet.has(pitch)) {
          notes.push([s, fret]);
        }
      }
    }
    return notes;
  }

  function mapCagedPositionSet(
    patterns: Record<number, string[]>,
    rootPc: number,
    pitchSet: PitchSet,
    tuning = STANDARD_TUNING,
    boxStart?: BoxStart,
    boxOffsets?: Record<1 | 2 | 3 | 4 | 5, number>
  ): [number, number][][] {
    const result: [number, number][][] = [];
    let minBaseFret: number | null = null;

    if (boxStart && boxOffsets) {
      // Deterministic sequence using configured start (position, fret) and global offsets.
      let currentPos = boxStart.position;
      let currentFret = boxStart.fret;
      for (let i = 0; i < 5; i += 1) {
        const pattern = patterns[currentPos];
        if (!pattern) {
          result.push([]);
        } else {
          const notes = mapCagedPatternToNotes(
            pattern,
            rootPc,
            pitchSet,
            tuning,
            currentFret,
            minBaseFret
          );
          result.push(notes);
          const frets = notes.map(([, f]) => f);
          if (frets.length) {
            const leftEdge = Math.min(...frets);
            minBaseFret = leftEdge;
          }
        }
        const offset = boxOffsets[currentPos] ?? 0;
        currentFret += offset;
        currentPos = ((currentPos % 5) + 1) as 1 | 2 | 3 | 4 | 5;
      }
      return result;
    }

    // Fallback: derive sequence only from root search and minBaseFret (legacy behavior).
    for (const position of [1, 2, 3, 4, 5]) {
      const pattern = patterns[position];
      if (!pattern) {
        result.push([]);
        continue;
      }
      const notes = mapCagedPatternToNotes(pattern, rootPc, pitchSet, tuning, null, minBaseFret);
      result.push(notes);
      const frets = notes.map(([, f]) => f);
      if (frets.length) {
        // Ensure next position doesn't "wrap back" below this position's left edge.
        const leftEdge = Math.min(...frets);
        minBaseFret = leftEdge;
      }
    }
    return result;
  }

  const mapperMajorNotesByPos = (() => {
    const pc = ((rootSemitone % 12) + 12) % 12;
    const start = MAJOR_BOX_START[pc];
    if (!start) {
      return mapCagedPositionSet(
        MAJOR_CAGED_POSITIONS,
        rootSemitone,
        mapperMajorPitchSet,
        mapperTuning
      );
    }
    return mapCagedPositionSet(
      MAJOR_CAGED_POSITIONS,
      rootSemitone,
      mapperMajorPitchSet,
      mapperTuning,
      start,
      MAJOR_BOX_OFFSETS
    );
  })();

  const mapperMajorOrder: (1 | 2 | 3 | 4 | 5)[] = (() => {
    const pc = ((rootSemitone % 12) + 12) % 12;
    const start = MAJOR_BOX_START[pc];
    if (!start) return [1, 2, 3, 4, 5];
    const order: (1 | 2 | 3 | 4 | 5)[] = [];
    let pos = start.position;
    for (let i = 0; i < 5; i += 1) {
      order.push(pos);
      pos = ((pos % 5) + 1) as 1 | 2 | 3 | 4 | 5;
    }
    return order;
  })();
  const mapperMinorNotesByPos = (() => {
    const pc = ((rootSemitone % 12) + 12) % 12;
    const start = MINOR_BOX_START[pc];
    if (!start) {
      return mapCagedPositionSet(
        MINOR_CAGED_POSITIONS,
        rootSemitone,
        mapperMinorPitchSet,
        mapperTuning
      );
    }
    return mapCagedPositionSet(
      MINOR_CAGED_POSITIONS,
      rootSemitone,
      mapperMinorPitchSet,
      mapperTuning,
      start,
      MINOR_BOX_OFFSETS
    );
  })();

  const mapperMinorOrder: (1 | 2 | 3 | 4 | 5)[] = (() => {
    const pc = ((rootSemitone % 12) + 12) % 12;
    const start = MINOR_BOX_START[pc];
    if (!start) return [1, 2, 3, 4, 5];
    const order: (1 | 2 | 3 | 4 | 5)[] = [];
    let pos = start.position;
    for (let i = 0; i < 5; i += 1) {
      order.push(pos);
      pos = ((pos % 5) + 1) as 1 | 2 | 3 | 4 | 5;
    }
    return order;
  })();

  const neutralMajorNotesByPos = mapCagedPositionSet(
    MAJOR_CAGED_POSITIONS,
    neutralRootSemitone,
    neutralMajorPitchSet,
    STANDARD_TUNING
  );
  const neutralMinorNotesByPos = mapCagedPositionSet(
    MINOR_CAGED_POSITIONS,
    neutralRootSemitone,
    neutralMinorPitchSet,
    STANDARD_TUNING
  );

  return (
    <div className="min-h-screen flex flex-col text-foreground relative">
      <header className="sticky top-0 z-20 w-full bg-secondary border-b border-border">
        <Tabs defaultValue="mapper" value={scaleTab} onValueChange={(v) => setScaleTab(v as 'mapper' | 'major' | 'minor')} className="w-full p-0">
          <TabsList variant="line" className="w-full justify-start rounded-none gap-0 bg-transparent px-6">
          <TabsTrigger value="mapper" className="py-3">Mapper</TabsTrigger>
            <TabsTrigger value="major" className="py-3">Major Scale</TabsTrigger>
            <TabsTrigger value="minor" className="py-3">Minor Scale</TabsTrigger>
          </TabsList>
        </Tabs>
      </header>

      <div className="flex-1 p-6 pb-24 mx-auto w-full">
        
        <Tabs defaultValue="mapper" value={scaleTab} onValueChange={(v) => setScaleTab(v as 'mapper' | 'major' | 'minor')} className="w-full">
           {/* Mapper Scale Tab */}
           <TabsContent value="mapper" className="space-y-8">
            <section className="mb-4">
              <h2 className="text-xl font-semibold text-foreground mb-3">
                New Mapping system
              </h2>
              <div className="flex flex-wrap gap-3 items-center">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground font-medium">Tuning:</span>
                  <Select value={mapperTuningId} onValueChange={setMapperTuningId}>
                    <SelectTrigger size="sm" className="min-w-[160px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TUNINGS_LIST.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                This tab uses a single mapper: pattern grid + (root key) + tuning → frets.
                It’s intentionally simple and will be improved to support richer patterns (3NPS, pentatonic) with one shared engine.
              </p>
            </section>
           
            <section className="mb-8">
              <h3 className="text-sm font-semibold text-foreground mb-2">
                {rootId} major — positions 1–5
              </h3>
             
                  <div className="text-xs font-semibold text-muted-foreground mb-4">
                    Major boxes 1–5 (neutral patterns)
                  </div>
                  <div className="flex flex-wrap gap-4 justify-start mb-4">
                    {[1, 2, 3, 4, 5].map((position) => {
                      const notes = neutralMajorNotesByPos[position - 1] ?? [];
                      return (
                        <PositionDiagram
                          key={`neutral-major-${position}`}
                          notes={notes}
                          title={cagedShapeLabel(position as 1 | 2 | 3 | 4 | 5)}
                          rootSemitone={neutralRootSemitone}
                          tuning={STANDARD_TUNING}
                          showFretNumbers={false}
                          showNoteLabels={false}
                        />
                      );
                    })}
                  </div>
              
              <div className="flex flex-wrap gap-4 justify-start">
                {mapperMajorNotesByPos.map((notes, idx) => {
                  const canonicalPos = mapperMajorOrder[idx] ?? ((idx + 1) as 1 | 2 | 3 | 4 | 5);
                  return (
                    <PositionDiagram
                      key={`major-${canonicalPos}-${idx}`}
                      notes={notes}
                      title={cagedShapeLabel(canonicalPos)}
                      rootSemitone={rootSemitone}
                      tuning={mapperTuning}
                    />
                  );
                })}
              </div>
            </section>
            <section className="mb-8">
              <h3 className="text-sm font-semibold text-foreground mb-2">
                {rootId} natural minor — positions 1–5
              </h3>
           
                  <div className="text-xs font-semibold text-muted-foreground mb-4">
                    Natural minor boxes 1–5 (neutral patterns)
                  </div>
                  <div className="flex flex-wrap gap-4 justify-start mb-4">
                    {[1, 2, 3, 4, 5].map((position) => {
                      const notes = neutralMinorNotesByPos[position - 1] ?? [];
                      return (
                        <PositionDiagram
                          key={`neutral-minor-${position}`}
                          notes={notes}
                          title={cagedShapeLabel(position as 1 | 2 | 3 | 4 | 5)}
                          rootSemitone={neutralRootSemitone}
                          tuning={STANDARD_TUNING}
                          showFretNumbers={false}
                          showNoteLabels={false}
                        />
                      );
                    })}
                  </div>
                
              <div className="flex flex-wrap gap-4 justify-start">
                {mapperMinorNotesByPos.map((notes, idx) => {
                  const canonicalPos =
                    mapperMinorOrder[idx] ?? ((idx + 1) as 1 | 2 | 3 | 4 | 5);
                  return (
                    <PositionDiagram
                      key={`minor-${canonicalPos}-${idx}`}
                      notes={notes}
                      title={cagedShapeLabel(canonicalPos)}
                      rootSemitone={rootSemitone}
                      tuning={mapperTuning}
                    />
                  );
                })}
              </div>
            </section>
           </TabsContent>
          {/* Major Scale Tab */}
          <TabsContent value="major" className="space-y-8">
            <section className="mb-4">
              <button
                type="button"
                onClick={() => setShowCanonicalMajor((prev) => !prev)}
                className="flex items-center justify-between w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors"
              >
                <span className="font-semibold text-muted-foreground">
                  C Major 3NPS — canonical positions (1–7)
                </span>
                <span className="text-xs text-muted-foreground">
                  {showCanonicalMajor ? 'Hide' : 'Show'}
                </span>
              </button>
              {showCanonicalMajor && (
                <div className="mt-3 flex flex-wrap gap-3 justify-start">
                  {C_MAJOR_3NPS_POSITIONS.map((notes, idx) => (
                    <PositionDiagram
                      key={idx}
                      notes={asNotePairs(notes)}
                      title={`Position ${idx + 1}`}
                      rootSemitone={ROOT_SEMITONES.C ?? 0}
                      showFretNumbers={false}
                      showNoteLabels={false}
                    />
                  ))}
                </div>
              )}
            </section>

            <section className="mb-10">
              <h2 className="text-xl font-semibold text-foreground mb-3">
                {rootId} Major 3NPS
              </h2>
             
              <p className="text-xs text-muted-foreground mb-2">
                Full fretboard, then positions ordered by lowest fret (closest to nut first). Root
                highlighted. Labels remain canonical (Position 1–7).
              </p>
              <div className="mb-4">
                <PositionDiagram
                  notes={majorFullNotes}
                  title={`${rootId} major 3NPS — full fretboard`}
                  fullScale
                  rootSemitone={rootSemitone}
                />
              </div>
              <div className="mb-4">
                <PositionDiagram
                  notes={majorFirstSevenNotes}
                  title={`${rootId} major 3NPS — positions 1–7 (neutral shapes)`}
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
                      notes={asNotePairs(notes)}
                      title={`Position ${canonicalIndex + 1}`}
                      rootSemitone={rootSemitone}
                    />
                  );
                })}
              </div>
            </section>
          </TabsContent>

          {/* Minor Scale Tab */}
          <TabsContent value="minor" className="space-y-8">
            <section className="mb-4">
              <button
                type="button"
                onClick={() => setShowCanonicalMinor((prev) => !prev)}
                className="flex items-center justify-between w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors"
              >
                <span className="font-semibold text-muted-foreground">
                  C Natural Minor 3NPS — canonical positions (1–7)
                </span>
                <span className="text-xs text-muted-foreground">
                  {showCanonicalMinor ? 'Hide' : 'Show'}
                </span>
              </button>
              {showCanonicalMinor && (
                <div className="mt-3 flex flex-wrap gap-3 justify-start">
                  {getMinor3NPSPositions(ROOT_SEMITONES.C ?? 0).map((notes, idx) => (
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
              )}
            </section>

            <section className="mb-10">
              <h2 className="text-xl font-semibold text-foreground mb-3">
                {rootId} natural minor 3NPS
              </h2>
              <p className="text-xs text-muted-foreground mb-2">
                Derived from major (b3). Full fretboard, then a continuous run of positions 1–7, then
                positions in fretboard order. Root highlighted.
              </p>
              <div className="mb-4">
                <PositionDiagram
                  notes={minorFullNotes}
                  title={`${rootId} natural minor 3NPS — full fretboard`}
                  fullScale
                  rootSemitone={rootSemitone}
                />
              </div>
              <div className="mb-4">
                <PositionDiagram
                  notes={minorFirstSevenNotes}
                  title={`${rootId} natural minor 3NPS — positions 1–7`}
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
                      notes={asNotePairs(notes)}
                      title={`Position ${canonicalIndex + 1}`}
                      rootSemitone={rootSemitone}
                    />
                  );
                })}
              </div>
            </section>
            <hr className="my-8 border-border" />

        <section className="mb-10">
          <h2 className="text-xl font-semibold text-foreground mb-3">A minor pentatonic</h2>
          <p className="text-xs text-muted-foreground mb-2">
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
                notes={asNotePairs(notes)}
                title={`Position ${idx + 1}`}
                rootSemitone={ROOT_SEMITONE_A}
              />
            ))}
          </div>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold text-foreground mb-3">A blues</h2>
          <p className="text-xs text-muted-foreground mb-2">
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
                notes={asNotePairs(notes)}
                title={`Position ${idx + 1}`}
                rootSemitone={ROOT_SEMITONE_A}
              />
            ))}
          </div>
        </section>
          </TabsContent>
        </Tabs>

        
      </div>

      <Footer disableMetronome disableTransport keySelector={
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-medium">Key:</span>
          <div className="flex items-center gap-2">
            {NOTE_NAMES.map((name) => (
              <Button
              className="w-[40px]"
                key={name}
                variant={rootId === name ? 'default' : 'outline'}
                size="lg"
                onClick={() => setRootId(name)}
              >
                {name}
              </Button>
            ))}
          </div>
        </div>
      } />
    </div>
  );
}
