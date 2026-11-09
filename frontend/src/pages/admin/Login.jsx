import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Eye, EyeOff, Lock, LogIn, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { getErrorMessage } from '../../api/client';
import { imageUrl } from '../../utils/links';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import Button from '../../components/ui/Button';
import { Field, Input } from '../../components/ui/FormControls';
import PageLoader from '../../components/ui/Loader';
import StoreLogo from '../../components/public/StoreLogo';
import { FloatingLeaves, LeafShape } from '../../components/public/Decor';

export default function Login() {
  useDocumentTitle('Admin login');
  const { login, isAuthenticated, initializing } = useAuth();
  const { storeName, settings } = useStore();
  const fullLogo = settings && settings.logoFull ? imageUrl(settings.logoFull) : null;
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state && location.state.from && location.state.from.pathname) || '/admin/dashboard';

  const [form, setForm] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (initializing) return <PageLoader fullScreen />;
  if (isAuthenticated) return <Navigate to={from} replace />;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.username.trim() || !form.password) {
      setError('Please enter your username and password');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const admin = await login(form.username.trim(), form.password);
      toast.success(`Welcome back, ${admin.name || admin.username}!`);
      navigate(from, { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, 'Login failed. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <LeafShape className="absolute -right-16 -top-16 size-80 rotate-[200deg] text-white/10" />
        <LeafShape className="absolute -bottom-20 -left-10 size-96 rotate-[20deg] text-white/10" />
        <StoreLogo light to="/" />
        <div className="relative">
          {fullLogo && (
            <img src={fullLogo} alt={storeName} className="mb-8 w-full max-w-sm rounded-3xl bg-white object-contain p-4 shadow-2xl" />
          )}
          <h1 className="text-4xl font-bold leading-tight text-white">Manage your store with ease.</h1>
          <p className="mt-4 max-w-md text-brand-100">
            Live order alerts, stock, income and expenses — everything for {storeName} in one place.
          </p>
        </div>
        <p className="relative text-sm text-brand-200">© {new Date().getFullYear()} {storeName}</p>
      </div>

      {/* Form */}
      <div className="relative flex items-center justify-center overflow-hidden bg-gradient-to-br from-brand-50 via-white to-beige px-4 py-12">
        <FloatingLeaves className="opacity-60 lg:hidden" />
        <div className="relative w-full max-w-md">
          <div className="mb-8 flex justify-center lg:hidden">
            {fullLogo ? <img src={fullLogo} alt={storeName} className="h-24 w-auto rounded-2xl bg-white object-contain p-2 shadow-card" /> : <StoreLogo />}
          </div>
          <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-soft sm:p-8">
            <h2 className="text-2xl font-bold">Admin login</h2>
            <p className="mt-1 text-sm text-slate-500">Sign in to manage orders and your store.</p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
              <Field label="Username" htmlFor="username">
                <Input
                  id="username"
                  icon={User}
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  autoComplete="username"
                  autoCapitalize="none"
                  placeholder="admin"
                  autoFocus
                  invalid={Boolean(error)}
                />
              </Field>
              <Field label="Password" htmlFor="password">
                <div className="relative">
                  <Input
                    id="password"
                    icon={Lock}
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="pr-11"
                    invalid={Boolean(error)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </Field>

              {error && (
                <p className="rounded-xl bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700" role="alert">
                  {error}
                </p>
              )}

              <Button type="submit" size="lg" fullWidth loading={submitting} icon={LogIn}>
                Sign in
              </Button>
            </form>
          </div>
          <Link to="/" className="mt-6 flex items-center justify-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-800">
            <ArrowLeft className="size-4" /> Back to store
          </Link>
        </div>
      </div>
    </div>
  );
}
