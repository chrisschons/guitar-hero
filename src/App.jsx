import { useState, useCallback, useEffect, useMemo } from 'react';
import { Play, Pause, ArrowLeftToLine, RotateCcw } from 'lucide-react';
import { useLocalStorage } from './hooks/useLocalStorage';
import { Controls } from './components/Controls';
import { TabDisplay, COLUMN_WIDTH, INITIAL_SCROLL } from './components/TabDisplay';
import { FretboardDiagram } from './components/FretboardDiagram';
import { Slider } from './components/ui/Slider';
import { Footer } from './components/Footer';
import { useMetronome } from './hooks/useMetronome';
import { useAnimationLoop } from './hooks/useAnimationLoop';
import { useNoteTones } from './hooks/useNoteTones';
import { useExercise } from './hooks/useExercise';
import { EXERCISE_TYPES, SUBDIVISIONS, getVisualizationData, getSlotsPerMeasure } from './data/exerciseTypes';
import { TUNINGS, STANDARD_TUNING } from './data/tunings';
import { getRiff, getMergedRiffList } from './data/riffs';
import { getSubdivisionsPerBar, getSubdivisionsPerBeat } from './core/exercise';
import { generateScalePosition, ROOT_SEMITONES } from './core/music';
import { useOrderedPositions, getLowestFretStartIndex } from './hooks/useOrderedPositions';

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
  const [metronomeOn, setMetronomeOn] = useState(true);
  const [rootNote, setRootNote] = useLocalStorage('guitar-hero-root-note', 'A');
  const [typeId, setTypeId] = useLocalStorage('guitar-hero-type', 'pentatonic');
  const [exerciseId, setExerciseId] = useLocalStorage('guitar-hero-exercise', 'pos1');
  const [patternId, setPatternId] = useLocalStorage('guitar-hero-pattern', 'up-down');
  const [tabScrollMode, setTabScrollMode] = useLocalStorage('guitar-hero-tab-scroll', false);
  const [showFretboard, setShowFretboard] = useLocalStorage('guitar-hero-show-fretboard', true);
  const [tuningId, setTuningId] = useLocalStorage('guitar-hero-tuning', 'standard');
  const [timeSignatureId, setTimeSignatureId] = useLocalStorage('guitar-hero-time-signature', '4/4');
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

  const rootSemitone = ROOT_SEMITONES[rootNote] ?? 9;
  const isPositionalScale = typeId === 'pentatonic' || typeId === 'blues';
  const scalePositions = useMemo(
    () => isPositionalScale
      ? [0, 1, 2, 3, 4].map(i => generateScalePosition(rootSemitone, typeId, i, tuning))
      : [],
    [isPositionalScale, rootSemitone, typeId, tuning]
  );
  const { startIndex: positionStartIndex } = useOrderedPositions(scalePositions);
  const orderedExercises = useMemo(() => {
    if (!isPositionalScale || exercises.length !== 5) return exercises;
    return [
      ...exercises.slice(positionStartIndex),
      ...exercises.slice(0, positionStartIndex),
    ];
  }, [isPositionalScale, exercises, positionStartIndex]);
  
  // Get visualization data
  const vizData = useMemo(() => {
    return getVisualizationData(typeId, exerciseId, rootNote, tuning);
  }, [typeId, exerciseId, rootNote, tuning]);

  const {
    tab,
    currentNotes,
    activeNoteIndex,
    onTick: exerciseOnTick,
    reset: exerciseReset,
    getCurrentColumn,
    getActiveNoteIndex,
    loopTicks,
  } = useExercise(typeId, exerciseId, patternId, rootNote, subdivision, effectiveTicksPerBar, tuning);

  const handleBeat = useCallback((beat) => {
    setCurrentBeat(beat);
  }, []);

  const handleCountIn = useCallback((remaining) => {
    setCountIn(remaining);
  }, []);

  const { playColumn } = useNoteTones(isPlaying, 1, tuning);

  const handleTick = useCallback(() => {
    // First tick after count-in switches visuals into regular beat mode.
    setCountIn(0);
    exerciseOnTick();

    const column = getCurrentColumn();
    const noteIndex = getActiveNoteIndex();
    if (noteIndex >= 0 && column) {
      setScrollPosition(INITIAL_SCROLL + noteIndex * COLUMN_WIDTH);
    }

    if (column) playColumn(column);
  }, [exerciseOnTick, getActiveNoteIndex, getCurrentColumn, playColumn]);

  const { reset: resetMetronome } = useMetronome(
    bpm,
    effectiveSubdivision,
    isPlaying,
    handleBeat,
    handleTick,
    handleCountIn,
    metronomeOn ? metronomeVolume : 0,
    effectiveTimeSignatureId,
    countInEnabled ? undefined : 0
  );

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
    const newType = EXERCISE_TYPES.find(t => t.id === id);
    if (newType) {
      let firstExerciseId = newType.exercises[0]?.id || '';
      if ((id === 'pentatonic' || id === 'blues') && newType.exercises.length === 5) {
        const positions = [0, 1, 2, 3, 4].map(i =>
          generateScalePosition(rootSemitone, id, i, tuning)
        );
        const startIdx = getLowestFretStartIndex(positions);
        firstExerciseId = newType.exercises[startIdx]?.id || firstExerciseId;
      }
      setExerciseId(firstExerciseId);
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
    <div className="min-h-screen flex flex-col bg-bg-secondary text-foreground overscroll-none">
      {/* Toolbar at top, full width, sticky */}
      <div className="fixed top-0 z-10 w-full bg-secondary border-b border-border shrink-0">
        <Controls
          rootNote={rootNote}
          onRootChange={handleRootChange}
          typeId={typeId}
          onTypeChange={handleTypeChange}
          exerciseId={exerciseId}
          exercises={orderedExercises}
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
          onResetAllToDefaults={handleResetAllToDefaults}
          metronomeVolume={metronomeVolume}
          onMetronomeVolumeChange={setMetronomeVolume}
          tabScrollMode={tabScrollMode}
          onTabScrollModeChange={setTabScrollMode}
          showFretboard={showFretboard}
          onShowFretboardChange={setShowFretboard}
          countInEnabled={countInEnabled}
          onCountInEnabledChange={setCountInEnabled}
          showFretNotes={showFretNotes}
          onShowFretNotesChange={setShowFretNotes}
        />
      </div>

      <div className="flex-1 flex flex-col pt-12 pb-80">
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

        <div className="fixed bottom-20 w-full flex-1 flex flex-col z-10 bg-linear-to-t from-bg-primary to-bg-primary">
          <div className="mx-auto x-3">
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
      </div>

      <Footer
        bpm={bpm}
        onBpmChange={(value) => setBpm(value)}
        metronomeOn={metronomeOn}
        onMetronomeOnChange={setMetronomeOn}
        isPlaying={isPlaying}
        onPlayToggle={handlePlayToggle}
        onReset={handleReset}
      />
    </div>
  );
}

export default App;
