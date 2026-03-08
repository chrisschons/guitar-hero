import { motion } from 'framer-motion';
import { useRef, useState, useEffect, Fragment } from 'react';
import { getStringLabels } from '../core/music';
import { STANDARD_TUNING } from '../data/tunings';
import { getSlotsPerMeasure, TIME_SIGNATURES, getBeatsPerBarForDots } from '../data/exerciseTypes';

const COLUMN_WIDTH = 50;
const PADDING_COLUMNS = 3;
const PLAYHEAD_OFFSET = 50; // tuned to align note with playhead when sound plays
const INITIAL_SCROLL = (PADDING_COLUMNS * COLUMN_WIDTH) - PLAYHEAD_OFFSET; // 100px

// Compact static (wrapped) view
const STATIC_COLUMN_WIDTH = 28;
const STATIC_ROW_HEIGHT = 72;
const STATIC_STRING_HEIGHT = 12;
const STATIC_ROW_GAP = 40;

export function TabDisplay({ tab, scrollPosition, scrollMode = false, currentBeat, countIn, activeNoteIndex, subdivision = 2, timeSignatureId = '4/4', notesPerMeasureOverride = null, loopTicks = 0, tuning = STANDARD_TUNING }) {
  const stringLabels = getStringLabels(tuning);
  const subDiv = Number(subdivision) || 2;
  const notesPerMeasure = notesPerMeasureOverride ?? getSlotsPerMeasure(timeSignatureId, subDiv);
  const beatsPerMeasure = TIME_SIGNATURES.find((t) => t.id === timeSignatureId)?.beatsPerMeasure ?? 4;
  const beatsPerBarDots = getBeatsPerBarForDots(timeSignatureId);

  const loopColumns = loopTicks > 0 ? loopTicks : tab.length;
  const loopWidth = loopColumns * COLUMN_WIDTH;
  const scrollBasedIndex = activeNoteIndex >= 0
    ? Math.min(activeNoteIndex, tab.length - 1)
    : -1;

  // Pad tab with blank columns to loopColumns so we draw empty space for rest-of-bar beats
  const displayTab =
    loopColumns > tab.length
      ? [...tab, ...Array.from({ length: loopColumns - tab.length }, () => [null, null, null, null, null, null])]
      : tab;

  // Static view: wrap to fit on screen (no horizontal overflow)
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);
  useEffect(() => {
    if (scrollMode || !containerRef.current) return;
    const el = containerRef.current;
    const ro = new ResizeObserver(() => setContainerWidth(el.offsetWidth));
    ro.observe(el);
    setContainerWidth(el.offsetWidth);
    return () => ro.disconnect();
  }, [scrollMode]);

  const contentWidth = Math.max(0, containerWidth);
  const maxCols = Math.floor(contentWidth / STATIC_COLUMN_WIDTH);
  const colsPerRow = Math.max(
    notesPerMeasure,
    Math.floor(maxCols / notesPerMeasure) * notesPerMeasure
  );
  const numRows = (loopColumns || tab.length) ? Math.ceil((loopColumns || tab.length) / colsPerRow) : 0;
  const linearIndex = scrollBasedIndex >= 0 ? Math.min(scrollBasedIndex, tab.length - 1) : -1;
  // Smooth playhead: use fractional position from scrollPosition (updated by animation loop)
  const positionInTabPixels = tab.length > 0
    ? ((scrollPosition - INITIAL_SCROLL) % loopWidth + loopWidth) % loopWidth
    : 0;
  const positionInTab = tab.length > 0 ? positionInTabPixels / COLUMN_WIDTH : 0; // fractional column index
  const playheadRow = numRows > 0 ? Math.floor(positionInTab / colsPerRow) % numRows : -1;
  const playheadColFractional = colsPerRow > 0 ? positionInTab % colsPerRow : 0; // fractional for smooth scroll
  const playheadColumnIndex = Math.min(loopColumns - 1, Math.max(0, Math.floor(positionInTab)));

  // (playheadOffset removed: static view always uses wrapped rows and row/col playhead)

  return (
    <div className="relative bg-bg-secondary pt-10 pb-6 pl-14 pr-6 overflow-hidden">
      {/* Beat indicator */}
      <div className="absolute top-2 left-0 right-0 flex justify-center items-center h-6 z-20">
        <div className="flex gap-2">
          {Array.from({ length: beatsPerBarDots }, (_, beat) => beat).map((beat) => {
            // During count-in, countIn is remaining (e.g. 6→1 for 6/8); highlight dot (beatsPerBarDots - countIn)
            const activeBeat = countIn > 0 ? Math.max(0, beatsPerBarDots - countIn) : currentBeat;
            const isActive = activeBeat >= 0 && activeBeat === beat;
            
            return (
              <motion.div
                key={`beat-${beat}`}
                className={`
                  w-2.5 h-2.5 rounded-full transition-colors
                  ${isActive 
                    ? beat === 0 
                      ? 'bg-accent-light shadow-[0_0_10px_rgba(233,69,96,0.6)]' 
                      : 'bg-accent shadow-[0_0_8px_rgba(233,69,96,0.4)]'
                    : 'bg-gray-700'
                  }
                `}
                animate={{
                  scale: isActive ? 1.3 : 1,
                }}
                transition={{ duration: 0.075 }}
              />
            );
          })}
        </div>
      </div>

      {/* Playhead: fixed in scroll mode, moving in static mode (wrapped: one per row position) */}
      {scrollMode ? (
        <div
          className="absolute left-[120px] top-5 bottom-5 w-[3px] bg-accent rounded z-10"
          style={{ boxShadow: '0 0 10px rgba(233,69,96,0.4), 0 0 20px rgba(233,69,96,0.4)' }}
        />
      ) : (
        numRows > 0 && playheadRow >= 0 && (
          <div
            className="absolute w-[3px] bg-accent rounded z-10"
            style={{
              left: `calc(3.5rem + ${(playheadColFractional / colsPerRow) * contentWidth}px)`,
              top: `calc(2.5rem + 0.5rem + ${playheadRow * (STATIC_ROW_HEIGHT + STATIC_ROW_GAP)}px)`,
              height: STATIC_ROW_HEIGHT,
              boxShadow: '0 0 10px rgba(233,69,96,0.4), 0 0 20px rgba(233,69,96,0.4)',
            }}
          />
        )
      )}

      {/* String labels: only in scroll mode (static mode has compact labels per row) */}
      {scrollMode && (
        <div className="absolute left-4 top-10 h-[180px] flex flex-col justify-between py-2">
          {stringLabels.map((label, stringIndex) => (
            <span 
              key={`string-${stringIndex}`}
              className="font-mono text-lg font-bold text-text-secondary h-6 flex items-center"
            >
              {label}
            </span>
          ))}
        </div>
      )}

      {/* Tab viewport */}
      <div
        ref={containerRef}
        className="overflow-hidden"
      >
        {scrollMode ? (
          <motion.div
            className="flex h-[180px] relative"
            style={{ x: -scrollPosition }}
          >
            <Fragment key="pad-start">
              {Array.from({ length: PADDING_COLUMNS }).map((_, i) => (
                <TabColumn key={`pad-start-${i}`} column={Array(6).fill(null)} />
              ))}
            </Fragment>

            {/* Calculate how many loops needed to fill viewport (aim for ~30 columns minimum) */}
            {tab.length > 0 && (
              <Fragment key="loops">
                {(() => {
                  const minColumns = 30;
                  const loopsNeeded = Math.max(2, Math.ceil(minColumns / tab.length));
                  return Array.from({ length: loopsNeeded }).flatMap((_, loopIndex) =>
                    tab.map((column, i) => {
                      const absoluteIndex = loopIndex * tab.length + i;
                      const showBarLine = absoluteIndex % notesPerMeasure === 0;
                      return (
                        <TabColumn
                          key={`loop-${loopIndex}-${i}`}
                          column={column}
                          isActive={loopIndex === 0 && i === scrollBasedIndex}
                          showBarLine={showBarLine}
                        />
                      );
                    })
                  );
                })()}
              </Fragment>
            )}

            <Fragment key="pad-end">
              {Array.from({ length: PADDING_COLUMNS }).map((_, i) => (
                <TabColumn key={`pad-end-${i}`} column={Array(6).fill(null)} />
              ))}
            </Fragment>
          </motion.div>
        ) : (
          <div className="flex flex-col pt-2">
            {numRows > 0 && Array.from({ length: numRows }).map((_, rowIndex) => {
              const start = rowIndex * colsPerRow;
              const rowColumns = displayTab.slice(start, start + colsPerRow);
              const paddedColumns =
                rowColumns.length < colsPerRow
                  ? [...rowColumns, ...Array.from({ length: colsPerRow - rowColumns.length }, () => Array(6).fill(null))]
                  : rowColumns;
              return (
                <div
                  key={`tab-row-${rowIndex}`}
                  className="flex items-stretch shrink-0"
                  style={{
                    height: STATIC_ROW_HEIGHT,
                    marginBottom: rowIndex < numRows - 1 ? STATIC_ROW_GAP : 0,
                  }}
                >
                  <div className="flex w-full min-w-0">
                    {paddedColumns.map((column, colIndex) => {
                      const linearIdx = start + colIndex;
                      const isRealColumn = linearIdx < tab.length;
                      const showBarLine = linearIdx < loopColumns && linearIdx % notesPerMeasure === 0;
                      const showEndBarLine = linearIdx === loopColumns - 1 || colIndex === paddedColumns.length - 1;
                      const isActive = linearIdx === playheadColumnIndex;
                      return (
                        <StaticTabColumn
                          key={`static-${rowIndex}-${colIndex}`}
                          column={column}
                          isActive={isActive}
                          showBarLine={showBarLine}
                          showEndBarLine={showEndBarLine}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function TabColumn({ column, isActive, showBarLine }) {
  return (
    <div 
      className="flex flex-col h-full py-2"
      style={{ minWidth: COLUMN_WIDTH }}
    >
      <div className="flex flex-col justify-between flex-1 relative">
        {showBarLine && (
          <div 
            className="absolute left-0 top-0 bottom-0 w-0.5 bg-text-secondary opacity-60"
          />
        )}
        {column.map((note, stringIndex) => (
          <div
            key={`tab-str-${stringIndex}`}
            className="h-6 flex items-center justify-center relative"
          >
            <div 
              className="absolute inset-x-0 top-1/2 h-px opacity-30"
              style={{ 
                height: stringIndex > 2 ? 2 : 1,
                marginTop: stringIndex > 2 ? -1 : 0,
                backgroundColor: 'var(--color-string)',
              }}
            />
            {note !== null && (
              <span
                className={`font-mono text-lg font-bold relative text-accent ${
                  isActive ? 'text-white scale-125' : ''
                }`}
                style={{ 
                  zIndex: 2,
                  textShadow: isActive 
                    ? '0 0 12px rgba(255,255,255,0.8), 0 0 24px rgba(233,69,96,0.6)' 
                    : '0 0 10px rgba(233,69,96,0.4)' 
                }}
              >
                {note}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function StaticTabColumn({ column, isActive, showBarLine, showEndBarLine }) {
  return (
    <div
      className="flex flex-col flex-1 min-w-0 h-full relative"
      style={{ minWidth: STATIC_COLUMN_WIDTH }}
    >
      <div className="flex flex-col justify-between flex-1 relative min-h-0">
        {showBarLine && (
          <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-text-secondary opacity-60" />
        )}
        {showEndBarLine && (
          <div className="absolute right-0 top-0 bottom-0 w-0.5 bg-text-secondary opacity-60" />
        )}
        {column.map((note, stringIndex) => (
          <div
            key={`tab-str-${stringIndex}`}
            className="flex items-center justify-center relative shrink-0"
            style={{ height: STATIC_STRING_HEIGHT }}
          >
            <div
              className="absolute inset-x-0 top-1/2 opacity-30"
              style={{ height: '1px', marginTop: '-0.5px', backgroundColor: 'var(--color-string)' }}
            />
            {note !== null && (
              <span
                className={`font-mono text-xs font-bold relative text-accent ${
                  isActive ? 'text-white scale-110' : ''
                }`}
                style={{
                  zIndex: 2,
                  textShadow: isActive
                    ? '0 0 8px rgba(255,255,255,0.8), 0 0 16px rgba(233,69,96,0.6)'
                    : '0 0 6px rgba(233,69,96,0.4)',
                }}
              >
                {note}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export { COLUMN_WIDTH, INITIAL_SCROLL, PADDING_COLUMNS };
