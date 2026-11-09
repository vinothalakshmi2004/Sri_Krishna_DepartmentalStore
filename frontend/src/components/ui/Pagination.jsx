import { ChevronLeft, ChevronRight } from 'lucide-react';

/** Page numbers to show around the current page: 1 … 4 5 6 … 12 */
const pageList = (page, pages) => {
  const set = new Set([1, pages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pages));
  const sorted = [...set].sort((a, b) => a - b);
  const result = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) result.push('…');
    result.push(p);
  });
  return result;
};

/**
 * Pagination bar driven by the API "pagination" block: { total, page, limit, pages }
 */
export default function Pagination({ pagination, onPageChange, className = '' }) {
  if (!pagination || pagination.total === 0) return null;
  const { page, pages, total, limit } = pagination;
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  const btn =
    'inline-flex size-9 items-center justify-center rounded-xl text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <div className={`flex flex-col items-center justify-between gap-3 sm:flex-row ${className}`}>
      <p className="text-sm text-slate-500">
        Showing <span className="font-medium text-slate-700">{from}</span>–<span className="font-medium text-slate-700">{to}</span> of{' '}
        <span className="font-medium text-slate-700">{total}</span>
      </p>
      {pages > 1 && (
        <nav className="flex items-center gap-1" aria-label="Pagination">
          <button type="button" className={`${btn} hover:bg-slate-100`} disabled={page <= 1} onClick={() => onPageChange(page - 1)} aria-label="Previous page">
            <ChevronLeft className="size-4" />
          </button>
          {pageList(page, pages).map((p, i) =>
            p === '…' ? (
              // eslint-disable-next-line react/no-array-index-key
              <span key={`gap-${i}`} className="px-1 text-slate-400">
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(p)}
                className={`${btn} ${p === page ? 'bg-brand-500 text-on-brand shadow-soft' : 'text-slate-600 hover:bg-slate-100'}`}
                aria-current={p === page ? 'page' : undefined}
              >
                {p}
              </button>
            )
          )}
          <button type="button" className={`${btn} hover:bg-slate-100`} disabled={page >= pages} onClick={() => onPageChange(page + 1)} aria-label="Next page">
            <ChevronRight className="size-4" />
          </button>
        </nav>
      )}
    </div>
  );
}
