import { Link } from 'react-router-dom';
import { Skeleton } from './Loader';

const TONES = {
  green: 'bg-brand-50 text-brand-600',
  blue: 'bg-sky-50 text-sky-600',
  indigo: 'bg-indigo-50 text-indigo-600',
  amber: 'bg-amber-50 text-amber-600',
  red: 'bg-red-50 text-red-500',
  purple: 'bg-violet-50 text-violet-600',
  teal: 'bg-teal-50 text-teal-600',
  slate: 'bg-slate-100 text-slate-600',
};

/**
 * Dashboard number card.
 *   <StatCard icon={ShoppingBag} label="Total Orders" value={12} tone="blue" />
 */
export default function StatCard({ icon: Icon, label, value, hint, tone = 'green', loading = false, to, valueClassName = '' }) {
  const content = (
    <div className="flex h-full items-start gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-card transition duration-200 hover:-translate-y-0.5 hover:shadow-soft">
      {Icon && (
        <div className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${TONES[tone] || TONES.green}`}>
          <Icon className="size-5" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        {loading ? (
          <Skeleton className="mt-2 h-6 w-24" />
        ) : (
          <p className={`mt-1 truncate text-xl font-semibold text-slate-800 ${valueClassName}`}>{value}</p>
        )}
        {hint && !loading && <p className="mt-0.5 truncate text-xs text-slate-500">{hint}</p>}
      </div>
    </div>
  );

  return to ? (
    <Link to={to} className="block h-full focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-100 rounded-2xl">
      {content}
    </Link>
  ) : (
    content
  );
}
