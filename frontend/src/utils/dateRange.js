/**
 * Date range presets used by the dashboard, reports and filters.
 * All ranges are inclusive local dates in "YYYY-MM-DD".
 */
import { toInputDate } from './format';

export const RANGE_PRESETS = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'custom', label: 'Custom' },
];

/** { from, to } for a preset (week starts on Monday, like the backend) */
export const getPresetDates = (preset) => {
  const today = new Date();
  const to = toInputDate(today);

  if (preset === 'week') {
    const start = new Date(today);
    start.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    return { from: toInputDate(start), to };
  }
  if (preset === 'month') {
    return { from: toInputDate(new Date(today.getFullYear(), today.getMonth(), 1)), to };
  }
  return { from: to, to };
};

/** "01-10-2026 to 20-10-2026" style label */
export const describeRange = (from, to) => {
  const fmt = (value) => value.split('-').reverse().join('-');
  if (!from && !to) return 'All time';
  if (from === to) return fmt(from);
  return `${from ? fmt(from) : 'Start'} to ${to ? fmt(to) : 'Today'}`;
};
