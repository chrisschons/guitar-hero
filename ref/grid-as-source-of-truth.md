# Grid as Source of Truth — Architecture Proposal

## Why the current approach is buggy

Right now the **riff is the source of truth**:

- `notes` are **derived every render** from `riff.notes` via `riffNotesToGridNotes(riff, bars)`.
- Selection is kept separately in `selectedNoteIds`.
- Every edit (place, delete, move, resize, split, combine) goes through `gridEditorModel` and updates `riff.notes` via `onRiffChange`.

That causes:

1. **Unstable note identity**  
   Ids come from the riff (`n.id` or `n-${index}`). After any edit (delete, undo, reorder), indices change so generated ids change. Selection and drag/resize often reference notes that no longer match, or the wrong note.

2. **No chord grouping from data**  
   `riffNotesToGridNotes` always sets `chordId: null` because `NoteEvent` has no chordId. So “select one note in a column” can’t reliably mean “select this chord” — the grid never has chord structure, so selection and multi-note drag are ambiguous.

3. **Round-trip on every edit**  
   Each interaction converts grid coordinates → bar/subdivision/duration → new `NoteEvent[]` → parent state → re-derive grid. Any small bug in that pipeline (or in who calls `onRiffChange`) shows up as selection/display bugs.

4. **Two parallel representations**  
   There is both `notes` (from riff) and `editorGrid` (from `notesToEditorGrid(riff)`) used in different places, which increases the chance of desync.

So yes: the current “riff-first” wiring is fragile. Making the **grid the single source of truth** and syncing to the riff only at the edges will fix this.

---

## Grid as source of truth

**Idea:** The grid holds the only editable state. The riff is an **output** of the grid (for save and playback), not the input we derive from every time.

- **Grid state:** One array `gridNotes: StateTestNote[]` with stable `id` and optional `chordId`. This is what we render and what all interactions mutate.
- **Load (riff → grid):** When we open or switch a riff, convert **once**: `riffNotesToGridNotes(riff, bars)`, then:
  - Assign **stable ids** (keep `n.id` if present, else generate once, e.g. `genNoteId()`).
  - Assign **chordId** for notes that start in the same column (e.g. same `startCol` → same `chordId`), so “select one in column” and “drag chord” work consistently.
- **All interactions:** Only update `gridNotes` (and `selectedNoteIds`). No `onRiffChange` in the middle of drag/resize/click — just update grid state.
- **Sync to riff:** Only when we need to:
  - **Save:** Convert `gridNotes` → `NoteEvent[]` with a single `gridNotesToRiffNotes(gridNotes, riff, bars)` and call `onRiffChange` with the new `notes`.
  - **Playback:** Pass an “effective riff” whose `notes` come from `gridNotesToRiffNotes(gridNotes, riff, bars)` (e.g. via `useMemo`) so playback always uses current grid content.
- **History:** Store **grid snapshots** (e.g. `gridNotes` arrays) in undo/redo, not riff snapshots. Undo/redo only replace `gridNotes`; then we sync to riff (e.g. on a short debounce or on next save) so the parent riff stays in sync when needed.

So we **do** need a small rework of how the grid is connected to the riff:

- **Add:** `gridNotesToRiffNotes(gridNotes, riff, bars)` that maps `StateTestNote[]` → `NoteEvent[]` (using `subsPerBar` from riff, slot → bar/subdivision, preserve `id`).
- **Change:** State is `gridNotes` (+ selection, drag, resize, etc.). On riff load/switch: set `gridNotes = riffNotesToGridNotes(...)` with stable ids and chordIds.
- **Change:** All edit handlers only update `gridNotes` (and selection). No direct `onRiffChange` from inside drag/resize/click; only when we “flush” grid to riff (save, or when playback needs it).
- **Change:** Undo/redo push and restore `gridNotes`; after restore, optionally sync to riff once.

That way, dragging, dropping, selecting, and splitting all operate on one consistent grid model, and we avoid the bugs that come from riff-derived identity and missing chord grouping. The riff becomes a serialization of the grid, not the source we derive from on every interaction.

---

## Implementation checklist

- [ ] **Add `gridNotesToRiffNotes`**  
  In `gridEditorModel` or `riffGrid`: `(gridNotes: StateTestNote[], riff: Riff, bars: number) => NoteEvent[]` using `subsPerBar`, slot → bar/subdivision, keep `id` from grid note.

- [ ] **Riff → grid once with stable ids and chordIds**  
  In `riffNotesToGridNotes` (or a dedicated “load” function): generate stable id per note if missing; for notes with the same `startCol`, assign the same `chordId` (e.g. `genChordId()` per column).

- [ ] **Grid state as primary**  
  In `StateTestGrid` (or the component that owns the grid): replace “derive notes from riff” with “state: `gridNotes`”. Initialize/update `gridNotes` only when `riff`/`riffId`/`bars` load or change (one-way: riff → grid).

- [ ] **All edits only touch grid**  
  Click, place, delete, move, resize, split, combine, paste: update only `gridNotes` (and selection). No `onRiffChange` inside these handlers.

- [ ] **Sync grid → riff when needed**  
  - On a short debounce after edits, or on “blur”/save: `onRiffChange(prev => ({ ...prev, notes: gridNotesToRiffNotes(gridNotes, prev, bars) }))`.
  - For playback: pass `useMemo(() => ({ ...riff, notes: gridNotesToRiffNotes(gridNotes, riff, bars) }), [riff, gridNotes, bars])` so the engine always sees current grid.

- [ ] **History over grid**  
  Undo stack holds `gridNotes[]` (or serializable snapshots). Undo/redo set `gridNotes` from stack; then run the same “sync grid → riff” so parent and playback stay in sync.

- [ ] **Remove duplicate representation**  
  Use one grid model (`gridNotes`) for both display and hit-testing; drop or derive `editorGrid` from `gridNotes` if something still needs a cell matrix, so there’s a single source of truth.

After this rework, the grid is the source of truth; the riff is an export. Interactions stay simple and consistent, and we can fix selection and chord behavior in one place.
