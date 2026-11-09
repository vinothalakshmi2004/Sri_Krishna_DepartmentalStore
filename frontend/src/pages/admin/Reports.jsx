/**
 * Reports: summary for a date range and CSV exports.
 */
import { useState } from 'react';
import toast from 'react-hot-toast';
import {
  Clock,
  Download,
  FileSpreadsheet,
  PackageCheck,
  PackageX,
  Receipt,
  ShoppingBag,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { dashboardApi, reportsApi } from '../../api/adminApi';
import { getErrorMessage } from '../../api/client';
import useFetch from '../../hooks/useFetch';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { EXPENSE_CATEGORIES, ORDER_STATUSES, PAYMENT_STATUSES, STATUS_META } from '../../utils/constants';
import { describeRange, getPresetDates } from '../../utils/dateRange';
import { formatCurrency, formatNumber } from '../../utils/format';
import PageHeader from '../../components/admin/PageHeader';
import RangeSelector from '../../components/admin/RangeSelector';
import { FilterSelect } from '../../components/admin/FilterBar';
import StatCard from '../../components/ui/StatCard';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';

function ExportCard({ title, description, icon: Icon, tone, children, onDownload, loading }) {
  return (
    <div className="flex flex-col rounded-2xl border border-slate-100 bg-white p-5 shadow-card">
      <div className="flex items-start gap-3">
        <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${tone}`}>
          <Icon className="size-5" />
        </span>
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="text-sm text-slate-500">{description}</p>
        </div>
      </div>
      <div className="mt-4 flex-1 space-y-2">{children}</div>
      <Button className="mt-4" icon={Download} loading={loading} onClick={onDownload} fullWidth>
        Export CSV
      </Button>
    </div>
  );
}

export default function Reports() {
  useDocumentTitle('Reports');
  const [range, setRange] = useState({ range: 'month', ...getPresetDates('month') });
  const [orderFilters, setOrderFilters] = useState({ status: '', paymentStatus: '', format: '' });
  const [incomeSource, setIncomeSource] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('');
  const [downloading, setDownloading] = useState('');

  const { data: s, loading, error, refetch } = useFetch(
    () => dashboardApi.stats({ range: 'custom', from: range.from, to: range.to }),
    [range.from, range.to]
  );
  const busy = loading && !s;

  const download = async (type, extra) => {
    setDownloading(type);
    try {
      const fileName = await reportsApi.download(type, { from: range.from, to: range.to, ...extra });
      toast.success(`Downloaded ${fileName}`);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not export the report.'));
    } finally {
      setDownloading('');
    }
  };

  const profitPositive = !s || s.profit >= 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description={`Summary for ${describeRange(range.from, range.to)}`}
        actions={<RangeSelector value={range} onChange={setRange} />}
        className="!mb-0"
      />

      {error && !s ? (
        <EmptyState title="Could not load summary" message={error} action={<Button onClick={() => refetch()}>Retry</Button>} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <StatCard icon={ShoppingBag} tone="blue" label="Orders" value={formatNumber(s?.totalOrders)} hint={s ? `${formatCurrency(s.totalSales)} order value` : ''} loading={busy} />
            <StatCard icon={PackageCheck} tone="green" label="Delivered" value={formatNumber(s?.deliveredOrders)} loading={busy} />
            <StatCard icon={PackageX} tone="red" label="Cancelled" value={formatNumber(s?.cancelledOrders)} loading={busy} />
            <StatCard icon={Clock} tone="purple" label="Pending payments" value={formatCurrency(s?.pendingPaymentAmount)} hint={s ? `${s.pendingPaymentCount} orders` : ''} loading={busy} />
          </div>

          <Card title="Profit & loss" icon={profitPositive ? TrendingUp : TrendingDown}>
            {busy ? (
              <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
            ) : (
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl bg-brand-50 p-4">
                  <p className="flex items-center gap-2 text-sm text-slate-600">
                    <Wallet className="size-4 text-brand-600" /> Income
                  </p>
                  <p className="mt-1 text-2xl font-bold text-brand-800">{formatCurrency(s?.totalIncome)}</p>
                </div>
                <div className="rounded-2xl bg-amber-50 p-4">
                  <p className="flex items-center gap-2 text-sm text-slate-600">
                    <Receipt className="size-4 text-amber-600" /> Expense
                  </p>
                  <p className="mt-1 text-2xl font-bold text-amber-700">{formatCurrency(s?.totalExpense)}</p>
                </div>
                <div className={`rounded-2xl p-4 ${profitPositive ? 'bg-brand-500 text-on-brand' : 'bg-red-500 text-white'}`}>
                  <p className="flex items-center gap-2 text-sm text-white/85">
                    {profitPositive ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />} {profitPositive ? 'Profit' : 'Loss'}
                  </p>
                  <p className="mt-1 text-2xl font-bold">{formatCurrency(s?.profit)}</p>
                </div>
              </div>
            )}
          </Card>
        </>
      )}

      <div>
        <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <FileSpreadsheet className="size-5 text-brand-600" /> Export to CSV
        </h3>
        <p className="mb-4 text-sm text-slate-500">
          Files open in Excel or Google Sheets and cover {describeRange(range.from, range.to)}.
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          <ExportCard
            title="Orders"
            description="Every order with items, totals and payment"
            icon={ShoppingBag}
            tone="bg-sky-50 text-sky-600"
            loading={downloading === 'orders'}
            onDownload={() => download('orders', orderFilters)}
          >
            <FilterSelect
              value={orderFilters.status}
              onChange={(v) => setOrderFilters((f) => ({ ...f, status: v }))}
              options={ORDER_STATUSES.map((st) => ({ value: st, label: STATUS_META[st].label }))}
              placeholder="All statuses"
              className="w-full"
            />
            <FilterSelect
              value={orderFilters.paymentStatus}
              onChange={(v) => setOrderFilters((f) => ({ ...f, paymentStatus: v }))}
              options={PAYMENT_STATUSES}
              placeholder="Any payment status"
              className="w-full"
            />
            <FilterSelect
              value={orderFilters.format}
              onChange={(v) => setOrderFilters((f) => ({ ...f, format: v }))}
              options={[{ value: 'items', label: 'Item-wise (one row per item)' }]}
              placeholder="One row per order"
              className="w-full"
              ariaLabel="Export layout"
            />
          </ExportCard>
          <ExportCard
            title="Income"
            description="Order income and manual entries"
            icon={Wallet}
            tone="bg-brand-50 text-brand-600"
            loading={downloading === 'income'}
            onDownload={() => download('income', { source: incomeSource })}
          >
            <FilterSelect value={incomeSource} onChange={setIncomeSource} options={['Order', 'Manual']} placeholder="All sources" className="w-full" />
          </ExportCard>
          <ExportCard
            title="Expenses"
            description="All expenses with category and mode"
            icon={Receipt}
            tone="bg-amber-50 text-amber-600"
            loading={downloading === 'expenses'}
            onDownload={() => download('expenses', { category: expenseCategory })}
          >
            <FilterSelect value={expenseCategory} onChange={setExpenseCategory} options={EXPENSE_CATEGORIES} placeholder="All categories" className="w-full" />
          </ExportCard>
        </div>
      </div>
    </div>
  );
}
