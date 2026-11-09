/**
 * Recharts based charts used by the dashboard and expenses pages.
 */
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CHART_COLORS, paymentModeLabel } from '../../utils/constants';
import { formatCompactCurrency, formatCurrency } from '../../utils/format';

const axisTick = { fontSize: 11, fill: 'var(--color-slate-500)' };

/** Shared tooltip: label + coloured rows, money formatted */
export function ChartTooltip({ active, payload, label, extra }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="rounded-xl border border-slate-100 bg-white px-3 py-2 text-xs shadow-card">
      {label && <p className="mb-1 font-semibold text-slate-700">{label}</p>}
      {payload.map((entry) => (
        <p key={entry.dataKey || entry.name} className="flex items-center gap-2 text-slate-600">
          <span className="size-2 rounded-full" style={{ background: entry.color || entry.payload.fill }} />
          {entry.name}: <span className="font-semibold text-slate-800">{formatCurrency(entry.value)}</span>
        </p>
      ))}
      {extra && extra(payload[0].payload)}
    </div>
  );
}

/** Overlay message when a chart has no data */
function NoData({ message }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <p className="rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-slate-500 shadow-sm">{message}</p>
    </div>
  );
}

/** Daily sales (area/line chart) */
export function SalesChart({ data = [], height = 280 }) {
  const empty = data.every((d) => !d.sales);
  return (
    <div className="relative" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-brand-500)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--color-brand-500)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
          <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} minTickGap={18} />
          <YAxis tick={axisTick} tickLine={false} axisLine={false} width={56} tickFormatter={formatCompactCurrency} />
          <Tooltip
            content={
              <ChartTooltip
                extra={(row) => (
                  <p className="mt-1 text-slate-500">
                    Orders: <span className="font-semibold text-slate-800">{row.orders}</span>
                  </p>
                )}
              />
            }
          />
          <Area type="monotone" dataKey="sales" name="Sales" stroke="var(--color-brand-800)" strokeWidth={2.5} fill="url(#salesFill)" dot={false} activeDot={{ r: 5 }} />
        </AreaChart>
      </ResponsiveContainer>
      {empty && <NoData message="No sales in this period yet" />}
    </div>
  );
}

/** Income vs expense per day (bar chart) */
export function IncomeExpenseChart({ data = [], height = 280 }) {
  const empty = data.every((d) => !d.income && !d.expense);
  return (
    <div className="relative" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }} barGap={2}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
          <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} minTickGap={18} />
          <YAxis tick={axisTick} tickLine={false} axisLine={false} width={56} tickFormatter={formatCompactCurrency} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--color-brand-50)' }} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="income" name="Income" fill="var(--color-brand-500)" radius={[6, 6, 0, 0]} maxBarSize={28} />
          <Bar dataKey="expense" name="Expense" fill="#F59E0B" radius={[6, 6, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
      {empty && <NoData message="No income or expenses recorded" />}
    </div>
  );
}

/** Payment mode split (donut + legend) */
export function PaymentModeChart({ data = [] }) {
  const total = data.reduce((sum, d) => sum + d.amount, 0);
  const rows = data.map((d, i) => ({ ...d, name: paymentModeLabel(d.mode), fill: CHART_COLORS[i % CHART_COLORS.length] }));

  if (!rows.length) {
    return <div className="flex h-56 items-center justify-center text-sm text-slate-500">No paid orders in this period</div>;
  }

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row lg:flex-col xl:flex-row">
      <div className="relative h-48 w-48 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={rows} dataKey="amount" nameKey="name" innerRadius={52} outerRadius={80} paddingAngle={rows.length > 1 ? 3 : 0} stroke="none">
              {rows.map((row) => (
                <Cell key={row.mode} fill={row.fill} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[11px] text-slate-500">Collected</span>
          <span className="text-sm font-bold text-slate-800">{formatCompactCurrency(total)}</span>
        </div>
      </div>
      <ul className="w-full space-y-2">
        {rows.map((row) => (
          <li key={row.mode} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2 text-slate-600">
              <span className="size-2.5 rounded-full" style={{ background: row.fill }} />
              {row.name}
              <span className="text-xs text-slate-400">({row.count})</span>
            </span>
            <span className="font-semibold text-slate-800">{formatCurrency(row.amount)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Expense total per category (horizontal bars) */
export function ExpenseCategoryChart({ data = [] }) {
  if (!data.length) {
    return <div className="flex h-48 items-center justify-center text-sm text-slate-500">No expenses in this period</div>;
  }
  const height = Math.max(160, data.length * 44);
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
          <XAxis type="number" tick={axisTick} tickLine={false} axisLine={false} tickFormatter={formatCompactCurrency} />
          <YAxis type="category" dataKey="category" tick={{ ...axisTick, fill: 'var(--color-slate-700)' }} tickLine={false} axisLine={false} width={90} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--color-brand-50)' }} />
          <Bar dataKey="total" name="Spent" radius={[0, 8, 8, 0]} maxBarSize={26}>
            {data.map((row, i) => (
              <Cell key={row.category} fill={CHART_COLORS[(i + 3) % CHART_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
