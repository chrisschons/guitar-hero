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
        'hover:bg-chip/20 hover:border-chip/20 border border-transparent';
      break;
    case 'emptySelected':
      stateClasses =
        'bg-chip/20 border border-chip/20';
      break;
    case 'selected':
      stateClasses =
        'bg-chip/50 text-white border-2 border-chip-selected shadow-md shadow-chip-selected/50';
      break;
    case 'ghost':
      stateClasses =
        'bg-chip/20 text-white border border-chip/60';
      break;
    case 'hover':
      stateClasses =
        'bg-chip text-white border border-chip';
      break;
    case 'selectedHover':
      stateClasses =
        'bg-chip text-white border-2 border-chip-selected shadow-lg shadow-chip-selected/50';
      break;
    case 'resizing':
      stateClasses =
        'bg-chip-selected text-white border-2 border-chip-selected/80';
      break;
    case 'dragGhost':
      stateClasses =
        'bg-chip-selected text-white border-2 border-chip-selected/80';
      break;
    case 'active':
      stateClasses =
        'text-white border border-transparent bg-chip-selected border-chip/50 transition-all duration-200';
      break;
    case 'default':
    default:
      stateClasses =
        'bg-chip/50 text-white border border-transparent hover:bg-chip hover:border-chip/50 active:bg-chip-selected active:border-chip/50 transition-all duration-200';
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