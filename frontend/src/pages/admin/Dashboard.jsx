/**
 * Admin dashboard: stats for a date range, charts, recent orders (live),
 * top items and low stock alerts.
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  BellRing,
  ChartColumn,
  ChartPie,
  Clock,
  PackageCheck,
  PackageX,
  Receipt,
  ShoppingBag,
  Star,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  Wallet,
  ArrowRight,
  Activity,
} from 'lucide-react';
import { dashboardApi, ordersApi } from '../../api/adminApi';
import { useAuth } from '../../context/AuthContext';
import { useSocketEvent } from '../../context/SocketContext';
import useFetch from '../../hooks/useFetch';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { getPresetDates, describeRange } from '../../utils/dateRange';
import { formatCurrency, formatDateTime, formatNumber, formatQty } from '../../utils/format';
import PageHeader from '../../components/admin/PageHeader';
import RangeSelector from '../../components/admin/RangeSelector';
import { IncomeExpenseChart, PaymentModeChart, SalesChart } from '../../components/admin/Charts';
import StatCard from '../../components/ui/StatCard';
import Card from '../../components/ui/Card';
import Table from '../../components/ui/Table';
import SegmentedControl from '../../components/ui/SegmentedControl';
import EmptyState from '../../components/ui/EmptyState';
import Button from '../../components/ui/Button';
import { PaymentBadge, StatusBadge } from '../../components/ui/Badge';
import { Skeleton } from '../../components/ui/Loader';
import ProductImage from '../../components/public/ProductImage';

const greeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

const DAY_OPTIONS = [
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
];

export default function Dashboard() {
  useDocumentTitle('Dashboard');
  const { admin } = useAuth();
  const navigate = useNavigate();
  const [range, setRange] = useState({ range: 'today', ...getPresetDates('today') });
  const [salesDays, setSalesDays] = useState(7);
  const [ledgerDays, setLedgerDays] = useState(7);

  const statsParams = range.range === 'custom' ? { range: 'custom', from: range.from, to: range.to } : { range: range.range };
  const stats = useFetch(() => dashboardApi.stats(statsParams), [range.range, range.from, range.to]);
  const recent = useFetch(() => ordersApi.list({ limit: 8, sort: '-createdAt' }), []);

  // Live updates
  const refreshAll = () => {
    stats.refetch({ silent: true });
    recent.refetch({ silent: true });
  };
  useSocketEvent('newOrder', refreshAll);
  useSocketEvent('orderUpdated', refreshAll);
  useSocketEvent('orderDeleted', refreshAll);

  const s = stats.data;
  const loading = stats.loading && !s;
  const chart = s ? s.salesChart : { last7Days: [], last30Days: [] };
  const profitPositive = !s || s.profit >= 0;

  const recentColumns = [
    {
      key: 'orderId',
      header: 'Order',
      render: (o) => (
        <div>
          <p className="font-semibold text-slate-800">{o.orderId}</p>
          <p className="text-xs text-slate-500">{formatDateTime(o.createdAt)}</p>
        </div>
      ),
    },
    { key: 'customer', header: 'Customer', render: (o) => <span className="font-medium text-slate-700">{o.customerName}</span> },
    { key: 'amount', header: 'Amount', render: (o) => <span className="font-semibold text-slate-800">{formatCurrency(o.grandTotal)}</span> },
    { key: 'status', header: 'Status', render: (o) => <StatusBadge status={o.status} /> },
    { key: 'payment', header: 'Payment', render: (o) => <PaymentBadge status={o.paymentStatus} /> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${greeting()}, ${admin?.name || admin?.username || 'Admin'}`}
        description={`Showing ${range.range === 'custom' ? describeRange(range.from, range.to) : range.range === 'today' ? 'today' : `this ${range.range}`} · updates live`}
        actions={<RangeSelector value={range} onChange={setRange} />}
        className="!mb-0"
      />

      {stats.error && !s && (
        <EmptyState title="Could not load dashboard" message={stats.error} action={<Button onClick={() => stats.refetch()}>Retry</Button>} />
      )}

      {s && s.openOrders.new > 0 && (
        <Link
          to="/admin/orders?status=New"
          className="flex items-center gap-3 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sky-900 transition hover:bg-sky-100"
        >
          <span className="flex size-9 shrink-0 animate-ring items-center justify-center rounded-full bg-sky-500 text-white">
            <BellRing className="size-4" />
          </span>
          <p className="flex-1 text-sm">
            <strong>{s.openOrders.new}</strong> new order{s.openOrders.new === 1 ? '' : 's'} waiting for confirmation
            {s.openOrders.pending > s.openOrders.new && <> · {s.openOrders.pending} open in total</>}
          </p>
          <ArrowRight className="size-4" />
        </Link>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard icon={ShoppingBag} tone="blue" label="Total orders" value={formatNumber(s?.totalOrders)} hint={s ? `${formatCurrency(s.totalSales)} sales` : ''} loading={loading} to="/admin/orders" />
        <StatCard icon={BellRing} tone="indigo" label="New orders" value={formatNumber(s?.newOrders)} hint={s ? `${s.pendingOrders} pending` : ''} loading={loading} to="/admin/orders?status=New" />
        <StatCard icon={PackageCheck} tone="green" label="Delivered" value={formatNumber(s?.deliveredOrders)} loading={loading} to="/admin/orders?status=Delivered" />
        <StatCard icon={PackageX} tone="red" label="Cancelled" value={formatNumber(s?.cancelledOrders)} loading={loading} to="/admin/orders?status=Cancelled" />
        <StatCard icon={Wallet} tone="teal" label="Income" value={formatCurrency(s?.totalIncome)} loading={loading} to="/admin/income" />
        <StatCard icon={Receipt} tone="amber" label="Expense" value={formatCurrency(s?.totalExpense)} loading={loading} to="/admin/expenses" />
        <StatCard
          icon={profitPositive ? TrendingUp : TrendingDown}
          tone={profitPositive ? 'green' : 'red'}
          label="Profit"
          value={formatCurrency(s?.profit)}
          valueClassName={profitPositive ? 'text-brand-700' : 'text-red-600'}
          loading={loading}
        />
        <StatCard
          icon={Clock}
          tone="purple"
          label="Pending payments"
          value={formatCurrency(s?.pendingPaymentAmount)}
          hint={s ? `${s.pendingPaymentCount} unpaid order${s.pendingPaymentCount === 1 ? '' : 's'}` : ''}
          loading={loading}
        />
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card
          className="lg:col-span-2"
          title="Sales trend"
          description="Order value per day (cancelled orders excluded)"
          icon={Activity}
          actions={<SegmentedControl size="sm" options={DAY_OPTIONS} value={salesDays} onChange={setSalesDays} />}
        >
          {loading ? <Skeleton className="h-[280px] w-full rounded-xl" /> : <SalesChart data={salesDays === 7 ? chart.last7Days : chart.last30Days} />}
        </Card>
        <Card title="Payment modes" description="Paid orders in this period" icon={ChartPie}>
          {loading ? <Skeleton className="h-56 w-full rounded-xl" /> : <PaymentModeChart data={s?.paymentModeSplit || []} />}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card
          className="lg:col-span-2"
          title="Income vs expense"
          description="Daily totals"
          icon={ChartColumn}
          actions={<SegmentedControl size="sm" options={DAY_OPTIONS} value={ledgerDays} onChange={setLedgerDays} />}
        >
          {loading ? <Skeleton className="h-[280px] w-full rounded-xl" /> : <IncomeExpenseChart data={ledgerDays === 7 ? chart.last7Days : chart.last30Days} />}
        </Card>
        <Card title="Top selling items" description="By quantity in this period" icon={Star} bodyClassName="p-2">
          {loading && <div className="space-y-2 p-3">{[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>}
          {!loading && (!s || s.topSellingItems.length === 0) && <EmptyState compact title="No sales yet" message="Top items will appear once orders come in." />}
          {!loading && s && s.topSellingItems.length > 0 && (
            <ol className="divide-y divide-slate-100">
              {s.topSellingItems.map((item, index) => (
                <li key={item.itemId} className="flex items-center gap-3 px-3 py-2.5">
                  <span
                    className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      index === 0 ? 'bg-amber-100 text-amber-700' : 'bg-brand-50 text-brand-700'
                    }`}
                  >
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800">{item.name}</p>
                    <p className="text-xs text-slate-500">
                      {formatQty(item.quantity, item.unit)} · {item.orders} order{item.orders === 1 ? '' : 's'}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-brand-800">{formatCurrency(item.revenue)}</span>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card
          className="lg:col-span-2"
          title="Recent orders"
          description="Updates live"
          icon={ShoppingBag}
          bodyClassName="p-0"
          actions={
            <Button size="sm" variant="ghost" to="/admin/orders" iconRight={ArrowRight}>
              All orders
            </Button>
          }
        >
          <Table
            columns={recentColumns}
            data={recent.data?.data || []}
            loading={recent.loading}
            onRowClick={(o) => navigate(`/admin/orders?open=${o.orderId}`)}
            rowClassName={(o) => (o.status === 'New' ? 'bg-sky-50/50' : '')}
            skeletonRows={5}
            minWidth="min-w-[560px]"
            className="rounded-none border-0"
            empty={<EmptyState compact icon={ShoppingBag} title="No orders yet" message="New orders will show up here instantly." />}
          />
        </Card>

        <Card
          title="Low stock alerts"
          description={s ? `${s.lowStockCount} item${s.lowStockCount === 1 ? ' needs' : 's need'} restocking` : ''}
          icon={TriangleAlert}
          bodyClassName="p-2"
          actions={
            <Button size="sm" variant="ghost" to="/admin/items?filter=lowStock">
              Manage
            </Button>
          }
        >
          {loading && <div className="space-y-2 p-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>}
          {!loading && s && s.lowStockItems.length === 0 && <EmptyState compact icon={PackageCheck} title="All stocked up" message="No items are running low." />}
          {!loading && s && s.lowStockItems.length > 0 && (
            <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
              {s.lowStockItems.map((item) => (
                <li key={item._id} className="flex items-center gap-3 px-3 py-2.5">
                  <ProductImage src={item.image} alt={item.name} className="size-10 shrink-0 rounded-lg" iconClass="size-4" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800">{item.name}</p>
                    <p className="text-xs text-slate-500">Alert at {formatQty(item.lowStockLimit, item.unit)}</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${item.stock <= 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                    {item.stock <= 0 ? 'Out' : formatQty(item.stock, item.unit)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
