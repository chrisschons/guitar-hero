export type TimeSignature = {
  num: number;
  denom: number;
};

export type BeatPosition = {
  bar: number;
  /**
   * 1-based index within the bar, according to the active subdivision grid
   * (e.g. 16 values per bar for 16th-note grid in 4/4).
   */
  subdivision: number;
};

export type Subdivision =
  | 1 // whole
  | 2 // half
  | 4 // quarter
  | 8 // eighth
  | 16 // sixteenth
  | 32;

export type TuningId = string;

export type NoteEvent = {
  /**
   * String index, 1 = highest string, 6 = lowest.
   */
  string: number;
  fret: number;

  /**
   * Position within the riff expressed as bar + subdivision.
   * This matches the existing grid / tab representation.
   */
  bar: number;
  subdivision: number;

  /**
   * Duration in grid subdivisions. For now this is optional because
   * existing riffs only store note onsets; duration can be inferred
   * later when we implement it.
   */
  durationSubdivisions?: number;

  /**
   * Non-MVP fields reserved for future use.
   */
  velocity?: number;
  articulation?: string;
};

export type ChordEvent = {
  root: string;
  quality?: string;
  extension?: string;
  bar: number;
  subdivision: number;
  durationSubdivisions?: number;
};

export type RiffMetadata = {
  createdAt?: string;
  modifiedAt?: string;
};

export type Riff = {
  id: string;
  name: string;

  /**
   * Canonical tempo for the riff. Existing data uses bpmRange,
   * so both are optional and can coexist.
   */
  tempo?: number;
  bpmRange?: {
    min: number;
    max: number;
  };

  timeSignature?: TimeSignature;

  key?: string;
  scale?: string;

  /**
   * Logical length in bars. Existing editor uses a separate `bars`
   * UI state, so this is optional for backward compatibility.
   */
  lengthBars?: number;

  /**
   * Tuning identifier (e.g. 'standard'); actual semitone arrays
   * live in data/tunings.
   */
  tuningId?: TuningId;

  instrument?: string;

  /**
   * Note and chord events define the content of the riff.
   * Chords are currently non-MVP and may remain empty.
   */
  notes: NoteEvent[];
  chords?: ChordEvent[];

  metadata?: RiffMetadata;

  /**
   * Existing field used to distinguish user riffs from presets.
   */
  style?: string;
};

