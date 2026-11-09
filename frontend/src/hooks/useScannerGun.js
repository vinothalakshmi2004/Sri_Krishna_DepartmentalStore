import { useEffect, useRef } from 'react';
import { BARCODE_PATTERN } from '../utils/barcode';

// A USB / Bluetooth barcode scanner types much faster than a person
const MAX_KEY_GAP_MS = 60;
const MIN_LENGTH = 6;

/**
 * Calls onScan(code) when a barcode scanner "types" a code and presses Enter
 * while no text box has focus (text boxes receive the code themselves).
 */
export default function useScannerGun(onScan, enabled = true) {
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    if (!enabled) return undefined;
    let buffer = '';
    let lastKeyAt = 0;

    const onKeyDown = (event) => {
      const target = event.target;
      if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return;
      if (event.ctrlKey || event.altKey || event.metaKey) return;

      const now = Date.now();
      if (now - lastKeyAt > MAX_KEY_GAP_MS) buffer = '';
      lastKeyAt = now;

      if (event.key === 'Enter') {
        if (buffer.length >= MIN_LENGTH && BARCODE_PATTERN.test(buffer)) {
          event.preventDefault();
          onScanRef.current(buffer);
        }
        buffer = '';
      } else if (event.key.length === 1) {
        buffer += event.key;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled]);
}
