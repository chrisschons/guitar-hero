import { motion } from 'framer-motion';
import { getStringLabels } from '../core/music';
import { STANDARD_TUNING } from '../data/tunings';
import { getSlotsPerMeasure, TIME_SIGNATURES } from '../data/exerciseTypes';

const COLUMN_WIDTH = 50;
const PADDING_COLUMNS = 3;
const PLAYHEAD_OFFSET = 50; // tuned to align note with playhead when sound plays
const INITIAL_SCROLL = (PADDING_COLUMNS * COLUMN_WIDTH) - PLAYHEAD_OFFSET; // 100px

export function TabDisplay({ tab, scrollPosition, currentBeat, countIn, activeNoteIndex, subdivision = 2, timeSignatureId = '4/4', tuning = STANDARD_TUNING }) {
  const stringLabels = getStringLabels(tuning);
  const subDiv = Number(subdivision) || 2;
  const notesPerMeasure = getSlotsPerMeasure(timeSignatureId, subDiv);
  const beatsPerMeasure = TIME_SIGNATURES.find((t) => t.id === timeSignatureId)?.beatsPerMeasure ?? 4;

  const scrollBasedIndex = activeNoteIndex >= 0
    ? Math.floor(Math.max(0, scrollPosition - INITIAL_SCROLL) / COLUMN_WIDTH) % tab.length
    : -1;

  return (
    <div className="relative bg-bg-secondary pt-10 pb-6 pl-14 pr-6 overflow-hidden">
      {/* Beat indicator */}
      <div className="absolute top-2 left-0 right-0 flex justify-center items-center h-6 z-20">
        <div className="flex gap-2">
          {Array.from({ length: beatsPerMeasure }, (_, beat) => beat).map((beat) => {
            // During count-in, countIn goes 4→3→2→1, so active beat is (4 - countIn)
            const activeBeat = countIn > 0 ? (4 - countIn) : currentBeat;
            const isActive = activeBeat === beat;
            
            return (
              <motion.div
                key={beat}
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

      {/* Playhead */}
      <div 
        className="absolute left-[120px] top-5 bottom-5 w-[3px] bg-accent rounded z-10"
        style={{ boxShadow: '0 0 10px rgba(233,69,96,0.4), 0 0 20px rgba(233,69,96,0.4)' }}
      />

      {/* String labels */}
      <div className="absolute left-4 top-10 h-[180px] flex flex-col justify-between py-2">
        {stringLabels.map((label) => (
          <span 
            key={label} 
            className="font-mono text-lg font-bold text-text-secondary h-6 flex items-center"
          >
            {label}
          </span>
        ))}
      </div>

      {/* Tab viewport */}
      <div className="overflow-hidden">
        <motion.div
          className="flex h-[180px] relative"
          style={{ x: -scrollPosition }}
        >
          {/* Padding columns at start */}
          {Array.from({ length: PADDING_COLUMNS }).map((_, i) => (
            <TabColumn key={`pad-start-${i}`} column={Array(6).fill(null)} />
          ))}

          {/* Calculate how many loops needed to fill viewport (aim for ~30 columns minimum) */}
          {(() => {
            if (!tab.length) return null;
            const minColumns = 30;
            const loopsNeeded = Math.max(2, Math.ceil(minColumns / tab.length));
            return Array.from({ length: loopsNeeded }).flatMap((_, loopIndex) => (
              tab.map((column, i) => {
                // Calculate absolute position across all loops for bar lines
                const absoluteIndex = loopIndex * tab.length + i;
                const showBarLine = absoluteIndex % notesPerMeasure === 0;
                return (
                  <TabColumn 
                    key={`loop${loopIndex}-${i}-sub${subDiv}`} 
                    column={column} 
                    isActive={loopIndex === 0 && i === scrollBasedIndex}
                    showBarLine={showBarLine}
                  />
                );
              })
            ));
          })()}

          {/* Padding columns at end */}
          {Array.from({ length: PADDING_COLUMNS }).map((_, i) => (
            <TabColumn key={`pad-end-${i}`} column={Array(6).fill(null)} />
          ))}
        </motion.div>
      </div>
    </div>
  );
}

function TabColumn({ column, isActive, showBarLine }) {
  return (
    <div 
      className="flex flex-col justify-between h-full py-2 relative"
      style={{ minWidth: COLUMN_WIDTH }}
    >
      {/* Bar line at measure boundary */}
      {showBarLine && (
        <div 
          className="absolute left-0 top-0 bottom-0 w-0.5 bg-text-secondary opacity-60"
        />
      )}
      {column.map((note, stringIndex) => (
        <div
          key={stringIndex}
          className="h-6 flex items-center justify-center relative"
        >
          {/* String line */}
          <div 
            className="absolute inset-x-0 top-1/2 h-px bg-string opacity-30"
            style={{ 
              height: stringIndex > 2 ? '2px' : '1px',
              marginTop: stringIndex > 2 ? '-1px' : '0'
            }}
          />
          {/* Note */}
          {note !== null && (
            <span
              className={`font-mono text-lg font-bold relative z-2 ${
                isActive ? 'text-white scale-125' : 'text-accent'
              }`}
              style={{ 
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
  );
}

export { COLUMN_WIDTH, INITIAL_SCROLL, PADDING_COLUMNS };
