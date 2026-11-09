import { useEffect } from 'react';
import { useStore } from '../context/StoreContext';

/**
 * Set the browser tab title: "Cart · Sri Krishna Department Store".
 * The suffix defaults to the store name from Store Settings ('' = no suffix).
 */
export default function useDocumentTitle(title, suffix) {
  const { storeName } = useStore();
  const end = suffix === undefined ? storeName : suffix;

  useEffect(() => {
    document.title = title && end ? `${title} · ${end}` : title || end;
  }, [title, end]);
}
