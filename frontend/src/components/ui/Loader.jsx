import { Leaf, LoaderCircle } from 'lucide-react';

/** Inline spinner */
export function Spinner({ className = 'size-5' }) {
  return <LoaderCircle className={`animate-spin text-brand-500 ${className}`} />;
}

/** Grey placeholder block with a pulse */
export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-lg bg-slate-200/70 ${className}`} />;
}

/** Full area loader with a gently spinning leaf */
export default function PageLoader({ label = 'Loading...', fullScreen = false }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${fullScreen ? 'min-h-screen' : 'min-h-[40vh]'}`}>
      <div className="relative flex size-14 items-center justify-center">
        <span className="absolute inset-0 animate-ping rounded-full bg-brand-200/60" />
        <span className="relative flex size-14 items-center justify-center rounded-full bg-brand-50">
          <Leaf className="size-7 animate-pulse text-brand-500" />
        </span>
      </div>
      <p className="text-sm font-medium text-slate-500">{label}</p>
    </div>
  );
}

/** Product card placeholders */
export function ProductGridSkeleton({ count = 8 }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        // eslint-disable-next-line react/no-array-index-key
        <div key={i} className="overflow-hidden rounded-2xl border border-slate-100 bg-white">
          <Skeleton className="aspect-square rounded-none" />
          <div className="space-y-2 p-3">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-9 w-full rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Stat card placeholders */
export function CardsSkeleton({ count = 4, className = 'h-24' }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        // eslint-disable-next-line react/no-array-index-key
        <Skeleton key={i} className={`rounded-2xl ${className}`} />
      ))}
    </>
  );
}
