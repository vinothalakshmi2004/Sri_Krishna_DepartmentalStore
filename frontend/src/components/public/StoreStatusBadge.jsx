import { useStore } from '../../context/StoreContext';

/** "Open now" / "Closed now" pill with a live dot */
export default function StoreStatusBadge({ className = '' }) {
  const { isStoreOpen, loading } = useStore();
  if (loading) return null;

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${
        isStoreOpen ? 'bg-white text-brand-800 ring-brand-200' : 'bg-red-50 text-red-700 ring-red-200'
      } ${className}`}
    >
      <span className="relative flex size-2">
        {isStoreOpen && <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand-400 opacity-75" />}
        <span className={`relative inline-flex size-2 rounded-full ${isStoreOpen ? 'bg-brand-500' : 'bg-red-500'}`} />
      </span>
      {isStoreOpen ? 'Open now · Taking orders' : 'Closed now · Not taking orders'}
    </span>
  );
}
