/** Page title row with optional description and action buttons */
export default function PageHeader({ title, description, actions, className = '' }) {
  return (
    <div className={`mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between ${className}`}>
      <div className="min-w-0">
        <h2 className="text-2xl font-bold">{title}</h2>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
