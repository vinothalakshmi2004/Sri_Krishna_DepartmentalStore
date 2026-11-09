import { useEffect } from 'react';

let lockCount = 0;

/** Stop the page behind a modal/drawer from scrolling while `locked` is true. */
export default function useLockBodyScroll(locked) {
  useEffect(() => {
    if (!locked) return undefined;
    lockCount += 1;
    document.body.style.overflow = 'hidden';
    return () => {
      lockCount -= 1;
      if (lockCount === 0) document.body.style.overflow = '';
    };
  }, [locked]);
}
