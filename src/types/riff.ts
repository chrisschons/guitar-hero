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

/**
 * Rhythm group: a span of slots with a rhythm interpretation (normal or tuplet).
 * Tuplets compress N notes into M subdivisions; grid slot count is unchanged.
 */
export type RhythmGroup = {
  id: string;
  startSlot: number;
  endSlot: number;
  type: 'normal' | 'tuplet';
  /** For tuplets: notesInGroup / slotsOccupied, e.g. { n: 3, d: 4 } for triplet in 4 slots. */
  tupletRatio?: { n: number; d: number };
  /** Strings this group applies to (empty = all / inferred from notes). */
  strings?: number[];
};

/**
 * Rest event: first-class rest within a slot span, optionally inside a rhythm group.
 */
export type RestEvent = {
  id?: string;
  bar: number;
  subdivision: number;
  durationSubdivisions?: number;
  rhythmGroupId?: string;
  indexInGroup?: number;
};

export type NoteEvent = {
  /**
   * Optional stable id for editor (e.g. selection, resize by note).
   * Grid editor generates if missing.
   */
  id?: string;

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
   * If set, this note belongs to a RhythmGroup; onset/duration may be derived from group + indexInGroup.
   */
  rhythmGroupId?: string;
  /** Index within the group (0-based). Used for tuplet timing and display order. */
  indexInGroup?: number;

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

  tempo?: number;

  timeSignature?: TimeSignature;

  /**
   * Logical length in bars. Existing editor uses a separate `bars`
   * UI state, so this is optional for backward compatibility.
   */
  lengthBars?: number;

  /**
   * Tuning identifier (e.g. 'standard'); actual semitone arrays
   * live in data/tunings.
   */
  instrument?: string;

  /**
   * Note and chord events define the content of the riff.
   * Chords are currently non-MVP and may remain empty.
   */
  notes: NoteEvent[];
  chords?: ChordEvent[];

  /**
   * Rhythm groups (normal duration spans or tuplets) that notes can reference via rhythmGroupId.
   */
  rhythmGroups?: RhythmGroup[];

  /**
   * Explicit rest events (optional). If not used, rest = absence of note in a slot.
   */
  rests?: RestEvent[];

  metadata?: RiffMetadata;

  /**
   * Existing field used to distinguish user riffs from presets.
   */
  style?: string;
};

