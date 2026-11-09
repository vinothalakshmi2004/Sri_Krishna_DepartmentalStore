/**
 * SocketContext - real-time admin notifications over Socket.io.
 *
 * Connects with the admin JWT. On "newOrder" it plays a sound, shows a toast
 * with a "View" button, adds an entry to the notification bell and shows a
 * desktop notification when the tab is in the background.
 *
 * Pages listen to events with:  useSocketEvent('newOrder', () => refetch())
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
import { API_URL } from '../api/client';
import { useAuth } from './AuthContext';
import NewOrderToast from '../components/admin/NewOrderToast';
import { playNotificationSound, showBrowserNotification } from '../utils/notify';
import { formatCurrency } from '../utils/format';

const SocketContext = createContext(null);
const MAX_NOTIFICATIONS = 30;
const AUTH_ERROR = /log in again|not authorized|no longer exists|invalid token/i;

export function SocketProvider({ children }) {
  const { token, logout } = useAuth();
  const navigate = useNavigate();

  const [connected, setConnected] = useState(false);
  const [notifications, setNotifications] = useState([]);

  // Refs keep the socket effect from reconnecting on every navigation
  const navigateRef = useRef(navigate);
  const logoutRef = useRef(logout);
  navigateRef.current = navigate;
  logoutRef.current = logout;

  const listeners = useRef(new Map());

  /** Subscribe to a socket event. Returns an unsubscribe function. */
  const subscribe = useCallback((event, handler) => {
    if (!listeners.current.has(event)) listeners.current.set(event, new Set());
    listeners.current.get(event).add(handler);
    return () => listeners.current.get(event)?.delete(handler);
  }, []);

  const notifyListeners = useCallback((event, payload) => {
    listeners.current.get(event)?.forEach((handler) => {
      try {
        handler(payload);
      } catch (err) {
        console.error(`[socket] ${event} handler failed`, err);
      }
    });
  }, []);

  const openOrder = useCallback((orderId) => {
    navigateRef.current(`/admin/orders?open=${encodeURIComponent(orderId)}`);
  }, []);

  useEffect(() => {
    if (!token) return undefined;

    const socket = io(API_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionDelay: 2000,
    });

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', (err) => {
      setConnected(false);
      if (AUTH_ERROR.test(err.message || '')) {
        socket.disconnect();
        logoutRef.current(err.message);
      }
    });

    socket.on('newOrder', (order) => {
      playNotificationSound();
      setNotifications((prev) =>
        [
          { id: `${order._id}-${Date.now()}`, type: 'newOrder', order, receivedAt: new Date().toISOString(), read: false },
          ...prev,
        ].slice(0, MAX_NOTIFICATIONS)
      );
      toast.custom(
        (t) => (
          <NewOrderToast
            t={t}
            order={order}
            onView={() => {
              toast.dismiss(t.id);
              openOrder(order.orderId);
            }}
          />
        ),
        { id: `new-order-${order._id}`, duration: 15000, position: 'top-right' }
      );
      showBrowserNotification(
        `New order ${order.orderId}`,
        `${order.customerName} • ${formatCurrency(order.grandTotal)}`,
        () => openOrder(order.orderId)
      );
      notifyListeners('newOrder', order);
    });

    socket.on('orderUpdated', (payload) => notifyListeners('orderUpdated', payload));
    socket.on('orderDeleted', (payload) => notifyListeners('orderDeleted', payload));
    socket.on('lowStock', (items) => {
      const names = items.map((i) => `${i.name} (${i.stock} ${i.unit} left)`).join(', ');
      toast(`Low stock: ${names}`, { id: 'low-stock', icon: '⚠️', duration: 8000 });
      notifyListeners('lowStock', items);
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      setConnected(false);
    };
  }, [token, notifyListeners, openOrder]);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => (n.read ? n : { ...n, read: true })));
  }, []);

  const markRead = useCallback((id) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  const clearNotifications = useCallback(() => setNotifications([]), []);

  const value = useMemo(
    () => ({
      connected,
      notifications,
      unreadCount: notifications.filter((n) => !n.read).length,
      subscribe,
      markAllRead,
      markRead,
      clearNotifications,
      openOrder,
    }),
    [connected, notifications, subscribe, markAllRead, markRead, clearNotifications, openOrder]
  );

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

// Used when no provider is found: live updates are off, but the admin keeps working
const NO_SOCKET = {
  connected: false,
  notifications: [],
  unreadCount: 0,
  subscribe: () => () => {},
  markAllRead: () => {},
  markRead: () => {},
  clearNotifications: () => {},
  openOrder: () => {},
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    // Should never happen in the built site. In development a stale hot-reload can
    // load this file twice - fall back instead of crashing the whole admin page.
    if (import.meta.env.DEV) console.warn('[socket] useSocket used outside <SocketProvider> - live updates are off. Restart "npm run dev" if this persists.');
    return NO_SOCKET;
  }
  return context;
};

/**
 * Run `handler` whenever the socket event fires.
 *   useSocketEvent('orderUpdated', () => refetch({ silent: true }));
 */
export function useSocketEvent(event, handler) {
  const context = useContext(SocketContext);
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  const subscribe = context && context.subscribe;

  useEffect(() => {
    if (!subscribe) return undefined;
    return subscribe(event, (payload) => handlerRef.current(payload));
  }, [subscribe, event]);
}
