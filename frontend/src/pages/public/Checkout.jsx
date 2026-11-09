/**
 * Checkout (/checkout): customer details + order summary -> POST /api/public/orders
 */
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Banknote, Hash, Landmark, MapPin, NotebookPen, Phone, ShieldCheck, Smartphone, TriangleAlert, User } from 'lucide-react';
import { publicApi } from '../../api/publicApi';
import { getErrorList, getErrorMessage } from '../../api/client';
import { useCart } from '../../context/CartContext';
import { useStore } from '../../context/StoreContext';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { calcCartTotals, minimumOrderMessage } from '../../utils/pricing';
import { formatCurrency, formatQty } from '../../utils/format';
import { STORAGE_KEYS, readJSON, removeKey, saveMyOrder, writeJSON } from '../../utils/storage';
import Button from '../../components/ui/Button';
import { Field, Input, Textarea } from '../../components/ui/FormControls';
import OrderTotals from '../../components/public/OrderTotals';
import ProductImage from '../../components/public/ProductImage';
import StoreClosedBanner from '../../components/public/StoreClosedBanner';

const EMPTY_FORM = { customerName: '', phone: '', address: '', landmark: '', pincode: '', note: '' };

/** "+91 98765-43210" -> "9876543210" */
const normalizePhone = (value) => {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return digits;
};

const validate = (form, settings) => {
  const errors = {};
  const name = form.customerName.trim();
  if (name.length < 2) errors.customerName = 'Please enter your name';
  else if (name.length > 80) errors.customerName = 'Name is too long';

  if (!/^\d{10}$/.test(normalizePhone(form.phone))) errors.phone = 'Enter a valid 10-digit mobile number';

  const address = form.address.trim();
  if (address.length < 5) errors.address = 'Please enter your full delivery address';
  else if (address.length > 300) errors.address = 'Address is too long (max 300 characters)';

  if (form.landmark.trim().length > 120) errors.landmark = 'Landmark is too long';

  const pincode = form.pincode.trim();
  const allowed = (settings && settings.allowedPincodes) || [];
  if (!/^\d{6}$/.test(pincode)) errors.pincode = 'Enter a valid 6-digit pincode';
  else if (allowed.length && !allowed.includes(pincode)) {
    errors.pincode = `Sorry, we deliver only to: ${allowed.join(', ')}`;
  }

  if (form.note.trim().length > 300) errors.note = 'Note is too long (max 300 characters)';
  return errors;
};

export default function Checkout() {
  useDocumentTitle('Checkout');
  const navigate = useNavigate();
  const { items, customItems, subtotal, savings, syncWithItems } = useCart();
  const { settings, isStoreOpen, refresh } = useStore();
  const totals = calcCartTotals(subtotal, settings, { hasCustomItems: customItems.length > 0 });
  const lineCount = items.length + customItems.length;

  const [form, setForm] = useState(() => ({ ...EMPTY_FORM, ...(readJSON(STORAGE_KEYS.customer) || {}), note: '' }));
  const [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [problems, setProblems] = useState([]);
  const placedRef = useRef(false);

  // Nothing to check out -> back to the cart
  useEffect(() => {
    if (lineCount === 0 && !placedRef.current) navigate('/cart', { replace: true });
  }, [lineCount, navigate]);

  const setField = (name) => (event) => {
    const value = event.target.value;
    const next = { ...form, [name]: value };
    setForm(next);
    if (touched[name]) setErrors(validate(next, settings));
  };

  const onBlur = (name) => () => {
    setTouched((prev) => ({ ...prev, [name]: true }));
    setErrors(validate(form, settings));
  };

  const fieldError = (name) => (touched[name] || submitting ? errors[name] : undefined);
  const canPlaceOrder = isStoreOpen && !totals.belowMinimum && lineCount > 0;

  const handleSubmit = async (event) => {
    event.preventDefault();
    const validation = validate(form, settings);
    setErrors(validation);
    setTouched({ customerName: true, phone: true, address: true, landmark: true, pincode: true, note: true });
    if (Object.keys(validation).length) {
      toast.error('Please check the highlighted fields');
      const first = document.querySelector('[aria-invalid="true"]');
      if (first) first.focus();
      return;
    }
    if (!isStoreOpen) {
      toast.error('Sorry, the store is closed right now.');
      return;
    }
    if (totals.belowMinimum) {
      toast.error(minimumOrderMessage(totals.minOrder));
      return;
    }

    const payload = {
      customerName: form.customerName.trim(),
      phone: normalizePhone(form.phone),
      address: form.address.trim(),
      landmark: form.landmark.trim(),
      pincode: form.pincode.trim(),
      note: form.note.trim(),
      items: items.map((line) => ({ itemId: line._id, quantity: line.quantity })),
      customItems: customItems.map(({ name, quantity }) => ({ name, quantity })),
    };

    setSubmitting(true);
    setProblems([]);
    try {
      const res = await publicApi.placeOrder(payload);
      const order = { ...res.data, customerName: payload.customerName, phone: payload.phone };

      if (remember) {
        const { note, ...details } = payload;
        delete details.items;
        delete details.customItems;
        writeJSON(STORAGE_KEYS.customer, details);
      } else {
        removeKey(STORAGE_KEYS.customer);
      }
      writeJSON(STORAGE_KEYS.lastOrder, order);
      saveMyOrder(order); // one-tap tracking from this phone later
      writeJSON(STORAGE_KEYS.clearCartFor, order.orderId, sessionStorage);

      placedRef.current = true;
      navigate(`/order-success/${order.orderId}`, { replace: true, state: { order } });
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not place the order. Please try again.'));
      const status = err.response && err.response.status;
      const list = getErrorList(err);

      if (status === 403) refresh(); // store just closed

      // Stock / availability changed: refresh the cart and explain what happened
      const itemProblems = list.filter((e) => e.itemId || e.field === 'items');
      if (itemProblems.length || status === 409) {
        setProblems(itemProblems.map((e) => e.message));
        try {
          const fresh = await publicApi.getItems();
          syncWithItems(fresh);
        } catch {
          /* ignore */
        }
      }

      // Field errors from the server
      const fieldErrors = {};
      list.forEach((e) => {
        if (e.field && e.field in EMPTY_FORM) fieldErrors[e.field] = e.message;
      });
      if (Object.keys(fieldErrors).length) setErrors((prev) => ({ ...prev, ...fieldErrors }));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-mint/50 pb-28 md:pb-0">
      {/* Phone: sticky "Place Order" bar always within thumb reach */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-brand-100 bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl backdrop-blur md:hidden">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-slate-500">{customItems.length ? 'Total so far' : 'Total'} · Pay on delivery</p>
            <p className="truncate text-lg font-bold text-brand-800">{formatCurrency(totals.grandTotal)}</p>
          </div>
          <Button type="submit" form="checkout-form" size="lg" loading={submitting} disabled={!canPlaceOrder}>
            {submitting ? 'Placing...' : 'Place Order'}
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Link to="/cart" className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-800">
          <ArrowLeft className="size-4" /> Back to cart
        </Link>
        <h1 className="mt-2 text-3xl font-bold">Checkout</h1>
        <p className="text-sm text-slate-500">Tell us where to deliver. No account needed.</p>

        <StoreClosedBanner className="mt-5" />

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
          {/* Customer form */}
          <form id="checkout-form" onSubmit={handleSubmit} noValidate className="space-y-5 rounded-2xl border border-slate-100 bg-white p-5 shadow-card sm:p-6 lg:col-span-3">
            <h2 className="text-lg font-semibold">Delivery details</h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name" htmlFor="customerName" required error={fieldError('customerName')}>
                <Input
                  id="customerName"
                  icon={User}
                  value={form.customerName}
                  onChange={setField('customerName')}
                  onBlur={onBlur('customerName')}
                  placeholder="Your name"
                  autoComplete="name"
                  maxLength={80}
                  invalid={Boolean(fieldError('customerName'))}
                  aria-invalid={Boolean(fieldError('customerName'))}
                />
              </Field>
              <Field label="Mobile number" htmlFor="phone" required error={fieldError('phone')} hint="We will call this number for delivery">
                <Input
                  id="phone"
                  icon={Phone}
                  type="tel"
                  inputMode="numeric"
                  value={form.phone}
                  onChange={setField('phone')}
                  onBlur={onBlur('phone')}
                  placeholder="10-digit mobile number"
                  autoComplete="tel"
                  maxLength={16}
                  invalid={Boolean(fieldError('phone'))}
                  aria-invalid={Boolean(fieldError('phone'))}
                />
              </Field>
            </div>

            <Field label="Delivery address" htmlFor="address" required error={fieldError('address')}>
              <Textarea
                id="address"
                value={form.address}
                onChange={setField('address')}
                onBlur={onBlur('address')}
                placeholder="House / flat no., street, area"
                autoComplete="street-address"
                maxLength={300}
                rows={3}
                invalid={Boolean(fieldError('address'))}
                aria-invalid={Boolean(fieldError('address'))}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Landmark" htmlFor="landmark" error={fieldError('landmark')} hint="Optional">
                <Input
                  id="landmark"
                  icon={Landmark}
                  value={form.landmark}
                  onChange={setField('landmark')}
                  onBlur={onBlur('landmark')}
                  placeholder="Near temple, school..."
                  maxLength={120}
                  invalid={Boolean(fieldError('landmark'))}
                />
              </Field>
              <Field label="Pincode" htmlFor="pincode" required error={fieldError('pincode')}>
                <Input
                  id="pincode"
                  icon={Hash}
                  inputMode="numeric"
                  value={form.pincode}
                  onChange={(e) => setField('pincode')({ target: { value: e.target.value.replace(/\D/g, '').slice(0, 6) } })}
                  onBlur={onBlur('pincode')}
                  placeholder="6-digit pincode"
                  autoComplete="postal-code"
                  invalid={Boolean(fieldError('pincode'))}
                  aria-invalid={Boolean(fieldError('pincode'))}
                />
              </Field>
            </div>

            <Field label="Note for the store" htmlFor="note" error={fieldError('note')} hint="Optional - e.g. call before delivery">
              <div className="relative">
                <NotebookPen className="pointer-events-none absolute left-3.5 top-3 size-4 text-slate-400" />
                <Textarea
                  id="note"
                  value={form.note}
                  onChange={setField('note')}
                  onBlur={onBlur('note')}
                  placeholder="Any special instructions"
                  maxLength={300}
                  rows={2}
                  className="pl-10"
                  invalid={Boolean(fieldError('note'))}
                />
              </div>
            </Field>

            <label className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="size-4 rounded border-slate-300 accent-brand-500"
              />
              Remember my details on this device
            </label>
          </form>

          {/* Summary (below the form on phones) */}
          <aside className="lg:col-span-2 lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-card sm:p-6">
              <h2 className="text-lg font-semibold">Order summary</h2>
              <ul className="mt-4 max-h-72 space-y-3 overflow-y-auto pr-1">
                {items.map((line) => (
                  <li key={line._id} className="flex items-center gap-3">
                    <ProductImage src={line.image} alt={line.name} className="size-12 shrink-0 rounded-xl" iconClass="size-5" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800">{line.name}</p>
                      <p className="text-xs text-slate-500">
                        {formatQty(line.quantity, line.unit)} × {formatCurrency(line.price)}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-slate-800">{formatCurrency(line.price * line.quantity)}</p>
                  </li>
                ))}
                {customItems.map((line) => (
                  <li key={line.id} className="flex items-center gap-3">
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-amber-50">
                      <NotebookPen className="size-5 text-amber-500" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800">{line.name}</p>
                      <p className="text-xs text-slate-500">{line.quantity || 'Quantity not given'} · your own item</p>
                    </div>
                    <p className="shrink-0 text-xs font-medium text-amber-700">Price by store</p>
                  </li>
                ))}
              </ul>

              <OrderTotals className="mt-5 border-t border-slate-100 pt-4" {...totals} savings={savings} unpricedCount={customItems.length} />

              <div className="mt-5 rounded-xl border border-brand-100 bg-brand-50 p-3.5">
                <p className="flex items-center gap-2 text-sm font-semibold text-brand-800">
                  <Banknote className="size-4" /> Pay on delivery – Cash / GPay
                </p>
                <p className="mt-1 flex items-center gap-2 text-xs text-slate-600">
                  <Smartphone className="size-3.5" /> No online payment needed. Pay when your order arrives.
                </p>
              </div>

              {problems.length > 0 && (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800" role="alert">
                  <p className="flex items-center gap-2 font-semibold">
                    <TriangleAlert className="size-4" /> Your cart was updated
                  </p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-6 text-xs">
                    {problems.map((message) => (
                      <li key={message}>{message}</li>
                    ))}
                  </ul>
                </div>
              )}

              {totals.belowMinimum && (
                <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
                  {minimumOrderMessage(totals.minOrder)} Add {formatCurrency(totals.shortBy)} more.
                </p>
              )}

              {/* Phones use the sticky bar at the bottom instead */}
              <div className="mt-5 hidden md:block">
                <Button
                  type="submit"
                  form="checkout-form"
                  size="lg"
                  fullWidth
                  loading={submitting}
                  disabled={!canPlaceOrder}
                >
                  {submitting ? 'Placing order...' : customItems.length ? 'Place Order' : `Place Order · ${formatCurrency(totals.grandTotal)}`}
                </Button>
              </div>
              <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-slate-500">
                <ShieldCheck className="size-3.5 text-brand-500" /> Prices are confirmed by the store when you order
              </p>
              <p className="mt-1 flex items-center justify-center gap-1.5 text-xs text-slate-500">
                <MapPin className="size-3.5 text-brand-500" /> Delivery to your doorstep
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
