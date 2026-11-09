import { createPortal } from 'react-dom';
import { formatCurrency, formatDateTime, formatQty } from '../../utils/format';
import { STATUS_META, paymentModeLabel } from '../../utils/constants';
import { imageUrl } from '../../utils/links';

/**
 * Printable bill. Rendered into <body> as ".print-root", which is hidden on
 * screen and is the ONLY thing printed (see index.css). Call window.print().
 * The narrow layout suits both A4 and 80 mm thermal printers.
 */
export default function PrintReceipt({ order, settings }) {
  if (!order) return null;
  const store = settings || {};
  const phones = [store.phone, ...(store.extraPhones || [])].filter(Boolean);

  return createPortal(
    <div className="print-root">
      <div className="mx-auto max-w-[380px] text-[12px] leading-snug text-black">
        <div className="border-b border-dashed border-black pb-2 text-center">
          {store.logoFull ? (
            <img src={imageUrl(store.logoFull)} alt={store.storeName} className="mx-auto mb-1 max-h-20 w-auto object-contain" />
          ) : (
            <p className="text-lg font-bold">{store.storeName || 'Sri Krishna Department Store'}</p>
          )}
          {store.address && <p>{store.address}</p>}
          {phones.length > 0 && <p>Ph: {phones.join(' / ')}</p>}
          {store.email && <p>{store.email}</p>}
          <p className="mt-1 font-semibold uppercase tracking-widest">Bill / Receipt</p>
        </div>

        <div className="border-b border-dashed border-black py-2">
          <div className="flex justify-between">
            <span>Order: <strong>{order.orderId}</strong></span>
            <span>{formatDateTime(order.createdAt)}</span>
          </div>
          <p className="mt-1">
            <strong>{order.customerName}</strong> · {order.phone}
          </p>
          <p>
            {order.address}
            {order.landmark ? `, ${order.landmark}` : ''} - {order.pincode}
          </p>
        </div>

        <table className="w-full border-b border-dashed border-black">
          <thead>
            <tr className="text-left">
              <th className="py-1 font-semibold">Item</th>
              <th className="py-1 text-right font-semibold">Qty</th>
              <th className="py-1 text-right font-semibold">Rate</th>
              <th className="py-1 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((line, i) => (
              // eslint-disable-next-line react/no-array-index-key
              <tr key={i} className="align-top">
                <td className="py-0.5 pr-1">{line.name}</td>
                <td className="py-0.5 text-right">{formatQty(line.quantity, line.unit)}</td>
                <td className="py-0.5 text-right">{formatCurrency(line.price)}</td>
                <td className="py-0.5 text-right">{formatCurrency(line.total)}</td>
              </tr>
            ))}
            {(order.customItems || []).map((line, i) => (
              // eslint-disable-next-line react/no-array-index-key
              <tr key={`own-${i}`} className="align-top">
                <td className="py-0.5 pr-1">{line.name} *</td>
                <td className="py-0.5 text-right">{line.quantity || '-'}</td>
                <td className="py-0.5 text-right">-</td>
                <td className="py-0.5 text-right">{line.amount === null || line.amount === undefined ? '-' : formatCurrency(line.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {order.customItems && order.customItems.length > 0 && (
          <p className="border-b border-dashed border-black py-1 text-[10px]">* Item typed in by the customer (own order)</p>
        )}

        <div className="space-y-0.5 border-b border-dashed border-black py-2">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{formatCurrency(order.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span>Delivery</span>
            <span>{order.deliveryCharge ? formatCurrency(order.deliveryCharge) : 'Free'}</span>
          </div>
          <div className="flex justify-between text-base font-bold">
            <span>Total</span>
            <span>{formatCurrency(order.grandTotal)}</span>
          </div>
        </div>

        <div className="py-2">
          <p>
            Payment: <strong>{order.paymentStatus}</strong>
            {order.paymentStatus === 'Paid' && ` (${paymentModeLabel(order.paymentMode)})`}
          </p>
          <p>Status: {STATUS_META[order.status]?.label || order.status}</p>
          {order.note && <p>Customer note: {order.note}</p>}
        </div>

        <p className="mt-2 text-center font-semibold">Thank you for shopping with us!</p>
        <p className="text-center text-[10px]">Printed on {formatDateTime(new Date())}</p>
      </div>
    </div>,
    document.body
  );
}
