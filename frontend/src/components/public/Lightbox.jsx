import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import useLockBodyScroll from '../../hooks/useLockBodyScroll';
import { imageUrl } from '../../utils/links';

/**
 * Full screen image viewer with arrows, keyboard (← → Esc) and swipe support.
 */
export default function Lightbox({ images, index, onClose, onChange }) {
  const open = index !== null && index !== undefined;
  const touchStart = useRef(null);
  useLockBodyScroll(open);

  const total = images.length;
  const prev = () => onChange((index - 1 + total) % total);
  const next = () => onChange((index + 1) % total);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowLeft') onChange((index - 1 + total) % total);
      if (event.key === 'ArrowRight') onChange((index + 1) % total);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, index, total, onClose, onChange]);

  if (!open) return null;

  const onTouchStart = (event) => {
    touchStart.current = event.touches[0].clientX;
  };
  const onTouchEnd = (event) => {
    if (touchStart.current === null) return;
    const delta = event.changedTouches[0].clientX - touchStart.current;
    if (Math.abs(delta) > 50) (delta > 0 ? prev : next)();
    touchStart.current = null;
  };

  const navButton =
    'absolute top-1/2 z-10 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-white/30';

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-black/90 p-4"
      onClick={onClose}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      role="dialog"
      aria-modal="true"
      aria-label="Image gallery"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 z-10 flex size-11 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/30"
        aria-label="Close gallery"
      >
        <X className="size-6" />
      </button>

      {total > 1 && (
        <>
          <button type="button" className={`${navButton} left-3 sm:left-6`} onClick={(e) => { e.stopPropagation(); prev(); }} aria-label="Previous image">
            <ChevronLeft className="size-6" />
          </button>
          <button type="button" className={`${navButton} right-3 sm:right-6`} onClick={(e) => { e.stopPropagation(); next(); }} aria-label="Next image">
            <ChevronRight className="size-6" />
          </button>
        </>
      )}

      <img
        key={images[index]}
        src={imageUrl(images[index])}
        alt={`Gallery ${index + 1}`}
        className="max-h-[85vh] max-w-full animate-pop rounded-2xl object-contain shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />

      <p className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-white/15 px-3 py-1 text-sm text-white backdrop-blur">
        {index + 1} / {total}
      </p>
    </div>,
    document.body
  );
}
