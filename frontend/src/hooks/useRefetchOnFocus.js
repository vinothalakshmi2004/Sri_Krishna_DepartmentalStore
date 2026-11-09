import { useEffect, useRef } from 'react';

/**
 * Call `callback` when the user comes back to the tab, so admin changes
 * (prices, stock, store open/closed) show up without a manual refresh.
 */
export default function useRefetchOnFocus(callback, minIntervalMs = 15000) {
  const callbackRef = useRef(callback);
  const lastRun = useRef(Date.now());
  callbackRef.current = callback;

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastRun.current < minIntervalMs) return;
      lastRun.current = Date.now();
      callbackRef.current();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [minIntervalMs]);
}
