import { Link, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { initials } from '../../utils/format';
import NotificationBell from './NotificationBell';
import { ADMIN_MENU } from './Sidebar';

export default function Topbar({ onMenuClick }) {
  const { admin } = useAuth();
  const { connected } = useSocket();
  const { pathname } = useLocation();
  const current = ADMIN_MENU.find((item) => pathname.startsWith(item.to));

  return (
    <header className="sticky top-0 z-20 border-b border-slate-100 bg-white/90 backdrop-blur-md">
      <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={onMenuClick}
            className="flex size-10 items-center justify-center rounded-xl text-slate-600 hover:bg-brand-50 lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="size-5" />
          </button>
          <h1 className="truncate text-lg font-semibold">{current ? current.label : 'Admin'}</h1>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <span
            className={`hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium sm:inline-flex ${
              connected ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-slate-500'
            }`}
            title={connected ? 'Receiving live order notifications' : 'Live notifications disconnected'}
          >
            <span className="relative flex size-2">
              {connected && <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand-400 opacity-75" />}
              <span className={`relative inline-flex size-2 rounded-full ${connected ? 'bg-brand-500' : 'bg-slate-400'}`} />
            </span>
            {connected ? 'Live' : 'Offline'}
          </span>

          <NotificationBell />

          <Link to="/admin/account" className="flex items-center gap-2 rounded-xl py-1 pl-1 pr-2 transition hover:bg-brand-50">
            <span className="flex size-9 items-center justify-center rounded-full bg-brand-500 text-sm font-semibold text-on-brand">
              {initials(admin?.name || admin?.username)}
            </span>
            <span className="hidden text-left leading-tight md:block">
              <span className="block text-sm font-semibold text-slate-800">{admin?.name || 'Admin'}</span>
              <span className="block text-xs text-slate-500">@{admin?.username}</span>
            </span>
          </Link>
        </div>
      </div>
    </header>
  );
}
