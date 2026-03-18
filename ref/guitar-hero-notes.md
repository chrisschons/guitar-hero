# Editor Notes

## Features & Improvements

### General
- Need better demos. Clear out the existing ones and replace with riffs based on editor functionality, not exercises
- Add volume control (all pages)
- Add stop button (all pages)
- Refactor design tokens and core UI colors (notes, frets, etc.) started, light mode wasnt quite working due to opacity issues

### Exercise
- Move Key option to only be visible for scale exercises
- Refine fretboard for exercises
- flesh put tailwind tokens and variables for better use

### Grid Editor
- Allow marquee drag to start outside grid cells
- Add support for X in cells
- Add quick duplicate option - cmd D duplicates selection to the right
- Add metronome visualization
- More consistent Save UX with local storage
- B - fill beat
- T - enhance keyboard control. T when a triplet is selected anywhere, converts to sextuplet in the same space, not starting at selected note. T on sextuplet has the same behavior except it converts to triplet.
- convert chip colors to solid, not opacity
- triplet/sextuplets, change rest display. if an individaul note is deleted, the chip content changes to rest, instead of the chip being deleted and rests being place on the grid. 

### Scales
- Add regular scale, not just 3NPS
- update blues to work with new system

### Chords
- Make boxes bigger
- attempt to rotate boxes with format option

### Practice
- Add ability to open riff in editor
- Make changes and save as a copy
- Metronome needs to be sticky

### Tab Display

### Navigation & UI
- Add minimap with bars

## Known Bugs
- ~~**Editor**: Notes should not resize when updating bar count. Any notes past the bar count are lost.~~  
  Fixed: bar-count changes now truncate or delete notes without reinterpreting durations, and no longer pile notes into the last cell.
- ~~**Editor**: Sound persists on loop sometimes, or if a note~~  
  Mitigated: loop detection and `stopAllSustained` wired so long notes don't ring across loops in the editor; further tuning left for later if needed.
- ~~**Tuplets**: Don't paste correctly when in a group~~  
  Fixed: tuplets paste via rhythm-group metadata, preserve group structure, and can't be partially carved by drop/paste.
- ~~**Tuplets**: Paste as all selected, cannot be individually selected or edited~~  
  Fixed: selection now expands to full rhythm groups for copy/paste, but pasted notes are individually editable again.
- ~~**Audio**: Volume difference between notes and metronome, the metronome is too loud, the tone volumne is too low, especially the low notes~~  
  Improved: metronome max gain reduced and note playback gain increased; mix is more balanced, though fine-tuning remains future work.
- **Tuning**: Exercises don't work properly with alternate tunings  
  Partially addressed: Drop C hidden for now; C Standard supported but scale/exercise generator still needs a full pitch-based refactor for perfect fret mapping.
- **Metronome**: First metronome dot does not hightlight in count in  
  Known issue (exercises): behavior left as-is to avoid destabilizing playback; revisit with a dedicated metronome visual pass.
- ~~**Metronome**: fixed position so it doesn not scroll with the content~~  
  Fixed: editor and practice metronomes/controls use sticky headers; overscroll/bounce largely removed for headers.
- **General**: All headers should use the beahvior of the editor, no overscrolling  
  Mostly done for main pages; minor edge cases and mobile bounce left as polish.