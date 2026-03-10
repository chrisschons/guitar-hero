/**
 * One fretted note on a specific string at a specific tick
 * within the tab grid.
 */
export type TabNote = {
  stringIndex: number; // 0 = highest string, 5 = lowest
  fret: number;
};

/**
 * One column in the tab grid (all notes that sound together).
 */
export type TabColumn = {
  /**
   * Zero-based index within the exercise / riff.
   */
  index: number;
  notes: TabNote[];
};

/**
 * A full tab is a simple array of columns. Both the main app
 * and the riff editor consume this shape.
 */
export type Tab = TabColumn[];

