export type PitchClass = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;

export type KeyQuality = 'major' | 'minor';

export type KeySignature = {
  root: PitchClass;
  quality: KeyQuality;
};

export type ScaleId =
  | 'major'
  | 'natural-minor'
  | 'harmonic-minor'
  | 'melodic-minor'
  | 'pentatonic'
  | 'blues'
  | string;

export type ExerciseTypeId = string;

