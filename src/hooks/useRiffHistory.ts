import { useState, useCallback } from 'react';
import type { Riff } from '../types/riff';

const MAX_HISTORY = 50;

export function useRiffHistory(initialRiff: Riff | null) {
  const [past, setPast] = useState<Riff[]>([]);
  const [future, setFuture] = useState<Riff[]>([]);

  const push = useCallback((riff: Riff) => {
    setPast((prev) => {
      const next = [...prev, riff];
      if (next.length > MAX_HISTORY) return next.slice(-MAX_HISTORY);
      return next;
    });
    setFuture([]);
  }, []);

  const undo = useCallback(
    (current: Riff | null): Riff | null => {
      if (past.length === 0 || !current) return current;
      const prev = past[past.length - 1];
      setPast((p) => p.slice(0, -1));
      setFuture((f) => [...f, current]);
      return prev;
    },
    [past.length]
  );

  const redo = useCallback(
    (current: Riff | null): Riff | null => {
      if (future.length === 0 || !current) return current;
      const next = future[future.length - 1];
      setFuture((f) => f.slice(0, -1));
      setPast((p) => [...p, current]);
      return next;
    },
    [future.length]
  );

  const clear = useCallback(() => {
    setPast([]);
    setFuture([]);
  }, []);

  const canUndo = past.length > 0;
  const canRedo = future.length > 0;

  return { push, undo, redo, clear, canUndo, canRedo };
}
