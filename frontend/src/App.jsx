/**
 * Routes.
 * Customer pages load right away; the admin portal (with charts) is
 * lazy-loaded so the public website stays light on phones.
 */
import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import PublicLayout from './components/public/PublicLayout';
import PageLoader from './components/ui/Loader';
import Home from './pages/public/Home';
import OrderPage from './pages/public/OrderPage';
import Cart from './pages/public/Cart';
import Checkout from './pages/public/Checkout';
import OrderSuccess from './pages/public/OrderSuccess';
import TrackOrder from './pages/public/TrackOrder';
import NotFound from './pages/NotFound';

// Admin (separate bundle)
const ProtectedRoute = lazy(() => import('./components/admin/ProtectedRoute'));
const AdminShell = lazy(() => import('./pages/admin/AdminShell'));
const Login = lazy(() => import('./pages/admin/Login'));
const Dashboard = lazy(() => import('./pages/admin/Dashboard'));
const Orders = lazy(() => import('./pages/admin/Orders'));
const Items = lazy(() => import('./pages/admin/Items'));
const BulkUpload = lazy(() => import('./pages/admin/BulkUpload'));
const Offers = lazy(() => import('./pages/admin/Offers'));
const Income = lazy(() => import('./pages/admin/Income'));
const Expenses = lazy(() => import('./pages/admin/Expenses'));
const Customers = lazy(() => import('./pages/admin/Customers'));
const Reports = lazy(() => import('./pages/admin/Reports'));
const StoreSettings = lazy(() => import('./pages/admin/StoreSettings'));
const WebsiteColours = lazy(() => import('./pages/admin/WebsiteColours'));
const Account = lazy(() => import('./pages/admin/Account'));
const Backup = lazy(() => import('./pages/admin/Backup'));

export default function App() {
  return (
    <Suspense fallback={<PageLoader fullScreen />}>
      <Routes>
        {/* Customer website */}
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/order" element={<OrderPage />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/order-success/:orderId" element={<OrderSuccess />} />
          <Route path="/track" element={<TrackOrder />} />
        </Route>

        {/* Admin portal */}
        <Route path="/admin/login" element={<Login />} />
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminShell />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="orders" element={<Orders />} />
          <Route path="items" element={<Items />} />
          <Route path="items/bulk" element={<BulkUpload />} />
          <Route path="offers" element={<Offers />} />
          <Route path="income" element={<Income />} />
          <Route path="expenses" element={<Expenses />} />
          <Route path="customers" element={<Customers />} />
          <Route path="reports" element={<Reports />} />
          <Route path="settings" element={<StoreSettings />} />
          <Route path="colours" element={<WebsiteColours />} />
          <Route path="backup" element={<Backup />} />
          <Route path="account" element={<Account />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
