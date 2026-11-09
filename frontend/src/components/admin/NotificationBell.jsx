import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, BellOff, CheckCheck, ShoppingBag } from 'lucide-react';
import { useSocket } from '../../context/SocketContext';
import { formatCurrency, timeAgo } from '../../utils/format';
import { getNotificationPermission, notificationsSupported, requestNotificationPermission } from '../../utils/notify';

/** Bell with unread count and a dropdown list of recent order notifications */
export default function NotificationBell() {
  const { notifications, unreadCount, markAllRead, markRead, clearNotifications, openOrder, connected } = useSocket();
  const [open, setOpen] = useState(false);
  const [permission, setPermission] = useState(getNotificationPermission());
  const panelRef = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const enableDesktopAlerts = async () => {
    setPermission(await requestNotificationPermission());
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex size-10 items-center justify-center rounded-xl text-slate-600 transition hover:bg-brand-50 hover:text-brand-800"
        aria-label={`Notifications${unreadCount ? ` (${unreadCount} unread)` : ''}`}
        aria-expanded={open}
      >
        <Bell key={unreadCount} className={`size-5 ${unreadCount ? 'animate-ring text-brand-700' : ''}`} />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex min-w-5 animate-bounce-in items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold leading-5 text-white ring-2 ring-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-x-3 top-16 z-40 animate-pop overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-96">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div>
              <p className="font-semibold text-slate-800">Notifications</p>
              <p className="flex items-center gap-1.5 text-xs text-slate-500">
                <span className={`size-1.5 rounded-full ${connected ? 'bg-brand-500' : 'bg-slate-400'}`} />
                {connected ? 'Live updates on' : 'Reconnecting...'}
              </p>
            </div>
            {notifications.length > 0 && (
              <button type="button" onClick={markAllRead} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50">
                <CheckCheck className="size-4" /> Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center px-6 py-10 text-center">
                <span className="flex size-12 items-center justify-center rounded-full bg-brand-50">
                  <Bell className="size-6 text-brand-500" />
                </span>
                <p className="mt-3 text-sm font-medium text-slate-700">No new notifications</p>
                <p className="mt-1 text-xs text-slate-500">New orders will appear here instantly.</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {notifications.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => {
                        markRead(n.id);
                        setOpen(false);
                        openOrder(n.order.orderId);
                      }}
                      className={`flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-brand-50/60 ${n.read ? '' : 'bg-brand-50/40'}`}
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700">
                        <ShoppingBag className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm text-slate-800">
                          New order <span className="font-semibold">{n.order.orderId}</span> from{' '}
                          <span className="font-semibold">{n.order.customerName}</span>
                        </span>
                        <span className="mt-0.5 block text-xs text-slate-500">
                          {formatCurrency(n.order.grandTotal)} · {timeAgo(n.receivedAt)}
                        </span>
                      </span>
                      {!n.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand-500" />}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-2 border-t border-slate-100 bg-slate-50/60 px-4 py-3">
            {notificationsSupported() && permission === 'default' && (
              <button
                type="button"
                onClick={enableDesktopAlerts}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 px-3 py-2 text-sm font-medium text-on-brand transition hover:bg-brand-600"
              >
                <Bell className="size-4" /> Enable desktop alerts
              </button>
            )}
            {permission === 'denied' && (
              <p className="flex items-center gap-2 text-xs text-slate-500">
                <BellOff className="size-4" /> Desktop alerts are blocked in your browser settings.
              </p>
            )}
            <div className="flex items-center justify-between">
              <Link to="/admin/orders" onClick={() => setOpen(false)} className="text-sm font-medium text-brand-700 hover:text-brand-800">
                View all orders
              </Link>
              {notifications.length > 0 && (
                <button type="button" onClick={clearNotifications} className="text-xs text-slate-500 hover:text-slate-700">
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
