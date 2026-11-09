/**
 * "Your own order" - the customer types any item they need (name + quantity)
 * and adds it to the cart, one after another. These lines have no price: the
 * store prices them after the order is placed and confirms the total.
 */
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, NotebookPen, Pencil, Plus, Trash2, X } from 'lucide-react';
import { CUSTOM_NAME_MAX, CUSTOM_QTY_MAX, MAX_CUSTOM_ITEMS, useCart } from '../../context/CartContext';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { Input } from '../ui/FormControls';

// One tap fills the quantity box (customers can still type anything)
const QUICK_QTY = ['1 kg', '500 g', '250 g', '1 litre', '1 packet', '1 piece'];

/** One line of the list, with a small edit mode */
function OwnItemRow({ line, index, onSave, onRemove }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(line.name);
  const [quantity, setQuantity] = useState(line.quantity);

  const startEdit = () => {
    setName(line.name);
    setQuantity(line.quantity);
    setEditing(true);
  };

  const save = (event) => {
    event.preventDefault();
    if (!name.trim()) return;
    onSave(line.id, { name, quantity });
    setEditing(false);
  };

  if (editing) {
    return (
      <li className="py-2.5">
        <form onSubmit={save} className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1fr_9rem_auto]">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={CUSTOM_NAME_MAX}
            placeholder="Item name"
            aria-label="Item name"
            autoFocus
          />
          <Input
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            maxLength={CUSTOM_QTY_MAX}
            placeholder="Quantity"
            aria-label="Quantity"
            className="col-span-2 row-start-2 sm:col-span-1 sm:row-start-auto"
          />
          <div className="col-start-2 row-start-1 flex gap-1 sm:col-start-3">
            <Button type="submit" size="icon" variant="secondary" disabled={!name.trim()} aria-label="Save item">
              <Check className="size-5" />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => setEditing(false)} aria-label="Cancel edit">
              <X className="size-5" />
            </Button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-3 py-2.5">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">
        {index + 1}
      </span>
      <div className="min-w-0 flex-1">
        <p className="break-words text-sm font-medium text-slate-800">{line.name}</p>
        <p className="text-xs text-slate-500">{line.quantity || 'Quantity not given'}</p>
      </div>
      <button
        type="button"
        onClick={startEdit}
        className="rounded-lg p-2 text-slate-400 transition hover:bg-brand-50 hover:text-brand-700"
        aria-label={`Edit ${line.name}`}
      >
        <Pencil className="size-4" />
      </button>
      <button
        type="button"
        onClick={() => onRemove(line.id)}
        className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-500"
        aria-label={`Remove ${line.name}`}
      >
        <Trash2 className="size-4" />
      </button>
    </li>
  );
}

export default function OwnOrderModal({ open, onClose }) {
  const { customItems, addCustomItem, updateCustomItem, removeCustomItem } = useCart();
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const nameRef = useRef(null);
  const listEndRef = useRef(null);
  const full = customItems.length >= MAX_CUSTOM_ITEMS;

  // Fresh, focused form every time the window opens
  useEffect(() => {
    if (!open) return undefined;
    setName('');
    setQuantity('');
    const timer = setTimeout(() => nameRef.current && nameRef.current.focus(), 80);
    return () => clearTimeout(timer);
  }, [open]);

  const add = (event) => {
    event.preventDefault();
    if (!name.trim()) {
      if (nameRef.current) nameRef.current.focus();
      return;
    }
    if (addCustomItem({ name, quantity })) {
      setName('');
      setQuantity('');
      if (nameRef.current) nameRef.current.focus(); // ready for the next item
      setTimeout(() => listEndRef.current && listEndRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 50);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Your own order"
      description="Can't find something? Type it here - the store will add the price and confirm with you."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {customItems.length ? 'Done' : 'Close'}
          </Button>
          {customItems.length > 0 && (
            <Button to="/cart" iconRight={ArrowRight} onClick={onClose}>
              View cart
            </Button>
          )}
        </>
      }
    >
      <form onSubmit={add} noValidate className="rounded-2xl border border-brand-100 bg-brand-50/50 p-3 sm:p-4">
        <div className="grid gap-2.5 sm:grid-cols-[1fr_10rem]">
          <div>
            <label htmlFor="own-name" className="mb-1 block text-xs font-medium text-slate-600">
              Item name <span className="text-red-500">*</span>
            </label>
            <Input
              id="own-name"
              ref={nameRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Aashirvaad atta, Kalyan ghee"
              maxLength={CUSTOM_NAME_MAX}
              autoComplete="off"
              disabled={full}
            />
          </div>
          <div>
            <label htmlFor="own-qty" className="mb-1 block text-xs font-medium text-slate-600">
              Quantity
            </label>
            <Input
              id="own-qty"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="e.g. 2 kg"
              maxLength={CUSTOM_QTY_MAX}
              autoComplete="off"
              disabled={full}
            />
          </div>
        </div>
        {/* Wraps onto a second line on small phones, so every option stays visible */}
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {QUICK_QTY.map((qty) => (
            <button
              key={qty}
              type="button"
              disabled={full}
              onClick={() => setQuantity(qty)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition disabled:opacity-50 ${
                quantity === qty ? 'bg-brand-500 text-on-brand' : 'bg-white text-brand-800 ring-1 ring-brand-100 hover:bg-brand-100'
              }`}
            >
              {qty}
            </button>
          ))}
        </div>
        <Button type="submit" icon={Plus} fullWidth className="mt-3" disabled={full || !name.trim()}>
          Add item
        </Button>
        {full && <p className="mt-2 text-center text-xs font-medium text-amber-700">You can add up to {MAX_CUSTOM_ITEMS} items.</p>}
      </form>

      <div className="mt-5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-700">Your list</h3>
          <span className="text-xs text-slate-500">
            {customItems.length} / {MAX_CUSTOM_ITEMS}
          </span>
        </div>
        {customItems.length === 0 ? (
          <div className="mt-3 flex flex-col items-center rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center">
            <NotebookPen className="size-7 text-slate-300" />
            <p className="mt-2 text-sm text-slate-500">No items yet. Type an item above and tap “Add item”.</p>
          </div>
        ) : (
          <ul className="mt-1 divide-y divide-slate-100">
            {customItems.map((line, index) => (
              <OwnItemRow key={line.id} line={line} index={index} onSave={updateCustomItem} onRemove={removeCustomItem} />
            ))}
          </ul>
        )}
        <div ref={listEndRef} />
      </div>
    </Modal>
  );
}
