## Dev Notes – Editor, Tuplets, Metronome, Tunings

### Phase 2 – What’s been fixed

- **Editor bar-count & durations**
  - Changing `lengthBars` no longer reinterprets durations or clamp-notes into the last column.
  - Behavior:
    - Notes fully inside the new range are untouched.
    - Notes overlapping the new end are truncated to `lastCol`.
    - Notes starting beyond `lastCol` are dropped.
  - `+`/`=` duration growth is clamped so a note can **never extend into or past the next note** on the same string.

- **Tuplets & duration groups**
  - Tuplets are treated as atomic rhythm groups:
    - Selection (click, shift-click, marquee) expands to the full `rhythmGroupId`.
    - Copy/cut/paste preserves tuplet groups when copied alone.
    - Split/combine:
      - Split (`S`) is disabled when any selected note has `rhythmGroupId`.
      - Combine-into-chord is disabled when any selected note has `rhythmGroupId`.
  - Drag/drop and paste:
    - Disallowed to drop or paste **onto** existing tuplets; any overlap with a tuplet cell cancels the operation.
    - Tuplets are shielded from “drop-to-split” carving; partial overlaps leave the group untouched.
  - Multi-select drag:
    - If more than one note is selected, the drag **always moves the full selection**, even when started on a tuplet.
    - Original chips and tuplet connector dots for dragged notes are hidden while dragging; only the ghost is shown.

- **Editor keyboard behavior**
  - `+`/`=`:
    - Works on the current selection, or on the note under the active cell when nothing is selected.
    - Extends duration by 1 column but clamps to **one before** the nearest later note on that row.
  - `-`:
    - Shrinks duration by 1 column down to `startCol`.

- **Looping & sustained notes (Editor)**
  - `useNoteTones` tracks sustained notes per string in `activeSustainedRef`.
  - The editor uses `stopAllSustained()` on:
    - Play → Stop,
    - Reset,
    - And when `isPlaying` becomes false.
  - Looping behavior is improved but still conservative; full loop-duration clamping is left for a future pass.

- **Audio balance**
  - Metronome:
    - `maxGain` reduced in `core/audio/metronome.js` so clicks sit lower in the mix.
  - Notes:
    - `useNoteTones` now uses a slightly higher gain factor (from `volume * 0.2` → `volume * 0.3`) for both plucks and sustained tones, especially helping low notes.

- **Metronome & layout**
  - Editor and practice/controls headers use `sticky top-0 z-10` so they behave like the editor header.
  - The exercise tab playhead in `TabDisplay`:
    - Has `z-0` so it no longer draws over the controls.
    - Still uses smooth scrolling based on `scrollPosition`.
  - For disallowed drops (e.g. over tuplets):
    - Drop-target highlight is hidden.
    - Hover states for cells, chips, chord connectors, and tuplet connectors are heavily suppressed in the invalid region.

- **Tunings**
  - `Drop C`:
    - Still defined but **hidden from `TUNINGS_LIST`** so it won’t appear in the UI.
    - Marked as a future enhancement; needs proper pattern mapping.
  - `C Standard`:
    - Fully defined in `data/tunings.js` as `C_STANDARD_TUNING = [C, G, Eb, Bb, F, C]`.
    - Works for tuning-aware APIs (`getStringLabels`, `getNoteFrequency`, etc.), but…
    - Scale/exercise patterns are still E-standard–centric; see “Future work” below.

### Phase 2 – Known limitations / future work

- **Scale & exercise generator (pitch vs fret)**
  - Current behavior:
    - Patterns (pentatonic, blues, etc.) are effectively defined as **E-standard fret shapes**.
    - When you switch to C standard, the engine doesn’t fully re-root patterns; e.g. C minor pentatonic position 1 shows 8–11 instead of 0–3 / 12–15, and audio doesn’t match the intended root.
  - Future refactor:
    - Represent patterns as **semitone intervals from a root pitch**.
    - Given tuning semitones, map each target pitch to `(string, fret)` by:
      - Computing open-string MIDI notes from tuning,
      - Finding valid fret positions for each pitch on each string,
      - Choosing positions that match the intended position box/fret range.
    - Rebuild:
      - The `tab` columns for `TabDisplay`,
      - And the note list used by `exerciseOnTick` / playback.
    - Goal: C standard (and other tunings) show and play the correct roots/frets for pentatonic/blues.

- **Tuplets & copy/paste in mixed selections**
  - Today:
    - Tuplets copy/paste correctly **when copied alone** (single `rhythmGroupId`).
    - Mixed selections (tuplets + regular notes) fall back to the plain-note path; tuplets flatten to regular grid notes on paste.
  - Future:
    - Extend clipboard to support **multiple rhythm groups** simultaneously:
      - Store `rhythmGroupId`, `tupletRatio`, span, and string set for each group.
      - Paste each group back as a proper tuplet while also pasting non-tuplet notes alongside.
    - Keep underlying riff model and grid model in sync for mixed-group pastes.

- **Tuplets & duplication**
  - Today:
    - Duplicate (Cmd + D or toolbar button) is allowed only when the selection contains **no** `rhythmGroupId` notes and would not overlap any existing tuplet cells in the duplicate region.
    - If duplication would touch a tuplet (either in the selection or in the target area), it is silently disallowed.
  - Future:
    - Implement full tuplet-aware duplication:
      - Duplicate entire tuplet groups as units, preserving their `rhythmGroupId` and `tupletRatio`.
      - Safely carve or shift any overlapping non-tuplet notes in the target region without breaking tuplet spans.

- **Split duration vs underlying riff model**
  - `StateTestGrid` now:
    - Splits selected duration notes into per-slot notes.
    - Clears overlapping notes on the same row/value inside the selected span before splitting.
  - But the canonical riff model (`durationSubdivisions` in `gridEditorModel`) can still contain overlapping entries from older operations.
  - Future:
    - Route `S`/Split through the model-level `splitDurationToNotes(riff, riff.notes, selection)` and rederive the grid from that, not from a separate grid-only splitter.
    - Guarantee “one logical note per string/slot” in the riff model after split.

- **Metronome visuals (exercises)**
  - Count-in:
    - Audio and playhead behavior are now back to a stable baseline.
    - The “first count-in dot” behavior is still not exactly as desired (first dot sometimes doesn’t light; visuals are conservative to avoid breaking playback again).
  - Future:
    - Revisit `TabDisplay`’s beat indicator and `countIn`/`currentBeat` wiring with a dedicated visual pass, ensuring:
      - First count-in click lights dot 0.
      - Transition from count-in to regular beat visualization is smooth.

- **Practice barlines & overscroll**
  - Barlines:
    - `TabDisplay` computes `notesPerMeasure` and `loopColumns` and uses them to decide `showBarLine`/`showEndBarLine`.
    - Some edge cases (e.g. certain loopTicks/subdivision combos) cause barlines to disappear or misalign.
  - Overscroll:
    - Main headers/controls are sticky, but there can still be mobile “bounce” and minor content overscroll in some layouts.
  - Future:
    - Normalize `loopColumns` vs `tab.length` and ensure barline conditions use the **effective** `notesPerMeasure` for the current exercise.
    - Tighten overscroll behavior on all top-level layouts (App, Editor, Scales, Practice) for consistent header stickiness.

### Quick reference – Files touched in Phase 2

- `src/pages/Editor.tsx`
  - Bar-count clamp logic.
  - Tuplet selection, copy/cut/paste, drag/drop, and keyboard `+`/`-` behavior.
  - Loop detection and use of `stopAllSustained` (editor playback).

- `src/core/gridEditorModel.ts`
  - Model-level helpers for tuplets and durations (used by editor).

- `src/hooks/useNoteTones.js`
  - Note/metronome volume balance (gain factors).
  - Sustained-note tracking + `stopAllSustained`.

- `src/core/audio/metronome.js`
  - Metronome gain staging.

- `src/components/TabDisplay.jsx`
  - Beat indicator and playhead layering (z-index).
  - Static vs scroll playhead behavior.

- `src/App.jsx` and `src/components/Controls.jsx`
  - Sticky practice/exercise controls header.
  - Wiring for `useMetronome` and `TabDisplay`.

- `src/data/tunings.js`
  - Tuning definitions (Standard, C Standard, temporarily hidden Drop C).

