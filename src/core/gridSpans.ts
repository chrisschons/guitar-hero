import type { RiffGrid } from './riffGrid';
import type { NoteEvent } from '../types/riff';

/**
 * A span represents a contiguous group of cells that are treated as one unit
 * (e.g. a duration run on one or more strings, or a chord stack at one slot).
 */
export type Span =
  | { kind: 'duration'; strings: number[]; startSlot: number; endSlot: number }
  | { kind: 'chord'; strings: number[]; slot: number };

function cellKey(s: number, col: number): string {
  return `${s}-${col}`;
}

/**
 * Extract duration spans from the grid (contiguous same-fret runs, length >= 2).
 * Prefer extractDurationSpansFromNotes when you have riff.notes so that only
 * explicitly held notes (durationSubdivisions > 1) are treated as duration.
 */
export function extractDurationSpansFromGrid(grid: RiffGrid): Span[] {
  const spans: Span[] = [];
  if (!grid?.length) return spans;

  for (let s = 0; s < grid.length; s += 1) {
    const row = grid[s] ?? [];
    let col = 0;
    while (col < row.length) {
      const fret = row[col];
      if (fret === null || fret === undefined) {
        col += 1;
        continue;
      }
      let end = col + 1;
      while (end < row.length && row[end] === fret) end += 1;
      const runLength = end - col;
      if (runLength > 1) {
        spans.push({ kind: 'duration', strings: [s], startSlot: col, endSlot: end - 1 });
      }
      col = end;
    }
  }
  return spans;
}

/**
 * Extract duration spans from notes. Only notes with durationSubdivisions > 1
 * are treated as duration runs. This avoids treating two adjacent same-fret
 * notes (entered separately) as one duration.
 */
export function extractDurationSpansFromNotes(
  notes: NoteEvent[],
  subsPerBar: number
): Span[] {
  const spans: Span[] = [];
  for (const n of notes ?? []) {
    const dur = n.durationSubdivisions && n.durationSubdivisions > 1 ? n.durationSubdivisions : 0;
    if (dur === 0) continue;
    const s = Math.max(0, Math.min(5, n.string - 1));
    const startSlot = (n.bar - 1) * subsPerBar + (n.subdivision - 1);
    const endSlot = startSlot + dur - 1;
    spans.push({ kind: 'duration', strings: [s], startSlot, endSlot });
  }
  return spans;
}

/**
 * Convert spans to a set of cell keys "stringIndex-slotIndex".
 */
export function spanToCellKeys(spans: Span[]): Set<string> {
  const set = new Set<string>();
  for (const span of spans) {
    if (span.kind === 'duration') {
      for (const s of span.strings) {
        for (let slot = span.startSlot; slot <= span.endSlot; slot += 1) {
          set.add(cellKey(s, slot));
        }
      }
    } else {
      for (const s of span.strings) {
        set.add(cellKey(s, span.slot));
      }
    }
  }
  return set;
}

/**
 * Get the set of cell keys for duration spans only.
 */
export function durationSpansToCellKeys(spans: Span[]): Set<string> {
  return spanToCellKeys(spans.filter((sp): sp is Extract<Span, { kind: 'duration' }> => sp.kind === 'duration'));
}
