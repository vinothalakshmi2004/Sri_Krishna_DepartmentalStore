import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  BadgePercent,
  DatabaseBackup,
  ExternalLink,
  FileChartColumn,
  LayoutDashboard,
  LogOut,
  Package,
  Palette,
  Receipt,
  ShieldCheck,
  ShoppingBag,
  Store,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import StoreLogo from '../public/StoreLogo';
import ConfirmDialog from '../ui/ConfirmDialog';

export const ADMIN_MENU = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/orders', label: 'Orders', icon: ShoppingBag, showUnread: true },
  { to: '/admin/items', label: 'Items', icon: Package },
  { to: '/admin/offers', label: 'Offers', icon: BadgePercent },
  { to: '/admin/income', label: 'Income', icon: Wallet },
  { to: '/admin/expenses', label: 'Expenses', icon: Receipt },
  { to: '/admin/customers', label: 'Customers', icon: Users },
  { to: '/admin/reports', label: 'Reports', icon: FileChartColumn },
  { to: '/admin/settings', label: 'Store Settings', icon: Store },
  { to: '/admin/colours', label: 'Website Colours', icon: Palette },
  { to: '/admin/backup', label: 'Backup', icon: DatabaseBackup },
  { to: '/admin/account', label: 'Account & Security', icon: ShieldCheck },
];

/** Left navigation. Fixed on desktop, slide-in drawer on phones/tablets. */
export default function Sidebar({ open, onClose }) {
  const { logout } = useAuth();
  const { unreadCount } = useSocket();
  const [confirmLogout, setConfirmLogout] = useState(false);

  const linkClass = ({ isActive }) =>
    `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
      isActive ? 'bg-brand-500 text-on-brand shadow-soft' : 'text-slate-600 hover:bg-brand-50 hover:text-brand-800'
    }`;

  const content = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center justify-between gap-2 border-b border-slate-100 px-4">
        <StoreLogo to="/admin/dashboard" />
        <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 lg:hidden" aria-label="Close menu">
          <X className="size-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4" aria-label="Admin">
        {ADMIN_MENU.map(({ to, label, icon: Icon, showUnread }) => (
          <NavLink key={to} to={to} className={linkClass} onClick={onClose}>
            {({ isActive }) => (
              <>
                <Icon className={`size-5 shrink-0 ${isActive ? '' : 'text-brand-600/80 group-hover:text-brand-700'}`} />
                <span className="flex-1 truncate">{label}</span>
                {showUnread && unreadCount > 0 && (
                  <span
                    className={`min-w-5 rounded-full px-1.5 py-0.5 text-center text-[11px] font-bold leading-none ${
                      isActive ? 'bg-white text-brand-700' : 'bg-red-500 text-white'
                    }`}
                  >
                    {unreadCount}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="space-y-1 border-t border-slate-100 p-3">
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-brand-50 hover:text-brand-800"
        >
          <ExternalLink className="size-5 text-brand-600/80" /> View store
        </a>
        <button
          type="button"
          onClick={() => setConfirmLogout(true)}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50"
        >
          <LogOut className="size-5" /> Logout
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-100 bg-white lg:block">{content}</aside>

      {/* Mobile */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 animate-fade-in bg-slate-900/40 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] animate-slide-up bg-white shadow-2xl">{content}</aside>
        </div>
      )}

      <ConfirmDialog
        open={confirmLogout}
        onClose={() => setConfirmLogout(false)}
        onConfirm={() => {
          setConfirmLogout(false);
          logout();
        }}
        title="Log out?"
        message="You will stop receiving new order alerts on this device until you log in again."
        confirmText="Logout"
      />
    </>
  );
}
