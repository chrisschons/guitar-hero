/**
 * Convert ChatGPT-generated riff JSON to our Riff format.
 *
 * Their format:
 * - string: 1-6 (1 = high e, 6 = low E) → we use 0-5 (0 = high e, 5 = low E)
 * - beat: 1-based → we use 0-based
 * - subdivision: 1-based slot within beat → we use 0-based; max sub = subdivisionsPerBeat
 * - timeSignature: "4/4" → we use { num: 4, denom: 4 }
 * - bpmRange: [min, max] → we use { min, max }
 *
 * @param {object} json - parsed JSON riff
 * @param {string} id - riff id (e.g. from filename)
 * @returns {{ riff: import('./gallops.js').Riff & { subdivisionsPerBeat?: number }, subdivisionsPerBeat: number }}
 */
export function convertChatRiffToRiff(json, id) {
  const notes = json.notes || [];
  let maxSub = 0;
  const converted = notes.map((n) => {
    const string = Math.max(0, Math.min(5, Number(n.string) - 1)); // 1-6 → 0-5
    const beat = Math.max(0, Number(n.beat) - 1); // 1-based → 0-based
    const sub = Number(n.subdivision);
    if (sub > maxSub) maxSub = sub;
    return {
      string,
      fret: Number(n.fret) ?? 0,
      beat,
      subdivision: Math.max(0, sub - 1), // 1-based → 0-based
      duration: Number(n.duration) ?? 1,
    };
  });

  const subdivisionsPerBeat = Math.max(1, maxSub);

  const timeSignature = parseTimeSignature(json.timeSignature || '4/4');
  const bpmRange = Array.isArray(json.bpmRange)
    ? { min: json.bpmRange[0] ?? 80, max: json.bpmRange[1] ?? 160 }
    : { min: 80, max: 160 };

  const name = (json.name || id)
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');

  const riff = {
    id,
    name,
    timeSignature,
    bpmRange,
    notes: converted,
    style: json.style || 'generic',
    subdivisionsPerBeat,
  };

  return { riff, subdivisionsPerBeat };
}

function parseTimeSignature(ts) {
  if (typeof ts === 'string') {
    const [num, denom] = ts.split('/').map(Number);
    return { num: num || 4, denom: denom || 4 };
  }
  return { num: 4, denom: 4 };
}
