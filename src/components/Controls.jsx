import { Tally3, Guitar } from 'lucide-react';
import { ROOT_NOTES, EXERCISE_TYPES, SUBDIVISIONS, TIME_SIGNATURES } from '../data/exerciseTypes';
import { TUNINGS_LIST } from '../data/tunings';
import { getStringLabels } from '../core/music';
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
  tuningId,
  onTuningChange,
  timeSignatureId,
  onTimeSignatureChange,
  subdivision,
  onSubdivisionChange,
  isPlaying,
  onPlayToggle,
  onReset,
  metronomeVolume,
  onMetronomeVolumeChange,
  tabScrollMode,
  onTabScrollModeChange,
  showFretboard,
  onShowFretboardChange
}) {
  return (
    <div className="flex flex-wrap gap-3 justify-center items-center p-3">
      <Select value={tuningId} onValueChange={onTuningChange}>
        <SelectTrigger size="sm" className="w-8 h-6 justify-center px-1.5" title={TUNINGS_LIST.find((t) => t.id === tuningId)?.name ?? 'Tuning'}>
          <Guitar className="h-4 w-4 shrink-0" />
        </SelectTrigger>
        <SelectContent>
          {TUNINGS_LIST.map((t) => (
            <SelectItem key={t.id} value={t.id}>
              {t.name}{' '}
              <span className="text-xs text-text-secondary">
                {getStringLabels(t.semitones).join(' ')}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

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

      {typeId !== 'riffs' && (
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-text-secondary whitespace-nowrap">Time</span>
          <Select value={timeSignatureId} onValueChange={onTimeSignatureChange}>
            <SelectTrigger size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIME_SIGNATURES.map((ts) => (
                <SelectItem key={ts.id} value={ts.id}>
                  {ts.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {typeId !== 'riffs' && (
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
      )}

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
          <Switch checked={tabScrollMode} onCheckedChange={onTabScrollModeChange} />
          <span>Scroll</span>
        </label>
        <label className="flex items-center gap-1.5 text-xs text-text-secondary cursor-pointer">
          <Switch checked={showFretboard} onCheckedChange={onShowFretboardChange} />
          <span>Fretboard</span>
        </label>
      </div>
    </div>
  );
}
