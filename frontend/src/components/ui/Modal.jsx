import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import useLockBodyScroll from '../../hooks/useLockBodyScroll';
import { isTopOverlay, pushOverlay, removeOverlay } from './overlayStack';

const SIZES = {
  sm: 'sm:max-w-md',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-4xl',
};

/**
 * Accessible modal. Slides up as a bottom sheet on phones, centred on larger screens.
 *   <Modal open={open} onClose={close} title="Add item" footer={<Button>Save</Button>}>...</Modal>
 */
export default function Modal({
  open,
  onClose,
  title,
  description,
  footer,
  size = 'md',
  closeOnBackdrop = true,
  children,
}) {
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
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div
        className="absolute inset-0 animate-fade-in bg-slate-900/40 backdrop-blur-[2px]"
        onClick={closeOnBackdrop ? onClose : undefined}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? `${id}-title` : undefined}
        className={`relative flex max-h-[92vh] w-full animate-slide-up flex-col rounded-t-3xl bg-white shadow-2xl sm:rounded-2xl ${SIZES[size] || SIZES.md}`}
      >
        {(title || onClose) && (
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
            <div>
              {title && (
                <h2 id={`${id}-title`} className="text-lg font-semibold">
                  {title}
                </h2>
              )}
              {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
            </div>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                aria-label="Close"
              >
                <X className="size-5" />
              </button>
            )}
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex flex-wrap justify-end gap-2 rounded-b-2xl border-t border-slate-100 bg-slate-50/60 px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
