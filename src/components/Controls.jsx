import { Tally3, Guitar, Palette, RotateCcw } from 'lucide-react';
import { EXERCISE_TYPES, SUBDIVISIONS, TIME_SIGNATURES } from '../data/exerciseTypes';
import { TUNINGS_LIST } from '../data/tunings';
import { getStringLabels, NOTE_NAMES } from '../core/music';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/Select';
import { Slider } from './ui/Slider';
import { Switch } from './ui/Switch';

const THEME_OPTIONS = [
  { id: 'default', label: 'Default' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
];

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
  onResetAllToDefaults,
  metronomeVolume,
  onMetronomeVolumeChange,
  tabScrollMode,
  onTabScrollModeChange,
  showFretboard,
  onShowFretboardChange,
  themeId,
  onThemeChange,
  countInEnabled,
  onCountInEnabledChange,
  showFretNotes,
  onShowFretNotesChange
}) {
  return (
    <div className="flex flex-wrap gap-3 justify-between items-center p-3">
      {/* Left: tuning, root, type, exercise, pattern, time, subdivision */}
      <div className="flex flex-wrap gap-3 items-center">
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
          {NOTE_NAMES.map((name) => (
            <SelectItem key={name} value={name}>
              {name}
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

      <div className="hidden md:flex items-center gap-2">
        <span className="text-xs text-text-secondary">Click</span>
        <Slider
          defaultValue={[metronomeVolume]}
          onValueChange={(values) => {
            const value = Array.isArray(values) ? values[0] : metronomeVolume;
            onMetronomeVolumeChange(value);
          }}
          min={0}
          max={1}
          step={0.05}
          className="w-[60px]"
        />
      </div>
      </div>

      {/* Right: Reset all, Scroll, Fretboard, Count-in, Theme */}
      <div className="flex flex-wrap gap-3 items-center">
      <div className="flex items-center gap-2">
       
      {/*}
        <label className="flex items-center gap-1.5 text-xs text-text-secondary cursor-pointer">
          <Switch checked={tabScrollMode} onCheckedChange={onTabScrollModeChange} />
          <span>Scroll</span>
        </label>
        */}
        <label className="flex items-center gap-1.5 text-xs text-text-secondary cursor-pointer">
          <Switch checked={showFretboard} onCheckedChange={onShowFretboardChange} />
          <span>Fretboard</span>
        </label>
      
        <label className="flex items-center gap-1.5 text-xs text-text-secondary cursor-pointer">
          <Switch checked={countInEnabled} onCheckedChange={onCountInEnabledChange} />
          <span>Count-in</span>
        </label>
        <label className="flex items-center gap-1.5 text-xs text-text-secondary cursor-pointer">
          <Switch checked={showFretNotes} onCheckedChange={onShowFretNotesChange} />
          <span>Notes</span>
        </label>
        <button
          type="button"
          onClick={onResetAllToDefaults}
          className="inline-flex items-center gap-1.5 rounded-full border border-bg-tertiary px-3 py-1 text-xs text-text-secondary hover:bg-bg-tertiary transition-colors"
        >
          <RotateCcw size={12} />
         
        </button>

      </div>
{/*}
      <Select value={themeId} onValueChange={onThemeChange}>
        <SelectTrigger size="sm" className="w-8 h-6 justify-center px-1.5" title="Theme">
          <Palette className="h-4 w-4 shrink-0" />
        </SelectTrigger>
        <SelectContent>
          {THEME_OPTIONS.map((opt) => (
            <SelectItem key={opt.id} value={opt.id}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      */}
      </div>
    </div>
  );
}
