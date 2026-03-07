import { useState, useCallback, useEffect, useMemo } from 'react';
import { Play, Pause, ArrowLeftToLine } from 'lucide-react';
import { useLocalStorage } from './hooks/useLocalStorage';
import { Controls } from './components/Controls';
import { TabDisplay, COLUMN_WIDTH, INITIAL_SCROLL } from './components/TabDisplay';
import { FretboardDiagram } from './components/FretboardDiagram';
import { useMetronome } from './hooks/useMetronome';
import { useAnimationLoop } from './hooks/useAnimationLoop';
import { useNoteTones } from './hooks/useNoteTones';
import { EXERCISE_TYPES, SUBDIVISIONS, generateTab, getVisualizationData } from './data/exerciseTypes';

function App() {
  // Playback state (not persisted)
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentBeat, setCurrentBeat] = useState(-1);
  const [countIn, setCountIn] = useState(0);
  const [scrollPosition, setScrollPosition] = useState(INITIAL_SCROLL);
  const [currentNotes, setCurrentNotes] = useState([]);
  
  // Persisted settings
  const [bpm, setBpm] = useLocalStorage('guitar-hero-bpm', 120);
  const [subdivision, setSubdivision] = useLocalStorage('guitar-hero-subdivision', 2); // Default to eighth notes
  const [metronomeVolume, setMetronomeVolume] = useLocalStorage('guitar-hero-metronome-volume', 0);
  const [rootNote, setRootNote] = useLocalStorage('guitar-hero-root-note', 'A');
  const [typeId, setTypeId] = useLocalStorage('guitar-hero-type', 'pentatonic');
  const [exerciseId, setExerciseId] = useLocalStorage('guitar-hero-exercise', 'pos1');
  const [patternId, setPatternId] = useLocalStorage('guitar-hero-pattern', 'up-down');
  const [showScroller, setShowScroller] = useLocalStorage('guitar-hero-show-scroller', true);
  const [showFretboard, setShowFretboard] = useLocalStorage('guitar-hero-show-fretboard', true);

  // Get current type and its exercises/patterns
  const currentType = EXERCISE_TYPES.find(t => t.id === typeId);
  const exercises = currentType?.exercises || [];
  const patterns = currentType?.patterns || [];
  
  // Get visualization data
  const vizData = useMemo(() => {
    return getVisualizationData(typeId, exerciseId, rootNote);
  }, [typeId, exerciseId, rootNote]);
  
  // Generate tab based on type, exercise, pattern, and root
  const tab = useMemo(() => {
    return generateTab(typeId, exerciseId, patternId, rootNote);
  }, [typeId, exerciseId, patternId, rootNote]);

  const handleBeat = useCallback((beat) => {
    setCurrentBeat(beat);
  }, []);

  const handleCountIn = useCallback((remaining) => {
    setCountIn(remaining);
  }, []);

  const { playColumn } = useNoteTones(isPlaying, 1);

  // Track current tick for scroll sync
  const [currentTick, setCurrentTick] = useState(-1);

  const handleTick = useCallback((tick) => {
    setCountIn(0); // Clear count-in display once playing starts
    setCurrentTick(tick);
    
    // Guard against empty tab
    if (!tab.length) return;
    
    // Sync scroll position to tick to prevent drift
    const noteIndex = tick % tab.length;
    setScrollPosition(INITIAL_SCROLL + (noteIndex * COLUMN_WIDTH));
    
    const column = tab[noteIndex];
    playColumn(column);
    
    // Track all notes being played (for chords)
    const playingNotes = [];
    for (let stringIndex = 0; stringIndex < column.length; stringIndex++) {
      if (column[stringIndex] !== null) {
        playingNotes.push({ stringIndex, fret: column[stringIndex] });
      }
    }
    setCurrentNotes(playingNotes);
  }, [tab, playColumn]);

  const { reset: resetMetronome } = useMetronome(bpm, subdivision, isPlaying, handleBeat, handleTick, handleCountIn, metronomeVolume);

  const handleAnimationFrame = useCallback((deltaTime) => {
    // Don't scroll until first tick happens
    if (currentTick < 0) return;
    
    const secondsPerBeat = 60.0 / bpm;
    const secondsPerNote = secondsPerBeat / subdivision;
    const pixelsPerSecond = COLUMN_WIDTH / secondsPerNote;

    setScrollPosition((prev) => {
      const loopWidth = tab.length * COLUMN_WIDTH;
      let newPos = prev + pixelsPerSecond * deltaTime;
      
      // When we've scrolled one full loop, jump back seamlessly
      if (newPos >= loopWidth + INITIAL_SCROLL) {
        newPos -= loopWidth;
      }

      return newPos;
    });
  }, [bpm, subdivision, tab.length, currentTick]);

  const { reset: resetAnimation } = useAnimationLoop(handleAnimationFrame, isPlaying);

  const handlePlayToggle = () => {
    setIsPlaying((prev) => !prev);
  };

  const handleReset = () => {
    setIsPlaying(false);
    setScrollPosition(INITIAL_SCROLL);
    setCurrentBeat(-1);
    setCurrentTick(-1);
    setCountIn(0);
    setCurrentNotes([]);
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
      {/* Toolbar at top, full width */}
      <div className="w-full bg-bg-secondary border-b border-bg-tertiary shrink-0">
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
          subdivision={subdivision}
          onSubdivisionChange={handleSubdivisionChange}
          bpm={bpm}
          onBpmChange={handleBpmChange}
          isPlaying={isPlaying}
          onPlayToggle={handlePlayToggle}
          onReset={handleReset}
          metronomeVolume={metronomeVolume}
          onMetronomeVolumeChange={setMetronomeVolume}
          showScroller={showScroller}
          onShowScrollerChange={setShowScroller}
          showFretboard={showFretboard}
          onShowFretboardChange={setShowFretboard}
        />
      </div>

      <div className="flex-1 flex flex-col">
        {showScroller && (
          <TabDisplay 
            tab={tab} 
            scrollPosition={scrollPosition}
            currentBeat={currentBeat}
            countIn={countIn}
            activeNoteIndex={currentTick >= 0 ? currentTick % tab.length : -1}
            subdivision={subdivision}
          />
        )}

        <div className="max-w-[1200px] mx-auto px-5 mt-6 flex-1 flex flex-col">
          {showFretboard && <FretboardDiagram vizData={vizData} currentNotes={currentNotes} rootNote={rootNote} />}

          {/* Play and Reset under fretboard - centered pill buttons */}
          <div className="flex gap-2 mt-4 justify-center">
            <button
              onClick={handlePlayToggle}
              className="flex items-center gap-2 px-5 py-2 rounded-full bg-accent text-white text-sm font-medium cursor-pointer transition-all hover:bg-accent-light"
            >
              {isPlaying ? <><Pause size={18} /><span>Pause</span></> : <><Play size={18} /><span>Play</span></>}
            </button>
            <button
              onClick={handleReset}
              className="flex items-center justify-center p-2 rounded-full bg-bg-tertiary text-text-primary cursor-pointer transition-all hover:bg-[#1a4a7a]"
            >
              <ArrowLeftToLine size={18} />
            </button>
          </div>

          <footer className="mt-auto pt-12 pb-6 text-center">
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
