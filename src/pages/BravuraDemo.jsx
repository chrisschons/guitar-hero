import { useState, useEffect, useRef } from 'react';

const SMUFL_CATEGORIES = {
  noteheads: {
    name: 'Noteheads',
    symbols: [
      { code: '\uE0A0', name: 'noteheadDoubleWhole' },
      { code: '\uE0A2', name: 'noteheadWhole' },
      { code: '\uE0A3', name: 'noteheadHalf' },
      { code: '\uE0A4', name: 'noteheadBlack' },
      { code: '\uE0A9', name: 'noteheadXBlack' },
      { code: '\uE0B0', name: 'noteheadDiamondBlack' },
      { code: '\uE0B2', name: 'noteheadDiamondHalf' },
    ],
  },
  rests: {
    name: 'Rests',
    symbols: [
      { code: '\uE4E1', name: 'restMaxima' },
      { code: '\uE4E2', name: 'restLonga' },
      { code: '\uE4E3', name: 'restDoubleWhole' },
      { code: '\uE4E4', name: 'restWhole' },
      { code: '\uE4E5', name: 'restHalf' },
      { code: '\uE4E6', name: 'restQuarter' },
      { code: '\uE4E7', name: 'rest8th' },
      { code: '\uE4E8', name: 'rest16th' },
      { code: '\uE4E9', name: 'rest32nd' },
    ],
  },
  clefs: {
    name: 'Clefs',
    symbols: [
      { code: '\uE050', name: 'gClef' },
      { code: '\uE05C', name: 'cClef' },
      { code: '\uE062', name: 'fClef' },
      { code: '\uE06A', name: 'unpitchedPercussionClef1' },
      { code: '\uE06E', name: 'semipitchedPercussionClef1' },
      { code: '\uE052', name: 'gClef8vb' },
      { code: '\uE053', name: 'gClef8va' },
    ],
  },
  accidentals: {
    name: 'Accidentals',
    symbols: [
      { code: '\uE260', name: 'accidentalFlat' },
      { code: '\uE261', name: 'accidentalNatural' },
      { code: '\uE262', name: 'accidentalSharp' },
      { code: '\uE263', name: 'accidentalDoubleSharp' },
      { code: '\uE264', name: 'accidentalDoubleFlat' },
      { code: '\uE26A', name: 'accidentalQuarterToneSharpStein' },
      { code: '\uE26B', name: 'accidentalQuarterToneFlatStein' },
    ],
  },
  timeSignatures: {
    name: 'Time Signatures',
    symbols: [
      { code: '\uE080', name: 'timeSig0' },
      { code: '\uE081', name: 'timeSig1' },
      { code: '\uE082', name: 'timeSig2' },
      { code: '\uE083', name: 'timeSig3' },
      { code: '\uE084', name: 'timeSig4' },
      { code: '\uE085', name: 'timeSig5' },
      { code: '\uE086', name: 'timeSig6' },
      { code: '\uE087', name: 'timeSig7' },
      { code: '\uE088', name: 'timeSig8' },
      { code: '\uE089', name: 'timeSig9' },
      { code: '\uE08A', name: 'timeSigCommon' },
      { code: '\uE08B', name: 'timeSigCutCommon' },
    ],
  },
  dynamics: {
    name: 'Dynamics',
    symbols: [
      { code: '\uE520', name: 'dynamicPiano' },
      { code: '\uE521', name: 'dynamicMezzo' },
      { code: '\uE522', name: 'dynamicForte' },
      { code: '\uE523', name: 'dynamicRinforzando' },
      { code: '\uE524', name: 'dynamicSforzando' },
      { code: '\uE525', name: 'dynamicZ' },
      { code: '\uE526', name: 'dynamicNiente' },
      { code: '\uE527', name: 'dynamicPPPPPP' },
      { code: '\uE528', name: 'dynamicPPPPP' },
      { code: '\uE529', name: 'dynamicPPPP' },
      { code: '\uE52A', name: 'dynamicPPP' },
      { code: '\uE52B', name: 'dynamicPP' },
      { code: '\uE52C', name: 'dynamicMP' },
      { code: '\uE52D', name: 'dynamicMF' },
      { code: '\uE52E', name: 'dynamicPF' },
      { code: '\uE52F', name: 'dynamicFF' },
      { code: '\uE530', name: 'dynamicFFF' },
      { code: '\uE531', name: 'dynamicFFFF' },
    ],
  },
  articulations: {
    name: 'Articulations',
    symbols: [
      { code: '\uE4A0', name: 'articAccentAbove' },
      { code: '\uE4A2', name: 'articStaccatoAbove' },
      { code: '\uE4A4', name: 'articTenutoAbove' },
      { code: '\uE4A6', name: 'articStaccatissimoAbove' },
      { code: '\uE4AA', name: 'articMarcatoAbove' },
      { code: '\uE4AC', name: 'articMarcatoStaccatoAbove' },
      { code: '\uE4AE', name: 'articAccentStaccatoAbove' },
      { code: '\uE4B2', name: 'articTenutoStaccatoAbove' },
      { code: '\uE4B4', name: 'articTenutoAccentAbove' },
    ],
  },
  ornaments: {
    name: 'Ornaments',
    symbols: [
      { code: '\uE560', name: 'ornamentTrill' },
      { code: '\uE566', name: 'ornamentTurn' },
      { code: '\uE567', name: 'ornamentTurnInverted' },
      { code: '\uE56C', name: 'ornamentMordent' },
      { code: '\uE56D', name: 'ornamentMordentInverted' },
      { code: '\uE56E', name: 'ornamentTremblement' },
    ],
  },
  fermatas: {
    name: 'Fermatas',
    symbols: [
      { code: '\uE4C0', name: 'fermataAbove' },
      { code: '\uE4C1', name: 'fermataBelow' },
      { code: '\uE4C2', name: 'fermataVeryShortAbove' },
      { code: '\uE4C4', name: 'fermataShortAbove' },
      { code: '\uE4C6', name: 'fermataLongAbove' },
      { code: '\uE4C8', name: 'fermataVeryLongAbove' },
    ],
  },
  repeats: {
    name: 'Repeats & Barlines',
    symbols: [
      { code: '\uE040', name: 'barlineSingle' },
      { code: '\uE041', name: 'barlineDouble' },
      { code: '\uE042', name: 'barlineFinal' },
      { code: '\uE046', name: 'repeatLeft' },
      { code: '\uE047', name: 'repeatRight' },
      { code: '\uE048', name: 'repeatRightLeft' },
      { code: '\uE044', name: 'repeatDot' },
      { code: '\uE045', name: 'repeatDots' },
      { code: '\uE040', name: 'barlineSingle' },
    ],
  },
};

function PentatonicExample() {
  const wrapperRef = useRef(null);
  const vexContainerRef = useRef(null);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    let mounted = true;

    if (wrapperRef.current && !vexContainerRef.current) {
      const div = document.createElement('div');
      div.style.minHeight = '160px';
      div.style.display = 'flex';
      div.style.alignItems = 'center';
      div.style.justifyContent = 'center';
      wrapperRef.current.appendChild(div);
      vexContainerRef.current = div;
    }

    async function loadVexFlow() {
      try {
        if (!window.VexFlow) {
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/vexflow@5.0.0/build/cjs/vexflow.js';
          script.async = true;
          
          await new Promise((resolve, reject) => {
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
          });
        }

        await document.fonts.ready;
        if (mounted) renderScore();
      } catch {
        if (mounted) setStatus('error');
      }
    }

    function renderScore() {
      const container = vexContainerRef.current;
      if (!container || !window.VexFlow) return;
      
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }
      
      const VF = window.VexFlow;
      VF.setFonts('Bravura');
      
      const { Renderer, Stave, StaveNote, Voice, Formatter, Beam } = VF;
      
      const renderer = new Renderer(container, Renderer.Backends.SVG);
      renderer.resize(620, 160);
      const context = renderer.getContext();
      
      const accentColor = '#e94560';
      
      const stave = new Stave(10, 20, 590);
      stave.addClef('treble').addTimeSignature('4/4');
      stave.setContext(context).draw();
      
      const notes = [
        new StaveNote({ keys: ['a/3'], duration: '8' }),
        new StaveNote({ keys: ['c/4'], duration: '8' }),
        new StaveNote({ keys: ['d/4'], duration: '8' }),
        new StaveNote({ keys: ['e/4'], duration: '8' }),
        new StaveNote({ keys: ['g/4'], duration: '8' }),
        new StaveNote({ keys: ['a/4'], duration: '8' }),
        new StaveNote({ keys: ['c/5'], duration: '8' }),
        new StaveNote({ keys: ['d/5'], duration: '8' }),
      ];
      
      const beams = [
        new Beam(notes.slice(0, 4)),
        new Beam(notes.slice(4, 8)),
      ];
      
      const voice = new Voice({ num_beats: 4, beat_value: 4 });
      voice.addTickables(notes);
      
      new Formatter().joinVoices([voice]).format([voice], 500);
      
      voice.draw(context, stave);
      beams.forEach(beam => beam.setContext(context).draw());
      
      const svg = container.querySelector('svg');
      if (svg) {
        const staveColor = '#334155';
        const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
        style.textContent = `
          path, line, rect, polygon, text { 
            fill: ${accentColor} !important; 
            stroke: ${accentColor} !important; 
          }
          path[fill="none"], line[fill="none"], rect[fill="none"] {
            fill: none !important;
          }
          path[stroke="none"], line[stroke="none"], rect[stroke="none"] {
            stroke: none !important;
          }
          .vf-stave path {
            stroke: ${staveColor} !important;
          }
          .vf-stavebarline rect {
            fill: ${staveColor} !important;
          }
        `;
        svg.insertBefore(style, svg.firstChild);
      }
      
      setStatus('loaded');
    }

    loadVexFlow();

    return () => {
      mounted = false;
      if (vexContainerRef.current && wrapperRef.current) {
        try {
          wrapperRef.current.removeChild(vexContainerRef.current);
        } catch {
          // Already removed
        }
        vexContainerRef.current = null;
      }
    };
  }, []);

  return (
    <section className="mb-8 p-6 bg-bg-secondary rounded-lg">
      <h2 className="text-xl font-semibold mb-4">Pentatonic Exercise Example</h2>
      <p className="text-text-secondary text-sm mb-4">
        A Minor Pentatonic - Position 1 (first 8 notes ascending): A, C, D, E, G, A, C, D
      </p>
      <p className="text-text-secondary text-sm mb-4">
        Rendered with <a href="https://vexflow.com" target="_blank" rel="noopener noreferrer" className="text-accent hover:text-accent-light">VexFlow</a> using Bravura font
      </p>
      
      <div ref={wrapperRef} className="overflow-x-auto">
        {status === 'loading' && (
          <div className="min-h-[160px] flex items-center justify-center">
            <span className="text-text-secondary">Loading VexFlow...</span>
          </div>
        )}
        {status === 'error' && (
          <div className="text-red-400 p-4">Failed to load VexFlow</div>
        )}
      </div>
      
      <div className="mt-4 text-xs text-text-secondary">
        <p className="mb-2">VexFlow handles all the complex SMuFL glyph positioning automatically:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Proper stem directions based on note position</li>
          <li>Automatic beaming of eighth notes</li>
          <li>Correct ledger line placement</li>
          <li>Precise glyph anchoring using Bravura metadata</li>
        </ul>
      </div>
    </section>
  );
}

function SymbolCard({ code, name }) {
  const [copied, setCopied] = useState(false);
  const codePoint = code.codePointAt(0).toString(16).toUpperCase();

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      onClick={handleCopy}
      className="flex flex-col items-center p-4 bg-bg-secondary rounded-lg hover:bg-bg-tertiary transition-colors cursor-pointer group"
    >
      <span 
        className="text-6xl mb-3 text-text-primary"
        style={{ fontFamily: 'Bravura' }}
      >
        {code}
      </span>
      <span className="text-xs text-text-secondary text-center break-all">
        {name}
      </span>
      <span className="text-xs text-accent mt-1 font-mono">
        U+{codePoint}
      </span>
      <span className={`text-xs mt-2 transition-opacity ${copied ? 'opacity-100 text-green-400' : 'opacity-0 group-hover:opacity-100 text-text-secondary'}`}>
        {copied ? 'Copied!' : 'Click to copy'}
      </span>
    </button>
  );
}

export function BravuraDemo() {
  const [activeCategory, setActiveCategory] = useState('noteheads');

  return (
    <div className="min-h-screen p-8 max-w-6xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-text-primary mb-2">
          Bravura / SMuFL Demo
        </h1>
        <p className="text-text-secondary">
          SMuFL (Standard Music Font Layout) is a specification for music symbols.
          Bravura is the reference font implementing this standard.
        </p>
        <a 
          href="#/" 
          className="inline-block mt-4 text-accent hover:text-accent-light transition-colors"
        >
          ← Back to Guitar Hero
        </a>
      </header>

      <PentatonicExample />

      <section className="mb-8 p-6 bg-bg-secondary rounded-lg">
        <h2 className="text-xl font-semibold mb-4">Usage</h2>
        <div className="space-y-4 text-sm">
          <div>
            <h3 className="text-text-secondary mb-2">In CSS:</h3>
            <pre className="bg-bg-primary p-3 rounded text-text-primary overflow-x-auto">
{`.music-symbol {
  font-family: 'Bravura';
}`}
            </pre>
          </div>
          <div>
            <h3 className="text-text-secondary mb-2">In React/JSX:</h3>
            <pre className="bg-bg-primary p-3 rounded text-text-primary overflow-x-auto">
{`<span style={{ fontFamily: 'Bravura' }}>
  {'\uE050'}  {/* G Clef */}
</span>`}
            </pre>
          </div>
          <div>
            <h3 className="text-text-secondary mb-2">Example Output:</h3>
            <div className="bg-bg-primary p-4 rounded flex items-center gap-4">
              <span style={{ fontFamily: 'Bravura', fontSize: '48px' }}>{'\uE050'}</span>
              <span style={{ fontFamily: 'Bravura', fontSize: '48px' }}>{'\uE084'}{'\uE084'}</span>
              <span style={{ fontFamily: 'Bravura', fontSize: '48px' }}>{'\uE0A4'}</span>
              <span style={{ fontFamily: 'Bravura', fontSize: '48px' }}>{'\uE4E6'}</span>
              <span style={{ fontFamily: 'Bravura', fontSize: '48px' }}>{'\uE52F'}</span>
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">Symbol Browser</h2>
        
        <div className="flex flex-wrap gap-2 mb-6">
          {Object.entries(SMUFL_CATEGORIES).map(([key, category]) => (
            <button
              key={key}
              onClick={() => setActiveCategory(key)}
              className={`px-4 py-2 rounded-lg transition-colors ${
                activeCategory === key
                  ? 'bg-accent text-white'
                  : 'bg-bg-secondary text-text-secondary hover:bg-bg-tertiary'
              }`}
            >
              {category.name}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {SMUFL_CATEGORIES[activeCategory].symbols.map((symbol, index) => (
            <SymbolCard key={`${symbol.name}-${index}`} {...symbol} />
          ))}
        </div>
      </section>

      <section className="mt-12 p-6 bg-bg-secondary rounded-lg">
        <h2 className="text-xl font-semibold mb-4">Resources</h2>
        <ul className="space-y-2 text-text-secondary">
          <li>
            <a 
              href="https://www.smufl.org/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-accent hover:text-accent-light"
            >
              SMuFL Specification
            </a>
            {' '}- Official documentation and full glyph tables
          </li>
          <li>
            <a 
              href="https://github.com/steinbergmedia/bravura" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-accent hover:text-accent-light"
            >
              Bravura GitHub
            </a>
            {' '}- Font source and releases
          </li>
          <li>
            <a 
              href="https://w3c.github.io/smufl/latest/tables/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-accent hover:text-accent-light"
            >
              Complete Glyph Tables
            </a>
            {' '}- All SMuFL code points
          </li>
        </ul>
      </section>
    </div>
  );
}
