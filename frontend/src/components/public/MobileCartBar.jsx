import { Link } from 'react-router-dom';
import { ChevronRight, ShoppingBasket } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useStore } from '../../context/StoreContext';
import { formatCurrency } from '../../utils/format';

/** Sticky bottom cart summary on phones (hidden on md+ screens). */
export default function MobileCartBar() {
  const { count, subtotal, customItems } = useCart();
  const { settings } = useStore();
  if (count === 0) return null;

  // How much more is needed for home delivery (minimum order from Store Settings)
  const minOrder = Number(settings && settings.minOrderAmount) || 0;
  // (own typed-in items are priced by the store, so no minimum is shown then)
  const shortBy = customItems.length ? 0 : Math.max(minOrder - subtotal, 0);

  return (
    <div className="fixed inset-x-3 bottom-3 z-30 animate-slide-up md:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <Link
        to="/cart"
        className="flex items-center justify-between gap-3 rounded-2xl bg-brand-800 px-4 py-3 text-white shadow-2xl shadow-brand-900/30 transition active:scale-[0.99]"
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/15">
            <ShoppingBasket className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs text-brand-100">
              {count} item{count === 1 ? '' : 's'}
              {shortBy > 0 && <span className="font-semibold text-amber-200"> · add {formatCurrency(shortBy)} for delivery</span>}
            </p>
            <p className="truncate text-base font-semibold">
              {subtotal > 0 ? formatCurrency(subtotal) : 'Your own order'}
              {subtotal > 0 && customItems.length > 0 && <span className="text-xs font-normal text-brand-100"> + own items</span>}
            </p>
          </div>
        </div>
        <span className="flex items-center gap-1 rounded-xl bg-white px-3.5 py-2 text-sm font-semibold text-brand-800">
          View Cart <ChevronRight className="size-4" />
        </span>
      </Link>
    </div>
  );
}
