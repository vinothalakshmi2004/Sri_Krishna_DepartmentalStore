import { formatCurrency } from '../../utils/format';
import { discountPercent, hasOffer } from '../../utils/pricing';
import ProductImage from './ProductImage';
import CartAction from './CartAction';

/**
 * Product tile: image, name, unit, price and an "Add to Cart" button that
 * turns into +/- controls once the item is in the cart.
 * Designed for a 2-column grid on phones (fits screens down to 320px).
 */
export default function ProductCard({ item, storeClosed = false }) {
  const outOfStock = !(item.stock > 0);
  const onOffer = hasOffer(item);

  return (
    <article className="group flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-card transition duration-300 hover:-translate-y-1 hover:border-brand-100 hover:shadow-soft">
      <div className="relative aspect-square overflow-hidden">
        <ProductImage src={item.image} alt={item.name} className="size-full transition duration-500 group-hover:scale-105" />
        {item.category && (
          <span
            className={`absolute left-2 top-2 truncate rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-medium text-brand-800 shadow-sm backdrop-blur sm:text-xs ${
              onOffer ? 'max-w-[50%]' : 'max-w-[85%]'
            }`}
          >
            {item.category}
          </span>
        )}
        {onOffer && (
          <span className="absolute right-2 top-2 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-extrabold text-amber-950 shadow-sm sm:text-xs">
            {discountPercent(item.price, item.originalPrice)}% OFF
          </span>
        )}
        {outOfStock && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/65 backdrop-blur-[1px]">
            <span className="rounded-full bg-slate-800/90 px-3 py-1 text-xs font-semibold text-white">Out of stock</span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-2.5 sm:p-4">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-slate-800 sm:text-base">{item.name}</h3>
        {item.description && (
          <div className="mt-1 hidden sm:block">
            <p className="line-clamp-2 text-xs text-slate-500">{item.description}</p>
          </div>
        )}

        <div className="mt-1.5 flex flex-wrap items-baseline gap-x-1.5">
          <span className="text-base font-bold text-brand-800 sm:text-lg">{formatCurrency(item.price)}</span>
          {onOffer && <span className="text-xs text-slate-400 line-through">{formatCurrency(item.originalPrice)}</span>}
          <span className="text-xs text-slate-500">/ {item.unit}</span>
        </div>

        <div className="mt-auto pt-2.5 sm:pt-3">
          <CartAction item={item} storeClosed={storeClosed} />
        </div>
      </div>
    </article>
  );
}
