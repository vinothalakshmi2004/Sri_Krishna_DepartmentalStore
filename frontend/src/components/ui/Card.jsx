/**
 * White rounded panel with an optional header.
 *   <Card title="Top items" icon={Star} actions={<Button size="sm">All</Button>}>...</Card>
 */
export default function Card({ title, description, icon: Icon, actions, className = '', bodyClassName = 'p-5', children }) {
  return (
    // min-w-0: inside a grid or flex row a card may shrink to the screen; wide content scrolls inside it
    <section className={`min-w-0 rounded-2xl border border-slate-100 bg-white shadow-card ${className}`}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex min-w-0 items-center gap-2.5">
            {Icon && (
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                <Icon className="size-4" />
              </span>
            )}
            <div className="min-w-0">
              {title && <h3 className="truncate text-base font-semibold">{title}</h3>}
              {description && <p className="text-xs text-slate-500">{description}</p>}
            </div>
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}
