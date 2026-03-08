/**
 * Chord progression tab generator.
 * Progression = list of { chordTypeId, root, durationBeats }. Uses basicChords for shapes.
 */

import { BASIC_CHORDS } from './basicChords.js';

/**
 * Convert a chord shape (frets array, -1 = mute) to a tab column (null = mute).
 * @param {number[]} frets - length 6
 * @returns {(number | null)[]}
 */
function chordShapeToColumn(frets) {
  return frets.map((f) => (f === -1 ? null : f));
}

/**
 * Get chord shape for a given type and root from BASIC_CHORDS.
 * @param {string} chordTypeId - 'major' | 'minor' | 'seventh'
 * @param {string} root - e.g. 'A', 'D'
 * @returns {(number | null)[] | null}
 */
function getChordColumn(chordTypeId, root) {
  const list = BASIC_CHORDS[chordTypeId];
  if (!list) return null;
  const chord = list.find((c) => c.root === root);
  if (!chord || !chord.frets) return null;
  return chordShapeToColumn(chord.frets);
}

/**
 * Generate tab from a chord progression. Each chord repeats for durationBeats * subdivision columns.
 * @param {{ chordTypeId: string, root: string, durationBeats: number }[]} progression
 * @param {number} subdivision - notes per beat (e.g. 2 for eighth notes)
 * @returns {(number | null)[][]}
 */
export function generateChordProgressionTab(progression, subdivision = 2) {
  /** @type {(number | null)[][]} */
  const tab = [];
  for (const step of progression) {
    const column = getChordColumn(step.chordTypeId, step.root);
    if (!column) continue;
    const numColumns = step.durationBeats * subdivision;
    for (let i = 0; i < numColumns; i++) {
      tab.push([...column]);
    }
  }
  return tab;
}

/** Preset progressions for the chord-progressions exercise type */
export const CHORD_PROGRESSIONS = [
  {
    id: 'i-iv-v-a',
    name: 'I–IV–V in A',
    progression: [
      { chordTypeId: 'major', root: 'A', durationBeats: 4 },
      { chordTypeId: 'major', root: 'D', durationBeats: 4 },
      { chordTypeId: 'major', root: 'E', durationBeats: 4 },
    ],
  },
  {
    id: 'i-iv-v-g',
    name: 'I–IV–V in G',
    progression: [
      { chordTypeId: 'major', root: 'G', durationBeats: 4 },
      { chordTypeId: 'major', root: 'C', durationBeats: 4 },
      { chordTypeId: 'major', root: 'D', durationBeats: 4 },
    ],
  },
  {
    id: 'i-vi-iv-v',
    name: 'I–vi–IV–V (pop)',
    progression: [
      { chordTypeId: 'major', root: 'G', durationBeats: 2 },
      { chordTypeId: 'minor', root: 'E', durationBeats: 2 },
      { chordTypeId: 'major', root: 'C', durationBeats: 2 },
      { chordTypeId: 'major', root: 'D', durationBeats: 2 },
    ],
  },
];
