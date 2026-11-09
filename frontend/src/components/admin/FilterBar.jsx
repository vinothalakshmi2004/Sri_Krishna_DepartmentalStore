import { RotateCcw, Search, X } from 'lucide-react';
import { toInputDate } from '../../utils/format';

const control =
  'h-10 rounded-xl border border-slate-200 bg-white px-3 text-base sm:text-sm text-slate-700 transition focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100';

/** Search box used in admin filter bars */
export function SearchInput({ value, onChange, placeholder = 'Search...', className = '' }) {
  return (
    <div className={`relative ${className}`}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`${control} w-full pl-9 pr-8`}
      />
      {value && (
        <button type="button" onClick={() => onChange('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-100" aria-label="Clear search">
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

/** Compact select for filters */
export function FilterSelect({ value, onChange, options, placeholder, className = '', ariaLabel }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={`${control} cursor-pointer pr-8 ${className}`} aria-label={ariaLabel || placeholder}>
      <option value="">{placeholder}</option>
      {options.map((option) => {
        const opt = typeof option === 'string' ? { value: option, label: option } : option;
        return (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        );
      })}
    </select>
  );
}

/** From / To date inputs */
export function DateRangeInputs({ from, to, onChange }) {
  return (
    <div className="flex items-center gap-2">
      <input type="date" value={from} max={to || toInputDate()} onChange={(e) => onChange({ from: e.target.value, to })} className={`${control} min-w-0 flex-1`} aria-label="From date" />
      <span className="text-xs text-slate-400">to</span>
      <input type="date" value={to} min={from || undefined} max={toInputDate()} onChange={(e) => onChange({ from, to: e.target.value })} className={`${control} min-w-0 flex-1`} aria-label="To date" />
    </div>
  );
}

/** "Reset filters" text button */
export function ResetButton({ onClick, visible = true }) {
  if (!visible) return null;
  return (
    <button type="button" onClick={onClick} className="inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700">
      <RotateCcw className="size-4" /> Reset
    </button>
  );
}

/** Wrapper card for a row of filters */
export default function FilterBar({ children, className = '' }) {
  return <div className={`mb-4 flex flex-col gap-3 rounded-2xl border border-slate-100 bg-white p-3 shadow-card lg:flex-row lg:flex-wrap lg:items-center ${className}`}>{children}</div>;
}
