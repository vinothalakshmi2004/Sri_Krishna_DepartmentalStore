import { useCallback, useEffect, useRef, useState } from 'react';
import { getErrorMessage } from '../api/client';

/**
 * Load data with loading / error state.
 *
 *   const { data, loading, error, refetch } = useFetch(() => api.list(params), [params]);
 *
 * - Re-runs when `deps` change.
 * - Ignores out-of-date responses (fast typing in a search box).
 * - refetch({ silent: true }) refreshes without showing the loading state
 *   (used for live socket updates).
 */
export default function useFetch(fetcher, deps = [], { immediate = true, initialData = null } = {}) {
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState(null);
  const requestId = useRef(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const refetch = useCallback(async ({ silent = false } = {}) => {
    const id = ++requestId.current;
    if (!silent) setLoading(true);
    try {
      const result = await fetcherRef.current();
      if (id === requestId.current) {
        setData(result);
        setError(null);
      }
      return result;
    } catch (err) {
      if (id === requestId.current) setError(getErrorMessage(err));
      return undefined;
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (immediate) refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, setData, loading, error, refetch };
}
