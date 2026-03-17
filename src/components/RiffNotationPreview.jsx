/**
 * Riff notation preview: renders the current riff as a VexFlow staff (rhythm + pitch).
 * Used in the grid Editor for export/preview. Loads VexFlow from CDN.
 */

import { useState, useEffect, useRef } from 'react';
import { getSubdivisionsPerBar } from '../core/exercise';
import { STANDARD_TUNING, STANDARD_TUNING_OCTAVES } from '../data/tunings';

const NOTE_NAMES = ['c', 'd', 'e', 'f', 'g', 'a', 'b'];
const SEMITONES = [0, 2, 4, 5, 7, 9, 11]; // C D E F G A B

function pitchClassToName(pc) {
  const i = SEMITONES.indexOf(pc % 12);
  if (i < 0) return 'c';
  const name = NOTE_NAMES[i];
  const next = SEMITONES[(i + 1) % 7];
  const diff = (next - SEMITONES[i] + 12) % 12;
  const sharp = pc % 12 !== SEMITONES[i];
  return sharp ? name + '#' : name;
}

/** (string 1-6, fret) -> VexFlow key e.g. 'e/4' (standard tuning) */
function noteToVexKey(string, fret) {
  const s = Math.max(0, Math.min(5, (string || 1) - 1));
  const openPc = STANDARD_TUNING[s];
  const totalSemitones = openPc + fret;
  const pitchClass = ((totalSemitones % 12) + 12) % 12;
  const octave = STANDARD_TUNING_OCTAVES[s] + Math.floor(totalSemitones / 12);
  return pitchClassToName(pitchClass) + '/' + octave;
}

/** durationSubdivisions (grid 16ths) -> VexFlow duration string */
function durationToVex(dur) {
  if (dur <= 0) return '16';
  if (dur <= 1) return '16';
  if (dur <= 2) return '8';
  if (dur <= 4) return 'q';
  if (dur <= 8) return 'h';
  return 'w';
}

/**
 * Build tickables (notes/rests) from riff for VexFlow.
 * Uses trigger slots for tuplet notes; fills empty slots with rests.
 */
function riffToTickables(riff) {
  const notes = riff?.notes ?? [];
  const rhythmGroups = riff?.rhythmGroups ?? [];
  const subsPerBar = riff?.timeSignature ? getSubdivisionsPerBar(riff.timeSignature) : 16;
  const bars = riff?.lengthBars ?? 8;
  const totalSlots = bars * subsPerBar;

  const groupById = new Map(rhythmGroups.map((g) => [g.id, g]));

  /** slotIndex -> [{ keys, duration, startSlot }] for notes that sound at this slot */
  const bySlot = new Map();
  for (let slot = 0; slot < totalSlots; slot++) {
    bySlot.set(slot, []);
  }

  for (const n of notes) {
    const stringIndex = n.string - 1;
    const bar = n.bar >= 1 ? n.bar : 1;
    const sub = n.subdivision >= 1 ? n.subdivision : 1;
    const startSlot = (bar - 1) * subsPerBar + (sub - 1);
    const duration = n.durationSubdivisions && n.durationSubdivisions > 0 ? n.durationSubdivisions : 1;
    const group = n.rhythmGroupId ? groupById.get(n.rhythmGroupId) : null;
    const indexInGroup = n.indexInGroup ?? 0;

    let triggerSlot;
    let durationSlots;
    if (group?.type === 'tuplet' && group.tupletRatio) {
      const spanSlots = group.endSlot - group.startSlot + 1;
      const nNotes = group.tupletRatio.n;
      const onsetSlot = group.startSlot + (indexInGroup / nNotes) * spanSlots;
      triggerSlot = Math.floor(onsetSlot);
      durationSlots = 1;
    } else {
      triggerSlot = startSlot;
      durationSlots = duration;
    }

    if (triggerSlot < 0 || triggerSlot >= totalSlots) continue;
    const key = noteToVexKey(n.string, n.fret);
    const entry = { keys: [key], duration: durationToVex(durationSlots), startSlot: triggerSlot };
    const list = bySlot.get(triggerSlot);
    if (list.length === 0) {
      list.push(entry);
    } else {
      list[0].keys.push(key);
    }
  }

  const tickables = [];
  const ts = riff.timeSignature || { num: 4, denom: 4 };
  const maxSlots = subsPerBar;
  for (let slot = 0; slot < maxSlots; slot++) {
    const list = bySlot.get(slot) ?? [];
    if (list.length > 0 && list[0].keys.length > 0) {
      tickables.push({ type: 'note', keys: list[0].keys, duration: list[0].duration });
    } else {
      tickables.push({ type: 'rest', duration: '16' });
    }
  }
  return { tickables, numBeats: ts.num };
}

const ACCENT_COLOR = '#e94560';
const STAVE_COLOR = '#334155';

function applyNotationStyles(svg) {
  if (!svg) return;
  const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
  style.textContent = `
    path, line, rect, polygon, text {
      fill: ${ACCENT_COLOR} !important;
      stroke: ${ACCENT_COLOR} !important;
    }
    path[fill="none"], line[fill="none"], rect[fill="none"] {
      fill: none !important;
    }
    path[stroke="none"], line[stroke="none"], rect[stroke="none"] {
      stroke: none !important;
    }
    .vf-stave path {
      stroke: ${STAVE_COLOR} !important;
    }
    .vf-stavebarline rect {
      fill: ${STAVE_COLOR} !important;
    }
  `;
  svg.insertBefore(style, svg.firstChild);
}

export function RiffNotationPreview({ riff, width = 600, height = 140 }) {
  const [status, setStatus] = useState('loading');
  const containerRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    const container = containerRef.current;
    if (!container || !riff) return;

    async function loadAndRender() {
      try {
        let VF = window.Vex?.Flow ?? window.VexFlow;
        if (!VF) {
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/vexflow@4.2.3/build/cjs/vexflow.js';
          script.async = true;
          await new Promise((resolve, reject) => {
            script.onload = resolve;
            script.onerror = () => reject(new Error('VexFlow script failed to load'));
            document.head.appendChild(script);
          });
          VF = window.Vex?.Flow ?? window.VexFlow;
        }
        if (!VF) throw new Error('VexFlow not available');
        if (typeof VF.setFonts === 'function') VF.setFonts('Bravura');
        await document.fonts.ready;
        if (!mounted || !containerRef.current) return;

        const el = containerRef.current;
        el.innerHTML = '';
        el.style.minHeight = height + 'px';
        el.style.width = width + 'px';

        const { Renderer, Stave, StaveNote, Voice, Formatter } = VF;
        const renderer = new Renderer(el, Renderer.Backends.SVG);
        renderer.resize(width, height);
        const context = renderer.getContext();

        const ts = riff.timeSignature || { num: 4, denom: 4 };
        const timeSig = `${ts.num}/${ts.denom}`;

        const stave = new Stave(10, 20, width - 20);
        stave.addClef('treble').addTimeSignature(timeSig);
        stave.setContext(context).draw();

        const { tickables, numBeats } = riffToTickables(riff);
        const voice = new Voice({ num_beats: Math.max(4, numBeats), beat_value: ts.denom || 4 });
        for (const t of tickables) {
          if (t.type === 'note') {
            voice.addTickable(new StaveNote({ keys: t.keys, duration: t.duration }));
          } else {
            voice.addTickable(new StaveNote({ keys: ['b/4'], duration: t.duration + 'r' }));
          }
        }

        new Formatter().joinVoices([voice]).format([voice], width - 80);
        voice.draw(context, stave);

        applyNotationStyles(el.querySelector('svg'));
        if (mounted) setStatus('loaded');
      } catch (err) {
        console.error('RiffNotationPreview:', err);
        if (mounted) setStatus('error');
      }
    }

    loadAndRender();
    return () => { mounted = false; };
  }, [riff, width, height]);

  if (!riff) {
    return (
      <div className="rounded-lg border border-border bg-secondary p-3">
        <h3 className="text-sm font-medium text-muted-foreground mb-2">Notation preview</h3>
        <div className="text-muted-foreground text-sm">No riff loaded</div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-secondary p-3">
      <h3 className="text-sm font-medium text-muted-foreground mb-2">Notation preview</h3>
      <div className="overflow-x-auto">
        {status === 'loading' && (
          <div className="flex items-center justify-center text-muted-foreground text-sm" style={{ minHeight: height }}>
            Loading VexFlow…
          </div>
        )}
        {status === 'error' && (
          <div className="text-red-400 text-sm p-2">Failed to load notation preview</div>
        )}
        <div
          ref={containerRef}
          style={{ minHeight: height, width }}
          aria-hidden={status !== 'loaded'}
        />
      </div>
    </div>
  );
}
