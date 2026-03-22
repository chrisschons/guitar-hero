# Guitar Practice App — Claude Code Context

React + TypeScript + Vite guitar practice app. Two main surfaces:
- **Practice page** (`App.jsx`) — exercise player with scrolling tab, fretboard, metronome
- **Editor page** (`src/pages/EditorV2.tsx`) — riff grid editor

---

## Architecture — read this before touching anything

### Editor data flow (v2, non-negotiable)

```
Load:  riff.notes[]  →  useGridEditor.loadFromNoteEvents()  →  gridNotes[]   (once, on riff switch)
Edit:  all operations mutate gridNotes[] only via useGridEditor / gridEngine
Flush: gridNotes[]   →  useGridEditor.toNoteEvents()        →  riff.notes[]  (save + playback)
```

**The riff object is never read during an edit operation.** It is only:
- Loaded from on riff switch (`useEffect` on `riffId`)
- Written to on flush (debounced 500 ms, or for playback via `useMemo`)

**Never** route editor mutations through `riff.notes` → `gridToNotes` → back. That was the v1 bug. All operations in `src/core/gridEngine.ts` are pure: `(GridNote[], ...params) → GridNote[]`.

### Key files

| File | Role |
|------|------|
| `src/core/gridEngine.ts` | All editor operations as pure functions. Source of truth for grid logic. |
| `src/hooks/useGridEditor.ts` | Owns `gridNotes[]`, `selectedIds`, clipboard, undo/redo. Wraps gridEngine. |
| `src/components/GridEditor.tsx` | Visual grid — receives props, fires callbacks. No internal note state. |
| `src/pages/EditorV2.tsx` | Wires useGridEditor + GridEditor + playback + save. |
| `src/core/music/` | Pure music theory: `getNoteAt`, `getScale`, `getChord`, `getFretboardNotes`. **No UI.** |
| `src/core/audio/` | Web Audio metronome + note playback. **No UI.** |
| `src/data/exerciseTypes.js` | `generateTab()` + `EXERCISE_TYPES` + `PENTATONIC_POSITIONS` etc. |
| `src/data/scalePositions.js` | `getMajor3NPSPositions()`, `getMinor3NPSPositions()` — currently fret-shape based. |
| `src/data/neutral3NPS.js` | Neutral 3NPS shapes + start position/fret tables per key. |
| `src/data/tunings.js` | `STANDARD_TUNING`, `C_STANDARD_TUNING`, `DROP_C_TUNING` as semitone arrays. |
| `src/hooks/useExercise.js` | Wraps exercise engine + `generateTab`. |
| `src/components/Controls.jsx` | Practice page toolbar — root note, type, exercise, pattern, subdivision selectors. |
| `src/components/TabDisplay.jsx` | Scrolling tab display for practice page. |
| `src/components/FretboardDiagram.jsx` | Fretboard with scale/position highlighting. |

### Music engine contract

- Notes are **semitones 0–11** (C=0, C#=1, … B=11). Never hardcode note-name arrays in logic.
- **Tuning** = `number[]` length 6, index 0 = high e, index 5 = low E. Every fretboard/playback API takes tuning as a parameter.
- `getNoteAt(stringIndex, fret, tuning)` → pitch class 0–11. The only way to get a note from a fret.
- `getScale(rootSemitone, intervals)` → pitch class array. Use `SCALE_INTERVALS` from `core/music/scales.js`.
- Scale/position generation must work for **any tuning**, not just standard. See "Phase 2 goal" below.

---

## Phase 2 goal: pitch-based scale/exercise engine

### The bug
`PENTATONIC_POSITIONS`, `BLUES_POSITIONS`, and 3NPS positions in `exerciseTypes.js` / `scalePositions.js` are **hardcoded fret shapes in A (standard tuning)**. Switching to C Standard plays the wrong notes because frets are literal, not pitch-relative.

`generateTab` for pentatonic/blues applies `getRootOffset(rootNote)` as a fret shift. This works for standard tuning but breaks for others, and it produces wrong frets for some roots (e.g. C minor pentatonic pos 1 shows 8–11 instead of 0–3).

### The fix (pitch-based generation)

Replace hardcoded position arrays with a computed `generateScalePosition(root, scaleType, positionIndex, tuning, fretWindow)` that:

1. Calls `getScale(rootSemitone, SCALE_INTERVALS[scaleType])` to get pitch classes.
2. Computes open-string MIDI notes from tuning + octave offsets (`STANDARD_TUNING_OCTAVES` in `tunings.js`).
3. For each string, finds all frets (0–23) where `(openMidi[s] + fret) % 12` is in the scale pitch classes.
4. Filters to frets within a position window (5-fret span centred on the position).
5. Returns `[stringIndex, fret][]` sorted low string → high string.

For 3NPS: after computing scale position, apply a "3 notes per string" filter — keep the 3 frets closest to the window centre per string.

This makes any root + any tuning produce correct frets automatically.

### All 12 root notes

`Controls.jsx` already imports `NOTE_NAMES` from `core/music` and renders all 12 in the selector. The blocker is that `generateTab` for pentatonic/blues uses `getRootOffset()` (A-based fret shift) which breaks for many roots. The pitch-based generator fixes this as a side effect.

`EXERCISE_TYPES` in `exerciseTypes.js` controls which exercise types show the root selector. Scale-type exercises (`pentatonic`, `blues`, `major-3nps`, `minor-3nps`, `scale-runs`) should show it; `riffs`, `power-chords`, `chord-progressions` should not. This is a conditional render in `Controls.jsx`.

---

## Known bugs — do not regress these (already fixed in v2)

- **String line behind notes**: `GridEditor.tsx` renders notes with solid `backgroundColor` on the chip div, not opacity-based. The string line sits behind it at `z-index` 0.
- **Editor data flow**: Fixed in `gridEngine.ts` / `useGridEditor.ts`. Do not add any `riff.notes → grid` reads inside edit handlers.
- **Overscroll**: All top-level page divs use `overscroll-none`. Don't remove it.
- **Metronome over toolbar**: Editor and practice headers are `sticky top-0 z-10`.

## Known bugs — still open (target in later phases)

- Barre chord rendering: `ChordDiagram.jsx` needs optional `barre: [fromString, fret, toString]` prop.
- Scale positions always show 5 frets: `PositionDiagram` needs a `minFretSpan={5}` clamp.
- Metronome count-in: first dot doesn't light on tick 0. Lives in `TabDisplay.jsx` / `useMetronome.js`.
- Tuplet copy/paste in mixed selections: clipboard in `gridEngine.ts` handles single-group correctly; multi-group mixed paste still flattens to regular notes.

---

## Tech stack

- React 19, TypeScript (strict), Vite, Tailwind v4
- shadcn/ui + Radix primitives in `src/components/ui/`
- Web Audio API (no external audio library)
- localStorage for persistence (no backend)

## CSS design tokens (do not hardcode colors)

```css
--color-string        /* guitar string line */
--color-chip          /* default note chip */
--color-chip-selected /* selected/active note chip */
--color-bg-primary    /* page background */
--color-bg-secondary  /* panel background */
```

All in `src/index.css`. Use these via Tailwind utilities (`bg-chip`, `text-chip-selected`, etc.) or `style={{ backgroundColor: 'var(--color-chip)' }}`.

## Coding conventions

- Pure functions for all music/grid logic. No side effects in `core/`.
- Hooks own state; components receive props + callbacks only.
- `useCallback` + `useRef` for stable callbacks passed to event listeners.
- No `gridToNotes()` calls inside editor operation handlers — ever.
- TypeScript strict. No `any` unless legacy JS interop forces it.
- Keep `console.log` / debug `fetch` calls out of committed code (the old code had agent logging; remove it if seen).
