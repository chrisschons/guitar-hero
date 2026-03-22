import { useMemo } from 'react';

/**
 * Returns the index of the position with the lowest playable fret.
 * Pure function — safe to call outside a component (e.g. in event handlers).
 */
export function getLowestFretStartIndex(positions: [number, number][][]): number {
  if (positions.length === 0) return 0;
  return positions.reduce((minIdx, pos, i, arr) => {
    const lowestFret = pos.length ? Math.min(...pos.map(([, f]) => f)) : Infinity;
    const currentMin = arr[minIdx].length
      ? Math.min(...arr[minIdx].map(([, f]) => f))
      : Infinity;
    return lowestFret < currentMin ? i : minIdx;
  }, 0);
}

/**
 * Rotates an array of scale positions so that the position with the lowest
 * playable fret (closest to the nut) comes first, preserving cyclic order.
 *
 * Returns the rotated positions and `startIndex` (the original index that
 * became position 0). Use it to reconstruct original position numbers:
 *   originalPosition = (startIndex + idx) % positions.length + 1
 *
 * Each position is [stringIndex, fret][].
 */
export function useOrderedPositions(
  positions: [number, number][][]
): { ordered: [number, number][][]; startIndex: number } {
  return useMemo(() => {
    const startIndex = getLowestFretStartIndex(positions);
    return {
      ordered: [
        ...positions.slice(startIndex),
        ...positions.slice(0, startIndex),
      ],
      startIndex,
    };
  }, [positions]);
}
