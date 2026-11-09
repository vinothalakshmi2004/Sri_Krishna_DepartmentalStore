/**
 * "Offer Zone" on the landing page - live offers posted from the admin portal.
 *  - Offer products: 2 per row on phones (3-4 on bigger screens), add to cart right here.
 *  - Announcements (e.g. "Free delivery this Sunday"): wide banners.
 */
import { ArrowRight, BadgePercent, Clock, Megaphone, Sparkles } from 'lucide-react';
import { publicApi } from '../../api/publicApi';
import { useStore } from '../../context/StoreContext';
import useFetch from '../../hooks/useFetch';
import useRefetchOnFocus from '../../hooks/useRefetchOnFocus';
import { formatCurrency, formatDate } from '../../utils/format';
import { discountPercent, hasOffer } from '../../utils/pricing';
import Button from '../ui/Button';
import { Skeleton } from '../ui/Loader';
import ProductImage from './ProductImage';
import CartAction from './CartAction';
import { LeafShape } from './Decor';

const dayStart = (value) => {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
};

/** "Ends today", "Ends tomorrow", "Till 25-10-2026" */
const validityLabel = (endDate) => {
  if (!endDate) return 'Limited time';
  const days = Math.round((dayStart(endDate) - dayStart(new Date())) / 86400000);
  if (days <= 0) return 'Ends today';
  if (days === 1) return 'Ends tomorrow';
  return `Till ${formatDate(endDate)}`;
};

function Validity({ endDate }) {
  return (
    <p className="flex items-center gap-1 text-[11px] font-semibold text-red-600 sm:text-xs">
      <Clock className="size-3 shrink-0" /> <span className="truncate">{validityLabel(endDate)}</span>
    </p>
  );
}

/** Offer product - same footprint as a product card so it fits 2 per row on phones */
function OfferProductCard({ offer, storeClosed }) {
  const { item } = offer;
  const discounted = hasOffer(item);
  const badge = offer.badge || (discounted ? `${discountPercent(item.price, item.originalPrice)}% OFF` : '');

  return (
    <article className="group flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-amber-100 bg-white shadow-card transition duration-300 hover:-translate-y-1 hover:shadow-soft">
      <div className="relative aspect-square overflow-hidden">
        <ProductImage src={offer.image || item.image} alt={offer.title} className="size-full transition duration-500 group-hover:scale-105" />
        {badge && (
          <span className="absolute left-2 top-2 max-w-[85%] truncate rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-amber-950 shadow sm:text-xs">
            {badge}
          </span>
        )}
        {!item.inStock && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/65 backdrop-blur-[1px]">
            <span className="rounded-full bg-slate-800/90 px-3 py-1 text-xs font-semibold text-white">Out of stock</span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-2.5 sm:p-4">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-slate-800 sm:text-base">{offer.title}</h3>
        <div className="mt-1">
          <Validity endDate={offer.endDate} />
        </div>
        <div className="mt-1.5 flex flex-wrap items-baseline gap-x-1.5">
          <span className="text-base font-extrabold text-brand-800 sm:text-xl">{formatCurrency(item.price)}</span>
          {discounted && <span className="text-xs text-slate-400 line-through">{formatCurrency(item.originalPrice)}</span>}
          <span className="text-xs text-slate-500">/ {item.unit}</span>
        </div>
        {discounted && (
          <p className="text-[11px] font-semibold text-green-700 sm:text-xs">Save {formatCurrency(item.originalPrice - item.price)}</p>
        )}
        <div className="mt-auto pt-2.5 sm:pt-3">
          <CartAction item={item} storeClosed={storeClosed} />
        </div>
      </div>
    </article>
  );
}

/** Announcement - a wide banner (image on the left, text on the right) */
function AnnouncementBanner({ offer }) {
  return (
    <article className="flex min-w-0 overflow-hidden rounded-2xl border border-amber-100 bg-white shadow-card transition duration-300 hover:shadow-soft">
      <div className="relative w-28 shrink-0 sm:w-40">
        {offer.image ? (
          <ProductImage src={offer.image} alt={offer.title} className="absolute inset-0 size-full" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-brand-400 via-brand-500 to-brand-700">
            <Megaphone className="size-10 text-on-brand/90" strokeWidth={1.5} />
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 p-3 sm:p-4">
        {offer.badge && (
          <span className="w-fit max-w-full truncate rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-amber-950 sm:text-xs">
            {offer.badge}
          </span>
        )}
        <h3 className="line-clamp-2 text-sm font-bold leading-snug text-slate-800 sm:text-base">{offer.title}</h3>
        {offer.description && <p className="line-clamp-2 text-xs text-slate-500 sm:text-sm">{offer.description}</p>}
        <Validity endDate={offer.endDate} />
      </div>
    </article>
  );
}

export default function OfferZone() {
  const { isStoreOpen } = useStore();
  const { data: offers, loading, error, refetch } = useFetch(() => publicApi.getOffers(), []);
  useRefetchOnFocus(() => refetch({ silent: true }));

  const list = offers || [];
  const announcements = list.filter((o) => o.type !== 'item');
  const products = list.filter((o) => o.type === 'item' && o.item);

  return (
    <section id="offers" className="relative overflow-hidden bg-gradient-to-b from-white via-amber-50/70 to-white py-12 sm:py-16">
      <LeafShape className="pointer-events-none absolute -left-10 top-10 size-32 rotate-[-25deg] text-amber-100" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-amber-800">
              <BadgePercent className="size-3.5" /> Offer Zone
            </span>
            <h2 className="mt-3 text-2xl font-bold sm:text-3xl lg:text-4xl">Today&apos;s special offers</h2>
            <p className="mt-2 text-sm text-slate-600 sm:text-base">Fresh deals posted daily — grab them before they end!</p>
          </div>
          {products.length > 0 && (
            <Button to="/order?category=__offers" variant="outline" size="sm" iconRight={ArrowRight} className="sm:px-4 sm:py-2.5">
              All offer products
            </Button>
          )}
        </div>

        <div className="mt-6 sm:mt-8">
          {loading && (
            <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="aspect-[3/4] rounded-2xl" />
              ))}
            </div>
          )}

          {!loading && (error || list.length === 0) && (
            <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-amber-200 bg-white/70 px-6 py-10 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                <Sparkles className="size-6" />
              </span>
              <p className="font-semibold text-slate-800">No offers right now</p>
              <p className="max-w-sm text-sm text-slate-500">New deals are posted daily. Check back soon — or browse all our products.</p>
              <Button to="/order" size="sm" variant="secondary" iconRight={ArrowRight}>
                Shop products
              </Button>
            </div>
          )}

          {!loading && !error && announcements.length > 0 && (
            <div className="mb-4 grid gap-3 sm:mb-6 sm:gap-4 md:grid-cols-2">
              {announcements.map((offer) => (
                <AnnouncementBanner key={offer._id} offer={offer} />
              ))}
            </div>
          )}

          {!loading && !error && products.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
              {products.map((offer) => (
                <OfferProductCard key={offer._id} offer={offer} storeClosed={!isStoreOpen} />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
