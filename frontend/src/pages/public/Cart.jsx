/**
 * Cart page (/cart): edit quantities, see totals, go to checkout.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, ArrowRight, Banknote, NotebookPen, Pencil, ShoppingCart, Trash2, TriangleAlert } from 'lucide-react';
import { publicApi } from '../../api/publicApi';
import { useCart } from '../../context/CartContext';
import { useStore } from '../../context/StoreContext';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { calcCartTotals, minimumOrderMessage } from '../../utils/pricing';
import { formatCurrency } from '../../utils/format';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import ProductImage from '../../components/public/ProductImage';
import QuantityControl from '../../components/public/QuantityControl';
import OrderTotals from '../../components/public/OrderTotals';
import StoreClosedBanner from '../../components/public/StoreClosedBanner';
import OwnOrderModal from '../../components/public/OwnOrderModal';

export default function Cart() {
  useDocumentTitle('Your cart');
  const { items, customItems, subtotal, savings, increment, decrement, removeItem, removeCustomItem, clearCart, syncWithItems } = useCart();
  const { settings, isStoreOpen } = useStore();
  const [confirmClear, setConfirmClear] = useState(false);
  const [ownOpen, setOwnOpen] = useState(false);
  const totals = calcCartTotals(subtotal, settings, { hasCustomItems: customItems.length > 0 });
  const lineCount = items.length + customItems.length;

  // Refresh prices and stock from the server when the cart opens
  useEffect(() => {
    let active = true;
    publicApi
      .getItems()
      .then((list) => {
        if (!active) return;
        const messages = syncWithItems(list);
        if (messages.length) toast(messages.join('\n'), { id: 'cart-sync', icon: 'ℹ️', duration: 7000 });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [syncWithItems]);

  const canCheckout = lineCount > 0 && !totals.belowMinimum && isStoreOpen;

  if (lineCount === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <EmptyState
          icon={ShoppingCart}
          title="Your cart is empty"
          message="Add fresh groceries and daily essentials to get started, or type your own list."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button to="/order" size="lg" iconRight={ArrowRight}>
                Start shopping
              </Button>
              <Button variant="outline" size="lg" icon={NotebookPen} onClick={() => setOwnOpen(true)}>
                Your own order
              </Button>
            </div>
          }
        />
        <OwnOrderModal open={ownOpen} onClose={() => setOwnOpen(false)} />
      </div>
    );
  }

  return (
    <div className="bg-mint/50 pb-28 md:pb-0">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <Link to="/order" className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-800">
              <ArrowLeft className="size-4" /> Continue shopping
            </Link>
            <h1 className="mt-2 text-3xl font-bold">Your cart</h1>
            <p className="text-sm text-slate-500">
              {lineCount} item{lineCount === 1 ? '' : 's'}
            </p>
          </div>
          <Button variant="ghost" size="sm" icon={Trash2} onClick={() => setConfirmClear(true)} className="text-red-600 hover:bg-red-50 hover:text-red-700">
            Clear cart
          </Button>
        </div>

        <StoreClosedBanner className="mt-5" />

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Lines */}
          <div className="space-y-3 lg:col-span-2">
            {items.length > 0 && (
              <ul className="space-y-3">
                {items.map((line) => (
                  <li key={line._id} className="flex gap-3 rounded-2xl border border-slate-100 bg-white p-3 shadow-card sm:gap-4 sm:p-4">
                    <ProductImage src={line.image} alt={line.name} className="size-16 shrink-0 rounded-xl sm:size-24" iconClass="size-7" />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="truncate font-semibold text-slate-800">{line.name}</h3>
                          <p className="text-xs text-slate-500">
                            {formatCurrency(line.price)} / {line.unit}
                            {line.originalPrice > line.price && (
                              <>
                                {' '}
                                <span className="text-slate-400 line-through">{formatCurrency(line.originalPrice)}</span>{' '}
                                <span className="font-semibold text-amber-700">Offer</span>
                              </>
                            )}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeItem(line._id)}
                          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-500"
                          aria-label={`Remove ${line.name}`}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-3">
                        <QuantityControl
                          size="sm"
                          compact
                          quantity={line.quantity}
                          unit={line.unit}
                          onIncrement={() => increment(line._id)}
                          onDecrement={() => decrement(line._id)}
                          className="w-32 sm:w-36"
                        />
                        <p className="text-base font-bold text-brand-800">{formatCurrency(line.price * line.quantity)}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {/* Items the customer typed in ("Your own order") */}
            {customItems.length > 0 ? (
              <section className="rounded-2xl border border-amber-200 bg-white p-4 shadow-card">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="flex items-center gap-2 font-semibold text-slate-800">
                      <NotebookPen className="size-5 text-amber-500" /> Your own order ({customItems.length})
                    </h2>
                    <p className="mt-0.5 text-xs text-slate-500">The store will add the price and confirm with you.</p>
                  </div>
                  <Button size="sm" variant="outline" icon={Pencil} onClick={() => setOwnOpen(true)}>
                    Add / edit
                  </Button>
                </div>
                <ul className="mt-2 divide-y divide-slate-100">
                  {customItems.map((line) => (
                    <li key={line.id} className="flex items-center gap-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="break-words text-sm font-medium text-slate-800">{line.name}</p>
                        <p className="text-xs text-slate-500">{line.quantity || 'Quantity not given'}</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800">Price by store</span>
                      <button
                        type="button"
                        onClick={() => removeCustomItem(line.id)}
                        className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-500"
                        aria-label={`Remove ${line.name}`}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : (
              <button
                type="button"
                onClick={() => setOwnOpen(true)}
                className="flex w-full items-center gap-3 rounded-2xl border-2 border-dashed border-brand-200 bg-white p-4 text-left transition hover:border-brand-400 hover:bg-brand-50/50"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50">
                  <NotebookPen className="size-5 text-brand-600" />
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold text-brand-800">Can&apos;t find something? Your own order</span>
                  <span className="block text-xs text-slate-500">Type any item and quantity - the store will get it for you.</span>
                </span>
              </button>
            )}
          </div>

          {/* Summary */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-card">
              <h2 className="text-lg font-semibold">Order summary</h2>
              <OrderTotals className="mt-4" {...totals} savings={savings} unpricedCount={customItems.length} />

              {totals.belowMinimum && (
                <div className="mt-4 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800" role="alert">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                  <p>
                    {minimumOrderMessage(totals.minOrder)} Add items worth <strong>{formatCurrency(totals.shortBy)}</strong> more to
                    place your order.
                  </p>
                </div>
              )}

              {/* Phones use the sticky checkout bar below instead */}
              <div className="mt-5 hidden md:block">
                <Button to={canCheckout ? '/checkout' : undefined} disabled={!canCheckout} size="lg" fullWidth iconRight={ArrowRight}>
                  Proceed to Checkout
                </Button>
              </div>

              <p className="mt-4 flex items-center gap-2 rounded-xl bg-beige px-3 py-2.5 text-xs text-slate-600">
                <Banknote className="size-4 shrink-0 text-brand-600" /> Pay on delivery – Cash / GPay
              </p>
            </div>
          </aside>
        </div>
      </div>

      {/* Mobile checkout bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-brand-100 bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl backdrop-blur md:hidden">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-slate-500">{customItems.length ? 'Total so far' : 'Total'}</p>
            <p className="truncate text-lg font-bold text-brand-800">{formatCurrency(totals.grandTotal)}</p>
          </div>
          <Button to={canCheckout ? '/checkout' : undefined} disabled={!canCheckout} size="lg" iconRight={ArrowRight}>
            Checkout
          </Button>
        </div>
      </div>

      <OwnOrderModal open={ownOpen} onClose={() => setOwnOpen(false)} />

      <ConfirmDialog
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        onConfirm={() => {
          clearCart();
          setConfirmClear(false);
          toast.success('Cart cleared');
        }}
        title="Clear your cart?"
        message="All items will be removed from your cart."
        confirmText="Clear cart"
      />
    </div>
  );
}
