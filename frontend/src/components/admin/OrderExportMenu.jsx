import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { ChevronDown, Download, FileSpreadsheet, ListOrdered } from 'lucide-react';
import { reportsApi } from '../../api/adminApi';
import { getErrorMessage } from '../../api/client';
import Button from '../ui/Button';

const FORMATS = [
  {
    value: 'summary',
    icon: FileSpreadsheet,
    title: 'Orders (one row per order)',
    text: 'Customer, phone, address, items, subtotal, savings, delivery, grand total, status, payment + TOTAL row',
  },
  {
    value: 'items',
    icon: ListOrdered,
    title: 'Item-wise details (one row per item)',
    text: 'Every item with quantity, price, regular price, line total and order totals',
  },
];

/**
 * Export button for the Orders page. Downloads a CSV (opens in Excel) of the
 * orders matching the current tab, filters and search.
 * `params` = current list filters, `count` = number of matching orders.
 */
export default function OrderExportMenu({ params, count }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (event) => {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const download = async (format) => {
    setOpen(false);
    setBusy(true);
    try {
      const fileName = await reportsApi.download('orders', { ...params, format });
      toast.success(`Downloaded ${fileName}`);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not export the orders.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="outline"
        icon={Download}
        iconRight={ChevronDown}
        loading={busy}
        disabled={!count}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={count ? 'Download these orders as an Excel/CSV file' : 'No orders to export'}
      >
        Export{count ? ` (${count})` : ''}
      </Button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 z-30 mt-2 w-80 max-w-[calc(100vw-2rem)] animate-pop overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-2xl sm:left-auto sm:right-0"
        >
          <p className="border-b border-slate-100 bg-slate-50/70 px-4 py-2.5 text-xs text-slate-500">
            Exports the <strong className="text-slate-700">{count}</strong> order{count === 1 ? '' : 's'} matching the current tab, filters and search.
            Opens in Excel.
          </p>
          {FORMATS.map(({ value, icon: Icon, title, text }) => (
            <button
              key={value}
              type="button"
              role="menuitem"
              onClick={() => download(value)}
              className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-brand-50"
            >
              <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <Icon className="size-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-slate-800">{title}</span>
                <span className="mt-0.5 block text-xs text-slate-500">{text}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
