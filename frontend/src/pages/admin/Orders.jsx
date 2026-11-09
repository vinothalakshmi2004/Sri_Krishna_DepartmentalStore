/**
 * Orders list with status tabs, filters, live updates and the details drawer.
 */
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowRight, Eye, NotebookPen, Phone, ShoppingBag } from 'lucide-react';
import { ordersApi } from '../../api/adminApi';
import { getErrorMessage } from '../../api/client';
import { useSocketEvent } from '../../context/SocketContext';
import useFetch from '../../hooks/useFetch';
import useDebounce from '../../hooks/useDebounce';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { NEXT_STATUS_ACTION, ORDER_PAYMENT_MODES, ORDER_STATUSES, PAYMENT_STATUSES, STATUS_META } from '../../utils/constants';
import { formatCurrency, formatDate, formatTime } from '../../utils/format';
import { telLink } from '../../utils/links';
import PageHeader from '../../components/admin/PageHeader';
import FilterBar, { DateRangeInputs, FilterSelect, ResetButton, SearchInput } from '../../components/admin/FilterBar';
import OrderDrawer from '../../components/admin/OrderDrawer';
import OrderExportMenu from '../../components/admin/OrderExportMenu';
import Table from '../../components/ui/Table';
import Pagination from '../../components/ui/Pagination';
import SegmentedControl from '../../components/ui/SegmentedControl';
import EmptyState from '../../components/ui/EmptyState';
import Button from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Loader';
import { PaymentBadge, PaymentModeBadge, StatusBadge } from '../../components/ui/Badge';

const EMPTY_FILTERS = { paymentStatus: '', paymentMode: '', from: '', to: '' };
/** Small tag for orders with items the customer typed in ("Your own order") */
function OwnListTag({ order }) {
  const lines = order.customItems || [];
  if (!lines.length) return null;
  const unpriced = lines.filter((line) => line.amount === null || line.amount === undefined).length;
  return (
    <span
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800"
      title={unpriced ? `${unpriced} own item(s) still need a price` : 'Own items priced'}
    >
      <NotebookPen className="size-3" /> Own list{unpriced ? ` · ${unpriced} to price` : ''}
    </span>
  );
}

const SORT_OPTIONS = [
  { value: '-createdAt', label: 'Newest first' },
  { value: 'createdAt', label: 'Oldest first' },
  { value: '-grandTotal', label: 'Highest amount' },
  { value: 'grandTotal', label: 'Lowest amount' },
];

export default function Orders() {
  useDocumentTitle('Orders');
  const [searchParams, setSearchParams] = useSearchParams();
  const initialStatus = searchParams.get('status');

  const [status, setStatus] = useState(ORDER_STATUSES.includes(initialStatus) ? initialStatus : 'All');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('-createdAt');
  const [page, setPage] = useState(1);
  const [openRef, setOpenRef] = useState(null);
  const [freshIds, setFreshIds] = useState(() => new Set());
  const [quickBusy, setQuickBusy] = useState(null);
  const debouncedSearch = useDebounce(search, 400);

  const params = {
    status: status === 'All' ? '' : status,
    ...filters,
    search: debouncedSearch.trim(),
    sort,
    page,
    limit: 20,
  };
  const { data, loading, error, refetch } = useFetch(() => ordersApi.list(params), [JSON.stringify(params)]);
  const orders = data ? data.data : [];

  // Remember tab counts so they don't flicker while loading
  const [counts, setCounts] = useState(null);
  useEffect(() => {
    if (data && data.statusCounts) setCounts(data.statusCounts);
  }, [data]);

  // ?open=ORD-0001 (from notifications) opens the drawer; ?status=New selects a tab
  useEffect(() => {
    const open = searchParams.get('open');
    const tab = searchParams.get('status');
    if (!open && !tab) return;
    if (open) setOpenRef(open);
    if (tab && ORDER_STATUSES.includes(tab)) {
      setStatus(tab);
      setPage(1);
    }
    const next = new URLSearchParams(searchParams);
    next.delete('open');
    next.delete('status');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  // Live updates
  useSocketEvent('newOrder', (order) => {
    setFreshIds((prev) => new Set(prev).add(order._id));
    refetch({ silent: true });
  });
  useSocketEvent('orderUpdated', () => refetch({ silent: true }));
  useSocketEvent('orderDeleted', () => refetch({ silent: true }));

  const changeTab = (value) => {
    setStatus(value);
    setPage(1);
  };
  const updateFilters = (patch) => {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(1);
  };
  const resetFilters = () => {
    setFilters(EMPTY_FILTERS);
    setSearch('');
    setSort('-createdAt');
    setPage(1);
  };
  const filtersActive = Boolean(search || filters.paymentStatus || filters.paymentMode || filters.from || filters.to || sort !== '-createdAt');

  const quickAdvance = async (order) => {
    const next = NEXT_STATUS_ACTION[order.status];
    if (!next) return;
    setQuickBusy(order._id);
    try {
      await ordersApi.updateStatus(order._id, next.status);
      toast.success(`${order.orderId} marked as ${STATUS_META[next.status].label}`);
      refetch({ silent: true });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setQuickBusy(null);
    }
  };

  const tabs = useMemo(
    () => [
      { value: 'All', label: 'All', count: counts ? counts.All : undefined },
      ...ORDER_STATUSES.map((s) => ({ value: s, label: STATUS_META[s].label, count: counts ? counts[s] : undefined })),
    ],
    [counts]
  );

  const rowHighlight = (order) => {
    if (freshIds.has(order._id)) return 'animate-highlight';
    if (order.status === 'New') return 'bg-sky-50/50';
    return '';
  };

  const actionButtons = (order) => {
    const next = NEXT_STATUS_ACTION[order.status];
    return (
      <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
        {next && (
          <Button size="xs" variant="secondary" iconRight={ArrowRight} loading={quickBusy === order._id} onClick={() => quickAdvance(order)}>
            {next.label}
          </Button>
        )}
        <Button size="xs" variant="ghost" icon={Eye} onClick={() => setOpenRef(order._id)}>
          View
        </Button>
      </div>
    );
  };

  const columns = [
    {
      key: 'orderId',
      header: 'Order ID',
      render: (o) => (
        <span className="flex items-center gap-2 font-semibold text-slate-800">
          {o.status === 'New' && (
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-sky-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-sky-500" />
            </span>
          )}
          {o.orderId}
        </span>
      ),
    },
    {
      key: 'date',
      header: 'Date / Time',
      render: (o) => (
        <div className="whitespace-nowrap">
          <p className="text-slate-700">{formatDate(o.createdAt)}</p>
          <p className="text-xs text-slate-500">{formatTime(o.createdAt)}</p>
        </div>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      render: (o) => (
        <div className="max-w-[180px]">
          <p className="truncate font-medium text-slate-800">{o.customerName}</p>
          <p className="truncate text-xs text-slate-500">{o.pincode}</p>
          <OwnListTag order={o} />
        </div>
      ),
    },
    {
      key: 'phone',
      header: 'Phone',
      render: (o) => (
        <a href={telLink(o.phone)} onClick={(e) => e.stopPropagation()} className="whitespace-nowrap text-brand-700 hover:underline">
          {o.phone}
        </a>
      ),
    },
    { key: 'amount', header: 'Amount', render: (o) => <span className="whitespace-nowrap font-semibold text-slate-800">{formatCurrency(o.grandTotal)}</span> },
    { key: 'status', header: 'Status', render: (o) => <StatusBadge status={o.status} /> },
    { key: 'payment', header: 'Payment', render: (o) => <PaymentBadge status={o.paymentStatus} /> },
    { key: 'mode', header: 'Mode', render: (o) => <PaymentModeBadge mode={o.paymentMode} /> },
    { key: 'actions', header: '', headerClassName: 'text-right', className: 'text-right', render: actionButtons },
  ];

  const empty = (
    <EmptyState
      icon={ShoppingBag}
      title={filtersActive || status !== 'All' ? 'No orders match these filters' : 'No orders yet'}
      message={filtersActive || status !== 'All' ? 'Try another tab or reset the filters.' : 'New orders will appear here instantly.'}
      action={filtersActive ? <Button variant="outline" onClick={resetFilters}>Reset filters</Button> : null}
    />
  );

  return (
    <div>
      <PageHeader
        title="Orders"
        description="Manage, confirm and deliver customer orders. New orders appear automatically."
        actions={
          <OrderExportMenu
            params={{ status: params.status, ...filters, search: params.search }}
            count={data && data.pagination ? data.pagination.total : 0}
          />
        }
      />

      <SegmentedControl options={tabs} value={status} onChange={changeTab} scrollable className="mb-4" />

      <FilterBar>
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search name, phone or order ID" className="lg:w-72" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:flex">
          <FilterSelect value={filters.paymentStatus} onChange={(v) => updateFilters({ paymentStatus: v })} options={PAYMENT_STATUSES} placeholder="Any payment" />
          <FilterSelect value={filters.paymentMode} onChange={(v) => updateFilters({ paymentMode: v })} options={ORDER_PAYMENT_MODES} placeholder="Any mode" />
          <FilterSelect
            value={sort === '-createdAt' ? '' : sort}
            onChange={(v) => { setSort(v || '-createdAt'); setPage(1); }}
            options={SORT_OPTIONS.slice(1)}
            placeholder={SORT_OPTIONS[0].label}
            ariaLabel="Sort orders"
            className="col-span-2 sm:col-span-1"
          />
        </div>
        <DateRangeInputs from={filters.from} to={filters.to} onChange={(range) => updateFilters(range)} />
        <ResetButton onClick={resetFilters} visible={filtersActive} />
      </FilterBar>

      {error && !data && <EmptyState title="Could not load orders" message={error} action={<Button onClick={() => refetch()}>Retry</Button>} />}

      {/* Phone: cards */}
      {!error || data ? (
        <>
          <div className="space-y-3 md:hidden">
            {loading && !data && [1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-32 w-full rounded-2xl" />)}
            {!loading && orders.length === 0 && <div className="rounded-2xl border border-slate-100 bg-white">{empty}</div>}
            {orders.map((o) => (
              <div
                key={o._id}
                role="button"
                tabIndex={0}
                onClick={() => setOpenRef(o._id)}
                onKeyDown={(e) => e.key === 'Enter' && setOpenRef(o._id)}
                className={`rounded-2xl border border-slate-100 bg-white p-4 shadow-card transition active:scale-[0.99] ${rowHighlight(o)} ${
                  o.status === 'New' ? 'border-l-4 border-l-sky-400' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800">{o.orderId}</p>
                    <p className="text-xs text-slate-500">
                      {formatDate(o.createdAt)} · {formatTime(o.createdAt)}
                    </p>
                  </div>
                  <p className="text-lg font-bold text-brand-800">{formatCurrency(o.grandTotal)}</p>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium text-slate-700">{o.customerName}</p>
                  <a href={telLink(o.phone)} onClick={(e) => e.stopPropagation()} className="flex items-center gap-1 text-sm text-brand-700">
                    <Phone className="size-3.5" /> {o.phone}
                  </a>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <StatusBadge status={o.status} />
                  <PaymentBadge status={o.paymentStatus} />
                  <PaymentModeBadge mode={o.paymentMode} />
                  <OwnListTag order={o} />
                  <div className="ml-auto">{actionButtons(o)}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Tablet / desktop: table */}
          <div className="hidden md:block">
            <Table columns={columns} data={orders} loading={loading} onRowClick={(o) => setOpenRef(o._id)} rowClassName={rowHighlight} empty={empty} minWidth="min-w-[960px]" />
          </div>

          <Pagination pagination={data && data.pagination} onPageChange={setPage} className="mt-4" />
        </>
      ) : null}

      <OrderDrawer orderRef={openRef} open={Boolean(openRef)} onClose={() => setOpenRef(null)} onChanged={() => refetch({ silent: true })} />
    </div>
  );
}
