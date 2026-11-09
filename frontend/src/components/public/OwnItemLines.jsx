import { NotebookPen } from 'lucide-react';
import { formatCurrency } from '../../utils/format';

/**
 * Items the customer typed in ("Your own order") on the success / track pages.
 * Shows the store's price once it is added, otherwise "Price by store".
 */
export function OwnItemLines({ lines, className = '' }) {
  if (!Array.isArray(lines) || lines.length === 0) return null;
  return (
    <div className={`mt-3 rounded-xl border border-amber-200 bg-amber-50/40 px-3 pb-1 pt-2.5 ${className}`}>
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-800">
        <NotebookPen className="size-3.5" /> Your own items
      </p>
      <ul className="divide-y divide-amber-100">
        {lines.map((line, index) => {
          const priced = line.amount !== null && line.amount !== undefined;
          return (
            // eslint-disable-next-line react/no-array-index-key
            <li key={index} className="flex justify-between gap-3 py-2 text-sm">
              <span className="min-w-0 break-words text-slate-700">
                {line.name} {line.quantity && <span className="text-slate-500">× {line.quantity}</span>}
              </span>
              <span className={`shrink-0 font-medium ${priced ? 'text-slate-800' : 'text-xs text-amber-700'}`}>
                {priced ? formatCurrency(line.amount) : 'Price by store'}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
