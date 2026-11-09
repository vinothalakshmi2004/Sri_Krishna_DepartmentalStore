import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Leaf } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { imageUrl } from '../../utils/links';

/**
 * Split a long store name into a two-line lockup:
 * "Sri Krishna Department Store" -> ["Sri Krishna", "Department Store"]
 */
const splitName = (name) => {
  const words = name.trim().split(/\s+/);
  if (words.length <= 2) return [name, ''];
  return [words.slice(0, 2).join(' '), words.slice(2).join(' ')];
};

/** Square store logo (from Store Settings, or a leaf mark) with the store name */
export default function StoreLogo({ to = '/', light = false, showName = true, className = '' }) {
  const { settings, storeName } = useStore();
  const [failed, setFailed] = useState(false);
  const logo = settings && settings.logo && !failed ? imageUrl(settings.logo) : null;
  const [main, sub] = splitName(storeName);

  return (
    <Link to={to} className={`group flex min-w-0 items-center gap-2.5 ${className}`}>
      {logo ? (
        <img
          src={logo}
          alt={`${storeName} logo`}
          className="size-11 shrink-0 rounded-xl bg-white object-contain p-0.5 shadow-card ring-1 ring-slate-100 transition group-hover:scale-105"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-500 text-on-brand shadow-soft transition group-hover:rotate-[-8deg]">
          <Leaf className="size-5" />
        </span>
      )}
      {showName && (
        <span className="min-w-0 leading-tight">
          <span className={`block truncate text-base font-extrabold tracking-tight sm:text-lg ${light ? 'text-white' : 'text-brand-800'}`}>
            {main}
          </span>
          {sub && (
            <span
              className={`block truncate text-[10px] font-semibold uppercase tracking-[0.16em] sm:text-[11px] ${
                light ? 'text-brand-100' : 'text-brand-600'
              }`}
            >
              {sub}
            </span>
          )}
        </span>
      )}
    </Link>
  );
}
