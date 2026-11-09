/**
 * Track order (/track): order ID + phone -> the status set by the admin,
 * the admin's comments for each step and the store's message.
 * Refreshes by itself every 30 seconds; orders placed on this phone can be
 * opened with one tap.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Banknote,
  CircleCheck,
  CircleX,
  ClipboardList,
  Hash,
  MessageSquare,
  PackageCheck,
  PackageSearch,
  Phone,
  RefreshCw,
  Truck,
} from 'lucide-react';
import { publicApi } from '../../api/publicApi';
import { getErrorMessage } from '../../api/client';
import { useStore } from '../../context/StoreContext';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { CUSTOMER_STATUS, STATUS_FLOW, paymentModeLabel } from '../../utils/constants';
import { formatCurrency, formatDate, formatDateTime, formatQty, timeAgo } from '../../utils/format';
import { telLink, whatsappLink } from '../../utils/links';
import { STORAGE_KEYS, readJSON, readMyOrders } from '../../utils/storage';
import Button from '../../components/ui/Button';
import { Field, Input } from '../../components/ui/FormControls';
import OrderTotals from '../../components/public/OrderTotals';
import { OwnItemLines } from '../../components/public/OwnItemLines';
import { FloatingLeaves, WhatsAppIcon } from '../../components/public/Decor';

const REFRESH_MS = 30000;
const AUTO_NOTE = 'Order placed by customer'; // default history note - not shown to customers

const STEP_ICONS = { New: ClipboardList, Confirmed: CircleCheck, OutForDelivery: Truck, Delivered: PackageCheck };
const STATUS_GRADIENT = {
  New: 'from-sky-500 to-sky-600',
  Confirmed: 'from-indigo-500 to-indigo-600',
  OutForDelivery: 'from-amber-500 to-orange-500',
  Delivered: 'from-brand-600 to-brand-800', // dark enough for white text in every colour theme
  Cancelled: 'from-red-500 to-red-600',
};

/** Latest history entry for each status (admin may have moved back and forth) */
const latestEntries = (history = []) => history.reduce((map, entry) => ({ ...map, [entry.status]: entry }), {});
const visibleNote = (entry) => (entry && entry.note && entry.note !== AUTO_NOTE ? entry.note : '');

function StatusCard({ order, refreshing, onRefresh }) {
  const meta = CUSTOMER_STATUS[order.status] || { label: order.status, text: '' };
  const Icon = order.status === 'Cancelled' ? CircleX : STEP_ICONS[order.status] || ClipboardList;
  return (
    <div className={`rounded-3xl bg-gradient-to-br p-5 text-white shadow-soft sm:p-6 ${STATUS_GRADIENT[order.status] || STATUS_GRADIENT.New}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/80">Order {order.orderId}</p>
          <p className="mt-1 text-2xl font-bold sm:text-3xl">{meta.label}</p>
          <p className="mt-1 text-sm text-white/90">{meta.text}</p>
        </div>
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/20">
          <Icon className="size-6" />
        </span>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-white/85">
        <span>Updated {timeAgo(order.updatedAt)} · refreshes automatically</span>
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1.5 font-semibold text-white transition hover:bg-white/30"
        >
          <RefreshCw className={`size-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>
    </div>
  );
}

function Timeline({ order }) {
  const entries = latestEntries(order.statusHistory);
  const cancelled = order.status === 'Cancelled';

  // For cancelled orders show how far the order got before it was cancelled
  let currentIndex = STATUS_FLOW.indexOf(order.status);
  if (cancelled) {
    const reached = [...(order.statusHistory || [])].reverse().find((h) => STATUS_FLOW.includes(h.status));
    currentIndex = reached ? STATUS_FLOW.indexOf(reached.status) : 0;
  }
  const steps = STATUS_FLOW.map((status, index) => ({
    status,
    done: index <= currentIndex,
    current: !cancelled && index === currentIndex,
    entry: index <= currentIndex ? entries[status] : null,
  }));
  const visible = cancelled ? steps.slice(0, currentIndex + 1) : steps;
  const cancelEntry = entries.Cancelled;

  return (
    <ol className="relative ml-4 space-y-6 border-l-2 border-slate-200">
      {visible.map((step) => {
        const Icon = STEP_ICONS[step.status];
        const note = visibleNote(step.entry);
        return (
          <li key={step.status} className="relative pl-8">
            <span
              className={`absolute -left-[17px] top-0 flex size-8 items-center justify-center rounded-full ring-4 ring-white ${
                step.done ? 'bg-brand-500 text-on-brand' : 'bg-slate-100 text-slate-400'
              }`}
            >
              {step.current && <span className="absolute inset-0 animate-ping rounded-full bg-brand-400/40" />}
              <Icon className="relative size-4" />
            </span>
            <p className={`font-semibold ${step.done ? 'text-slate-800' : 'text-slate-400'}`}>{CUSTOMER_STATUS[step.status].label}</p>
            <p className="text-xs text-slate-500">
              {step.entry ? formatDateTime(step.entry.changedAt) : step.done ? '' : 'Pending'}
            </p>
            {note && (
              <p className="mt-2 flex gap-2 rounded-xl bg-brand-50 px-3 py-2 text-sm text-slate-700">
                <MessageSquare className="mt-0.5 size-4 shrink-0 text-brand-600" />
                <span className="whitespace-pre-line">{note}</span>
              </p>
            )}
          </li>
        );
      })}

      {cancelled && (
        <li className="relative pl-8">
          <span className="absolute -left-[17px] top-0 flex size-8 items-center justify-center rounded-full bg-red-500 text-white ring-4 ring-white">
            <CircleX className="size-4" />
          </span>
          <p className="font-semibold text-red-700">Cancelled</p>
          <p className="text-xs text-slate-500">{formatDateTime(order.cancelledAt || (cancelEntry && cancelEntry.changedAt))}</p>
          {visibleNote(cancelEntry) && (
            <p className="mt-2 flex gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">
              <MessageSquare className="mt-0.5 size-4 shrink-0" />
              <span className="whitespace-pre-line">{visibleNote(cancelEntry)}</span>
            </p>
          )}
        </li>
      )}
    </ol>
  );
}

export default function TrackOrder() {
  useDocumentTitle('Track order');
  const { settings, storeName } = useStore();
  const [searchParams] = useSearchParams();
  const [myOrders] = useState(readMyOrders);
  const savedCustomer = readJSON(STORAGE_KEYS.customer);

  const [form, setForm] = useState(() => ({
    orderId: (searchParams.get('orderId') || (myOrders[0] && myOrders[0].orderId) || '').toUpperCase(),
    phone: searchParams.get('phone') || (myOrders[0] && myOrders[0].phone) || (savedCustomer && savedCustomer.phone) || '',
  }));
  const [order, setOrder] = useState(null);
  const [active, setActive] = useState(null); // { orderId, phone } currently shown
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const lastStatus = useRef(null);
  const resultRef = useRef(null);

  const lookup = useCallback(async (orderId, phone, { silent = false } = {}) => {
    const id = String(orderId || '').trim().toUpperCase();
    const digits = String(phone || '').replace(/\D/g, '').slice(-10);
    if (!silent) {
      if (!/^ORD-\d{4,}$/.test(id)) {
        setError('Enter a valid order ID, for example ORD-0001');
        return;
      }
      if (digits.length !== 10) {
        setError('Enter the 10-digit phone number used for the order');
        return;
      }
    }
    if (silent) setRefreshing(true);
    else {
      setLoading(true);
      setError('');
    }
    try {
      const data = await publicApi.trackOrder(id, digits);
      // Tell the customer when the store changes the status while the page is open
      if (silent && lastStatus.current && lastStatus.current !== data.status) {
        toast.success(`Order ${data.orderId}: ${CUSTOMER_STATUS[data.status].label}`, { duration: 6000 });
      }
      lastStatus.current = data.status;
      setOrder(data);
      setActive((prev) => (prev && prev.orderId === id && prev.phone === digits ? prev : { orderId: id, phone: digits }));
      if (!silent) {
        setForm({ orderId: id, phone: digits });
        window.history.replaceState(null, '', `/track?orderId=${encodeURIComponent(id)}&phone=${digits}`);
        setTimeout(() => resultRef.current && resultRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
      }
    } catch (err) {
      if (!silent) {
        setOrder(null);
        setActive(null);
        lastStatus.current = null;
        setError(getErrorMessage(err, 'Could not find the order.'));
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Open from the success page link, or show the latest order placed on this phone
  useEffect(() => {
    const id = searchParams.get('orderId');
    const phone = searchParams.get('phone');
    if (id && phone) lookup(id, phone);
    else if (myOrders[0]) lookup(myOrders[0].orderId, myOrders[0].phone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live updates: every 30 s while the page is visible, and when the customer comes back
  useEffect(() => {
    if (!active) return undefined;
    const refresh = () => {
      if (document.visibilityState === 'visible') lookup(active.orderId, active.phone, { silent: true });
    };
    const timer = setInterval(refresh, REFRESH_MS);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [active, lookup]);

  const onSubmit = (event) => {
    event.preventDefault();
    lookup(form.orderId, form.phone);
  };

  const storeWhatsapp = settings && (settings.whatsapp || settings.phone);
  const storePhone = settings && settings.phone;
  const savings = order
    ? order.items.reduce((sum, line) => (line.originalPrice > line.price ? sum + (line.originalPrice - line.price) * line.quantity : sum), 0)
    : 0;

  return (
    <div className="relative min-h-[70vh] overflow-hidden bg-gradient-to-b from-brand-50 via-white to-white">
      <FloatingLeaves className="opacity-60" />
      <div className="relative mx-auto max-w-2xl px-4 py-8 sm:py-12">
        <div className="text-center">
          <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-brand-500 text-on-brand shadow-soft">
            <PackageSearch className="size-7" />
          </span>
          <h1 className="mt-4 text-2xl font-bold sm:text-3xl">Track your order</h1>
          <p className="mt-1 text-sm text-slate-600 sm:text-base">See the latest status from {storeName}.</p>
        </div>

        <form onSubmit={onSubmit} noValidate className="mt-6 grid grid-cols-1 gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-card sm:grid-cols-[1fr_1fr_auto] sm:items-end sm:p-5">
          <Field label="Order ID" htmlFor="track-order">
            <Input
              id="track-order"
              icon={Hash}
              value={form.orderId}
              onChange={(e) => setForm({ ...form, orderId: e.target.value.toUpperCase() })}
              placeholder="ORD-0001"
              autoCapitalize="characters"
              autoComplete="off"
            />
          </Field>
          <Field label="Phone number" htmlFor="track-phone">
            <Input
              id="track-phone"
              icon={Phone}
              type="tel"
              inputMode="numeric"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="10-digit number"
            />
          </Field>
          <Button type="submit" size="lg" loading={loading} className="sm:h-[46px]">
            Track
          </Button>
          {error && <p className="text-sm font-medium text-red-600 sm:col-span-3">{error}</p>}
        </form>

        {myOrders.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Your orders on this phone</p>
            <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
              {myOrders.map((o) => {
                const isActive = active && active.orderId === o.orderId;
                return (
                  <button
                    key={o.orderId}
                    type="button"
                    onClick={() => lookup(o.orderId, o.phone)}
                    className={`shrink-0 rounded-2xl border px-3.5 py-2 text-left transition ${
                      isActive ? 'border-brand-400 bg-brand-50 shadow-soft' : 'border-slate-200 bg-white hover:border-brand-300'
                    }`}
                  >
                    <span className="block text-sm font-semibold text-brand-800">{o.orderId}</span>
                    <span className="block text-xs text-slate-500">
                      {formatDate(o.createdAt)} · {formatCurrency(o.grandTotal)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {order && (
          <div ref={resultRef} className="mt-6 animate-slide-up scroll-mt-20 space-y-4">
            <StatusCard order={order} refreshing={refreshing} onRefresh={() => lookup(order.orderId, active ? active.phone : form.phone, { silent: true })} />

            {order.customerMessage && (
              <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <MessageSquare className="mt-0.5 size-5 shrink-0 text-amber-600" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Message from {storeName}</p>
                  <p className="mt-1 whitespace-pre-line text-sm text-slate-800">{order.customerMessage}</p>
                  {order.customerMessageAt && <p className="mt-1 text-xs text-slate-500">{formatDateTime(order.customerMessageAt)}</p>}
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-card">
              <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-lg font-semibold">Order progress</h2>
                <p className="text-xs text-slate-500">Placed {formatDateTime(order.createdAt)}</p>
              </div>
              <Timeline order={order} />
            </div>

            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-card">
              <h2 className="text-lg font-semibold">Items</h2>
              <ul className="mt-2 divide-y divide-slate-100">
                {order.items.map((line, index) => (
                  // eslint-disable-next-line react/no-array-index-key
                  <li key={index} className="flex justify-between gap-3 py-2.5 text-sm">
                    <span className="min-w-0 text-slate-700">
                      {line.name} <span className="text-slate-500">× {formatQty(line.quantity, line.unit)}</span>
                    </span>
                    <span className="shrink-0 font-medium text-slate-800">{formatCurrency(line.total)}</span>
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
                savings={savings}
              />
              <p className="mt-4 flex items-center gap-2 rounded-xl bg-brand-50 px-3 py-2.5 text-sm text-brand-800">
                <Banknote className="size-4 shrink-0" />
                {order.paymentStatus === 'Paid'
                  ? `Paid${order.paymentMode ? ` via ${paymentModeLabel(order.paymentMode)}` : ''}. Thank you!`
                  : 'Pay on delivery – Cash / GPay'}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              {storePhone && (
                <Button href={telLink(storePhone)} variant="outline" icon={Phone} className="flex-auto">
                  Call store
                </Button>
              )}
              {storeWhatsapp && (
                <Button
                  href={whatsappLink(storeWhatsapp, `Hi ${storeName}, I want to know about my order ${order.orderId}.`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="whatsapp"
                  icon={WhatsAppIcon}
                  className="flex-auto"
                >
                  WhatsApp store
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
