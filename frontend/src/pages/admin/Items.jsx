/**
 * Items management: grid/table view, search, filters, quick price & stock
 * edits, availability toggle, add/edit modal, barcode scanning and delete.
 */
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Images, LayoutGrid, List, Package, Pencil, Plus, ScanBarcode, Trash2 } from 'lucide-react';
import { itemsApi } from '../../api/adminApi';
import { getErrorMessage } from '../../api/client';
import useFetch from '../../hooks/useFetch';
import useDebounce from '../../hooks/useDebounce';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import useScannerGun from '../../hooks/useScannerGun';
import { formatCurrency, formatQty } from '../../utils/format';
import PageHeader from '../../components/admin/PageHeader';
import FilterBar, { FilterSelect, ResetButton, SearchInput } from '../../components/admin/FilterBar';
import InlineNumberEdit from '../../components/admin/InlineNumberEdit';
import ItemFormModal from '../../components/admin/ItemFormModal';
import BarcodeScanner from '../../components/admin/BarcodeScanner';
import ProductImage from '../../components/public/ProductImage';
import Table from '../../components/ui/Table';
import Pagination from '../../components/ui/Pagination';
import SegmentedControl from '../../components/ui/SegmentedControl';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import EmptyState from '../../components/ui/EmptyState';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { Toggle } from '../../components/ui/FormControls';
import { Skeleton } from '../../components/ui/Loader';

const VIEW_KEY = 'greenmart_items_view';
const AVAILABILITY_OPTIONS = [
  { value: 'true', label: 'Available' },
  { value: 'false', label: 'Hidden' },
  { value: 'lowStock', label: 'Low stock' },
];
const SORT_OPTIONS = [
  { value: '-createdAt', label: 'Newest first' },
  { value: 'price', label: 'Price: low to high' },
  { value: '-price', label: 'Price: high to low' },
  { value: 'stock', label: 'Stock: low to high' },
  { value: 'category', label: 'Category' },
];

const readView = () => {
  try {
    return localStorage.getItem(VIEW_KEY) === 'grid' ? 'grid' : 'table';
  } catch {
    return 'table';
  }
};

function StockBadge({ item }) {
  if (item.stock <= 0) return <Badge color="red">Out of stock</Badge>;
  if (item.stock <= item.lowStockLimit) return <Badge color="amber">Low stock</Badge>;
  return null;
}

export default function Items() {
  useDocumentTitle('Items');
  const [searchParams] = useSearchParams();
  const [view, setView] = useState(readView);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [availability, setAvailability] = useState({ lowStock: 'lowStock', hidden: 'false' }[searchParams.get('filter')] || '');
  const [sort, setSort] = useState('name');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState({ open: false, item: null, prefill: null });
  const [scanOpen, setScanOpen] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const debouncedSearch = useDebounce(search, 350);

  const params = {
    search: debouncedSearch.trim(),
    category,
    isAvailable: availability === 'true' || availability === 'false' ? availability : '',
    lowStock: availability === 'lowStock' ? 'true' : '',
    sort,
    page,
    limit: 48,
  };
  const { data, setData, loading, error, refetch } = useFetch(() => itemsApi.list(params), [JSON.stringify(params)]);
  const categories = useFetch(() => itemsApi.categories(), [], { initialData: [] });
  const items = data ? data.data : [];

  const changeView = (value) => {
    setView(value);
    try {
      localStorage.setItem(VIEW_KEY, value);
    } catch {
      /* ignore */
    }
  };

  const replaceItem = (updated) =>
    setData((prev) => (prev ? { ...prev, data: prev.data.map((i) => (i._id === updated._id ? updated : i)) } : prev));

  const savePrice = async (item, price) => {
    // A hidden item without a price (e.g. saved by bulk upload) is shown to customers once it gets a price
    const showNow = !item.isAvailable && !(item.price > 0) && price > 0;
    try {
      const res = await itemsApi.update(item._id, showNow ? { price, isAvailable: true } : { price });
      replaceItem(res.data);
      toast.success(`${item.name}: price is now ${formatCurrency(price)}${showNow ? ' and it is shown to customers' : ''}`);
    } catch (err) {
      toast.error(getErrorMessage(err));
      throw err;
    }
  };

  const saveStock = async (item, stock) => {
    try {
      const res = await itemsApi.updateStock(item._id, { stock });
      replaceItem(res.data);
      toast.success(`${item.name}: stock is now ${formatQty(stock, item.unit)}`);
    } catch (err) {
      toast.error(getErrorMessage(err));
      throw err;
    }
  };

  const toggleAvailability = async (item, value) => {
    replaceItem({ ...item, isAvailable: value }); // optimistic
    try {
      const res = await itemsApi.toggleAvailability(item._id, value);
      replaceItem(res.data);
      toast.success(res.message);
    } catch (err) {
      replaceItem(item);
      toast.error(getErrorMessage(err));
    }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await itemsApi.remove(toDelete._id);
      toast.success(`${toDelete.name} deleted`);
      setToDelete(null);
      refetch({ silent: true });
      categories.refetch({ silent: true });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  const onSaved = (saved) => {
    if (modal.item) replaceItem(saved);
    else refetch({ silent: true });
    categories.refetch({ silent: true });
  };

  /** Scanned barcode: edit the item that has it, or add a new item filled with the details found online */
  const openScanned = async (code) => {
    setScanOpen(false);
    const toastId = toast.loading(`Looking up barcode ${code}...`);
    try {
      const result = await itemsApi.lookupBarcode(code);
      if (result.item) {
        toast.success(`${result.item.name} is already in your store`, { id: toastId });
        setModal({ open: true, item: result.item, prefill: null });
      } else {
        toast.dismiss(toastId);
        setModal({ open: true, item: null, prefill: result });
      }
    } catch (err) {
      toast.dismiss(toastId);
      setModal({ open: true, item: null, prefill: { barcode: code, item: null, product: null, error: getErrorMessage(err) } });
    }
  };

  // A USB barcode scanner works anywhere on this page
  useScannerGun(openScanned, !modal.open && !scanOpen && !toDelete);

  const resetFilters = () => {
    setSearch('');
    setCategory('');
    setAvailability('');
    setSort('name');
    setPage(1);
  };
  const filtersActive = Boolean(search || category || availability || sort !== 'name');

  const actions = (item) => (
    <div className="flex items-center justify-end gap-1">
      <Button size="icon" variant="ghost" onClick={() => setModal({ open: true, item })} aria-label={`Edit ${item.name}`} title="Edit">
        <Pencil className="size-4" />
      </Button>
      <Button size="icon" variant="ghost" className="text-red-500 hover:bg-red-50 hover:text-red-600" onClick={() => setToDelete(item)} aria-label={`Delete ${item.name}`} title="Delete">
        <Trash2 className="size-4" />
      </Button>
    </div>
  );

  const columns = [
    {
      key: 'item',
      header: 'Item',
      render: (item) => (
        <div className="flex items-center gap-3">
          <ProductImage src={item.image} alt={item.name} className="size-12 shrink-0 rounded-xl" iconClass="size-5" />
          <div className="min-w-0">
            <p className="max-w-[220px] truncate font-semibold text-slate-800">{item.name}</p>
            <p className="text-xs text-slate-500">{item.category}</p>
            {item.barcode && <p className="font-mono text-[11px] text-slate-400">{item.barcode}</p>}
          </div>
        </div>
      ),
    },
    {
      key: 'price',
      header: 'Price',
      render: (item) => <InlineNumberEdit value={item.price} format={formatCurrency} suffix={`/ ${item.unit}`} step="0.01" label="price" onSave={(v) => savePrice(item, v)} />,
    },
    {
      key: 'stock',
      header: 'Stock',
      render: (item) => (
        <div className="flex flex-col items-start gap-1">
          <InlineNumberEdit value={item.stock} format={(v) => formatQty(v, item.unit)} label="stock" onSave={(v) => saveStock(item, v)} />
          <StockBadge item={item} />
        </div>
      ),
    },
    {
      key: 'available',
      header: 'Available',
      render: (item) => <Toggle size="sm" checked={item.isAvailable} onChange={(v) => toggleAvailability(item, v)} />,
    },
    { key: 'actions', header: '', className: 'text-right', render: actions },
  ];

  const empty = (
    <EmptyState
      icon={Package}
      title={filtersActive ? 'No items match these filters' : 'No items yet'}
      message={filtersActive ? 'Try changing the search or filters.' : 'Add your first product to start taking orders.'}
      action={
        filtersActive ? (
          <Button variant="outline" onClick={resetFilters}>Reset filters</Button>
        ) : (
          <Button icon={Plus} onClick={() => setModal({ open: true, item: null })}>Add item</Button>
        )
      }
    />
  );

  return (
    <div>
      <PageHeader
        title="Items"
        description="Changes here show up on the customer order page immediately. Click a price or stock to edit it."
        actions={
          <>
            <SegmentedControl
              size="sm"
              value={view}
              onChange={changeView}
              options={[
                { value: 'table', label: 'Table', icon: List },
                { value: 'grid', label: 'Grid', icon: LayoutGrid },
              ]}
            />
            <Button variant="outline" icon={ScanBarcode} onClick={() => setScanOpen(true)}>
              Scan barcode
            </Button>
            <Button variant="outline" icon={Images} to="/admin/items/bulk">
              Bulk upload
            </Button>
            <Button icon={Plus} onClick={() => setModal({ open: true, item: null })}>
              Add item
            </Button>
          </>
        }
      />

      <FilterBar>
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search items or barcode" className="lg:w-72" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:flex">
          <FilterSelect value={category} onChange={(v) => { setCategory(v); setPage(1); }} options={categories.data || []} placeholder="All categories" />
          <FilterSelect value={availability} onChange={(v) => { setAvailability(v); setPage(1); }} options={AVAILABILITY_OPTIONS} placeholder="All items" />
          <FilterSelect value={sort === 'name' ? '' : sort} onChange={(v) => { setSort(v || 'name'); setPage(1); }} options={SORT_OPTIONS} placeholder="Name A-Z" className="col-span-2 sm:col-span-1" ariaLabel="Sort items" />
        </div>
        <ResetButton onClick={resetFilters} visible={filtersActive} />
      </FilterBar>

      {error && !data && <EmptyState title="Could not load items" message={error} action={<Button onClick={() => refetch()}>Retry</Button>} />}

      {view === 'table' && (!error || data) && (
        <Table columns={columns} data={items} loading={loading} empty={empty} minWidth="min-w-[760px]" />
      )}

      {view === 'grid' && (!error || data) && (
        <>
          {loading && !data && (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => <Skeleton key={i} className="h-72 rounded-2xl" />)}
            </div>
          )}
          {!loading && items.length === 0 && <div className="rounded-2xl border border-slate-100 bg-white">{empty}</div>}
          {items.length > 0 && (
            <div className={`grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4 ${loading ? 'opacity-60' : ''}`}>
              {items.map((item) => (
                <div key={item._id} className={`flex flex-col overflow-hidden rounded-2xl border bg-white shadow-card transition hover:shadow-soft ${item.isAvailable ? 'border-slate-100' : 'border-dashed border-slate-300'}`}>
                  <div className="relative">
                    <ProductImage src={item.image} alt={item.name} className={`aspect-[4/3] w-full ${item.isAvailable ? '' : 'opacity-50 grayscale'}`} />
                    <div className="absolute right-2 top-2 rounded-full bg-white/90 p-1 shadow-sm">
                      <Toggle size="sm" checked={item.isAvailable} onChange={(v) => toggleAvailability(item, v)} />
                    </div>
                    <div className="absolute left-2 top-2">
                      <StockBadge item={item} />
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col p-3">
                    <p className="truncate font-semibold text-slate-800">{item.name}</p>
                    <p className="truncate text-xs text-slate-500">{item.category}</p>
                    <div className="mt-2 space-y-1 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-slate-500">Price</span>
                        <InlineNumberEdit value={item.price} format={formatCurrency} suffix={`/${item.unit}`} step="0.01" label="price" onSave={(v) => savePrice(item, v)} />
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-slate-500">Stock</span>
                        <InlineNumberEdit value={item.stock} format={(v) => formatQty(v, item.unit)} label="stock" onSave={(v) => saveStock(item, v)} />
                      </div>
                    </div>
                    <div className="mt-auto flex justify-end border-t border-slate-100 pt-2">{actions(item)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <Pagination pagination={data && data.pagination} onPageChange={setPage} className="mt-4" />

      <ItemFormModal
        open={modal.open}
        item={modal.item}
        prefill={modal.prefill}
        categories={categories.data || []}
        onClose={() => setModal({ open: false, item: null, prefill: null })}
        onSaved={onSaved}
        onOpenItem={(existing) => setModal({ open: true, item: existing, prefill: null })}
      />

      <BarcodeScanner open={scanOpen} onClose={() => setScanOpen(false)} onDetected={openScanned} />

      <ConfirmDialog
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        loading={deleting}
        title={`Delete ${toDelete ? toDelete.name : 'item'}?`}
        message="It will be removed from the store. Past orders keep their own copy of the item details."
        confirmText="Delete item"
      />
    </div>
  );
}
