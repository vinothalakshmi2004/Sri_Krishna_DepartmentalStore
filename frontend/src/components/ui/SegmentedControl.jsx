/**
 * Pill style tabs / segmented buttons.
 *   <SegmentedControl value={range} onChange={setRange}
 *     options={[{ value: 'today', label: 'Today', count: 3, icon: Calendar }]} />
 */
export default function SegmentedControl({ options, value, onChange, size = 'md', className = '', scrollable = false }) {
  const pad = size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm';
  return (
    <div className={`${scrollable ? 'no-scrollbar overflow-x-auto' : ''} ${className}`}>
      <div className="inline-flex gap-1 rounded-2xl bg-brand-50/80 p-1">
        {options.map((option) => {
          const active = option.value === value;
          const Icon = option.icon;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl font-medium transition-all duration-200 ${pad} ${
                active ? 'bg-white text-brand-800 shadow-card' : 'text-slate-600 hover:text-brand-800'
              }`}
              aria-pressed={active}
              title={option.title}
            >
              {Icon && <Icon className="size-4" />}
              {option.label}
              {option.count !== undefined && (
                <span
                  className={`min-w-5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold leading-none ${
                    active ? 'bg-brand-500 text-on-brand' : 'bg-white/80 text-slate-600'
                  }`}
                >
                  {option.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
