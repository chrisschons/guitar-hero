import { useRef, useEffect, useCallback } from 'react';

export function useAnimationLoop(callback, isRunning) {
  const requestRef = useRef(null);
  const previousTimeRef = useRef(null);

  const animate = useCallback((timestamp) => {
    if (previousTimeRef.current === null) {
      previousTimeRef.current = timestamp;
    }

    const deltaTime = (timestamp - previousTimeRef.current) / 1000;
    previousTimeRef.current = timestamp;

    callback(deltaTime);

    requestRef.current = requestAnimationFrame(animate);
  }, [callback]);

  useEffect(() => {
    if (isRunning) {
      previousTimeRef.current = null;
      requestRef.current = requestAnimationFrame(animate);
    } else {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
        requestRef.current = null;
      }
    }

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [isRunning, animate]);

  const reset = useCallback(() => {
    previousTimeRef.current = null;
  }, []);

  return { reset };
}
