import { Clock, Store } from 'lucide-react';
import { useStore } from '../../context/StoreContext';

/** Warning shown on shopping pages while the store is not accepting orders. */
export default function StoreClosedBanner({ className = '' }) {
  const { isStoreOpen, settings } = useStore();
  if (isStoreOpen) return null;

  return (
    <div className={`flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800 ${className}`} role="alert">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-red-100">
        <Store className="size-5" />
      </span>
      <div>
        <p className="font-semibold">Store is closed now</p>
        <p className="mt-0.5 text-sm text-red-700">
          We are not taking orders at the moment. You can still browse products.
        </p>
        {settings && settings.openingHours && (
          <p className="mt-1.5 flex items-center gap-1.5 text-sm text-red-700">
            <Clock className="size-4" /> {settings.openingHours}
          </p>
        )}
      </div>
    </div>
  );
}
