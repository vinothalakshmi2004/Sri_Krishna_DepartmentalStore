/**
 * Axios instance shared by every API call.
 *  - Base URL comes from VITE_API_URL (.env)
 *  - Adds the admin JWT automatically
 *  - Calls the registered "unauthorized" handler on 401 (auto logout)
 */
import axios from 'axios';

export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');

const TOKEN_KEY = 'greenmart_admin_token';

export const tokenStorage = {
  get: () => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: (token) => {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* storage unavailable */
    }
  },
  clear: () => {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* storage unavailable */
    }
  },
};

const api = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 20000,
});

// Attach the token (public calls pass { skipAuth: true })
api.interceptors.request.use((config) => {
  const token = tokenStorage.get();
  if (token && !config.skipAuth) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let unauthorizedHandler = null;

/** AuthContext registers what to do when the session is no longer valid. */
export const setUnauthorizedHandler = (handler) => {
  unauthorizedHandler = handler;
};

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const { response, config = {} } = error;
    const sentToken = Boolean(config.headers && config.headers.Authorization);
    const isLogin = (config.url || '').includes('/auth/login');

    if (response && response.status === 401 && sentToken && !isLogin && !config.skipAuthRedirect && unauthorizedHandler) {
      unauthorizedHandler(response.data && response.data.message);
    }
    return Promise.reject(error);
  }
);

/** Friendly error text from an Axios error (server message when available). */
export const getErrorMessage = (error, fallback = 'Something went wrong. Please try again.') => {
  const data = error && error.response && error.response.data;
  if (data && typeof data === 'object' && !(data instanceof Blob) && data.message) return data.message;
  if (error && error.code === 'ECONNABORTED') return 'The server is taking too long to respond. Please try again.';
  if (error && error.message === 'Network Error') return 'Cannot reach the server. Please check your connection.';
  return fallback;
};

/** Field level errors from a 400 response: [{ field, message, ... }] */
export const getErrorList = (error) => {
  const data = error && error.response && error.response.data;
  return (data && Array.isArray(data.errors) && data.errors) || [];
};

export default api;
