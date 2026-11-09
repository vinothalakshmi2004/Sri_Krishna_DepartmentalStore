/**
 * Order placed (/order-success/:orderId)
 */
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Banknote, Check, Copy, PackageSearch, ShoppingBasket } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useStore } from '../../context/StoreContext';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { formatCurrency, formatDateTime, formatQty } from '../../utils/format';
import { OwnItemLines } from '../../components/public/OwnItemLines';
import { customerWhatsappMessage, whatsappLink } from '../../utils/links';
import { STORAGE_KEYS, readJSON, removeKey } from '../../utils/storage';
import Button from '../../components/ui/Button';
import OrderTotals from '../../components/public/OrderTotals';
import { FloatingLeaves, WhatsAppIcon } from '../../components/public/Decor';

function SuccessTick() {
  return (
    <svg viewBox="0 0 52 52" className="size-24 sm:size-28" aria-hidden="true">
      <circle cx="26" cy="26" r="25" className="fill-brand-50" />
      <circle cx="26" cy="26" r="25" fill="none" className="success-circle stroke-brand-500" strokeWidth="2.5" />
      <path className="success-check stroke-brand-800" fill="none" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" d="M15 27l7 7 15-16" />
    </svg>
  );
}

export default function OrderSuccess() {
  useDocumentTitle('Order placed');
  const { orderId } = useParams();
  const location = useLocation();
  const { clearCart } = useCart();
  const { settings, storeName } = useStore();
  const [copied, setCopied] = useState(false);

  // Order details from the checkout page, or from storage after a refresh
  const order = useMemo(() => {
    const fromState = location.state && location.state.order;
    if (fromState && fromState.orderId === orderId) return fromState;
    const saved = readJSON(STORAGE_KEYS.lastOrder);
    return saved && saved.orderId === orderId ? saved : null;
  }, [location.state, orderId]);

  // Clear the cart once for this freshly placed order
  useEffect(() => {
    const pending = readJSON(STORAGE_KEYS.clearCartFor, sessionStorage);
    if (pending === orderId) {
      clearCart();
      removeKey(STORAGE_KEYS.clearCartFor, sessionStorage);
    }
  }, [orderId, clearCart]);

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(orderId);
      setCopied(true);
      toast.success('Order ID copied');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy. Please note it down.');
    }
  };

  const storeWhatsapp = settings && (settings.whatsapp || settings.phone);
  const trackUrl = `/track?orderId=${encodeURIComponent(orderId)}${order && order.phone ? `&phone=${order.phone}` : ''}`;

  return (
    <div className="relative overflow-hidden bg-gradient-to-b from-brand-50 via-white to-white">
      <FloatingLeaves className="opacity-60" />
      <div className="relative mx-auto max-w-2xl px-4 py-10 sm:py-16">
        <div className="flex flex-col items-center text-center">
          <SuccessTick />
          <h1 className="mt-5 animate-slide-up text-2xl font-bold sm:text-3xl [animation-delay:500ms]">Order placed successfully!</h1>
          <p className="mt-2 animate-slide-up text-slate-600 [animation-delay:600ms]">
            Thank you{order && order.customerName ? `, ${order.customerName}` : ''}! {storeName} has received your order and will contact you soon.
          </p>

          <div className="mt-6 inline-flex animate-pop items-center gap-3 rounded-2xl border border-brand-200 bg-white px-5 py-3 shadow-soft [animation-delay:700ms]">
            <div className="text-left">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Your order ID</p>
              <p className="text-2xl font-bold tracking-wide text-brand-800">{orderId}</p>
            </div>
            <button
              type="button"
              onClick={copyId}
              className="rounded-xl p-2 text-brand-700 transition hover:bg-brand-50"
              aria-label="Copy order ID"
            >
              {copied ? <Check className="size-5" /> : <Copy className="size-5" />}
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500">Use this ID to track your order. It is also saved on this phone.</p>
        </div>

        {order && order.items && (
          <div className="mt-8 rounded-2xl border border-slate-100 bg-white p-5 shadow-card sm:p-6">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Order summary</h2>
              {order.createdAt && <p className="text-xs text-slate-500">{formatDateTime(order.createdAt)}</p>}
            </div>
            <ul className="mt-4 divide-y divide-slate-100">
              {order.items.map((line) => (
                <li key={`${line.itemId || line.name}`} className="flex justify-between gap-3 py-2.5 text-sm">
                  <span className="text-slate-700">
                    {line.name} <span className="text-slate-500">× {formatQty(line.quantity, line.unit)}</span>
                  </span>
                  <span className="font-medium text-slate-800">{formatCurrency(line.total)}</span>
                </li>
              ))}
            </ul>
            <OwnItemLines lines={order.customItems} />
            <OrderTotals
              className="mt-3 border-t border-slate-100 pt-4"
              subtotal={order.subtotal}
              deliveryCharge={order.deliveryCharge}
              grandTotal={order.grandTotal}
              unpricedCount={(order.customItems || []).filter((line) => line.amount === null || line.amount === undefined).length}
              savings={order.items.reduce(
                (sum, line) => (line.originalPrice > line.price ? sum + (line.originalPrice - line.price) * line.quantity : sum),
                0
              )}
            />
            <p className="mt-4 flex items-center gap-2 rounded-xl bg-brand-50 px-3 py-2.5 text-sm text-brand-800">
              <Banknote className="size-4" /> Pay on delivery – Cash / GPay
            </p>
          </div>
        )}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
          <Button to={trackUrl} size="lg" icon={PackageSearch}>
            Track order
          </Button>
          <Button to="/order" variant="outline" size="lg" icon={ShoppingBasket}>
            Continue shopping
          </Button>
          {storeWhatsapp && (
            <Button
              href={whatsappLink(storeWhatsapp, customerWhatsappMessage(orderId, order && order.customerName))}
              target="_blank"
              rel="noopener noreferrer"
              variant="whatsapp"
              size="lg"
              icon={WhatsAppIcon}
            >
              WhatsApp store
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
