/**
 * Customers (built from orders, grouped by phone number) and their order history.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, MapPin, Phone, ShoppingBag, Users } from 'lucide-react';
import { customersApi } from '../../api/adminApi';
import useFetch from '../../hooks/useFetch';
import useDebounce from '../../hooks/useDebounce';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { formatCurrency, formatDate, formatDateTime, initials } from '../../utils/format';
import { telLink, whatsappLink } from '../../utils/links';
import PageHeader from '../../components/admin/PageHeader';
import FilterBar, { FilterSelect, SearchInput } from '../../components/admin/FilterBar';
import Table from '../../components/ui/Table';
import Pagination from '../../components/ui/Pagination';
import Modal from '../../components/ui/Modal';
import EmptyState from '../../components/ui/EmptyState';
import Button from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Loader';
import { PaymentBadge, StatusBadge } from '../../components/ui/Badge';
import { WhatsAppIcon } from '../../components/public/Decor';

const SORT_OPTIONS = [
  { value: '-totalSpent', label: 'Top spenders' },
  { value: '-totalOrders', label: 'Most orders' },
  { value: 'name', label: 'Name A-Z' },
  { value: 'firstOrderDate', label: 'Oldest customers' },
];

function Avatar({ name }) {
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-300 to-brand-500 text-sm font-semibold text-on-brand">
      {initials(name)}
    </span>
  );
}

function CustomerModal({ phone, onClose }) {
  const navigate = useNavigate();
  const { data: customer, loading, error } = useFetch(() => (phone ? customersApi.get(phone) : Promise.resolve(null)), [phone]);

  return (
    <Modal open={Boolean(phone)} onClose={onClose} size="xl" title={customer ? customer.name : 'Customer'} description={phone}>
      {loading && (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
      )}
      {!loading && error && <EmptyState compact title="Could not load customer" message={error} />}
      {!loading && customer && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <Avatar name={customer.name} />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-800">{customer.name}</p>
              <p className="flex items-center gap-1.5 text-sm text-slate-500">
                <MapPin className="size-3.5" /> {customer.lastAddress}
                {customer.lastLandmark ? `, ${customer.lastLandmark}` : ''} - {customer.lastPincode}
              </p>
            </div>
            <Button size="sm" variant="secondary" icon={Phone} href={telLink(customer.phone)}>
              Call
            </Button>
            <Button size="sm" variant="whatsapp" icon={WhatsAppIcon} href={whatsappLink(customer.phone)} target="_blank" rel="noopener noreferrer">
              WhatsApp
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['Total orders', customer.totalOrders],
              ['Delivered', customer.deliveredOrders],
              ['Total spent', formatCurrency(customer.totalSpent)],
              ['Customer since', formatDate(customer.firstOrderDate)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-brand-50/70 p-3">
                <p className="text-xs text-slate-500">{label}</p>
                <p className="mt-0.5 font-semibold text-slate-800">{value}</p>
              </div>
            ))}
          </div>

          <div>
            <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Order history</h4>
            <Table
              minWidth="min-w-[600px]"
              data={customer.orders}
              onRowClick={(o) => navigate(`/admin/orders?open=${o.orderId}`)}
              columns={[
                { key: 'orderId', header: 'Order', render: (o) => <span className="font-semibold text-slate-800">{o.orderId}</span> },
                { key: 'date', header: 'Date', render: (o) => <span className="whitespace-nowrap text-slate-600">{formatDateTime(o.createdAt)}</span> },
                { key: 'items', header: 'Items', render: (o) => o.items.length + (o.customItems ? o.customItems.length : 0) },
                { key: 'amount', header: 'Amount', render: (o) => <span className="font-semibold">{formatCurrency(o.grandTotal)}</span> },
                { key: 'status', header: 'Status', render: (o) => <StatusBadge status={o.status} /> },
                { key: 'payment', header: 'Payment', render: (o) => <PaymentBadge status={o.paymentStatus} /> },
              ]}
            />
          </div>
        </div>
      )}
    </Modal>
  );
}

export default function Customers() {
  useDocumentTitle('Customers');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('-lastOrderDate');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const debouncedSearch = useDebounce(search, 400);

  const params = { search: debouncedSearch.trim(), sort, page, limit: 20 };
  const { data, loading, error, refetch } = useFetch(() => customersApi.list(params), [JSON.stringify(params)]);
  const rows = data ? data.data : [];

  const columns = [
    {
      key: 'name',
      header: 'Customer',
      render: (c) => (
        <div className="flex items-center gap-3">
          <Avatar name={c.name} />
          <div className="min-w-0">
            <p className="max-w-[200px] truncate font-semibold text-slate-800">{c.name}</p>
            <p className="max-w-[220px] truncate text-xs text-slate-500">{c.lastAddress}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'phone',
      header: 'Phone',
      render: (c) => (
        <a href={telLink(c.phone)} onClick={(e) => e.stopPropagation()} className="whitespace-nowrap text-brand-700 hover:underline">
          {c.phone}
        </a>
      ),
    },
    {
      key: 'orders',
      header: 'Orders',
      render: (c) => (
        <div>
          <p className="font-semibold text-slate-800">{c.totalOrders}</p>
          {c.cancelledOrders > 0 && <p className="text-xs text-red-500">{c.cancelledOrders} cancelled</p>}
        </div>
      ),
    },
    { key: 'spent', header: 'Total spent', render: (c) => <span className="whitespace-nowrap font-semibold text-brand-800">{formatCurrency(c.totalSpent)}</span> },
    { key: 'last', header: 'Last order', render: (c) => <span className="whitespace-nowrap text-slate-600">{formatDate(c.lastOrderDate)}</span> },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (c) => (
        <Button size="xs" variant="ghost" icon={Eye} onClick={(e) => { e.stopPropagation(); setSelected(c.phone); }}>
          History
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Customers" description="Everyone who has ordered, grouped by phone number." />

      <FilterBar>
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search name or phone" className="lg:w-72" />
        <FilterSelect
          value={sort === '-lastOrderDate' ? '' : sort}
          onChange={(v) => { setSort(v || '-lastOrderDate'); setPage(1); }}
          options={SORT_OPTIONS}
          placeholder="Recent first"
          ariaLabel="Sort customers"
        />
        {data && (
          <p className="text-sm text-slate-500 lg:ml-auto">
            <Users className="mr-1 inline size-4 text-brand-600" />
            {data.pagination.total} customer{data.pagination.total === 1 ? '' : 's'}
          </p>
        )}
      </FilterBar>

      {error && !data ? (
        <EmptyState title="Could not load customers" message={error} action={<Button onClick={() => refetch()}>Retry</Button>} />
      ) : (
        <Table
          columns={columns}
          data={rows}
          rowKey="phone"
          loading={loading}
          onRowClick={(c) => setSelected(c.phone)}
          minWidth="min-w-[760px]"
          empty={<EmptyState icon={ShoppingBag} title={search ? 'No customers found' : 'No customers yet'} message="Customers appear here after their first order." />}
        />
      )}

      <Pagination pagination={data && data.pagination} onPageChange={setPage} className="mt-4" />

      <CustomerModal phone={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
