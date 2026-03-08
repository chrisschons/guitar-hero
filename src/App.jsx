import { useState, useCallback, useEffect, useMemo } from 'react';
import { Play, Pause, ArrowLeftToLine, Metronome } from 'lucide-react';
import { useLocalStorage } from './hooks/useLocalStorage';
import { Controls } from './components/Controls';
import { TabDisplay, COLUMN_WIDTH, INITIAL_SCROLL } from './components/TabDisplay';
import { FretboardDiagram } from './components/FretboardDiagram';
import { Slider } from './components/ui/Slider';
import { useMetronome } from './hooks/useMetronome';
import { useAnimationLoop } from './hooks/useAnimationLoop';
import { useNoteTones } from './hooks/useNoteTones';
import { useExercise } from './hooks/useExercise';
import { EXERCISE_TYPES, SUBDIVISIONS, getVisualizationData } from './data/exerciseTypes';
import { TUNINGS, STANDARD_TUNING } from './data/tunings';

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

  const tuning = TUNINGS[tuningId]?.semitones ?? STANDARD_TUNING;

  // Get current type and its exercises/patterns
  const currentType = EXERCISE_TYPES.find(t => t.id === typeId);
  const exercises = currentType?.exercises || [];
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
  } = useExercise(typeId, exerciseId, patternId, rootNote, subdivision);

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

    const noteIndex = getActiveNoteIndex();
    if (noteIndex >= 0) {
      setScrollPosition(INITIAL_SCROLL + noteIndex * COLUMN_WIDTH);
    }

    const column = getCurrentColumn();
    if (column) playColumn(column);
  }, [exerciseOnTick, getActiveNoteIndex, getCurrentColumn, playColumn]);

  const { reset: resetMetronome } = useMetronome(bpm, subdivision, isPlaying, handleBeat, handleTick, handleCountIn, metronomeVolume);

  const handleAnimationFrame = useCallback((deltaTime) => {
    if (activeNoteIndex < 0) return;
    if (countIn > 0) return; // Pause scrolling during count-in

    const secondsPerBeat = 60.0 / bpm;
    const secondsPerNote = secondsPerBeat / subdivision;
    const pixelsPerSecond = COLUMN_WIDTH / secondsPerNote;

    setScrollPosition((prev) => {
      const loopWidth = tab.length * COLUMN_WIDTH;
      let newPos = prev + pixelsPerSecond * deltaTime;

      if (newPos >= loopWidth + INITIAL_SCROLL) {
        newPos -= loopWidth;
      }

      return newPos;
    });
  }, [bpm, subdivision, tab.length, activeNoteIndex, countIn]);

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
        />
      </div>

      <div className="flex-1 flex flex-col">
        <TabDisplay
            tab={tab}
            scrollPosition={scrollPosition}
            scrollMode={tabScrollMode}
            currentBeat={currentBeat}
            countIn={countIn}
            activeNoteIndex={activeNoteIndex}
            subdivision={subdivision}
            timeSignatureId={timeSignatureId}
            tuning={tuning}
          />

        <div className="max-w-[1200px] mx-auto px-5 mt-6 flex-1 flex flex-col">
          {showFretboard && <FretboardDiagram vizData={vizData} currentNotes={currentNotes} rootNote={rootNote} tuning={tuning} />}

          {/* Play, Reset, and BPM in one line */}
          <div className="flex flex-wrap items-center justify-center gap-4 mt-4">
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
                {isPlaying ? <><Pause size={18} /><span>Pause</span></> : <><Play size={18} /><span>Play</span></>}
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
              <span className="text-sm font-medium text-text-primary tabular-nums w-8 text-right">{bpm}</span>
            </div>
          </div>

          <footer className="mt-auto pt-12 pb-6 text-center space-x-4">
            <a
              href="#/reference"
              className="text-xs text-accent hover:text-accent-light transition-colors"
            >
              Scale Reference
            </a>
            <a
              href="#/tuner"
              className="text-xs text-accent hover:text-accent-light transition-colors"
            >
              Tuner
            </a>
            <a
              href="#/bravura-demo"
              className="text-xs text-accent hover:text-accent-light transition-colors"
            >
              Bravura / SMuFL Demo
            </a>
          </footer>
        </div>
      </div>
    </div>
  );
}

export default App;
