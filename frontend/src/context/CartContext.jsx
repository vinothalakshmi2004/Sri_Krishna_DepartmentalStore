/**
 * CartContext - shopping cart kept in React state and saved to localStorage.
 *
 * Each line: { _id, name, price, originalPrice, unit, image, category, stock, quantity }
 * (originalPrice is set while a live offer lowers the price)
 *
 * customItems ("Your own order"): lines the customer types in themselves,
 * { id, name, quantity } with free-text quantity ("2 kg", "1 packet").
 * They have no price - the store prices them after the order is placed.
 * kg/litre items move in steps of 0.5, everything else in whole numbers.
 * Prices shown here are refreshed from the server (syncWithItems) and the
 * server recalculates the real total when the order is placed.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { MAX_ORDER_QTY } from '../utils/constants';
import { formatCurrency, formatQty, getQtyStep, roundQty } from '../utils/format';
import { round2 } from '../utils/pricing';

const CartContext = createContext(null);
const STORAGE_KEY = 'greenmart_cart_v1';
const CUSTOM_STORAGE_KEY = 'greenmart_custom_items_v1';
export const MAX_CUSTOM_ITEMS = 30;
export const CUSTOM_NAME_MAX = 80;
export const CUSTOM_QTY_MAX = 40;

const loadCart = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((line) => line && line._id && line.quantity > 0) : [];
  } catch {
    return [];
  }
};

const loadCustomItems = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(CUSTOM_STORAGE_KEY) || '[]');
    return Array.isArray(parsed)
      ? parsed.filter((line) => line && line.id && typeof line.name === 'string' && line.name.trim())
      : [];
  } catch {
    return [];
  }
};

const newId = () => `own-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const cleanCustom = ({ name = '', quantity = '' }) => ({
  name: String(name).replace(/\s+/g, ' ').trim().slice(0, CUSTOM_NAME_MAX),
  quantity: String(quantity).replace(/\s+/g, ' ').trim().slice(0, CUSTOM_QTY_MAX),
});

const maxQuantity = (line) => Math.min(Number.isFinite(Number(line.stock)) ? Number(line.stock) : MAX_ORDER_QTY, MAX_ORDER_QTY);

export function CartProvider({ children }) {
  const [items, setItems] = useState(loadCart);
  const [customItems, setCustomItems] = useState(loadCustomItems);

  // Latest items for the action callbacks (keeps them stable)
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const customRef = useRef(customItems);
  customRef.current = customItems;

  // Persist
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* private mode / storage full */
    }
  }, [items]);

  useEffect(() => {
    try {
      localStorage.setItem(CUSTOM_STORAGE_KEY, JSON.stringify(customItems));
    } catch {
      /* private mode / storage full */
    }
  }, [customItems]);

  // Keep several open tabs in sync
  useEffect(() => {
    const onStorage = (event) => {
      if (event.key === STORAGE_KEY) setItems(loadCart());
      if (event.key === CUSTOM_STORAGE_KEY) setCustomItems(loadCustomItems());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const findLine = (id) => itemsRef.current.find((line) => line._id === id);

  const removeItem = useCallback((id) => {
    setItems((prev) => prev.filter((line) => line._id !== id));
    return true;
  }, []);

  /** Set an exact quantity (0 or less removes the line). Returns false if not allowed. */
  const setQuantity = useCallback((id, quantity) => {
    const line = findLine(id);
    if (!line) return false;

    const qty = roundQty(quantity);
    if (qty <= 0) return removeItem(id);

    const max = maxQuantity(line);
    if (qty > max) {
      toast.error(`Only ${formatQty(max, line.unit)} of ${line.name} available`, { id: `max-${id}` });
      return false;
    }
    setItems((prev) => prev.map((l) => (l._id === id ? { ...l, quantity: qty } : l)));
    return true;
  }, [removeItem]);

  /** Add a product (or one more step of it). */
  const addItem = useCallback((product) => {
    const existing = findLine(product._id);
    if (existing) return setQuantity(product._id, existing.quantity + getQtyStep(existing.unit));

    const stock = Number(product.stock) || 0;
    if (stock <= 0) {
      toast.error(`${product.name} is out of stock`);
      return false;
    }
    const quantity = Math.min(1, stock);
    setItems((prev) => [
      ...prev,
      {
        _id: product._id,
        name: product.name,
        price: product.price,
        originalPrice: product.originalPrice || null,
        unit: product.unit,
        image: product.image,
        category: product.category,
        stock,
        quantity,
      },
    ]);
    // One shared id: a new "added" toast replaces the previous one instead of stacking
    toast.success(`${product.name} added to cart`, { id: 'cart-added', duration: 2000 });
    return true;
  }, [setQuantity]);

  const increment = useCallback((id) => {
    const line = findLine(id);
    return line ? setQuantity(id, line.quantity + getQtyStep(line.unit)) : false;
  }, [setQuantity]);

  const decrement = useCallback((id) => {
    const line = findLine(id);
    return line ? setQuantity(id, line.quantity - getQtyStep(line.unit)) : false;
  }, [setQuantity]);

  const clearCart = useCallback(() => {
    setItems([]);
    setCustomItems([]);
  }, []);

  /** Add a typed-in item to "Your own order". Returns false if not allowed. */
  const addCustomItem = useCallback((line) => {
    const clean = cleanCustom(line);
    if (!clean.name) {
      toast.error('Please type the item name');
      return false;
    }
    if (customRef.current.length >= MAX_CUSTOM_ITEMS) {
      toast.error(`You can add up to ${MAX_CUSTOM_ITEMS} items in your own list`, { id: 'own-max' });
      return false;
    }
    const entry = { id: newId(), ...clean };
    customRef.current = [...customRef.current, entry]; // so a second quick add sees this one
    setCustomItems((prev) => [...prev, entry]);
    return true;
  }, []);

  const updateCustomItem = useCallback((id, patch) => {
    setCustomItems((prev) => prev.map((line) => (line.id === id ? { ...line, ...cleanCustom({ ...line, ...patch }) } : line)));
  }, []);

  const removeCustomItem = useCallback((id) => {
    setCustomItems((prev) => prev.filter((line) => line.id !== id));
  }, []);

  /**
   * Refresh cart lines with the latest server data: new prices, stock limits,
   * and removal of items that are no longer sold. Returns messages describing
   * what changed (so the page can tell the customer).
   */
  const syncWithItems = useCallback((serverItems) => {
    const byId = new Map(serverItems.map((item) => [item._id, item]));
    const messages = [];
    let changed = false;

    const next = itemsRef.current.reduce((list, line) => {
      const fresh = byId.get(line._id);
      if (!fresh) {
        messages.push(`${line.name} is no longer available and was removed.`);
        changed = true;
        return list;
      }
      const stock = Number(fresh.stock) || 0;
      if (stock <= 0) {
        messages.push(`${fresh.name} is out of stock and was removed.`);
        changed = true;
        return list;
      }
      let quantity = line.quantity;
      if (quantity > stock) {
        quantity = stock;
        messages.push(`Only ${formatQty(stock, fresh.unit)} of ${fresh.name} left - quantity updated.`);
      }
      if (fresh.price !== line.price) {
        messages.push(`Price of ${fresh.name} is now ${formatCurrency(fresh.price)}.`);
      }
      const updated = {
        ...line,
        name: fresh.name,
        price: fresh.price,
        originalPrice: fresh.originalPrice || null,
        unit: fresh.unit,
        image: fresh.image,
        category: fresh.category,
        stock,
        quantity,
      };
      if (JSON.stringify(updated) !== JSON.stringify(line)) changed = true;
      list.push(updated);
      return list;
    }, []);

    if (changed) setItems(next);
    return messages;
  }, []);

  const value = useMemo(() => {
    const subtotal = round2(items.reduce((sum, line) => sum + line.price * line.quantity, 0));
    // Money saved thanks to live offers
    const savings = round2(
      items.reduce((sum, line) => (line.originalPrice > line.price ? sum + (line.originalPrice - line.price) * line.quantity : sum), 0)
    );
    return {
      items,
      customItems,
      count: items.length + customItems.length,
      subtotal,
      savings,
      addCustomItem,
      updateCustomItem,
      removeCustomItem,
      addItem,
      removeItem,
      setQuantity,
      increment,
      decrement,
      clearCart,
      syncWithItems,
      getQuantity: (id) => {
        const line = items.find((l) => l._id === id);
        return line ? line.quantity : 0;
      },
    };
  }, [items, customItems, addItem, removeItem, setQuantity, increment, decrement, clearCart, syncWithItems, addCustomItem, updateCustomItem, removeCustomItem]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used inside <CartProvider>');
  return context;
};
