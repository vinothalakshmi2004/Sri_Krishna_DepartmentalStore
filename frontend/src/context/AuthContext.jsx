/**
 * AuthContext - admin login state.
 *  - JWT is kept in localStorage
 *  - On start-up an existing token is checked with GET /api/auth/me
 *  - Any 401 from an admin API call logs out automatically
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { authApi } from '../api/adminApi';
import { setUnauthorizedHandler, tokenStorage } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  const [token, setToken] = useState(() => tokenStorage.get());
  const [admin, setAdmin] = useState(null);
  const [initializing, setInitializing] = useState(() => Boolean(tokenStorage.get()));

  /** Log out, optionally explaining why, and go to the login page. */
  const logout = useCallback((message) => {
    tokenStorage.clear();
    setToken(null);
    setAdmin(null);
    if (message) toast.error(message, { id: 'auth-logout' });
    navigateRef.current('/admin/login', { replace: true });
  }, []);

  // Auto logout when the server rejects our token
  useEffect(() => {
    setUnauthorizedHandler((message) => logout(message || 'Your session has expired. Please log in again.'));
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  // Validate a saved token once on start-up
  useEffect(() => {
    const saved = tokenStorage.get();
    if (!saved) {
      setInitializing(false);
      return undefined;
    }
    let cancelled = false;
    authApi
      .me()
      .then((data) => {
        if (!cancelled) setAdmin(data);
      })
      .catch(() => {
        if (!cancelled) {
          tokenStorage.clear();
          setToken(null);
        }
      })
      .finally(() => {
        if (!cancelled) setInitializing(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (username, password) => {
    const data = await authApi.login(username, password);
    tokenStorage.set(data.token);
    setToken(data.token);
    setAdmin(data.admin);
    return data.admin;
  }, []);

  /** Replace the token (after a password change the server issues a new one). */
  const updateToken = useCallback((newToken) => {
    tokenStorage.set(newToken);
    setToken(newToken);
  }, []);

  const value = useMemo(
    () => ({
      admin,
      token,
      initializing,
      isAuthenticated: Boolean(token && admin),
      login,
      logout,
      updateToken,
      setAdmin,
    }),
    [admin, token, initializing, login, logout, updateToken]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
};
