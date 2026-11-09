import { useState } from 'react';
import { CalendarDays } from 'lucide-react';
import SegmentedControl from '../ui/SegmentedControl';
import Button from '../ui/Button';
import { RANGE_PRESETS, getPresetDates } from '../../utils/dateRange';
import { toInputDate } from '../../utils/format';

/**
 * Today / This Week / This Month / Custom selector.
 * value: { range, from, to }  (from/to are YYYY-MM-DD, always filled)
 */
export default function RangeSelector({ value, onChange, className = '' }) {
  const [custom, setCustom] = useState({ from: value.from, to: value.to });

  const selectPreset = (range) => {
    if (range === 'custom') {
      const start = custom.from || toInputDate();
      const end = custom.to || toInputDate();
      setCustom({ from: start, to: end });
      onChange({ range, from: start, to: end });
      return;
    }
    onChange({ range, ...getPresetDates(range) });
  };

  const applyCustom = () => {
    if (!custom.from || !custom.to) return;
    const [from, to] = custom.from <= custom.to ? [custom.from, custom.to] : [custom.to, custom.from];
    setCustom({ from, to });
    onChange({ range: 'custom', from, to });
  };

  const dateInput =
    'rounded-xl border border-slate-200 bg-white px-3 py-2 text-base sm:text-sm text-slate-700 focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100';

  return (
    <div className={`flex min-w-0 max-w-full flex-col gap-2 sm:items-end ${className}`}>
      <SegmentedControl options={RANGE_PRESETS} value={value.range} onChange={selectPreset} size="sm" scrollable />
      {value.range === 'custom' && (
        <div className="flex flex-wrap items-center gap-2 animate-fade-in">
          <CalendarDays className="hidden size-4 text-brand-600 sm:block" />
          <input type="date" className={dateInput} value={custom.from} max={toInputDate()} onChange={(e) => setCustom({ ...custom, from: e.target.value })} aria-label="From date" />
          <span className="text-sm text-slate-500">to</span>
          <input type="date" className={dateInput} value={custom.to} max={toInputDate()} onChange={(e) => setCustom({ ...custom, to: e.target.value })} aria-label="To date" />
          <Button size="sm" onClick={applyCustom} disabled={!custom.from || !custom.to}>
            Apply
          </Button>
        </div>
      )}
    </div>
  );
}
