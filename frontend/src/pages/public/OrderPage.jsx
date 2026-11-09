/**
 * Products page (/order): search, category chips, the product grid and the
 * "Your own order" button (customer types items that are not listed).
 */
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { BadgePercent, NotebookPen, PackageSearch, Search, WifiOff, X } from 'lucide-react';
import { publicApi } from '../../api/publicApi';
import { useCart } from '../../context/CartContext';
import { useStore } from '../../context/StoreContext';
import useFetch from '../../hooks/useFetch';
import useDebounce from '../../hooks/useDebounce';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import useRefetchOnFocus from '../../hooks/useRefetchOnFocus';
import { deliveryRule, hasOffer } from '../../utils/pricing';
import ProductCard from '../../components/public/ProductCard';
import OwnOrderModal from '../../components/public/OwnOrderModal';
import StoreClosedBanner from '../../components/public/StoreClosedBanner';
import { FloatingLeaves } from '../../components/public/Decor';
import { ProductGridSkeleton } from '../../components/ui/Loader';
import EmptyState from '../../components/ui/EmptyState';
import Button from '../../components/ui/Button';
import { Toggle } from '../../components/ui/FormControls';

// Special chip that shows only items with a live offer
const OFFERS_CHIP = '__offers';

export default function OrderPage() {
  useDocumentTitle('Order groceries');
  const { settings, isStoreOpen } = useStore();
  const { syncWithItems, customItems } = useCart();
  const [ownOpen, setOwnOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [category, setCategory] = useState(searchParams.get('category') || 'All');
  const [inStockOnly, setInStockOnly] = useState(false);
  const debouncedSearch = useDebounce(search, 250);

  const { data: items, loading, error, refetch } = useFetch(() => publicApi.getItems(), []);
  useRefetchOnFocus(() => refetch({ silent: true }));

  // Keep cart prices / stock in line with what the store sells now
  useEffect(() => {
    if (!items) return;
    const messages = syncWithItems(items);
    if (messages.length) toast(messages.join('\n'), { id: 'cart-sync', icon: 'ℹ️', duration: 6000 });
  }, [items, syncWithItems]);

  // Shareable URL: /order?category=Vegetables&search=tom
  useEffect(() => {
    const params = {};
    if (category !== 'All') params.category = category;
    if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
    setSearchParams(params, { replace: true });
  }, [category, debouncedSearch, setSearchParams]);

  const counts = useMemo(() => {
    const map = { All: (items || []).length, [OFFERS_CHIP]: 0 };
    (items || []).forEach((item) => {
      map[item.category] = (map[item.category] || 0) + 1;
      if (hasOffer(item)) map[OFFERS_CHIP] += 1;
    });
    return map;
  }, [items]);

  const categories = useMemo(() => {
    const names = [...new Set((items || []).map((item) => item.category))].sort((a, b) => a.localeCompare(b));
    return ['All', ...(counts[OFFERS_CHIP] > 0 ? [OFFERS_CHIP] : []), ...names];
  }, [items, counts]);

  const filtered = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    const list = (items || []).filter((item) => {
      if (category === OFFERS_CHIP) {
        if (!hasOffer(item)) return false;
      } else if (category !== 'All' && item.category !== category) return false;
      if (inStockOnly && !(item.stock > 0)) return false;
      if (!query) return true;
      return [item.name, item.category, item.description].some((text) => (text || '').toLowerCase().includes(query));
    });
    // In-stock items first
    return list.sort((a, b) => Number(b.stock > 0) - Number(a.stock > 0));
  }, [items, category, inStockOnly, debouncedSearch]);

  const clearFilters = () => {
    setSearch('');
    setCategory('All');
    setInStockOnly(false);
  };

  return (
    <div className="bg-white">
      {/* Header */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-50 via-white to-beige">
        <FloatingLeaves className="opacity-70" />
        <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
          <h1 className="text-3xl font-bold sm:text-4xl">Shop fresh groceries</h1>
          <p className="mt-2 text-sm text-slate-600 sm:text-base">
            Add items to your cart and pay on delivery.
            {deliveryRule(settings) && <span className="font-medium text-brand-700"> {deliveryRule(settings)}.</span>}
          </p>
          <div className="mt-5 flex max-w-2xl flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search rice, dal, milk, vegetables..."
                className="w-full rounded-2xl border border-brand-100 bg-white py-3.5 pl-12 pr-11 text-base shadow-card transition placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100"
                aria-label="Search products"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-100"
                  aria-label="Clear search"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
            <OwnOrderButton count={customItems.length} onClick={() => setOwnOpen(true)} />
          </div>
          <StoreClosedBanner className="mt-5 max-w-2xl" />
        </div>
      </section>

      {/* Category chips (sticky under the navbar) */}
      <div className="sticky top-16 z-20 border-b border-slate-100 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="no-scrollbar -mx-1 flex flex-1 gap-2 overflow-x-auto px-1">
            {categories.map((name) => {
              const active = name === category;
              const isOffers = name === OFFERS_CHIP;
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => setCategory(name)}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 ${
                    active
                      ? isOffers
                        ? 'bg-amber-400 text-amber-950 shadow-soft'
                        : 'bg-brand-500 text-on-brand shadow-soft'
                      : isOffers
                        ? 'bg-amber-50 text-amber-800 ring-1 ring-amber-200 hover:bg-amber-100'
                        : 'bg-brand-50 text-brand-800 hover:bg-brand-100'
                  }`}
                  aria-pressed={active}
                >
                  {isOffers && <BadgePercent className="size-4" />}
                  {isOffers ? 'Offers' : name}
                  <span className={`text-xs ${active ? (isOffers ? 'text-amber-900' : 'text-brand-100') : isOffers ? 'text-amber-700' : 'text-brand-600/70'}`}>
                    {counts[name] || 0}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="hidden shrink-0 items-center gap-2 sm:flex">
            <span className="text-sm text-slate-600">In stock only</span>
            <Toggle size="sm" checked={inStockOnly} onChange={setInStockOnly} />
          </div>
        </div>
      </div>

      {/* Products */}
      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {!loading && !error && (
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-sm text-slate-500">
              {filtered.length} product{filtered.length === 1 ? '' : 's'}
              {category === OFFERS_CHIP && <> on <span className="font-medium text-amber-700">offer</span></>}
              {category !== 'All' && category !== OFFERS_CHIP && <> in <span className="font-medium text-brand-800">{category}</span></>}
            </p>
            <div className="flex items-center gap-2 sm:hidden">
              <span className="text-xs text-slate-600">In stock</span>
              <Toggle size="sm" checked={inStockOnly} onChange={setInStockOnly} />
            </div>
          </div>
        )}

        {loading && <ProductGridSkeleton count={8} />}

        {!loading && error && (
          <EmptyState
            icon={WifiOff}
            title="Could not load products"
            message={error}
            action={<Button onClick={() => refetch()}>Try again</Button>}
          />
        )}

        {!loading && !error && filtered.length === 0 && (
          <EmptyState
            icon={PackageSearch}
            title="No products found"
            message={
              search
                ? `Nothing matches "${search}". Try another word, or type it in "Your own order" and the store will get it for you.`
                : 'No products in this category right now.'
            }
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="outline" onClick={clearFilters}>Clear filters</Button>
                <Button icon={NotebookPen} onClick={() => setOwnOpen(true)}>Your own order</Button>
              </div>
            }
          />
        )}

        {!loading && !error && filtered.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
            {filtered.map((item) => (
              <ProductCard key={item._id} item={item} storeClosed={!isStoreOpen} />
            ))}
          </div>
        )}
      </section>

      <OwnOrderModal open={ownOpen} onClose={() => setOwnOpen(false)} />
    </div>
  );
}

/** Opens the "Your own order" window; shows how many items are in the list */
function OwnOrderButton({ count, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-brand-300 bg-white px-5 py-3 text-base font-semibold text-brand-800 shadow-card transition hover:border-brand-500 hover:bg-brand-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-100 active:scale-[0.98]"
    >
      <NotebookPen className="size-5 text-brand-600" />
      Your own order
      {count > 0 && (
        <span className="flex min-w-6 items-center justify-center rounded-full bg-brand-500 px-1.5 text-xs font-bold leading-6 text-on-brand">
          {count}
        </span>
      )}
    </button>
  );
}
