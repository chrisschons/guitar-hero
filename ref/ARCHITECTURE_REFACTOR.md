# Guitar Practice App — Full Refactor Architecture

Senior architecture and refactor plan for a React-based, local-only guitar practice app. All music logic is **math-based (semitone arithmetic)**; no hardcoded note-name arrays in the engine.

---

## 1. High-Level Architecture

### Principles

- **Single source of truth for music:** A **Music Theory Engine** owns all note/scale/chord math. UI only displays and triggers; it does not compute pitches or intervals.
- **Tuning as data:** The fretboard and all note logic derive from a **tuning** (array of open-string semitones). No `STRING_SEMITONES` baked into components.
- **Exercises as timed sequences:** Exercises are lists of **note events** (string, fret, beat, subdivision, duration). The **Exercise Engine** advances time and exposes current notes; the UI scrolls and highlights.
- **Audio isolated:** An **Audio Engine** (Web Audio API) handles metronome, note playback, and future drums. No audio code inside React components beyond calling the engine.
- **Theme-driven UI:** All colors and sizing come from a **theme** object so we can support multiple themes and keep CSS predictable.

### Layer Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  UI Layer (React)                                                │
│  App, Controls, TabDisplay, FretboardDiagram, Reference, etc.   │
└────────────────────────────┬────────────────────────────────────┘
                             │ uses
┌────────────────────────────▼────────────────────────────────────┐
│  State / Exercise Engine                                         │
│  Current exercise, BPM, play state, currentNotes, tick index    │
└────────────────────────────┬────────────────────────────────────┘
                             │ uses
┌────────────────────────────▼────────────────────────────────────┐
│  Music Theory Engine (pure, no UI)                               │
│  getNoteAt, getScale, getChord, getFretboardNotes, transpose    │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│  Audio Engine (Web Audio API)                                    │
│  Metronome, note playback, (future: drums)                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Recommended Folder Structure

```
src/
├── main.jsx
├── App.jsx
├── index.css
│
├── core/                      # Music & audio engines (no UI)
│   ├── music/
│   │   ├── index.js            # Public API
│   │   ├── notes.js           # Semitone constants, getNoteAt, transpose
│   │   ├── scales.js           # Interval patterns, getScale
│   │   ├── chords.js           # Interval structures, getChord, chordShapes
│   │   ├── tuning.js           # Tuning definitions, getFretboardNotes
│   │   └── intervals.js        # Interval step patterns, names
│   ├── exercise/
│   │   ├── index.js
│   │   ├── types.js            # Exercise type definitions
│   │   ├── tabGenerator.js     # generateTab using music engine
│   │   ├── scheduler.js        # Beat/tick from BPM + subdivision
│   │   └── riffLibrary.js     # Riff data structures + combinators
│   └── audio/
│       ├── index.js
│       ├── audioContext.js     # Singleton AudioContext
│       ├── metronome.js
│       ├── notePlayback.js
│       └── tuner.js            # Optional: mic FFT pitch detection
│
├── data/                      # Static data (tuning presets, chord fingerings, riffs)
│   ├── tunings.js
│   ├── chordShapes.js         # Fingering data per chord (string, fret, muted)
│   ├── scalePositions.js      # Position shapes per scale (can stay or move to core)
│   └── riffs/
│       ├── index.js
│       └── *.js               # By style (gallops, powerChords, etc.)
│
├── state/                     # Optional: global state (context or store)
│   └── practiceStore.js       # Exercise state, BPM, theme, etc.
│
├── theme/
│   ├── index.js               # theme object + helpers
│   └── variables.css           # CSS custom properties from theme
│
├── components/
│   ├── layout/
│   ├── practice/               # TabDisplay, FretboardDiagram, Controls
│   ├── reference/              # PositionDiagram, ChordDiagram
│   └── ui/                     # Buttons, Select, Slider (existing)
│
├── hooks/
│   ├── useExercise.js         # Uses exercise engine + tab generator
│   ├── useMetronome.js        # Wraps audio metronome
│   ├── useNotePlayback.js     # Wraps audio note playback
│   └── useLocalStorage.js
│
└── pages/
    ├── Practice.jsx
    ├── Reference.jsx
    └── BravuraDemo.jsx
```

**Reasoning:** `core/` keeps all “music math” and audio in one place and testable without React. `data/` holds presets and fingerings. Components stay thin and depend on `core` and `theme`.

---

## 3. React Component Hierarchy

```
Router (hash)
├── Practice (default route)
│   ├── Layout
│   │   ├── Controls
│   │   │   ├── RootSelect, ExerciseTypeSelect, PatternSelect, SubdivisionSelect
│   │   │   ├── BPM slider, Metronome volume
│   │   │   └── View toggles (Scroller / Fretboard)
│   │   ├── TabDisplay
│   │   │   └── Column list, playhead, beat grid, bar lines
│   │   ├── FretboardDiagram
│   │   │   └── String rows, fret cells, dots (scale + current notes)
│   │   └── PlaybackControls (Play, Pause, Reset)
│   └── (state: exercise params, tab, currentNotes, isPlaying, bpm, etc.)
├── Reference
│   ├── Scale sections (full scale + positions) — uses music.getScale + positions
│   └── Chord sections — uses music.getChord + chordShapes
└── BravuraDemo
```

**Data flow (Practice):**

- User changes in **Controls** → update exercise params (root, type, pattern, subdivision, BPM).
- **useExercise** (or similar) calls `tabGenerator.generateTab(params)` and `exerciseEngine` to get `tab` and subscribe to `currentNotes` per tick.
- **useMetronome** drives ticks; on each tick, exercise engine advances and returns `currentNotes`; **useNotePlayback** plays the current column.
- **TabDisplay** and **FretboardDiagram** receive `tab`, `currentNotes`, and `tuning` (from theme or settings); they call `music.getNoteAt(string, fret, tuning)` only for display (e.g. note name or color), not for “is this in scale” — that comes from the engine’s scale/chord APIs.

---

## 4. Music Theory Engine Design

### 4.1 Responsibilities

- Represent notes as **semitones 0–11** (C=0 … B=11).
- Provide: **getNoteAt(string, fret, tuning)**, **getScale(rootSemitone, scalePattern)**, **getChord(rootSemitone, intervals)**, **getFretboardNotes(tuning, numFrets)**, **transpose(note, interval)**.
- No UI, no React, no DOM. Pure functions + small data structures.

### 4.2 Data Structures

**Note:** integer 0–11 (pitch class).

**Tuning:** array of 6 integers (open string semitones from C).

```js
// Example: standard tuning E A D G B e  →  from C: [4, 9, 2, 7, 11, 4]
const STANDARD_TUNING = [4, 9, 2, 7, 11, 4];
```

**Scale pattern:** step pattern in semitones (e.g. major = [2,2,1,2,2,2,1]).

**Chord structure:** intervals in semitones from root (e.g. major triad [0, 4, 7]).

### 4.3 Example Implementation

```js
// core/music/notes.js

/** Note names for display only; engine uses 0-11 everywhere */
export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const C = 0;
export const ROOT_SEMITONES = Object.fromEntries(
  NOTE_NAMES.map((name, i) => [name, i])
);

/**
 * @param {number} stringIndex - 0 = high e, 5 = low E
 * @param {number} fret - 0 = open, 1-24
 * @param {number[]} tuning - length 6, semitones from C per open string
 * @returns {number} pitch class 0-11
 */
export function getNoteAt(stringIndex, fret, tuning) {
  const open = tuning[stringIndex];
  return (open + fret) % 12;
}

/**
 * @param {number} note - pitch class 0-11
 * @param {number} interval - semitones up (e.g. 4 for major third)
 * @returns {number} pitch class 0-11
 */
export function transpose(note, interval) {
  return (note + interval) % 12;
}
```

```js
// core/music/scales.js

import { transpose } from './notes.js';

/**
 * Step pattern: semitone steps from one scale degree to the next.
 * Major: [2,2,1,2,2,2,1]  →  root, root+2, root+4, root+5, ...
 */
export const SCALE_STEP_PATTERNS = {
  major: [2, 2, 1, 2, 2, 2, 1],
  naturalMinor: [2, 1, 2, 2, 1, 2, 2],
  pentatonicMinor: [3, 2, 2, 3, 2],
  pentatonicMajor: [2, 2, 3, 2, 3],
  blues: [3, 2, 1, 1, 3, 2],
  // modes: ionian, dorian, etc. same as major/minor step patterns
};

/**
 * Build scale degrees as semitone offsets from root.
 * @param {number[]} stepPattern - e.g. [2,2,1,2,2,2,1]
 * @returns {number[]} e.g. [0, 2, 4, 5, 7, 9, 11]
 */
export function stepsToIntervals(stepPattern) {
  const intervals = [0];
  let sum = 0;
  for (let i = 0; i < stepPattern.length - 1; i++) {
    sum += stepPattern[i];
    intervals.push(sum);
  }
  return intervals;
}

/**
 * @param {number} rootSemitone - 0-11
 * @param {number[]} stepPattern - from SCALE_STEP_PATTERNS
 * @returns {number[]} pitch classes in scale (e.g. [9, 11, 0, 2, 4, 5, 7] for A major)
 */
export function getScale(rootSemitone, stepPattern) {
  const intervals = stepsToIntervals(stepPattern);
  return intervals.map((i) => (rootSemitone + i) % 12);
}
```

```js
// core/music/chords.js

/**
 * Chord = root + set of intervals (semitones).
 * Major triad [0, 4, 7], power [0, 7], min7 [0, 3, 7, 10], etc.
 */
export const CHORD_INTERVALS = {
  major: [0, 4, 7],
  minor: [0, 3, 7],
  seventh: [0, 4, 7, 10],
  min7: [0, 3, 7, 10],
  power: [0, 7],
};

/**
 * @param {number} rootSemitone - 0-11
 * @param {number[]} intervals - e.g. [0, 4, 7]
 * @returns {number[]} pitch classes in chord
 */
export function getChord(rootSemitone, intervals) {
  return intervals.map((i) => (rootSemitone + i) % 12);
}
```

```js
// core/music/tuning.js

/**
 * @param {number[]} tuning - length 6
 * @param {number} numFrets - e.g. 24
 * @returns {number[][]} grid[row][fret] = pitch class 0-11 (row = string index)
 */
export function getFretboardNotes(tuning, numFrets) {
  return tuning.map((open) =>
    Array.from({ length: numFrets + 1 }, (_, fret) => (open + fret) % 12)
  );
}
```

### 4.4 Design Decisions

- **Notes as 0–11:** Unambiguous, tuning-agnostic, and easy to transpose and compare (e.g. “is this note in this scale?” = `scale.includes(getNoteAt(s, f, tuning))`).
- **Tuning as first-class:** Every fretboard and note API takes `tuning`; switching to Drop D or C standard is a data change, not component logic.
- **Scale patterns as steps:** Adding new scales (modes, harmonic minor, etc.) is just adding a step array; no new “scale type” branching in the UI.
- **Chord = root + intervals:** Fingering (which string/fret to play) stays in `data/chordShapes.js`; the engine only answers “what pitch classes are in this chord?”

---

## 5. Exercise Engine Design

### 5.1 Responsibilities

- Hold **current exercise**: tab (list of columns), BPM, subdivision, time signature.
- Advance **time** on metronome ticks (beat, subdivision, tick index).
- Expose **currentNotes** (and current column) for UI and playback.
- Support **loop** (reset to start at end) and **reset**.
- Support **up to 8 subdivisions per beat** (e.g. 8th-note triplets, 16ths).

### 5.2 Data Structures

**Tab column:** length-6 array; each element is `number | null` (fret on that string, or no note). High e = index 0.

**Tab:** array of columns. Optionally each column can carry a **beat** and **subdivision** index if we move to explicit timing later; for the current refactor, columns are evenly spaced by subdivision.

**Exercise state:**

```js
{
  tab: number[][],           // each column is [fret0, ..., fret5] | null
  bpm: number,
  subdivision: number,         // 1-8
  timeSignature: { num: 4, denom: 4 }, // or 3/4, 6/8, 12/8
  tickIndex: number,          // 0-based index into “slot” (beat * subdivision + sub)
  isPlaying: boolean,
  loop: boolean
}
```

**Note event (for future riff/explicit timing):**

```js
{
  string: number,   // 0-5
  fret: number,     // 0-24
  beat: number,
  subdivision: number,  // 0 to subdivisionsPerBeat-1
  duration: number  // in subdivision units (e.g. 1 = one slot)
}
```

### 5.3 Scheduler Logic

- **Seconds per slot** = `60 / (bpm * subdivision)` when each slot is one column (current behavior).
- On each **tick** from the metronome: increment `tickIndex`; if `tickIndex >= tab.length` and `loop`, set `tickIndex = 0`; else if no loop, stop.
- **currentNotes** = list of `{ string, fret }` for the column at `tab[tickIndex]` (non-null entries).
- **Beat grouping:** For bar lines and visual grouping, compute `beatInMeasure = tickIndex % (timeSignature.num * subdivision)` so we know measure boundaries.

### 5.4 Example API

```js
// core/exercise/scheduler.js (conceptual)

export function createExerciseEngine() {
  let state = {
    tab: [],
    bpm: 120,
    subdivision: 2,
    timeSignature: { num: 4, denom: 4 },
    tickIndex: 0,
    loop: true,
  };
  const listeners = new Set();

  function getCurrentColumn() {
    const { tab, tickIndex, loop } = state;
    if (!tab.length) return null;
    const i = loop ? tickIndex % tab.length : Math.min(tickIndex, tab.length - 1);
    return tab[i];
  }

  function getCurrentNotes() {
    const col = getCurrentColumn();
    if (!col) return [];
    return col
      .map((fret, string) => (fret != null ? { string, fret } : null))
      .filter(Boolean);
  }

  function onTick() {
    state.tickIndex += 1;
    if (state.loop && state.tab.length) state.tickIndex %= state.tab.length;
    listeners.forEach((fn) => fn(state));
  }

  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  return {
    getState: () => ({ ...state }),
    getCurrentColumn,
    getCurrentNotes,
    onTick,
    subscribe,
    setTab(tab) { state.tab = tab; state.tickIndex = 0; },
    setBpm(bpm) { state.bpm = bpm; },
    reset() { state.tickIndex = 0; },
    setLoop(loop) { state.loop = loop; },
  };
}
```

**Reasoning:** Centralizing time and “current column” in one engine keeps TabDisplay and FretboardDiagram dumb: they receive `currentNotes` and `tab`; they don’t compute timing.

---

## 6. Riff Library Data Structures

### 6.1 Riff Definition

```js
{
  id: string,
  name: string,
  timeSignature: { num: number, denom: number },  // 4/4, 3/4, 6/8, 12/8
  bpmRange: { min: number, max: number },
  notes: [
    { string: 0, fret: 5, beat: 0, subdivision: 0, duration: 1 },
    { string: 1, fret: 5, beat: 0, subdivision: 1, duration: 1 },
    // ...
  ],
  style: 'gallop' | 'powerChord' | 'alternatePicking' | 'stringSkip' | 'generic',
}
```

**duration** in subdivision units: 1 = one slot, 2 = two slots (e.g. half beat in 8ths).

### 6.2 Converting Riff to Tab

- Precompute **slots per beat** from time signature (e.g. 4/4 with 8th subdivision → 2 slots per beat).
- Sort `notes` by `beat` then `subdivision`.
- Build columns: one column per slot; each column is `[null, null, null, null, null, null]`; for each note, set `column[note.string] = fret` at the slot for `(beat, subdivision)`.
- Result is a **tab** (array of columns) compatible with the existing TabDisplay.

### 6.3 Combining Riffs

- **Concat:** riff1.notes then riff2.notes with beat indices shifted by riff1 length.
- **Random chain:** pick N riffs from a pool, concat, optional repeat.
- **Heavy metal focus:** tag riffs by style (gallops, palm-muted power chords, alternate picking, string skipping) and filter by style when building a “random exercise.”

---

## 7. State Management Strategy

- **No global store required initially.** Practice screen can hold:
  - **Exercise params:** root, exerciseType, exerciseId, patternId, subdivision, BPM (from Controls).
  - **Derived:** `tab = generateTab(params)` (and optionally tuning from params or theme).
  - **Playback:** `isPlaying`, `tickIndex` / `currentNotes` from exercise engine (or from useMetronome + local advancement).
- **Lifting state:** Keep state in Practice (or a single Practice container); pass callbacks and data down to Controls, TabDisplay, FretboardDiagram.
- **Persistence:** Use **useLocalStorage** for BPM, metronome volume, last exercise type, theme id — so the app “remembers” without a backend.
- **If state grows:** Introduce a small **context** (e.g. `PracticeContext`) for exercise state and playback, or a minimal store (Zustand/Jotai) for “practice” slice only. Avoid Redux unless the app grows significantly.

---

## 8. Audio Engine Design

### 8.1 Responsibilities

- **Single AudioContext** (lazy-init on first play; respect browser autoplay).
- **Metronome:** downbeat/upbeat clicks at scheduled times; callbacks for `onBeat`, `onTick`, `onCountIn`.
- **Note playback:** given tuning (or base frequencies), play a single (string, fret) or a full column; short envelope (pluck).
- **Future:** drum loops (pre-rendered or scheduled buffers), separate gain nodes for click vs notes vs drums.

### 8.2 Structure

```js
// core/audio/audioContext.js
let ctx = null;
export function getAudioContext() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  return ctx;
}
```

```js
// core/audio/metronome.js
// schedule clicks using getAudioContext().currentTime + lookahead
// call onBeat(beatIndex), onTick(tickIndex), onCountIn(count) at the right time
// support 4-beat count-in, then subdivision-based ticks
```

```js
// core/audio/notePlayback.js
// getNoteFrequency(stringIndex, fret, tuning) => Hz from tuning + fret formula
// playNote(stringIndex, fret, tuning, duration) => oscillator + gain envelope
// playColumn(column, tuning) => play all non-null (string, fret) in column
```

**Tuning:** Pass the same **tuning** (semitones) from the Music Engine; convert to Hz with a reference frequency (e.g. A4 = 440) and `freq = ref * 2^((semitone + octave*12) / 12)`.

### 8.3 Design Decisions

- **Single context:** Avoids multiple contexts and sample-rate issues.
- **Lookahead scheduling:** Schedule clicks/notes a few hundred ms ahead to avoid drift (current code uses setInterval + setTimeout; a refactor can move to `AudioContext.currentTime` + `setTimeout` for next batch).
- **Volume controls:** Gain nodes for metronome and note volume so UI can mute or balance.

---

## 9. Theme System Design

### 9.1 Theme Object

```js
// theme/index.js
export const defaultTheme = {
  id: 'default',
  background: '#1a1a2e',
  backgroundSecondary: '#16213e',
  backgroundTertiary: '#0f3460',
  accent: '#e94560',
  accentLight: '#ff5a75',
  textPrimary: '#eeeeee',
  textSecondary: '#aaaaaa',
  stringColor: '#888888',
  fretColor: '#444',
  noteColor: '#e94560',
  activeNoteColor: '#ff5a75',
  fullRangeNoteColor: '#888',
  gridColor: 'rgba(255,255,255,0.1)',
};
```

### 9.2 Applying Theme

- **CSS custom properties:** In `index.css` or a theme wrapper, set `--color-bg-primary: ${theme.background}` etc., and use `var(--color-bg-primary)` in Tailwind or components. Current `@theme` in Tailwind can be driven by a script or by injecting a `<style>` that sets these variables from the active theme.
- **React context:** `ThemeContext` holds `theme` and `setTheme`; a theme switcher (future) calls `setTheme(nextTheme)`; root component or layout re-applies CSS variables when theme changes.
- **Persistence:** Store `themeId` in localStorage so the choice survives refresh.

---

## 10. Chord System (Fingering)

Chords are **pitch sets** from the Music Engine (`getChord(root, intervals)`). **Fingering** is separate data: which string, which fret, mute or open.

### 10.1 Fingering Shape

```js
// data/chordShapes.js
// One shape = one way to play a chord (e.g. E-shaped barre)
{
  chordKey: 'major',        // or 'minor', 'seventh', etc.
  rootSemitone: 11,         // B
  startFret: 2,             // capo/barre at fret 2
  frets: [-1, 0, 1, 1, 1, 0],  // per string: -1 mute, 0 open, 1+ fret (relative to startFret or absolute by convention)
  barre: true,              // optional: draw barre line on first fret column
}
```

Keep the current **column-relative** convention (column 0 = mute/open, 1 = first fret, etc.) so the existing ChordDiagram and display logic can stay; the engine only needs to know **root + intervals** for pitch/root highlighting; fingering stays in data.

---

## 11. Time Signatures

- **Supported:** 4/4, 3/4, 6/8, 12/8.
- **Storage:** `{ num: number, denom: number }` (beats per measure, note value of one beat).
- **Subdivisions:** “Subdivision” = divisions per **beat** (e.g. 2 = eighth notes in 4/4). So slots per measure = `num * subdivision` (e.g. 4/4 with 8ths → 8 slots).
- **Bar lines:** In TabDisplay, a bar line every `num * subdivision` columns (or every `num` beats when using explicit beat/subdivision per column).
- **Count-in:** Keep 4 beats; for 3/4 we could still do 4 clicks or switch to 3; document as a product choice.

---

## 12. Performance Considerations

- **Tab generation:** `generateTab` is pure and cheap; run it when params change and store the result; no need to regenerate on every tick.
- **Fretboard:** Only re-render when `currentNotes`, `tuning`, or scale/position data change; avoid recalculating “all notes in scale” inside render — compute once per exercise/scale and pass down.
- **Metronome:** Scheduling in a tight loop (e.g. every 25 ms) is fine; avoid doing heavy work in the tick callback — only advance index and call `playColumn` + update state.
- **Virtualization:** If tab has thousands of columns, TabDisplay can virtualize (render only a window of columns); current design likely doesn’t need it yet.
- **Audio:** Reuse oscillators or use short one-shots; avoid creating hundreds of nodes per second.

---

## 13. Step-by-Step Refactor Plan

### Phase 1 — Music engine (no UI changes)

1. Add **core/music/** with `notes.js`, `scales.js`, `chords.js`, `tuning.js`, `intervals.js` as above. Implement `getNoteAt`, `transpose`, `getScale`, `getChord`, `getFretboardNotes`.
2. Add **data/tunings.js** with STANDARD, DROP_C, C_STANDARD (semitones from C).
3. Replace **all** direct use of `STRING_SEMITONES` / `ROOT_SEMITONES` in components with imports from `core/music` and `data/tunings`. Pass **tuning** into FretboardDiagram, TabDisplay, and any note playback.
4. **Tests:** Unit tests for `getNoteAt`, `getScale`, `getChord`, `transpose` (no React).

### Phase 2 — Exercise engine and tab

5. Add **core/exercise/** with `scheduler.js` (or equivalent) and move/refactor **tabGenerator** to use only `core/music` (no hardcoded note names). `generateTab` returns tab (array of columns) from exercise type, pattern, root (as semitone or root id mapped to semitone).
6. Integrate scheduler with **useMetronome**: on each tick, call `exerciseEngine.onTick()` and read `getCurrentNotes()`; App or a hook sets state for `currentNotes` and current column index.
7. Ensure **FretboardDiagram** receives `tuning` and uses `music.getNoteAt` and `music.getScale` (or engine-provided “scale notes” for the current root/scale type) for highlighting; remove any duplicated scale logic from the component.

### Phase 3 — Audio and theme

8. Add **core/audio/** with shared AudioContext, metronome, and note playback. **useMetronome** and **useNotePlayback** become thin wrappers that call the engine. Note playback takes **tuning** and uses music engine to resolve pitch if needed (or keep frequency calc in audio from tuning + fret).
9. **Theme:** Extract current colors into **theme/index.js** and apply via CSS variables; ensure all components use `var(--…)` or theme props. Optional: ThemeContext + switcher.

### Phase 4 — Chords and reference

10. **Chords:** Keep `data/chordShapes.js` (or basicChords) for fingering; add `core/music/chords.js` with `getChord(root, intervals)`. Reference page: load chord shapes from data, resolve root to semitone, use engine for “is this note root?” and for any future chord quizzes.
11. **Scale reference:** Use `getScale(root, stepPattern)` and position data (from current exerciseTypes or from scalePositions) to render PositionDiagram; no hardcoded note arrays in the diagram.

### Phase 5 — Riffs and chord progressions

12. **Riff library:** Add **data/riffs/** with a few riffs in the note-event format; add a small **riffToTab** in core/exercise and a way to “play a riff” (load its tab into the exercise engine).
13. **Chord progression exercises:** New exercise type: sequence of chord shapes + duration per chord; generator produces a “tab” where each column is a chord (multiple strings). Reuse ChordDiagram for display and engine for chord pitch sets.

### Phase 6 — Tuner (optional)

14. **Tuner:** Optional module in **core/audio/tuner.js**: getUserMedia → AnalyserNode → FFT → pitch detection (e.g. autocorrelation or simple peak). Display note name (from semitone) and cents offset; drive a simple needle or “in tune” indicator.

---

## 14. Important Reminders

- **No hardcoded note arrays** for logic: use semitone math and interval patterns everywhere.
- **Tuning is always passed** into fretboard, playback, and any note-dependent UI.
- **Engine first:** Implement and test core/music and core/exercise before big UI changes.
- **Incremental:** One phase at a time; keep the app runnable after each phase (feature flags or parallel paths if needed).

This document is the single reference for the **full-refactor** branch; implement in the order above and adjust the plan only when the codebase reveals a better approach.
