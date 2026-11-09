/**
 * Account & Security: change username / password and system (.env) settings.
 */
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Database,
  Eye,
  EyeOff,
  KeyRound,
  RefreshCw,
  Server,
  ShieldAlert,
  TriangleAlert,
  UserCog,
  Wand2,
} from 'lucide-react';
import { authApi, settingsApi } from '../../api/adminApi';
import { getErrorList, getErrorMessage } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import useFetch from '../../hooks/useFetch';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import PageHeader from '../../components/admin/PageHeader';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { Field, Input } from '../../components/ui/FormControls';
import { Skeleton } from '../../components/ui/Loader';

const SYSTEM_FIELDS = [
  { key: 'MONGO_URI', label: 'MongoDB URI', placeholder: 'mongodb://127.0.0.1:27017/greenmart', current: (s) => s.mongoUri },
  { key: 'JWT_SECRET', label: 'JWT secret', placeholder: 'At least 16 characters, no spaces', current: (s) => s.jwt.secret, secret: true },
  { key: 'JWT_EXPIRES_IN', label: 'Login expires in', placeholder: '7d, 12h, 30m', current: (s) => s.jwt.expiresIn },
  { key: 'PORT', label: 'Server port', placeholder: '5000', current: (s) => s.port },
  { key: 'CLIENT_URL', label: 'Frontend URL(s)', placeholder: 'http://localhost:5173', current: (s) => s.clientUrl },
];

/** 64 character random hex string for JWT_SECRET */
const generateSecret = () => {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
};

function PasswordInput({ id, value, onChange, placeholder, invalid, autoComplete }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input id={id} type={show ? 'text' : 'password'} value={value} onChange={onChange} placeholder={placeholder} invalid={invalid} autoComplete={autoComplete} className="pr-11" />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        aria-label={show ? 'Hide' : 'Show'}
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

function ProfileCard() {
  const { admin, setAdmin } = useAuth();
  const [form, setForm] = useState({ username: admin?.username || '', name: admin?.name || '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (admin) setForm({ username: admin.username, name: admin.name || '' });
  }, [admin]);

  const unchanged = admin && form.username.trim().toLowerCase() === admin.username && form.name.trim() === (admin.name || '');

  const submit = async (event) => {
    event.preventDefault();
    const username = form.username.trim().toLowerCase();
    if (!/^[a-z0-9_.-]{3,30}$/.test(username)) {
      setError('3-30 characters: letters, numbers, dot, dash or underscore');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const res = await authApi.changeUsername(username, form.name.trim() || undefined);
      setAdmin(res.data);
      toast.success('Profile updated');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title="Profile" description="Your login name and display name" icon={UserCog}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Username" htmlFor="username" error={error} hint="Used to log in. Lowercase letters, numbers, . _ -">
          <Input id="username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} autoComplete="username" autoCapitalize="none" invalid={Boolean(error)} />
        </Field>
        <Field label="Display name" htmlFor="display-name">
          <Input id="display-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={60} placeholder="Store Admin" />
        </Field>
        <div className="flex justify-end">
          <Button type="submit" loading={saving} disabled={unchanged}>
            Save profile
          </Button>
        </div>
      </form>
    </Card>
  );
}

function PasswordCard() {
  const { updateToken } = useAuth();
  const empty = { oldPassword: '', newPassword: '', confirmPassword: '' };
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const set = (name) => (event) => setForm((prev) => ({ ...prev, [name]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    const next = {};
    if (!form.oldPassword) next.oldPassword = 'Enter your current password';
    if (form.newPassword.length < 6) next.newPassword = 'Use at least 6 characters';
    else if (form.newPassword === form.oldPassword) next.newPassword = 'New password must be different';
    if (form.confirmPassword !== form.newPassword) next.confirmPassword = 'Passwords do not match';
    setErrors(next);
    if (Object.keys(next).length) return;

    setSaving(true);
    try {
      const res = await authApi.changePassword(form.oldPassword, form.newPassword);
      updateToken(res.data.token); // keep this session logged in
      setForm(empty);
      toast.success('Password changed. Other devices will need to log in again.');
    } catch (err) {
      toast.error(getErrorMessage(err));
      const fieldErrors = {};
      getErrorList(err).forEach((e) => {
        if (e.field) fieldErrors[e.field] = e.message;
      });
      setErrors(fieldErrors);
    } finally {
      setSaving(false);
    }
  };

  const strength = form.newPassword.length >= 12 ? 'Strong' : form.newPassword.length >= 8 ? 'Good' : form.newPassword ? 'Weak' : '';

  return (
    <Card title="Change password" description="You stay logged in on this device" icon={KeyRound}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Current password" htmlFor="oldPassword" error={errors.oldPassword}>
          <PasswordInput id="oldPassword" value={form.oldPassword} onChange={set('oldPassword')} autoComplete="current-password" invalid={Boolean(errors.oldPassword)} />
        </Field>
        <Field
          label="New password"
          htmlFor="newPassword"
          error={errors.newPassword}
          hint={strength ? `Strength: ${strength}` : 'At least 6 characters (12+ recommended)'}
        >
          <PasswordInput id="newPassword" value={form.newPassword} onChange={set('newPassword')} autoComplete="new-password" invalid={Boolean(errors.newPassword)} />
        </Field>
        <Field label="Confirm new password" htmlFor="confirmPassword" error={errors.confirmPassword}>
          <PasswordInput id="confirmPassword" value={form.confirmPassword} onChange={set('confirmPassword')} autoComplete="new-password" invalid={Boolean(errors.confirmPassword)} />
        </Field>
        <div className="flex justify-end">
          <Button type="submit" loading={saving}>
            Change password
          </Button>
        </div>
      </form>
    </Card>
  );
}

function SystemSettingsCard() {
  const { data: system, loading, error, refetch } = useFetch(() => settingsApi.getSystem(), []);
  const [form, setForm] = useState({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [understood, setUnderstood] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);

  const changes = Object.fromEntries(Object.entries(form).filter(([, v]) => v && v.trim()));
  const hasChanges = Object.keys(changes).length > 0;

  const save = async () => {
    setSaving(true);
    try {
      const res = await settingsApi.updateSystem(Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, v.trim()])));
      setResult({ message: res.message, keys: res.data.updatedKeys });
      setForm({});
      setConfirmOpen(false);
      setUnderstood(false);
      toast.success(res.message, { duration: 6000 });
      refetch({ silent: true });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card
      title="System settings"
      description="Server configuration stored in the backend .env file"
      icon={Server}
      className="border-red-200 lg:col-span-2"
      actions={
        <Button size="sm" variant="ghost" icon={RefreshCw} onClick={() => refetch()}>
          Refresh
        </Button>
      }
    >
      {/* Red warning */}
      <div className="flex gap-3 rounded-2xl border-2 border-red-300 bg-red-50 p-4 text-red-800" role="alert">
        <TriangleAlert className="mt-0.5 size-6 shrink-0" />
        <div>
          <p className="font-bold">Server restart required. Wrong value will stop the app.</p>
          <p className="mt-1 text-sm text-red-700">
            {system?.warning ||
              'A wrong MONGO_URI stops the server from reaching the database. Changing JWT_SECRET logs out every admin. Only change these if you know what you are doing.'}
          </p>
        </div>
      </div>

      {loading && !system && <Skeleton className="mt-4 h-40 w-full rounded-2xl" />}
      {error && !system && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {system && (
        <>
          {system.restartRequired && (
            <p className="mt-4 flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-sm font-medium text-amber-800">
              <RefreshCw className="size-4" /> Saved changes are waiting for a server restart.
            </p>
          )}
          {system.jwt.isWeakSecret && (
            <p className="mt-4 flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
              <ShieldAlert className="size-4 shrink-0" /> The JWT secret looks weak or is still the test value. Generate a strong one below.
            </p>
          )}
          {result && (
            <div className="mt-4 rounded-xl border border-brand-200 bg-brand-50 px-3 py-2.5 text-sm text-brand-800">
              <strong>{result.message}.</strong> Updated: {result.keys.join(', ')}. Stop and start the backend (npm run dev) for the changes to take effect.
            </div>
          )}

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {SYSTEM_FIELDS.map(({ key, label, placeholder, current, secret }) => (
              <Field key={key} label={label} htmlFor={`sys-${key}`} hint={`Current: ${current(system) || '—'}`}>
                <div className="flex gap-2">
                  <div className="min-w-0 flex-1">
                    <Input
                      id={`sys-${key}`}
                      value={form[key] || ''}
                      onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
                      placeholder={`Leave blank to keep · ${placeholder}`}
                      icon={key === 'MONGO_URI' ? Database : undefined}
                      autoComplete="off"
                      spellCheck={false}
                    />
                  </div>
                  {secret && (
                    <Button variant="outline" icon={Wand2} onClick={() => setForm((prev) => ({ ...prev, [key]: generateSecret() }))} title="Generate a strong random secret">
                      Generate
                    </Button>
                  )}
                </div>
              </Field>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <p className="text-xs text-slate-500">Environment: {system.nodeEnv} · A backup of the old file is saved as .env.backup</p>
            <Button variant="danger" disabled={!hasChanges} onClick={() => setConfirmOpen(true)}>
              Update system settings
            </Button>
          </div>
        </>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => {
          setConfirmOpen(false);
          setUnderstood(false);
        }}
        onConfirm={save}
        loading={saving}
        confirmDisabled={!understood}
        title="Update server configuration?"
        message={
          <>
            You are changing: <strong>{Object.keys(changes).join(', ')}</strong>. The server must be restarted, and a wrong value will stop the app.
            {changes.JWT_SECRET && ' Changing the JWT secret logs out every admin after the restart.'}
          </>
        }
        confirmText="Yes, update .env"
      >
        <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} className="mt-0.5 size-4 accent-red-500" />
          I understand that a wrong value can stop the app and the server needs a restart.
        </label>
      </ConfirmDialog>
    </Card>
  );
}

export default function Account() {
  useDocumentTitle('Account & security');
  return (
    <div>
      <PageHeader title="Account & Security" description="Manage your login details and server configuration." />
      <div className="grid gap-6 lg:grid-cols-2">
        <ProfileCard />
        <PasswordCard />
        <SystemSettingsCard />
      </div>
    </div>
  );
}
