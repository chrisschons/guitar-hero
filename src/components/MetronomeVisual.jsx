import { motion } from 'framer-motion';

export function MetronomeVisual({ currentBeat, countIn = 0 }) {
  if (countIn > 0) {
    return (
      <div
        data-editor-section="metronome-visual-count-in"
        className="absolute top-0 left-0 right-0 flex justify-center items-center h-8 z-50 bg-background"
      >
        <motion.span
          key={countIn}
          className="text-2xl font-bold text-accent"
          initial={{ scale: 1.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.1 }}
        >
          {countIn}
        </motion.span>
      </div>
    );
  }

  return (
    <div
      data-editor-section="metronome-visual-beats"
      className="absolute top-0 left-0 right-0 flex justify-center gap-2 h-8 items-center z-50 bg-background"
    >
      {[0, 1, 2, 3].map((beat) => (
        <motion.div
          key={beat}
          className={`
            w-3 h-3 rounded-full bg-accent transition-colors
            ${currentBeat === beat 
              ? beat === 0 
                ? 'shadow-[0_0_10px_rgba(233,69,96,0.6)]' 
                : 'shadow-[0_0_8px_rgba(233,69,96,0.4)]'
              : 'bg-accent'
            }
          `}
          animate={{
            scale: currentBeat === beat ? 1.3 : 1,
          }}
          transition={{ duration: 0.075 }}
        />
      ))}
    </div>
  );
}
