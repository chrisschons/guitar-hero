import type { CSSProperties } from 'react';
import { getActualFret, isRootAt } from '../data/basicChords';
import { STANDARD_TUNING } from '../data/tunings';

/** high e → low E; -1 mute, 0 open or offset per startFret (see basicChords). */
export type ChordBoxFrets = readonly number[];

export type ChordBoxBarreTuple = readonly [number, number, number];

/**
 * Chord shape for the diagram. Compatible with entries in {@link BASIC_CHORDS}.
 * - `barre`: [fret, startString, endString] 1-based (1 = high e … 6 = low E), or legacy
 *   [colIndex, fromString, toString] 0-based as in the old horizontal diagram.
 */
export type ChordBoxModel = {
  frets: ChordBoxFrets;
  root?: string;
  startFret?: number;
  barre?: ChordBoxBarreTuple;
  fingers?: readonly (number | string | null | undefined)[];
};

/** Always four fret bands below the nut (absolute frets 1–4). */
const NUM_FRETS = 4;
/** 150% of the original 24px row height */
const FRET_ROW_H = 36;
/** Thick nut line (scaled with taller box) */
const NUT_THICK_PX = 6;
/** Inner width of the framed diagram — keeps string spacing tight (×/○ align to same grid) */
const DIAGRAM_INNER_W = 128;
/** Matches underlay `border-2` — string centers run inside this inset */
const DIAGRAM_BORDER_PX = 2;
/** Horizontal inset so edge string dots (× ○ •) are not clipped by the frame */
const FRAME_PAD_X = 8;
/** Space between ×/○ row and top of chord frame */
const ABOVE_NUT_MARGIN = 12;
const DIAGRAM_OUTER_W = DIAGRAM_INNER_W + FRAME_PAD_X * 2;
const VIS_STRING_HIGH_E = 5;

function dataStringToVisual(dataStringIndex: number): number {
  return VIS_STRING_HIGH_E - dataStringIndex;
}

type BarreLayout = {
  atFret: number;
  topDataString: number;
  bottomDataString: number;
};

function resolveBarre(
  barre: ChordBoxBarreTuple | undefined,
  firstColumnFret: number
): BarreLayout | null {
  if (!barre || barre.length < 3) return null;
  const a = barre[0];
  const b = barre[1];
  const c = barre[2];
  const isOneBased =
    b >= 1 && b <= 6 && c >= 1 && c <= 6 && b <= c && a >= 1 && a <= 24;
  if (isOneBased) {
    return { atFret: a, topDataString: b - 1, bottomDataString: c - 1 };
  }
  const colIndex = a;
  if (colIndex < 1 || colIndex > 4) return null;
  const atFret = firstColumnFret + colIndex - 1;
  return { atFret, topDataString: b, bottomDataString: c };
}

export type ChordBoxProps = {
  chord: ChordBoxModel;
  title?: string;
  className?: string;
  tuning?: number[];
};

/**
 * String centers along the **inner** fingerboard (inset by border so edge strings sit on the
 * frame edge, not past it). `visualStringIndex` 0 = low E … 5 = high e.
 */
function stringPositionStyle(visualStringIndex: number): CSSProperties {
  const t = visualStringIndex / 5;
  const b = DIAGRAM_BORDER_PX;
  return {
    left: `calc(${b}px + (100% - ${2 * b}px) * ${t})`,
    transform: 'translateX(-50%)',
  };
}

function barrePositionStyle(topData: number, bottomData: number): CSSProperties {
  const visA = dataStringToVisual(topData);
  const visB = dataStringToVisual(bottomData);
  const visMin = Math.min(visA, visB);
  const visMax = Math.max(visA, visB);
  const tMid = (visMin + visMax) / 2 / 5;
  const tSpan = (visMax - visMin) / 5;
  const b = DIAGRAM_BORDER_PX;
  return {
    left: `calc(${b}px + (100% - ${2 * b}px) * ${tMid})`,
    transform: 'translateX(-50%)',
    width: tSpan === 0 ? 4 : `calc((100% - ${2 * b}px) * ${tSpan})`,
    minWidth: tSpan === 0 ? 4 : undefined,
  };
}

const FRET_BANDS = [1, 2, 3, 4] as const;

/**
 * Frame + vertical strings + three interior horizontal fret lines under the dots; four fret bands.
 */
export function ChordBox({ chord, title = '', className = '', tuning = STANDARD_TUNING }: ChordBoxProps) {
  if (!chord?.frets || chord.frets.length !== 6) return null;

  const { frets, root, startFret: startFretRaw = 0, barre, fingers } = chord;
  const startFret = startFretRaw;
  const firstColumnFret = startFret || 1;
  const barreLayout = resolveBarre(barre, firstColumnFret);

  const includeNut = true;
  const showFretLabels = !includeNut;

  return (
    <div
      className={`bg-secondary rounded-lg p-3 border border-border inline-block ${className}`.trim()}
    >
      {title ? (
        <div className="text-xs font-medium text-muted-foreground mb-2 text-center">{title}</div>
      ) : null}

      <div
        className="flex select-none"
        style={{ minWidth: showFretLabels ? 24 + DIAGRAM_OUTER_W : DIAGRAM_OUTER_W }}
      >
        {showFretLabels ? (
          <div className="flex w-6 shrink-0 flex-col pt-6">
            {FRET_BANDS.map((fretNum) => (
              <div
                key={`lbl-${fretNum}`}
                className="flex items-center justify-end pr-1 font-mono text-[10px] text-muted-foreground tabular-nums"
                style={{ height: FRET_ROW_H }}
              >
                {fretNum}
              </div>
            ))}
          </div>
        ) : null}

        <div className="mx-auto flex w-full max-w-full flex-1 flex-col" style={{ width: DIAGRAM_OUTER_W }}>
          {/* Above nut — × / ○; margin below adds air before the frame / nut */}
          <div
            className="relative shrink-0"
            style={{
              width: DIAGRAM_OUTER_W,
              paddingLeft: FRAME_PAD_X,
              paddingRight: FRAME_PAD_X,
              minHeight: 44,
              marginBottom: ABOVE_NUT_MARGIN,
            }}
          >
            {[0, 1, 2, 3, 4, 5].map((vis) => {
              const s = VIS_STRING_HIGH_E - vis;
              const col = frets[s];
              const isMute = col === -1;
              const isOpen = col === 0 && startFret === 0;
              const openIsRoot =
                root && isOpen && isRootAt(s, col, startFret, root, tuning);

              return (
                <div
                  key={`xo-${vis}`}
                  className="absolute bottom-0 flex justify-center"
                  style={stringPositionStyle(vis)}
                >
                  {isMute ? (
                    <span className="font-mono text-sm font-semibold leading-none text-muted-foreground">
                      ×
                    </span>
                  ) : isOpen ? (
                    openIsRoot ? (
                      <span
                        className="h-[11px] w-[11px] shrink-0 box-border rounded-full border-2 border-accent bg-transparent"
                        aria-hidden
                      />
                    ) : (
                      <span
                        className="h-[11px] w-[11px] shrink-0 rounded-full bg-accent"
                        aria-hidden
                      />
                    )
                  ) : null}
                </div>
              );
            })}
          </div>

          <div
            className="relative shrink-0 overflow-visible"
            style={{
              width: DIAGRAM_OUTER_W,
              paddingLeft: FRAME_PAD_X,
              paddingRight: FRAME_PAD_X,
            }}
          >
            <div
              className="relative w-full"
              style={{ height: FRET_ROW_H * NUM_FRETS + NUT_THICK_PX }}
            >
              {/* Underlay: nut, box, vertical strings, three interior fret lines (z-0) */}
              <div
                className="pointer-events-none absolute inset-0 z-0 flex flex-col rounded-none border-2 border-gray-600 bg-secondary"
              >
                <div
                  className="box-border h-0 w-full shrink-0 border-0 border-b border-solid border-gray-500"
                  style={{ borderBottomWidth: NUT_THICK_PX }}
                />
                <div className="relative min-h-0 flex-1">
                  {[1, 2, 3, 4].map((k) => (
                    <div
                      key={`v-${k}`}
                      className="absolute top-0 bottom-0 w-px bg-gray-600/85"
                      style={{
                        left: `calc(${DIAGRAM_BORDER_PX}px + (100% - ${2 * DIAGRAM_BORDER_PX}px) * ${k / 5})`,
                        transform: 'translateX(-50%)',
                      }}
                    />
                  ))}
                  {[1, 2, 3].map((i) => (
                    <div
                      key={`h-fret-${i}`}
                      className="absolute right-0 left-0 bg-gray-700"
                      style={{ top: i * FRET_ROW_H, height: 1 }}
                    />
                  ))}
                </div>
              </div>

              {/* Dots & barre */}
              <div className="relative z-10 flex h-full w-full flex-col rounded-none">
                <div className="shrink-0" style={{ height: NUT_THICK_PX }} aria-hidden />
                {FRET_BANDS.map((fretNum) => (
                  <div key={fretNum} className="relative" style={{ height: FRET_ROW_H }}>
                    {barreLayout?.atFret === fretNum ? (
                      <div
                        className="pointer-events-none absolute top-1/2 z-5 h-1.5 -translate-y-1/2 rounded-sm bg-accent"
                        style={barrePositionStyle(
                          barreLayout.topDataString,
                          barreLayout.bottomDataString
                        )}
                      />
                    ) : null}
                    {[0, 1, 2, 3, 4, 5].map((vis) => {
                      const s = VIS_STRING_HIGH_E - vis;
                      const col = frets[s];
                      const isOpen = col === 0 && startFret === 0;
                      const actual = getActualFret(col, startFret);
                      const showDot = actual === fretNum && !isOpen && col >= 0;
                      const showRoot =
                        root && showDot && isRootAt(s, col, startFret, root, tuning);
                      const finger = fingers?.[s];

                      return (
                        <div
                          key={`${vis}-${fretNum}`}
                          className="absolute top-1/2 z-20 -translate-y-1/2"
                          style={stringPositionStyle(vis)}
                        >
                          {showDot ? (
                            <div
                              className={`flex h-3.5 w-3.5 items-center justify-center rounded-full box-border ${
                                showRoot
                                  ? 'border-2 border-accent bg-secondary'
                                  : 'bg-accent'
                              }`}
                            >
                              {finger != null && finger !== '' ? (
                                <span className="text-[9px] font-semibold leading-none text-accent-foreground">
                                  {finger}
                                </span>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
