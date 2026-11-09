import { Minus, Plus, Trash2 } from 'lucide-react';
import { formatQty, formatQtyShort, getQtyStep } from '../../utils/format';

/**
 * - qty + control. Shows a bin icon when the next "-" would remove the item.
 * `compact` uses short units ("2 pcs", "1 L") so it fits narrow phone cards.
 */
export default function QuantityControl({ quantity, unit, onIncrement, onDecrement, disabled = false, size = 'md', compact = false, className = '' }) {
  const removesNext = quantity - getQtyStep(unit) <= 0;
  const btn = size === 'sm' ? 'size-8 rounded-lg' : 'size-9 rounded-xl';
  const label = compact ? formatQtyShort(quantity, unit) : formatQty(quantity, unit);

  return (
    <div className={`flex items-center justify-between gap-0.5 rounded-xl border border-brand-200 bg-brand-50 p-0.5 ${className}`}>
      <button
        type="button"
        onClick={onDecrement}
        disabled={disabled}
        className={`flex shrink-0 items-center justify-center text-brand-800 transition hover:bg-white active:scale-90 disabled:opacity-50 ${btn}`}
        aria-label={removesNext ? 'Remove from cart' : 'Decrease quantity'}
      >
        {removesNext ? <Trash2 className="size-4 text-red-500" /> : <Minus className="size-4" />}
      </button>
      <span className={`min-w-0 truncate px-0.5 text-center font-semibold text-brand-800 ${compact ? 'text-xs sm:text-sm' : 'text-sm'}`} aria-live="polite">
        {label}
      </span>
      <button
        type="button"
        onClick={onIncrement}
        disabled={disabled}
        className={`flex shrink-0 items-center justify-center bg-brand-500 text-on-brand shadow-sm transition hover:bg-brand-600 active:scale-90 disabled:opacity-50 ${btn}`}
        aria-label="Increase quantity"
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}
