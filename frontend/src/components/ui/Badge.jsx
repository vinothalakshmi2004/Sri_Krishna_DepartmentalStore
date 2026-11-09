import { STATUS_META, paymentModeLabel } from '../../utils/constants';

const COLORS = {
  green: 'bg-green-50 text-green-700 ring-green-600/20',
  brand: 'bg-brand-50 text-brand-800 ring-brand-600/20',
  blue: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
  amber: 'bg-amber-50 text-amber-700 ring-amber-600/25',
  red: 'bg-red-50 text-red-700 ring-red-600/20',
  purple: 'bg-violet-50 text-violet-700 ring-violet-600/20',
  teal: 'bg-teal-50 text-teal-700 ring-teal-600/20',
  gray: 'bg-slate-100 text-slate-600 ring-slate-500/20',
};

/** Small coloured pill */
export default function Badge({ color = 'gray', dot = false, className = '', children }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
        COLORS[color] || COLORS.gray
      } ${className}`}
    >
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

/** Order status (New, Confirmed, Out for Delivery, Delivered, Cancelled) */
export function StatusBadge({ status, className }) {
  const meta = STATUS_META[status] || { label: status, color: 'gray' };
  return (
    <Badge color={meta.color} dot className={className}>
      {meta.label}
    </Badge>
  );
}

/** Payment status (Pending / Paid) */
export function PaymentBadge({ status, className }) {
  return (
    <Badge color={status === 'Paid' ? 'green' : 'amber'} className={className}>
      {status}
    </Badge>
  );
}

const MODE_COLORS = { Cash: 'teal', GPay: 'blue', PhonePe: 'purple', UPI: 'indigo', Card: 'amber', BankTransfer: 'brand' };

/** Payment mode (Cash, GPay ...) */
export function PaymentModeBadge({ mode }) {
  if (!mode || mode === 'None') return <span className="text-slate-400">—</span>;
  return <Badge color={MODE_COLORS[mode] || 'gray'}>{paymentModeLabel(mode)}</Badge>;
}
