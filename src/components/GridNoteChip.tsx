type GridNoteChipProps = {
  value: string | number;
  /** Logical width in slots (1–6). Each slot ~40px wide. Ignored when widthPx is set. */
  slots?: 1 | 2 | 3 | 4 | 5 | 6;
  /** Override width in pixels (e.g. for resize preview). */
  widthPx?: number;
  /** Visual state of the chip */
  state?:
    | 'default'
    | 'hover'
    | 'selected'
    | 'selectedHover'
    | 'resizing'
    | 'dragGhost'
    | 'ghost'
    | 'empty'
    | 'emptySelected'
    | 'active';
  /** Horizontal content alignment */
  align?: 'center' | 'start';
  /** When true, no rounding/border/background – parent (e.g. chord row) provides the look */
  chordCell?: boolean;
};

const SLOT_WIDTH = 60;

export function GridNoteChip({
  value,
  slots = 1,
  widthPx: widthPxProp,
  state = 'default',
  align = 'center',
  chordCell = false,
}: GridNoteChipProps) {
  const widthPx = widthPxProp ?? slots * SLOT_WIDTH;

  const alignClasses =
    align === 'center' ? 'justify-center px-1.5' : 'justify-start px-2.5';

  const baseClasses = chordCell
    ? 'py-0.5 flex items-center font-mono font-bold text-sm text-white'
    : 'rounded-md py-0.5 flex items-center font-mono font-bold text-sm';

  // Color/state styles (chordCell: parent provides bg/border, chip is just content)
  let stateClasses = '';
  if (chordCell) {
    stateClasses = 'bg-transparent border-0';
  } else switch (state) {
    case 'empty':
      stateClasses =
        'hover:bg-pink-400/20 hover:border-pink-100/20 border-1 border-transparent';
      break;
    case 'emptySelected':
      stateClasses =
        'bg-pink-400/20 border border-pink-100/20';
      break;
    case 'selected':
      stateClasses =
        'bg-pink-500/50 text-white border-2 border-cyan-400 shadow-md shadow-cyan-500/50';
      break;
    case 'ghost':
      stateClasses =
        'bg-pink-500/20 text-white border border-pink-400/60';
      break;
    case 'hover':
      stateClasses =
        'bg-rose-400 text-white border border-rose-400';
      break;
    case 'selectedHover':
      stateClasses =
        'bg-rose-400 text-white border-2 border-cyan-400 shadow-lg shadow-cyan-500/50';
      break;
    case 'resizing':
      stateClasses =
        'bg-cyan-400 text-white border-2 border-cyan-500';
      break;
    case 'dragGhost':
      stateClasses =
        'bg-cyan-400 text-white border-2 border-cyan-500';
      break;
    case 'active':
      stateClasses =
        'text-white border border-transparent bg-cyan-600 border-pink-600/50 transition-all duration-200';
      break;
    case 'default':
    default:
      stateClasses =
        'bg-pink-500/50 text-white border border-transparent hover:bg-pink-500 hover:border-pink-600/50 active:bg-cyan-600 active:border-pink-600/50 transition-all duration-200';
      break;
  }

  return (
    <div
      className={`${baseClasses} ${stateClasses}`}
      style={{ width: widthPx }}
    >
      <div style={{ width: SLOT_WIDTH }} className='flex items-center justify-center h-[20px]'>{value}</div>
    </div>
  );
}