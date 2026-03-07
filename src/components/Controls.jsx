import { Play, Pause, ArrowLeftToLine, Tally3 } from 'lucide-react';
import { ROOT_NOTES, EXERCISE_TYPES, SUBDIVISIONS } from '../data/exerciseTypes';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/Select';
import { Slider } from './ui/Slider';

export function Controls({
  rootNote,
  onRootChange,
  typeId,
  onTypeChange,
  exerciseId,
  exercises,
  onExerciseChange,
  patternId,
  patterns,
  onPatternChange,
  subdivision,
  onSubdivisionChange,
  bpm,
  onBpmChange,
  isPlaying,
  onPlayToggle,
  onReset,
  metronomeVolume,
  onMetronomeVolumeChange
}) {
  return (
    <div className="flex flex-wrap gap-3 justify-center items-center p-3 bg-bg-secondary rounded-lg mb-4">
      <Select value={rootNote} onValueChange={onRootChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ROOT_NOTES.map((root) => (
            <SelectItem key={root.id} value={root.id}>
              {root.id}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={typeId} onValueChange={onTypeChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {EXERCISE_TYPES.map((type) => (
            <SelectItem key={type.id} value={type.id}>
              {type.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={exerciseId} onValueChange={onExerciseChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {exercises.map((ex) => (
            <SelectItem key={ex.id} value={ex.id}>
              {ex.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {patterns.length > 1 && (
        <Select value={patternId} onValueChange={onPatternChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {patterns.map((pattern) => (
              <SelectItem key={pattern.id} value={pattern.id}>
                {pattern.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <Select value={String(subdivision)} onValueChange={(val) => onSubdivisionChange(Number(val))}>
        <SelectTrigger>
          {subdivision === 3 ? <Tally3 size={16} /> : <SelectValue />}
        </SelectTrigger>
        <SelectContent>
          {SUBDIVISIONS.map((sub) => (
            <SelectItem key={sub.id} value={String(sub.id)}>
              {sub.id === 3 ? <Tally3 size={16} /> : sub.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex items-center gap-2">
        <span className="text-xs text-text-secondary w-7 text-right">{bpm}</span>
        <Slider
          value={[bpm]}
          onValueChange={([value]) => onBpmChange(value)}
          min={40}
          max={220}
          step={1}
          className="w-[100px]"
        />
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-text-secondary">Click</span>
        <Slider
          value={[metronomeVolume]}
          onValueChange={([value]) => onMetronomeVolumeChange(value)}
          min={0}
          max={1}
          step={0.05}
          className="w-[60px]"
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={onPlayToggle}
          className="p-2 bg-accent text-white rounded cursor-pointer transition-all hover:bg-accent-light"
        >
          {isPlaying ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <button
          onClick={onReset}
          className="p-2 bg-bg-tertiary text-text-primary rounded cursor-pointer transition-all hover:bg-[#1a4a7a]"
        >
          <ArrowLeftToLine size={18} />
        </button>
      </div>
    </div>
  );
}
