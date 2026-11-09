/**
 * Order details drawer: customer info, items (including pricing the
 * customer's own typed-in items), status, payment, notes, cancel / delete
 * and bill printing.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  ArrowRight,
  Ban,
  Check,
  Clock,
  Eye,
  EyeOff,
  IndianRupee,
  MapPin,
  MessageSquare,
  Navigation,
  NotebookPen,
  Phone,
  Printer,
  Save,
  Send,
  StickyNote,
  Trash2,
  User,
  Wallet,
} from 'lucide-react';
import { ordersApi } from '../../api/adminApi';
import { getErrorMessage } from '../../api/client';
import { useStore } from '../../context/StoreContext';
import { useSocketEvent } from '../../context/SocketContext';
import { NEXT_STATUS_ACTION, ORDER_PAYMENT_MODES, ORDER_STATUSES, STATUS_META, paymentModeLabel } from '../../utils/constants';
import { formatCurrency, formatDateTime, formatQty } from '../../utils/format';
import { mapsLink, orderWhatsappMessage, telLink, whatsappLink } from '../../utils/links';
import Drawer from '../ui/Drawer';
import Button from '../ui/Button';
import ConfirmDialog from '../ui/ConfirmDialog';
import { PaymentBadge, StatusBadge } from '../ui/Badge';
import { Textarea, Input, Select } from '../ui/FormControls';
import { Skeleton } from '../ui/Loader';
import EmptyState from '../ui/EmptyState';
import { WhatsAppIcon } from '../public/Decor';
import PrintReceipt from './PrintReceipt';

const MAX_LINE_AMOUNT = 1000000;

/** Server amount -> text box value ('' = not priced) */
const toDrafts = (order) => (order.customItems || []).map((line) => (line.amount === null || line.amount === undefined ? '' : String(line.amount)));
/** '50.0' and '50' are the same price */
const normalizeAmount = (value) => (String(value).trim() === '' ? '' : String(Number(value)));
const sameAmounts = (a, b) => a.length === b.length && a.every((value, i) => normalizeAmount(value) === normalizeAmount(b[i]));
const isValidAmount = (value) => {
  if (String(value).trim() === '') return true;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= MAX_LINE_AMOUNT;
};

function Section({ title, icon: Icon, children, className = '' }) {
  return (
    <section className={`border-b border-slate-100 px-5 py-5 ${className}`}>
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
        {Icon && <Icon className="size-4 text-brand-600" />} {title}
      </h3>
      {children}
    </section>
  );
}

export default function OrderDrawer({ orderRef, open, onClose, onChanged }) {
  const { settings, storeName } = useStore();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  const [statusChoice, setStatusChoice] = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [payMode, setPayMode] = useState('Cash');
  const [adminNote, setAdminNote] = useState('');
  const [customerMessage, setCustomerMessage] = useState('');
  const [confirm, setConfirm] = useState(null); // 'cancel' | 'delete'
  const [cancelReason, setCancelReason] = useState('');
  // Price text boxes for the customer's own items (one per line)
  const [ownAmounts, setOwnAmounts] = useState([]);
  const ownSavedRef = useRef([]);

  const load = useCallback(
    async ({ silent = false } = {}) => {
      if (!orderRef) return;
      if (!silent) setLoading(true);
      try {
        const data = await ordersApi.get(orderRef);
        setOrder(data);
        setError('');
        // Refresh the price boxes unless the admin is in the middle of editing them
        const fresh = toDrafts(data);
        const previousSaved = ownSavedRef.current;
        ownSavedRef.current = fresh;
        setOwnAmounts((prev) => (!silent || sameAmounts(prev, previousSaved) ? fresh : prev));
        if (!silent) {
          setAdminNote(data.adminNote || '');
          setCustomerMessage(data.customerMessage || '');
        }
        setPayMode(data.paymentMode && data.paymentMode !== 'None' ? data.paymentMode : 'Cash');
      } catch (err) {
        setError(getErrorMessage(err, 'Could not load this order.'));
      } finally {
        setLoading(false);
      }
    },
    [orderRef]
  );

  useEffect(() => {
    if (open && orderRef) {
      setOrder(null);
      setStatusChoice('');
      setStatusNote('');
      setConfirm(null);
      load();
    }
  }, [open, orderRef, load]);

  // Keep in sync with changes made from other screens / devices
  useSocketEvent('orderUpdated', (payload) => {
    if (open && order && payload._id === order._id) load({ silent: true });
  });
  useSocketEvent('orderDeleted', (payload) => {
    if (open && order && payload._id === order._id && busy !== 'delete') {
      toast('This order was deleted', { icon: '🗑️' });
      onClose();
    }
  });

  /** Run an action, show a toast, reload the order and refresh the list */
  const run = async (key, action, successMessage) => {
    setBusy(key);
    try {
      await action();
      // Shared id so quick successive actions replace each other instead of stacking
      if (successMessage) toast.success(successMessage, { id: 'order-action' });
      if (key !== 'delete') await load({ silent: true });
      if (onChanged) onChanged();
      return true;
    } catch (err) {
      toast.error(getErrorMessage(err));
      return false;
    } finally {
      setBusy('');
    }
  };

  const changeStatus = (status) => {
    if (status === 'Cancelled') {
      setConfirm('cancel');
      return;
    }
    run('status', () => ordersApi.updateStatus(order._id, status, statusNote.trim()), `Order marked as ${STATUS_META[status].label}`).then((ok) => {
      if (ok) {
        setStatusChoice('');
        setStatusNote('');
      }
    });
  };

  const cancelled = order && order.status === 'Cancelled';
  const next = order && NEXT_STATUS_ACTION[order.status];

  const ownLines = (order && order.customItems) || [];
  const ownUnpriced = ownLines.filter((line) => line.amount === null || line.amount === undefined).length;
  const ownDirty = order ? !sameAmounts(ownAmounts, toDrafts(order)) : false;
  const ownInvalid = ownAmounts.some((value) => !isValidAmount(value));

  const saveOwnPrices = () => {
    const amounts = ownAmounts.map((value) => (String(value).trim() === '' ? null : Number(value)));
    run('own', () => ordersApi.updateCustomItems(order._id, amounts), 'Prices saved - totals updated');
  };

  return (
    <>
      <Drawer
        open={open}
        onClose={onClose}
        title={order ? `Order ${order.orderId}` : 'Order details'}
        subtitle={order ? `Placed ${formatDateTime(order.createdAt)}` : null}
        footer={
          order && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" icon={Printer} onClick={() => window.print()}>
                Print bill
              </Button>
              <Button
                variant="whatsapp"
                size="sm"
                icon={WhatsAppIcon}
                href={whatsappLink(order.phone, orderWhatsappMessage(order, storeName))}
                target="_blank"
                rel="noopener noreferrer"
              >
                WhatsApp
              </Button>
              <div className="flex-1" />
              {!cancelled && (
                <Button variant="danger-outline" size="sm" icon={Ban} onClick={() => setConfirm('cancel')}>
                  Cancel
                </Button>
              )}
              <Button variant="ghost" size="sm" icon={Trash2} className="text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => setConfirm('delete')}>
                Delete
              </Button>
            </div>
          )
        }
      >
        {loading && (
          <div className="space-y-4 p-5">
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-40 w-full rounded-2xl" />
            <Skeleton className="h-24 w-full rounded-2xl" />
          </div>
        )}

        {!loading && error && <EmptyState title="Could not load order" message={error} action={<Button onClick={() => load()}>Try again</Button>} />}

        {!loading && order && (
          <div className="animate-fade-in">
            {/* Status strip */}
            <div className="flex flex-wrap items-center gap-2 bg-brand-50/60 px-5 py-3">
              <StatusBadge status={order.status} />
              <PaymentBadge status={order.paymentStatus} />
              {order.paymentStatus === 'Paid' && <span className="text-xs text-slate-500">via {paymentModeLabel(order.paymentMode)}</span>}
              <span className="ml-auto text-lg font-bold text-brand-800">{formatCurrency(order.grandTotal)}</span>
            </div>
            {order.status === 'New' && (
              <div className="mx-5 mt-4 flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-800">
                <Clock className="size-4" /> New order - please confirm it with the customer.
              </div>
            )}

            {/* Customer */}
            <Section title="Customer" icon={User}>
              <p className="text-base font-semibold text-slate-800">{order.customerName}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" icon={Phone} href={telLink(order.phone)}>
                  {order.phone}
                </Button>
                <Button
                  size="sm"
                  variant="whatsapp"
                  icon={WhatsAppIcon}
                  href={whatsappLink(order.phone, orderWhatsappMessage(order, storeName))}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  WhatsApp
                </Button>
              </div>
              <div className="mt-3 flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                <MapPin className="mt-0.5 size-4 shrink-0 text-brand-600" />
                <div className="min-w-0 flex-1">
                  <p className="whitespace-pre-line">{order.address}</p>
                  {order.landmark && <p className="text-slate-500">Landmark: {order.landmark}</p>}
                  <p className="text-slate-500">Pincode: {order.pincode}</p>
                </div>
                <Button
                  size="xs"
                  variant="outline"
                  icon={Navigation}
                  href={mapsLink(order.address, order.landmark, order.pincode)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Maps
                </Button>
              </div>
              {order.note && (
                <div className="mt-3 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  <MessageSquare className="mt-0.5 size-4 shrink-0" />
                  <p>
                    <span className="font-semibold">Customer note:</span> {order.note}
                  </p>
                </div>
              )}
            </Section>

            {/* Items */}
            <Section title={`Items (${order.items.length + ownLines.length})`} icon={IndianRupee}>
              <ul className="divide-y divide-slate-100">
                {order.items.map((line, i) => (
                  // eslint-disable-next-line react/no-array-index-key
                  <li key={i} className="flex items-start justify-between gap-3 py-2.5 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-800">{line.name}</p>
                      <p className="text-xs text-slate-500">
                        {formatQty(line.quantity, line.unit)} × {formatCurrency(line.price)}
                      </p>
                    </div>
                    <p className="font-semibold text-slate-800">{formatCurrency(line.total)}</p>
                  </li>
                ))}
              </ul>

              {/* Items the customer typed in themselves ("Your own order") */}
              {ownLines.length > 0 && (
                <div className="my-3 rounded-xl border border-amber-200 bg-amber-50/60 p-3">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-900">
                    <NotebookPen className="size-4" /> Customer&apos;s own list ({ownLines.length})
                  </p>
                  <p className="mt-0.5 text-xs text-amber-800">
                    Typed in by the customer - no stock is reserved. Enter the price for each line (for the full quantity) and save; the
                    totals update.
                  </p>
                  <ul className="mt-2 divide-y divide-amber-100">
                    {ownLines.map((line, i) => (
                      // eslint-disable-next-line react/no-array-index-key
                      <li key={i} className="flex items-center gap-3 py-2 text-sm">
                        <div className="min-w-0 flex-1">
                          <p className="break-words font-medium text-slate-800">{line.name}</p>
                          <p className="text-xs text-slate-500">{line.quantity || 'No quantity given'}</p>
                        </div>
                        <div className="relative w-28 shrink-0">
                          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">₹</span>
                          <Input
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="any"
                            value={ownAmounts[i] ?? ''}
                            onChange={(e) => {
                              const { value } = e.target;
                              setOwnAmounts((prev) => prev.map((v, index) => (index === i ? value : v)));
                            }}
                            placeholder="Price"
                            disabled={cancelled}
                            invalid={!isValidAmount(ownAmounts[i] ?? '')}
                            className="py-1.5 pl-7"
                            aria-label={`Price for ${line.name}`}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <p className={`text-xs font-medium ${ownUnpriced ? 'text-amber-800' : 'text-brand-700'}`}>
                      {ownUnpriced ? `${ownUnpriced} item${ownUnpriced === 1 ? '' : 's'} not priced yet` : 'All own items priced'}
                    </p>
                    <Button size="sm" icon={Save} disabled={cancelled || !ownDirty || ownInvalid} loading={busy === 'own'} onClick={saveOwnPrices}>
                      Save prices
                    </Button>
                  </div>
                </div>
              )}

              <dl className="mt-2 space-y-1.5 border-t border-dashed border-slate-200 pt-3 text-sm">
                <div className="flex justify-between text-slate-600">
                  <dt>Subtotal</dt>
                  <dd>{formatCurrency(order.subtotal)}</dd>
                </div>
                <div className="flex justify-between text-slate-600">
                  <dt>Delivery</dt>
                  <dd>{order.deliveryCharge ? formatCurrency(order.deliveryCharge) : 'Free'}</dd>
                </div>
                <div className="flex justify-between text-base font-bold text-brand-800">
                  <dt>Grand total</dt>
                  <dd>{formatCurrency(order.grandTotal)}</dd>
                </div>
              </dl>
            </Section>

            {/* Status */}
            <Section title="Order status" icon={Clock}>
              {cancelled ? (
                <p className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700">
                  This order was cancelled{order.cancelledAt ? ` on ${formatDateTime(order.cancelledAt)}` : ''}. Stock has been restored.
                </p>
              ) : (
                <div className="space-y-3">
                  {next && (
                    <Button fullWidth iconRight={ArrowRight} loading={busy === 'status'} onClick={() => changeStatus(next.status)}>
                      Mark as {STATUS_META[next.status].label}
                    </Button>
                  )}
                  <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                    <Select value={statusChoice} onChange={(e) => setStatusChoice(e.target.value)} aria-label="Change status">
                      <option value="">Change status to...</option>
                      {ORDER_STATUSES.filter((s) => s !== order.status).map((s) => (
                        <option key={s} value={s}>
                          {STATUS_META[s].label}
                        </option>
                      ))}
                    </Select>
                    <Button variant="outline" disabled={!statusChoice} loading={busy === 'status' && Boolean(statusChoice)} onClick={() => changeStatus(statusChoice)}>
                      Update
                    </Button>
                  </div>
                  <Input
                    value={statusNote}
                    onChange={(e) => setStatusNote(e.target.value)}
                    placeholder="Comment for the customer (optional), e.g. Delivery boy Kumar is on the way"
                    maxLength={300}
                  />
                  <p className="flex items-center gap-1.5 text-xs text-brand-700">
                    <Eye className="size-3.5" /> The status and this comment are shown to the customer on Track Order.
                  </p>
                </div>
              )}

              {/* Timeline */}
              <ol className="mt-5 space-y-3 border-l-2 border-brand-100 pl-4">
                {[...(order.statusHistory || [])].reverse().map((entry, i) => (
                  // eslint-disable-next-line react/no-array-index-key
                  <li key={i} className="relative">
                    <span className={`absolute -left-[23px] top-1 size-3 rounded-full ring-4 ring-white ${i === 0 ? 'bg-brand-500' : 'bg-brand-200'}`} />
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={entry.status} />
                      <span className="text-xs text-slate-500">{formatDateTime(entry.changedAt)}</span>
                    </div>
                    {entry.note && <p className="mt-1 text-xs text-slate-600">{entry.note}</p>}
                  </li>
                ))}
              </ol>
            </Section>

            {/* Payment */}
            <Section title="Payment" icon={Wallet}>
              {order.paymentStatus === 'Paid' ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50 p-3">
                  <p className="flex items-center gap-2 text-sm text-brand-800">
                    <Check className="size-4" />
                    Paid via <strong>{paymentModeLabel(order.paymentMode)}</strong>
                    {order.paidAt && <span className="text-xs text-slate-500">on {formatDateTime(order.paidAt)}</span>}
                  </p>
                  <Button
                    size="xs"
                    variant="outline"
                    loading={busy === 'payment'}
                    onClick={() => run('payment', () => ordersApi.updatePayment(order._id, 'Pending'), 'Payment marked as pending')}
                  >
                    Mark unpaid
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {ORDER_PAYMENT_MODES.map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        disabled={cancelled}
                        onClick={() => setPayMode(mode)}
                        className={`rounded-xl border px-3 py-1.5 text-sm font-medium transition disabled:opacity-50 ${
                          payMode === mode ? 'border-brand-500 bg-brand-500 text-on-brand' : 'border-slate-200 text-slate-600 hover:border-brand-300'
                        }`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                  <Button
                    fullWidth
                    variant="dark"
                    icon={Check}
                    disabled={cancelled}
                    loading={busy === 'payment'}
                    onClick={() => run('payment', () => ordersApi.updatePayment(order._id, 'Paid', payMode), `Marked as paid (${payMode})`)}
                  >
                    Mark as Paid · {formatCurrency(order.grandTotal)}
                  </Button>
                </div>
              )}
              {!cancelled && ownUnpriced > 0 && (
                <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                  Add prices for the customer&apos;s own items first, so the total is correct.
                </p>
              )}
              <p className="mt-3 text-xs text-slate-500">
                {order.incomeEntry
                  ? `Income of ${formatCurrency(order.incomeEntry.amount)} was recorded automatically.`
                  : 'Income is recorded automatically once the order is Delivered and Paid.'}
              </p>
            </Section>

            {/* Message the customer sees on the Track Order page */}
            <Section title="Message to customer" icon={MessageSquare}>
              <p className="mb-2 flex items-center gap-1.5 text-xs text-brand-700">
                <Eye className="size-3.5" /> The customer sees this on their Track Order page.
              </p>
              <Textarea
                value={customerMessage}
                onChange={(e) => setCustomerMessage(e.target.value)}
                placeholder="e.g. Your order will reach you by 6 PM today."
                maxLength={500}
                rows={3}
              />
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-slate-500">
                  {order.customerMessage && order.customerMessageAt ? `Sent ${formatDateTime(order.customerMessageAt)}` : 'No message sent yet'}
                </p>
                <div className="flex gap-2">
                  {order.customerMessage && (
                    <Button
                      size="sm"
                      variant="ghost"
                      loading={busy === 'message-remove'}
                      onClick={() =>
                        run('message-remove', () => ordersApi.updateCustomerMessage(order._id, ''), 'Message removed').then((ok) => ok && setCustomerMessage(''))
                      }
                    >
                      Remove
                    </Button>
                  )}
                  <Button
                    size="sm"
                    icon={Send}
                    disabled={!customerMessage.trim() || customerMessage.trim() === (order.customerMessage || '')}
                    loading={busy === 'message'}
                    onClick={() => run('message', () => ordersApi.updateCustomerMessage(order._id, customerMessage.trim()), 'Message sent to the customer')}
                  >
                    Send to customer
                  </Button>
                </div>
              </div>
            </Section>

            {/* Private admin note */}
            <Section title="Private note" icon={StickyNote} className="border-b-0">
              <p className="mb-2 flex items-center gap-1.5 text-xs text-slate-500">
                <EyeOff className="size-3.5" /> Only admins can see this. Customers never see it.
              </p>
              <Textarea value={adminNote} onChange={(e) => setAdminNote(e.target.value)} placeholder="e.g. Collect ₹50 change, deliver after 5 PM" maxLength={500} rows={3} />
              <div className="mt-2 flex justify-end">
                <Button
                  size="sm"
                  variant="secondary"
                  icon={Save}
                  disabled={adminNote === (order.adminNote || '')}
                  loading={busy === 'note'}
                  onClick={() => run('note', () => ordersApi.updateNote(order._id, adminNote.trim()), 'Note saved')}
                >
                  Save note
                </Button>
              </div>
            </Section>
          </div>
        )}
      </Drawer>

      {open && order && <PrintReceipt order={order} settings={settings} />}

      <ConfirmDialog
        open={confirm === 'cancel'}
        onClose={() => setConfirm(null)}
        title={`Cancel order ${order ? order.orderId : ''}?`}
        message="The items will be put back into stock. A cancelled order cannot be reopened."
        confirmText="Cancel order"
        cancelText="Keep order"
        loading={busy === 'cancel'}
        onConfirm={async () => {
          const ok = await run('cancel', () => ordersApi.cancel(order._id, cancelReason.trim()), 'Order cancelled and stock restored');
          if (ok) {
            setConfirm(null);
            setCancelReason('');
          }
        }}
      >
        <Input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Reason (shown to the customer)" maxLength={300} />
      </ConfirmDialog>

      <ConfirmDialog
        open={confirm === 'delete'}
        onClose={() => setConfirm(null)}
        title={`Delete order ${order ? order.orderId : ''}?`}
        message={
          order && order.status === 'Delivered'
            ? 'This permanently removes the order and its income entry.'
            : 'This permanently removes the order. Its items will be put back into stock.'
        }
        confirmText="Delete permanently"
        loading={busy === 'delete'}
        onConfirm={async () => {
          const ok = await run('delete', () => ordersApi.remove(order._id), 'Order deleted');
          if (ok) {
            setConfirm(null);
            onClose();
          }
        }}
      />
    </>
  );
}
