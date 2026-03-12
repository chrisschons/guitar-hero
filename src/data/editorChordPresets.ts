import { BASIC_CHORDS, getActualFret } from './basicChords.js';

export type ChordPresetId =
  | 'open-e'
  | 'open-em'
  | 'open-a'
  | 'open-am'
  | 'open-d'
  | 'open-dm'
  | 'open-g'
  | 'open-c'
  | 'power-e5-2note'
  | 'power-e5-3note';

export type ChordPreset = {
  id: ChordPresetId;
  name: string;
  frets: (number | null)[];
};

function chordShapeToFrets(shape: { frets: number[]; startFret?: number }) {
  const startFret = shape.startFret ?? 0;
  // basicChords frets are [high e, B, G, D, A, E]; editor grid expects [0=high e ... 5=low E]
  return shape.frets.map((col, stringIndex) => {
    const f = getActualFret(col, startFret);
    return f < 0 ? null : f;
  });
}

export function getEditorChordPresets(): ChordPreset[] {
  const openMajor = BASIC_CHORDS.major || [];
  const openMinor = BASIC_CHORDS.minor || [];

  const findShape = (type: 'major' | 'minor', root: string) => {
    const list = type === 'major' ? openMajor : openMinor;
    return list.find((c) => c.root === root);
  };

  const presets: ChordPreset[] = [];

  const pushIf = (id: ChordPresetId, name: string, shape: any | undefined) => {
    if (!shape) return;
    presets.push({
      id,
      name,
      frets: chordShapeToFrets(shape),
    });
  };

  pushIf('open-e', 'Open E', findShape('major', 'E'));
  pushIf('open-em', 'Open Em', findShape('minor', 'E'));
  pushIf('open-a', 'Open A', findShape('major', 'A'));
  pushIf('open-am', 'Open Am', findShape('minor', 'A'));
  pushIf('open-d', 'Open D', findShape('major', 'D'));
  pushIf('open-dm', 'Open Dm', findShape('minor', 'D'));
  pushIf('open-g', 'Open G', findShape('major', 'G'));
  pushIf('open-c', 'Open C', findShape('major', 'C'));

  // Simple E5 power chord: 6/0 + 5/2 (+ 4/2)
  presets.push({
    id: 'power-e5-2note',
    name: 'E5 (2-note)',
    frets: [null, null, null, null, 2, 0],
  });
  presets.push({
    id: 'power-e5-3note',
    name: 'E5 (3-note)',
    frets: [null, null, 2, null, 2, 0],
  });

  return presets;
}

