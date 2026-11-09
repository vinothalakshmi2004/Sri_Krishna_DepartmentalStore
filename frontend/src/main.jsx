import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App';
import ErrorBoundary from './components/ui/ErrorBoundary';
import { StoreProvider } from './context/StoreContext';
import { CartProvider } from './context/CartContext';
import { AuthProvider } from './context/AuthContext';
import { applyCachedTheme } from './utils/theme';
import './index.css';

// Colours from the last visit, so the page does not flash green before the settings load
applyCachedTheme();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <StoreProvider>
        <CartProvider>
          <AuthProvider>
            {/* Shows a "Reload page" screen instead of a blank page if anything crashes */}
            <ErrorBoundary>
              <App />
            </ErrorBoundary>
            <Toaster
              position="top-center"
              gutter={10}
              containerStyle={{ top: 72 }}
              toastOptions={{
                duration: 3500,
                style: {
                  borderRadius: '16px',
                  background: '#FFFFFF',
                  color: 'var(--color-slate-800)',
                  fontFamily: 'Poppins, sans-serif',
                  fontSize: '14px',
                  boxShadow: '0 10px 30px -10px color-mix(in srgb, var(--color-brand-800) 35%, transparent)',
                  border: '1px solid var(--color-brand-100)',
                  whiteSpace: 'pre-line',
                },
                success: { iconTheme: { primary: 'var(--color-brand-500)', secondary: 'var(--color-on-brand)' } },
                error: { iconTheme: { primary: '#EF4444', secondary: '#FFFFFF' } },
              }}
            />
          </AuthProvider>
        </CartProvider>
      </StoreProvider>
    </BrowserRouter>
  </React.StrictMode>
);
