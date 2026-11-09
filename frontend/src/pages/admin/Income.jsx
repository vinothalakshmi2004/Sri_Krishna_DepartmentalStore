/**
 * Income: automatic entries from Delivered + Paid orders and manual entries.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { HandCoins, Lock, Pencil, Plus, ShoppingBag, Trash2, Wallet } from 'lucide-react';
import { incomeApi } from '../../api/adminApi';
import { getErrorMessage } from '../../api/client';
import { useSocketEvent } from '../../context/SocketContext';
import useFetch from '../../hooks/useFetch';
import useDebounce from '../../hooks/useDebounce';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { LEDGER_PAYMENT_MODES, paymentModeLabel } from '../../utils/constants';
import { formatCurrency, formatDate } from '../../utils/format';
import { describeRange } from '../../utils/dateRange';
import PageHeader from '../../components/admin/PageHeader';
import FilterBar, { DateRangeInputs, FilterSelect, ResetButton, SearchInput } from '../../components/admin/FilterBar';
import { IncomeFormModal } from '../../components/admin/LedgerFormModals';
import StatCard from '../../components/ui/StatCard';
import Table from '../../components/ui/Table';
import Pagination from '../../components/ui/Pagination';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import EmptyState from '../../components/ui/EmptyState';
import Button from '../../components/ui/Button';
import Badge, { PaymentModeBadge } from '../../components/ui/Badge';

const EMPTY_FILTERS = { source: '', paymentMode: '', from: '', to: '' };

export default function Income() {
  useDocumentTitle('Income');
  const navigate = useNavigate();
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState({ open: false, entry: null });
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const debouncedSearch = useDebounce(search, 400);

  const params = { ...filters, search: debouncedSearch.trim(), page, limit: 20 };
  const { data, loading, error, refetch } = useFetch(() => incomeApi.list(params), [JSON.stringify(params)]);
  const rows = data ? data.data : [];

  // Automatic entries change when orders are delivered / paid
  useSocketEvent('orderUpdated', () => refetch({ silent: true }));
  useSocketEvent('orderDeleted', () => refetch({ silent: true }));

  const updateFilters = (patch) => {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(1);
  };
  const resetFilters = () => {
    setFilters(EMPTY_FILTERS);
    setSearch('');
    setPage(1);
  };
  const filtersActive = Boolean(search || Object.values(filters).some(Boolean));

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await incomeApi.remove(toDelete._id);
      toast.success('Income entry deleted');
      setToDelete(null);
      refetch({ silent: true });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    { key: 'date', header: 'Date', render: (r) => <span className="whitespace-nowrap text-slate-700">{formatDate(r.date)}</span> },
    {
      key: 'source',
      header: 'Source',
      render: (r) =>
        r.source === 'Order' ? (
          <Badge color="brand">
            <ShoppingBag className="size-3" /> Order
          </Badge>
        ) : (
          <Badge color="purple">
            <HandCoins className="size-3" /> Manual
          </Badge>
        ),
    },
    {
      key: 'details',
      header: 'Details',
      render: (r) =>
        r.source === 'Order' && r.orderRef ? (
          <button type="button" onClick={() => navigate(`/admin/orders?open=${r.orderRef.orderId}`)} className="text-left">
            <span className="font-medium text-brand-700 hover:underline">{r.orderRef.orderId}</span>
            <span className="block text-xs text-slate-500">{r.orderRef.customerName}</span>
          </button>
        ) : (
          <span className="line-clamp-2 max-w-xs text-slate-600">{r.note || '—'}</span>
        ),
    },
    { key: 'amount', header: 'Amount', render: (r) => <span className="whitespace-nowrap font-semibold text-brand-800">{formatCurrency(r.amount)}</span> },
    { key: 'mode', header: 'Mode', render: (r) => <PaymentModeBadge mode={r.paymentMode} /> },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (r) =>
        r.source === 'Manual' ? (
          <div className="flex justify-end gap-1">
            <Button size="icon" variant="ghost" onClick={() => setModal({ open: true, entry: r })} aria-label="Edit" title="Edit">
              <Pencil className="size-4" />
            </Button>
            <Button size="icon" variant="ghost" className="text-red-500 hover:bg-red-50" onClick={() => setToDelete(r)} aria-label="Delete" title="Delete">
              <Trash2 className="size-4" />
            </Button>
          </div>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs text-slate-400" title="Managed automatically from the order">
            <Lock className="size-3.5" /> Auto
          </span>
        ),
    },
  ];

  const rangeLabel = filters.from || filters.to ? describeRange(filters.from, filters.to) : 'All time';
  const summary = data ? data.sourceSummary || { Order: 0, Manual: 0 } : null;

  return (
    <div>
      <PageHeader
        title="Income"
        description="Delivered + paid orders are added automatically. Add other income manually."
        actions={
          <Button icon={Plus} onClick={() => setModal({ open: true, entry: null })}>
            Add manual income
          </Button>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatCard icon={Wallet} tone="green" label="Total income" value={formatCurrency(data?.totalAmount)} hint={rangeLabel} loading={loading && !data} />
        <StatCard icon={ShoppingBag} tone="blue" label="From orders" value={formatCurrency(summary?.Order)} loading={loading && !data} />
        <StatCard icon={HandCoins} tone="purple" label="Manual entries" value={formatCurrency(summary?.Manual)} loading={loading && !data} />
      </div>

      <FilterBar>
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search notes" className="lg:w-60" />
        <div className="grid grid-cols-2 gap-3 lg:flex">
          <FilterSelect value={filters.source} onChange={(v) => updateFilters({ source: v })} options={['Order', 'Manual']} placeholder="All sources" />
          <FilterSelect
            value={filters.paymentMode}
            onChange={(v) => updateFilters({ paymentMode: v })}
            options={LEDGER_PAYMENT_MODES.map((m) => ({ value: m, label: paymentModeLabel(m) }))}
            placeholder="Any mode"
          />
        </div>
        <DateRangeInputs from={filters.from} to={filters.to} onChange={(range) => updateFilters(range)} />
        <ResetButton onClick={resetFilters} visible={filtersActive} />
      </FilterBar>

      {error && !data ? (
        <EmptyState title="Could not load income" message={error} action={<Button onClick={() => refetch()}>Retry</Button>} />
      ) : (
        <Table
          columns={columns}
          data={rows}
          loading={loading}
          minWidth="min-w-[720px]"
          empty={
            <EmptyState
              icon={Wallet}
              title={filtersActive ? 'No income matches these filters' : 'No income recorded yet'}
              message="Income from orders appears once an order is Delivered and Paid."
            />
          }
        />
      )}

      <Pagination pagination={data && data.pagination} onPageChange={setPage} className="mt-4" />

      <IncomeFormModal open={modal.open} entry={modal.entry} onClose={() => setModal({ open: false, entry: null })} onSaved={() => refetch({ silent: true })} />

      <ConfirmDialog
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        loading={deleting}
        title="Delete this income entry?"
        message={toDelete ? `${formatCurrency(toDelete.amount)} on ${formatDate(toDelete.date)} will be removed.` : ''}
        confirmText="Delete"
      />
    </div>
  );
}
