import { Inbox } from 'lucide-react';

/**
 * Friendly "nothing here" block.
 *   <EmptyState icon={Package} title="No items yet" message="Add your first item." action={<Button>Add</Button>} />
 */
export default function EmptyState({ icon: Icon = Inbox, title = 'Nothing here yet', message, action, compact = false, className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center text-center ${compact ? 'px-4 py-8' : 'px-6 py-14'} ${className}`}>
      <div className={`flex items-center justify-center rounded-full bg-brand-50 ${compact ? 'size-12' : 'size-16'}`}>
        <Icon className={`text-brand-500 ${compact ? 'size-6' : 'size-8'}`} />
      </div>
      <h3 className={`mt-4 font-semibold text-slate-800 ${compact ? 'text-sm' : 'text-base'}`}>{title}</h3>
      {message && <p className="mt-1 max-w-sm text-sm text-slate-500">{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
