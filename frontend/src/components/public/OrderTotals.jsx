import { BadgePercent, NotebookPen, Truck } from 'lucide-react';
import { formatCurrency } from '../../utils/format';

/**
 * Subtotal / delivery / grand total block used by cart, checkout and success pages.
 * `savings` = money saved through live offers (already included in the subtotal).
 * `unpricedCount` = own (typed-in) items the store has not priced yet; they are
 * not in the totals, so the total is labelled "so far".
 */
export default function OrderTotals({ subtotal, deliveryCharge, grandTotal, freeDeliveryGap = 0, savings = 0, unpricedCount = 0, className = '' }) {
  return (
    <div className={className}>
      <dl className="space-y-2.5 text-sm">
        <div className="flex justify-between">
          <dt className="text-slate-600">Subtotal</dt>
          <dd className="font-medium text-slate-800">{formatCurrency(subtotal)}</dd>
        </div>
        {unpricedCount > 0 && (
          <div className="flex justify-between gap-3">
            <dt className="flex items-center gap-1.5 text-slate-600">
              <NotebookPen className="size-4 text-amber-500" /> Your own items ({unpricedCount})
            </dt>
            <dd className="text-right font-medium text-amber-700">Price by store</dd>
          </div>
        )}
        <div className="flex justify-between">
          <dt className="flex items-center gap-1.5 text-slate-600">
            <Truck className="size-4 text-brand-500" /> Delivery
          </dt>
          <dd className={`font-medium ${deliveryCharge ? 'text-slate-800' : 'text-brand-600'}`}>
            {deliveryCharge ? formatCurrency(deliveryCharge) : 'FREE'}
          </dd>
        </div>
        <div className="flex items-center justify-between border-t border-dashed border-brand-200 pt-3">
          <dt className="text-base font-semibold text-slate-800">{unpricedCount > 0 ? 'Total so far' : 'Grand total'}</dt>
          <dd className="text-xl font-bold text-brand-800">{formatCurrency(grandTotal)}</dd>
        </div>
      </dl>
      {unpricedCount > 0 && (
        <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
          The store will add the price of your own items and confirm the final total with you.
        </p>
      )}
      {savings > 0 && (
        <p className="mt-3 flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
          <BadgePercent className="size-4 shrink-0" /> You save {formatCurrency(savings)} with today&apos;s offers
        </p>
      )}
      {freeDeliveryGap > 0 && (
        <p className="mt-3 rounded-xl bg-brand-50 px-3 py-2 text-xs font-medium text-brand-800">
          Add {formatCurrency(freeDeliveryGap)} more for <span className="font-semibold">FREE delivery</span>
        </p>
      )}
    </div>
  );
}
