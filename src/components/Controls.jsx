import { Tally3 } from 'lucide-react';
import { ROOT_NOTES, EXERCISE_TYPES, SUBDIVISIONS } from '../data/exerciseTypes';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/Select';
import { Slider } from './ui/Slider';
import { Switch } from './ui/Switch';

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
  onMetronomeVolumeChange,
  showScroller,
  onShowScrollerChange,
  showFretboard,
  onShowFretboardChange
}) {
  return (
    <div className="flex flex-wrap gap-3 justify-center items-center p-3">
      <Select value={rootNote} onValueChange={onRootChange}>
        <SelectTrigger size="sm">
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
        <SelectTrigger size="sm">
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
        <SelectTrigger size="sm">
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
          <SelectTrigger size="sm">
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
        <SelectTrigger size="sm">
          {subdivision === 3 ? <Tally3 size={14} /> : <SelectValue />}
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

      <div className="hidden flex items-center gap-2">
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

      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1.5 text-xs text-text-secondary cursor-pointer">
          <Switch checked={showScroller} onCheckedChange={onShowScrollerChange} />
          <span>Scroller</span>
        </label>
        <label className="flex items-center gap-1.5 text-xs text-text-secondary cursor-pointer">
          <Switch checked={showFretboard} onCheckedChange={onShowFretboardChange} />
          <span>Fretboard</span>
        </label>
      </div>
    </div>
  );
}
