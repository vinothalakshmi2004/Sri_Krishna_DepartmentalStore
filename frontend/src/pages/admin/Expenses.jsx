/**
 * Expenses: add / edit / delete, filters, totals and category summary chart.
 */
import { useState } from 'react';
import toast from 'react-hot-toast';
import { ChartColumn, Pencil, Plus, Receipt, Trash2 } from 'lucide-react';
import { expensesApi } from '../../api/adminApi';
import { getErrorMessage } from '../../api/client';
import useFetch from '../../hooks/useFetch';
import useDebounce from '../../hooks/useDebounce';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { EXPENSE_CATEGORIES, LEDGER_PAYMENT_MODES, paymentModeLabel } from '../../utils/constants';
import { formatCurrency, formatDate } from '../../utils/format';
import { describeRange } from '../../utils/dateRange';
import PageHeader from '../../components/admin/PageHeader';
import FilterBar, { DateRangeInputs, FilterSelect, ResetButton, SearchInput } from '../../components/admin/FilterBar';
import { ExpenseFormModal } from '../../components/admin/LedgerFormModals';
import { ExpenseCategoryChart } from '../../components/admin/Charts';
import StatCard from '../../components/ui/StatCard';
import Card from '../../components/ui/Card';
import Table from '../../components/ui/Table';
import Pagination from '../../components/ui/Pagination';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import EmptyState from '../../components/ui/EmptyState';
import Button from '../../components/ui/Button';
import Badge, { PaymentModeBadge } from '../../components/ui/Badge';
import { Skeleton } from '../../components/ui/Loader';

const EMPTY_FILTERS = { category: '', paymentMode: '', from: '', to: '' };
const CATEGORY_COLORS = { Purchase: 'blue', Salary: 'purple', Rent: 'indigo', Electricity: 'amber', Transport: 'teal', Other: 'gray' };

export default function Expenses() {
  useDocumentTitle('Expenses');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState({ open: false, entry: null });
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const debouncedSearch = useDebounce(search, 400);

  const params = { ...filters, search: debouncedSearch.trim(), page, limit: 20 };
  const { data, loading, error, refetch } = useFetch(() => expensesApi.list(params), [JSON.stringify(params)]);
  const rows = data ? data.data : [];

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
      await expensesApi.remove(toDelete._id);
      toast.success('Expense deleted');
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
      key: 'title',
      header: 'Title',
      render: (r) => (
        <div className="max-w-xs">
          <p className="truncate font-medium text-slate-800">{r.title}</p>
          {r.note && <p className="truncate text-xs text-slate-500">{r.note}</p>}
        </div>
      ),
    },
    { key: 'category', header: 'Category', render: (r) => <Badge color={CATEGORY_COLORS[r.category]}>{r.category}</Badge> },
    { key: 'amount', header: 'Amount', render: (r) => <span className="whitespace-nowrap font-semibold text-red-600">{formatCurrency(r.amount)}</span> },
    { key: 'mode', header: 'Mode', render: (r) => <PaymentModeBadge mode={r.paymentMode} /> },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (r) => (
        <div className="flex justify-end gap-1">
          <Button size="icon" variant="ghost" onClick={() => setModal({ open: true, entry: r })} aria-label="Edit" title="Edit">
            <Pencil className="size-4" />
          </Button>
          <Button size="icon" variant="ghost" className="text-red-500 hover:bg-red-50" onClick={() => setToDelete(r)} aria-label="Delete" title="Delete">
            <Trash2 className="size-4" />
          </Button>
        </div>
      ),
    },
  ];

  const rangeLabel = filters.from || filters.to ? describeRange(filters.from, filters.to) : 'All time';
  const summary = (data && data.categorySummary) || [];
  const topCategory = summary[0];

  return (
    <div>
      <PageHeader
        title="Expenses"
        description="Track purchases, salaries, rent, electricity and other costs."
        actions={
          <Button icon={Plus} onClick={() => setModal({ open: true, entry: null })}>
            Add expense
          </Button>
        }
      />

      <div className="mb-5 grid gap-4 lg:grid-cols-3">
        <div className="grid content-start gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <StatCard icon={Receipt} tone="red" label="Total expenses" value={formatCurrency(data?.totalAmount)} hint={rangeLabel} loading={loading && !data} />
          <StatCard
            icon={ChartColumn}
            tone="amber"
            label="Biggest category"
            value={topCategory ? topCategory.category : '—'}
            hint={topCategory ? `${formatCurrency(topCategory.total)} · ${topCategory.count} entr${topCategory.count === 1 ? 'y' : 'ies'}` : 'No expenses yet'}
            loading={loading && !data}
          />
        </div>
        <Card title="By category" description={rangeLabel} icon={ChartColumn} className="lg:col-span-2">
          {loading && !data ? <Skeleton className="h-48 w-full rounded-xl" /> : <ExpenseCategoryChart data={summary} />}
        </Card>
      </div>

      <FilterBar>
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search title or note" className="lg:w-60" />
        <div className="grid grid-cols-2 gap-3 lg:flex">
          <FilterSelect value={filters.category} onChange={(v) => updateFilters({ category: v })} options={EXPENSE_CATEGORIES} placeholder="All categories" />
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
        <EmptyState title="Could not load expenses" message={error} action={<Button onClick={() => refetch()}>Retry</Button>} />
      ) : (
        <Table
          columns={columns}
          data={rows}
          loading={loading}
          minWidth="min-w-[720px]"
          empty={
            <EmptyState
              icon={Receipt}
              title={filtersActive ? 'No expenses match these filters' : 'No expenses yet'}
              message="Record purchases, salaries and bills to see your real profit."
              action={!filtersActive && <Button icon={Plus} onClick={() => setModal({ open: true, entry: null })}>Add expense</Button>}
            />
          }
        />
      )}

      <Pagination pagination={data && data.pagination} onPageChange={setPage} className="mt-4" />

      <ExpenseFormModal open={modal.open} entry={modal.entry} onClose={() => setModal({ open: false, entry: null })} onSaved={() => refetch({ silent: true })} />

      <ConfirmDialog
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        loading={deleting}
        title="Delete this expense?"
        message={toDelete ? `"${toDelete.title}" (${formatCurrency(toDelete.amount)}) will be removed.` : ''}
        confirmText="Delete"
      />
    </div>
  );
}
