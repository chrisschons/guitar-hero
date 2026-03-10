import { useState, useCallback, useEffect, useMemo } from 'react';
import { Play, Pause, ArrowLeftToLine, Metronome, RotateCcw } from 'lucide-react';
import { useLocalStorage } from './hooks/useLocalStorage';
import { Controls } from './components/Controls';
import { TabDisplay, COLUMN_WIDTH, INITIAL_SCROLL } from './components/TabDisplay';
import { FretboardDiagram } from './components/FretboardDiagram';
import { Slider } from './components/ui/Slider';
import { useMetronome } from './hooks/useMetronome';
import { useAnimationLoop } from './hooks/useAnimationLoop';
import { useNoteTones } from './hooks/useNoteTones';
import { useExercise } from './hooks/useExercise';
import { EXERCISE_TYPES, SUBDIVISIONS, getVisualizationData, getSlotsPerMeasure } from './data/exerciseTypes';
import { TUNINGS, STANDARD_TUNING } from './data/tunings';
import { getRiff, getMergedRiffList } from './data/riffs';
import { getSubdivisionsPerBar, getSubdivisionsPerBeat } from './core/exercise';
import { applyTheme, THEMES, persistThemeId } from './theme';

function App() {
  // Playback state (not persisted)
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentBeat, setCurrentBeat] = useState(-1);
  const [countIn, setCountIn] = useState(0);
  const [scrollPosition, setScrollPosition] = useState(INITIAL_SCROLL);
  
  // Persisted settings
  const [bpm, setBpm] = useLocalStorage('guitar-hero-bpm', 120);
  const [subdivision, setSubdivision] = useLocalStorage('guitar-hero-subdivision', 2); // Default to eighth notes
  const [metronomeVolume, setMetronomeVolume] = useLocalStorage('guitar-hero-metronome-volume', 0);
  const [rootNote, setRootNote] = useLocalStorage('guitar-hero-root-note', 'A');
  const [typeId, setTypeId] = useLocalStorage('guitar-hero-type', 'pentatonic');
  const [exerciseId, setExerciseId] = useLocalStorage('guitar-hero-exercise', 'pos1');
  const [patternId, setPatternId] = useLocalStorage('guitar-hero-pattern', 'up-down');
  const [tabScrollMode, setTabScrollMode] = useLocalStorage('guitar-hero-tab-scroll', false);
  const [showFretboard, setShowFretboard] = useLocalStorage('guitar-hero-show-fretboard', true);
  const [tuningId, setTuningId] = useLocalStorage('guitar-hero-tuning', 'standard');
  const [timeSignatureId, setTimeSignatureId] = useLocalStorage('guitar-hero-time-signature', '4/4');
  const [themeId, setThemeId] = useLocalStorage('guitar-hero-theme-id', 'default');
  const [countInEnabled, setCountInEnabled] = useLocalStorage('guitar-hero-count-in', true);
  const [showFretNotes, setShowFretNotes] = useLocalStorage('guitar-hero-show-fret-notes', false);

  const tuning = TUNINGS[tuningId]?.semitones ?? STANDARD_TUNING;

  // For riffs, use the riff's time signature for dots and metronome; otherwise use global timeSignatureId
  const effectiveTimeSignatureId = useMemo(() => {
    if (typeId === 'riffs') {
      const riff = getRiff(exerciseId);
      if (riff?.timeSignature) {
        return `${riff.timeSignature.num}/${riff.timeSignature.denom}`;
      }
    }
    return timeSignatureId;
  }, [typeId, exerciseId, timeSignatureId]);

  // For riffs, notes per measure = subdivisions per bar (16th-note grid from time sig)
  const notesPerMeasureOverride = useMemo(() => {
    if (typeId === 'riffs') {
      const riff = getRiff(exerciseId);
      if (riff?.timeSignature) return getSubdivisionsPerBar(riff.timeSignature);
    }
    return null;
  }, [typeId, exerciseId]);

  // For riffs, subdivisions per beat from time sig (4/4→4, 6/8→8)
  const effectiveSubdivision = useMemo(() => {
    if (typeId === 'riffs') {
      const riff = getRiff(exerciseId);
      if (riff?.timeSignature) return getSubdivisionsPerBeat(riff.timeSignature);
      return 4;
    }
    return subdivision;
  }, [typeId, exerciseId, subdivision]);

  // Ticks per bar for bar-aligned looping (blank space at end of bar before loop)
  const effectiveTicksPerBar = useMemo(
    () => notesPerMeasureOverride ?? getSlotsPerMeasure(effectiveTimeSignatureId, effectiveSubdivision),
    [notesPerMeasureOverride, effectiveTimeSignatureId, effectiveSubdivision]
  );

  // Get current type and its exercises/patterns
  const currentType = EXERCISE_TYPES.find(t => t.id === typeId);
  const exercises = typeId === 'riffs' ? getMergedRiffList() : (currentType?.exercises || []);
  const patterns = currentType?.patterns || [];
  
  // Get visualization data
  const vizData = useMemo(() => {
    return getVisualizationData(typeId, exerciseId, rootNote);
  }, [typeId, exerciseId, rootNote]);

  const {
    tab,
    currentNotes,
    activeNoteIndex,
    onTick: exerciseOnTick,
    reset: exerciseReset,
    getCurrentColumn,
    getActiveNoteIndex,
    loopTicks,
  } = useExercise(typeId, exerciseId, patternId, rootNote, subdivision, effectiveTicksPerBar);

  const handleBeat = useCallback((beat) => {
    setCurrentBeat(beat);
  }, []);

  const handleCountIn = useCallback((remaining) => {
    setCountIn(remaining);
  }, []);

  const { playColumn } = useNoteTones(isPlaying, 1, tuning);

  const handleTick = useCallback(() => {
    setCountIn(0);
    exerciseOnTick();

    const column = getCurrentColumn();
    const noteIndex = getActiveNoteIndex();
    if (noteIndex >= 0 && column) {
      setScrollPosition(INITIAL_SCROLL + noteIndex * COLUMN_WIDTH);
    }

    if (column) playColumn(column);
  }, [exerciseOnTick, getActiveNoteIndex, getCurrentColumn, playColumn]);

  const { reset: resetMetronome } = useMetronome(bpm, effectiveSubdivision, isPlaying, handleBeat, handleTick, handleCountIn, metronomeVolume, effectiveTimeSignatureId, countInEnabled ? undefined : 0);

  const handleAnimationFrame = useCallback((deltaTime) => {
    if (activeNoteIndex < 0) return;
    if (countIn > 0) return; // Pause scrolling during count-in

    const secondsPerBeat = 60.0 / bpm;
    const secondsPerNote = secondsPerBeat / effectiveSubdivision;
    const pixelsPerSecond = COLUMN_WIDTH / secondsPerNote;

    setScrollPosition((prev) => {
      const loopWidth = (loopTicks > 0 ? loopTicks : tab.length) * COLUMN_WIDTH;
      let newPos = prev + pixelsPerSecond * deltaTime;

      if (newPos >= loopWidth + INITIAL_SCROLL) {
        newPos -= loopWidth;
      }

      return newPos;
    });
  }, [bpm, effectiveSubdivision, tab.length, loopTicks, activeNoteIndex, countIn]);

  const { reset: resetAnimation } = useAnimationLoop(handleAnimationFrame, isPlaying);

  const handlePlayToggle = () => {
    setIsPlaying((prev) => !prev);
  };

  const handleReset = () => {
    setIsPlaying(false);
    setScrollPosition(INITIAL_SCROLL);
    setCurrentBeat(-1);
    setCountIn(0);
    exerciseReset();
    resetMetronome();
    resetAnimation();
  };

  const handleRootChange = (root) => {
    handleReset();
    setRootNote(root);
  };

  const handleTypeChange = (id) => {
    handleReset();
    setTypeId(id);
    // Reset to first exercise and pattern of new type
    const newType = EXERCISE_TYPES.find(t => t.id === id);
    if (newType) {
      setExerciseId(newType.exercises[0]?.id || '');
      setPatternId(newType.patterns[0]?.id || 'default');
    }
  };

  const handleExerciseChange = (id) => {
    handleReset();
    setExerciseId(id);
  };

  const handlePatternChange = (id) => {
    handleReset();
    setPatternId(id);
  };

  const handleTuningChange = (id) => {
    // #region agent log
    fetch('http://127.0.0.1:7481/ingest/7c3e261f-81b5-47e6-baf0-d02d2bca5bcd',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'2abbdd'},body:JSON.stringify({sessionId:'2abbdd',location:'App.jsx:handleTuningChange',message:'Tuning change',data:{tuningId:id,tabLength:tab?.length},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
    // #endregion
    handleReset();
    setTuningId(id);
  };

  const handleTimeSignatureChange = (id) => {
    handleReset();
    setTimeSignatureId(id);
  };

  const handleBpmChange = (newBpm) => {
    setBpm(newBpm);
  };

  const handleSubdivisionChange = (newSub) => {
    handleReset();
    setSubdivision(newSub);
    setScrollPosition(INITIAL_SCROLL);
  };

  const handleThemeChange = (id) => {
    const theme = THEMES[id];
    if (theme) {
      applyTheme(theme);
      persistThemeId(id);
      setThemeId(id);
    }
  };

  const handleResetAllToDefaults = () => {
    handleReset();
    setBpm(120);
    setSubdivision(2);
    setMetronomeVolume(0);
    setRootNote('A');
    setTypeId('pentatonic');
    setExerciseId('pos1');
    setPatternId('up-down');
    setTabScrollMode(false);
    setShowFretboard(true);
    setCountInEnabled(true);
    setShowFretNotes(false);
    setTuningId('standard');
    setTimeSignatureId('4/4');
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'SELECT') {
        e.preventDefault();
        handlePlayToggle();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Toolbar at top, full width, sticky */}
      <div className="sticky top-0 z-10 w-full bg-bg-secondary border-b border-bg-tertiary shrink-0">
        <Controls
          rootNote={rootNote}
          onRootChange={handleRootChange}
          typeId={typeId}
          onTypeChange={handleTypeChange}
          exerciseId={exerciseId}
          exercises={exercises}
          onExerciseChange={handleExerciseChange}
          patternId={patternId}
          patterns={patterns}
          onPatternChange={handlePatternChange}
          tuningId={tuningId}
          onTuningChange={handleTuningChange}
          timeSignatureId={timeSignatureId}
          onTimeSignatureChange={handleTimeSignatureChange}
          subdivision={subdivision}
          onSubdivisionChange={handleSubdivisionChange}
          isPlaying={isPlaying}
          onPlayToggle={handlePlayToggle}
          onReset={handleReset}
          metronomeVolume={metronomeVolume}
          onMetronomeVolumeChange={setMetronomeVolume}
          tabScrollMode={tabScrollMode}
          onTabScrollModeChange={setTabScrollMode}
          showFretboard={showFretboard}
          onShowFretboardChange={setShowFretboard}
          themeId={themeId}
          onThemeChange={handleThemeChange}
          countInEnabled={countInEnabled}
          onCountInEnabledChange={setCountInEnabled}
          showFretNotes={showFretNotes}
          onShowFretNotesChange={setShowFretNotes}
        />
      </div>

      <div className="flex-1 flex flex-col pb-24">
        <TabDisplay
          tab={tab}
          scrollPosition={scrollPosition}
          scrollMode={tabScrollMode}
          currentBeat={currentBeat}
          countIn={countIn}
          activeNoteIndex={activeNoteIndex}
          subdivision={effectiveSubdivision}
          timeSignatureId={effectiveTimeSignatureId}
          notesPerMeasureOverride={notesPerMeasureOverride}
          loopTicks={loopTicks}
          tuning={tuning}
        />

        <div className="max-w-[1200px] mx-auto px-5 mt-6 flex-1 flex flex-col">
          {showFretboard && (
            <FretboardDiagram
              vizData={vizData}
              currentNotes={currentNotes}
              rootNote={rootNote}
              tuning={tuning}
              showFretNotes={showFretNotes}
            />
          )}
        </div>
      </div>

      <footer className="fixed bottom-0 left-0 right-0 w-full border-t border-bg-tertiary bg-bg-secondary py-3 z-20">
        <div className="max-w-[1200px] mx-auto px-5 flex items-center justify-between gap-4 flex-wrap">
          {/* Controls on the left */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex gap-2 items-center">
              <button
                onClick={handleReset}
                className="flex items-center justify-center p-2 rounded-full bg-bg-tertiary text-text-primary cursor-pointer transition-all hover:bg-[#1a4a7a]"
              >
                <ArrowLeftToLine size={18} />
              </button>
              <button
                onClick={handlePlayToggle}
                className="flex items-center gap-2 px-5 py-2 rounded-full bg-accent text-white text-sm font-medium cursor-pointer transition-all hover:bg-accent-light"
              >
                {isPlaying ? (
                  <>
                    <Pause size={18} />
                    <span>Pause</span>
                  </>
                ) : (
                  <>
                    <Play size={18} />
                    <span>Play</span>
                  </>
                )}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <Metronome className="h-5 w-5 text-text-secondary shrink-0" />
              <Slider
                value={[bpm]}
                onValueChange={([value]) => setBpm(value)}
                min={40}
                max={220}
                step={1}
                className="w-[100px]"
              />
              <span className="text-sm font-medium text-text-primary tabular-nums w-8 text-right">
                {bpm}
              </span>
            </div>
          </div>

          {/* Links on the right */}
          <div className="flex items-center gap-4 flex-wrap justify-end text-xs">
            <a
              href="#/scales"
              className="text-accent hover:text-accent-light transition-colors"
            >
              Scales
            </a>
            <a
              href="#/chords"
              className="text-accent hover:text-accent-light transition-colors"
            >
              Chords
            </a>
            <a
              href="#/editor"
              className="text-accent hover:text-accent-light transition-colors"
            >
              Riff Editor
            </a>
            <a
              href="#/bravura-demo"
              className="text-accent hover:text-accent-light transition-colors"
            >
              Bravura / SMuFL Demo
            </a>
            <button
              type="button"
              onClick={handleResetAllToDefaults}
              className="inline-flex items-center justify-center p-1.5 rounded text-text-secondary hover:text-accent hover:bg-bg-tertiary transition-colors"
              title="Reset all settings to default"
              aria-label="Reset all settings to default"
            >
              <RotateCcw size={14} />
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
