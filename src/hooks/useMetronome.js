import { useRef, useCallback, useEffect } from 'react';

const COUNT_IN_BEATS = 4;

export function useMetronome(bpm, subdivision, isPlaying, onBeat, onTick, onCountIn, volume = 0.3) {
  const audioContextRef = useRef(null);
  const nextNoteTimeRef = useRef(0);
  const currentBeatRef = useRef(0);
  const currentSubBeatRef = useRef(0); // Track position within beat (0 to subdivision-1)
  const currentTickRef = useRef(0);
  const countInRef = useRef(0);
  const timerIdRef = useRef(null);

  const initAudio = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioContextRef.current;
  }, []);

  const playClick = useCallback((isDownbeat = false, isCountIn = false) => {
    const ctx = audioContextRef.current;
    if (!ctx) return;
    
    // Always play click during count-in, otherwise respect volume setting
    if (!isCountIn && volume === 0) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    // Higher pitch for count-in clicks
    osc.frequency.value = isCountIn ? 1200 : (isDownbeat ? 1000 : 800);
    osc.type = 'sine';

    const clickVolume = isCountIn ? 0.5 : (isDownbeat ? volume : volume * 0.4);
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(clickVolume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.start(now);
    osc.stop(now + 0.1);
  }, [volume]);

  const scheduleNote = useCallback((beat, subBeat, tick, time) => {
    const ctx = audioContextRef.current;
    if (!ctx) return;

    const isCountingIn = countInRef.current < COUNT_IN_BEATS;
    const delay = (time - ctx.currentTime) * 1000;
    const isOnBeat = subBeat === 0; // Only click on the main beat
    
    if (isCountingIn) {
      // Count-in only happens on beats (not subdivisions)
      // Capture count value now, before incrementing
      const countValue = COUNT_IN_BEATS - countInRef.current;
      countInRef.current += 1;
      
      setTimeout(() => {
        // Play click when it's time
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 1200;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.5, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.1);
        
        onCountIn?.(countValue);
        onBeat?.(beat);
      }, Math.max(0, delay));
    } else {
      // Normal playback - only click on actual beats, not subdivisions
      if (isOnBeat) {
        playClick(beat === 0, false);
      }
      
      setTimeout(() => {
        if (isOnBeat) {
          onBeat?.(beat);
        }
        onTick?.(tick);
      }, Math.max(0, delay));
    }
  }, [playClick, onBeat, onTick, onCountIn]);

  const scheduler = useCallback(() => {
    const ctx = audioContextRef.current;
    if (!ctx) return;

    const secondsPerBeat = 60.0 / bpm;
    const secondsPerNote = secondsPerBeat / subdivision;

    while (nextNoteTimeRef.current < ctx.currentTime + 0.1) {
      const isCountingIn = countInRef.current < COUNT_IN_BEATS;
      
      if (isCountingIn) {
        // During count-in, only tick on full beats (not subdivisions)
        scheduleNote(currentBeatRef.current, 0, currentTickRef.current, nextNoteTimeRef.current);
        nextNoteTimeRef.current += secondsPerBeat;
        currentBeatRef.current = (currentBeatRef.current + 1) % 4;
      } else {
        // Normal playback - tick at subdivision rate
        scheduleNote(currentBeatRef.current, currentSubBeatRef.current, currentTickRef.current, nextNoteTimeRef.current);
        nextNoteTimeRef.current += secondsPerNote;
        currentTickRef.current += 1;
        
        // Advance sub-beat, and beat when sub-beat wraps
        currentSubBeatRef.current += 1;
        if (currentSubBeatRef.current >= subdivision) {
          currentSubBeatRef.current = 0;
          currentBeatRef.current = (currentBeatRef.current + 1) % 4;
        }
      }
    }
  }, [bpm, subdivision, scheduleNote]);

  const start = useCallback(() => {
    const ctx = initAudio();

    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    nextNoteTimeRef.current = ctx.currentTime;
    currentBeatRef.current = 0;
    currentSubBeatRef.current = 0;
    currentTickRef.current = 0;
    countInRef.current = 0;

    timerIdRef.current = setInterval(scheduler, 25);
  }, [initAudio, scheduler]);

  const stop = useCallback(() => {
    if (timerIdRef.current) {
      clearInterval(timerIdRef.current);
      timerIdRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    currentBeatRef.current = 0;
    currentSubBeatRef.current = 0;
    currentTickRef.current = 0;
    countInRef.current = 0;
    onBeat?.(-1);
  }, [onBeat]);

  useEffect(() => {
    if (isPlaying) {
      start();
    } else {
      stop();
    }

    return () => stop();
  }, [isPlaying, start, stop]);

  useEffect(() => {
    if (isPlaying && timerIdRef.current) {
      stop();
      start();
    }
  }, [bpm, subdivision, isPlaying, start, stop]);

  return { reset };
}
