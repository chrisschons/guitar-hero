/**
 * Note representation and semitone math.
 * All notes are pitch classes 0–11 (C=0 … B=11).
 * No UI; pure functions only.
 */

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** Root letter (or 'C#', etc.) to semitone 0–11 */
export const ROOT_SEMITONES = Object.fromEntries(
  NOTE_NAMES.map((name, i) => [name, i])
);

/**
 * Get pitch class at a string/fret for a given tuning.
 * @param {number} stringIndex - 0 = high e, 5 = low E
 * @param {number} fret - 0 = open, 1–24
 * @param {number[]} tuning - length 6, semitones from C per open string
 * @returns {number} pitch class 0–11
 */
export function getNoteAt(stringIndex, fret, tuning) {
  const open = tuning[stringIndex];
  return (open + fret) % 12;
}

/**
 * Transpose a pitch class by a number of semitones.
 * @param {number} note - pitch class 0–11
 * @param {number} interval - semitones up (negative for down)
 * @returns {number} pitch class 0–11
 */
export function transpose(note, interval) {
  return ((note + interval) % 12 + 12) % 12;
}

/**
 * Get note name for display.
 * @param {number} semitone - 0–11
 * @returns {string}
 */
export function getNoteName(semitone) {
  return NOTE_NAMES[semitone % 12] ?? '?';
}

/**
 * Get display labels for each string (open note names) for a tuning.
 * Index 0 = high string (often shown lowercase, e.g. "e").
 * @param {number[]} tuning - length 6, semitones from C per open string
 * @returns {string[]} length 6, e.g. ['e', 'B', 'G', 'D', 'A', 'E'] for standard
 */
export function getStringLabels(tuning) {
  if (!tuning || tuning.length !== 6) return ['e', 'B', 'G', 'D', 'A', 'E'];
  return tuning.map((semitone, i) => {
    const name = getNoteName(semitone);
    return i === 0 ? name.toLowerCase() : name;
  });
}

const A4_HZ = 440;
const A4_MIDI = 69;

/**
 * Convert frequency (Hz) to pitch class (0–11), note name, and cents offset from nearest semitone.
 * @param {number} frequencyHz
 * @returns {{ pitchClass: number, noteName: string, cents: number } | null} cents in [-50, 50], or null if invalid
 */
export function frequencyToNoteCents(frequencyHz) {
  if (!Number.isFinite(frequencyHz) || frequencyHz <= 0) return null;
  const midi = A4_MIDI + 12 * Math.log2(frequencyHz / A4_HZ);
  const rounded = Math.round(midi);
  const pitchClass = ((rounded % 12) + 12) % 12;
  const cents = (midi - rounded) * 100;
  return {
    pitchClass,
    noteName: getNoteName(pitchClass),
    cents: Math.max(-50, Math.min(50, cents)),
  };
}
