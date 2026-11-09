/**
 * StoreContext - public store settings (name, contact, delivery rules ...)
 * loaded once from GET /api/public/settings and shared by every page.
 * Refreshes when the customer returns to the tab, so admin edits show up.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { publicApi } from '../api/publicApi';
import { getErrorMessage } from '../api/client';
import useRefetchOnFocus from '../hooks/useRefetchOnFocus';
import { imageUrl } from '../utils/links';
import { setSavedTheme } from '../utils/theme';

const StoreContext = createContext(null);
const DEFAULT_STORE_NAME = 'Sri Krishna Department Store';

export function StoreProvider({ children }) {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const data = await publicApi.getSettings();
      setSettings(data);
      setError(null);
      return data;
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load store details.'));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useRefetchOnFocus(refresh);

  // Browser tab icon follows the logo uploaded in Store Settings
  const logo = settings && settings.logo;
  useEffect(() => {
    let link = document.querySelector("link[rel='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.removeAttribute('type');
    link.href = logo ? imageUrl(logo) : '/favicon.png';
  }, [logo]);

  // Website colours chosen by the admin recolour every page
  const theme = settings && settings.theme;
  useEffect(() => {
    if (theme) setSavedTheme(theme);
  }, [theme]);

  const value = useMemo(
    () => ({
      settings,
      loading,
      error,
      refresh,
      storeName: (settings && settings.storeName) || DEFAULT_STORE_NAME,
      isStoreOpen: settings ? settings.isStoreOpen !== false : true,
      // Offers on/off (Admin -> Offers). Hidden until the settings arrive, so a
      // switched-off Offers link never flashes on screen.
      offersEnabled: settings ? settings.offersEnabled !== false : false,
    }),
    [settings, loading, error, refresh]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) throw new Error('useStore must be used inside <StoreProvider>');
  return context;
};
