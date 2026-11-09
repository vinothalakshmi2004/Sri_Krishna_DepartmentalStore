import toast from 'react-hot-toast';
import { BellRing, X } from 'lucide-react';
import { formatCurrency } from '../../utils/format';
import Button from '../ui/Button';

/** Pop-up shown to admins when a new order arrives (react-hot-toast custom toast) */
export default function NewOrderToast({ t, order, onView }) {
  return (
    <div
      className={`pointer-events-auto w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-brand-100 bg-white p-4 shadow-2xl transition-all duration-300 ${
        t.visible ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0'
      }`}
      role="status"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 animate-ring items-center justify-center rounded-full bg-brand-500 text-on-brand shadow-soft">
          <BellRing className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">New order · {order.orderId}</p>
          <p className="mt-0.5 truncate font-semibold text-slate-800">{order.customerName}</p>
          <p className="text-sm text-slate-500">
            {order.itemCount} item{order.itemCount === 1 ? '' : 's'} ·{' '}
            <span className="font-semibold text-brand-800">{formatCurrency(order.grandTotal)}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => toast.dismiss(t.id)}
          className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          aria-label="Dismiss"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="mt-3 flex gap-2">
        <Button size="sm" fullWidth onClick={onView}>
          View order
        </Button>
        <Button size="sm" variant="ghost" onClick={() => toast.dismiss(t.id)}>
          Later
        </Button>
      </div>
    </div>
  );
}
