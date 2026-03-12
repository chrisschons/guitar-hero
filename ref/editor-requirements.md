# Riff editor – requirements (notes & duration)

## Source of truth

- **Canonical state**: `riff.notes` (array of `NoteEvent`). Each note is independent: `string`, `fret`, `bar`, `subdivision`, optional `durationSubdivisions`.
- **Grid**: Display only. Always derived via `notesToGrid(riff, bars)`. The grid is never the source of truth for “how many notes” or “is this one note or two.”
- **No implicit merging**: Two notes with the same fret in adjacent slots remain two notes unless the user explicitly combines them (e.g. “Combine (duration)”).

---

## Duration

- **Duration** = one note with `durationSubdivisions > 1` (one note spanning multiple slots on one string).
- **Duration cells** (styling): Derived only from notes — `extractDurationSpansFromNotes(riff.notes, subsPerBar)` → which cells get duration highlight. Not from the grid.
- **Creating duration**: Only via “Combine (duration)” on a horizontal selection (or future: drag-resize a single note’s handle). Never by “two adjacent same-fret cells” alone.
- **Resize duration**: Only the note being resized changes. New span must not overlap any other note on that string (clamp or no-op). Use note-based `applyDurationResizeToNotes`; do not use `gridToNotes`.
- **Convert duration to notes**: Replace each duration note in the selection by a single-slot note (clear extra slots from that note only).

---

## Chords

- **Chord cells**: Styling set (`chordCells`). A “chord” is multiple strings at the same slot; structure is still just notes. “Combine (chord)” only marks those cells as chord; no structural merge.
- **No overlap**: A cell is either chord-styled or duration-styled, not both. Disable “Combine (duration)” and “Combine (chord)” when selection already has chord or duration.

---

## Operations (note-based, no accidental merge)

1. **Single-cell edit (type / clear)**  
   Use `applyCellUpdateToNotes(riff, notes, stringIndex, slotIndex, value)`. No `gridToNotes`. Adjacent same-fret notes stay separate.

2. **Move (drag-drop)**  
   - **Note-based**: For each note that overlaps the source cells (the selection or the duration run being dragged), remove it from the source (trim/split if it’s a duration and only part is moved). For each “block” moved, add a note at the target with the same fret (and same duration length if it was a duration).  
   - **Do not** build a grid, clear source, fill target, then `gridToNotes` — that merges adjacent same-fret at the target and can merge unrelated notes at the source.

3. **Delete selected**  
   For each note that overlaps any selected cell, remove or trim that note (split duration if only part is selected). Do not use “clear cells on grid then gridToNotes.”

4. **Resize duration**  
   Use `applyDurationResizeToNotes`. New span must not overlap any other note on that string.

5. **Combine (duration)**  
   Only when selection is horizontal and has no chord/duration overlap. Replace all notes that cover the selected slots on the selected string(s) with a single note per string spanning the selection range. Not “grid copy + gridToNotes” (that merges the whole grid).

6. **Combine (chord)**  
   Mark selected cells as `chordCells`; structure remains notes. Optional: ensure one note per string at that slot (no structural merge).

7. **Convert duration to notes**  
   For each note in the selection that has `durationSubdivisions > 1`, replace it with a single-slot note at its start. No gridToNotes over the whole grid.

---

## What goes wrong if we use `gridToNotes` for move/delete/combine

- **gridToNotes** merges every contiguous same-fret run on the grid into one note. So:
  - After a move, if the drop target is next to an existing same-fret note, they become one note (merge).
  - After clearing source cells, if two same-fret notes remain and become adjacent, they merge (moving one cell can “affect” non-touching cells).
  - “Combine (duration)” with “grid copy + gridToNotes” merges the entire grid, not just the selection.

So: **use note-based helpers for all mutations**. Use `gridToNotes` only when we explicitly want “grid → merged notes” (e.g. import from external grid), not for move, delete, or combine.

---

## Summary

| Operation           | Use notes as source of truth | Avoid |
|--------------------|------------------------------|--------|
| Cell edit          | `applyCellUpdateToNotes`     | `gridToNotes` after edit |
| Move               | Remove/trim source notes; add at target | `gridToNotes(nextGrid)` after move |
| Delete             | Remove/trim notes overlapping selection | Clear grid + `gridToNotes` |
| Resize duration    | `applyDurationResizeToNotes` | Grid-based resize + `gridToNotes` |
| Combine duration   | Replace selection-span notes with one note per string | `gridToNotes(riff, nextGrid)` |
| Convert to notes   | Replace duration notes with single-slot notes | Full grid clear + `gridToNotes` |

Duration cells and selection should always reflect the note array; the grid is a view of it.
