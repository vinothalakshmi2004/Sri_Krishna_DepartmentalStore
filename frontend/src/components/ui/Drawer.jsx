import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import useLockBodyScroll from '../../hooks/useLockBodyScroll';
import { isTopOverlay, pushOverlay, removeOverlay } from './overlayStack';

/**
 * Side panel that slides in from the right (full screen on phones).
 * Used for the order details view.
 */
export default function Drawer({ open, onClose, title, subtitle, headerExtra, footer, children, width = 'sm:max-w-xl' }) {
  const id = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useLockBodyScroll(open);

  useEffect(() => {
    if (!open) return undefined;
    pushOverlay(id);
    const onKey = (event) => {
      if (event.key === 'Escape' && isTopOverlay(id) && onCloseRef.current) onCloseRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      removeOverlay(id);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, id]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 animate-fade-in bg-slate-900/40 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
      <aside
        role="dialog"
        aria-modal="true"
        className={`absolute inset-y-0 right-0 flex w-full animate-slide-in-right flex-col bg-white shadow-2xl ${width}`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            {title && <h2 className="truncate text-lg font-semibold">{title}</h2>}
            {subtitle && <div className="mt-0.5 text-sm text-slate-500">{subtitle}</div>}
          </div>
          <div className="flex items-center gap-2">
            {headerExtra}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              aria-label="Close"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
        {footer && <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-3">{footer}</div>}
      </aside>
    </div>,
    document.body
  );
}
