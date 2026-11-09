import { Leaf } from 'lucide-react';

/** Section title with a small leaf eyebrow */
export default function SectionHeading({ eyebrow, title, subtitle, align = 'center', className = '' }) {
  const alignClass = align === 'center' ? 'mx-auto text-center items-center' : 'text-left items-start';
  return (
    <div className={`flex max-w-2xl flex-col ${alignClass} ${className}`}>
      {eyebrow && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-brand-700">
          <Leaf className="size-3.5" /> {eyebrow}
        </span>
      )}
      <h2 className="mt-3 text-2xl font-bold sm:text-3xl lg:text-4xl">{title}</h2>
      {subtitle && <p className="mt-3 text-sm text-slate-600 sm:text-base">{subtitle}</p>}
    </div>
  );
}
