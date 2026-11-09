import { CircleAlert, TriangleAlert } from 'lucide-react';
import Modal from './Modal';
import Button from './Button';

/**
 * Yes/No confirmation.
 *   <ConfirmDialog open={open} title="Delete item?" message="This cannot be undone."
 *     confirmText="Delete" tone="danger" loading={busy} onConfirm={remove} onClose={close} />
 * Extra inputs (e.g. a cancel reason) can be passed as children.
 */
export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  tone = 'danger',
  loading = false,
  confirmDisabled = false,
  children,
}) {
  const Icon = tone === 'danger' ? TriangleAlert : CircleAlert;
  const iconClass = tone === 'danger' ? 'bg-red-50 text-red-500' : 'bg-brand-50 text-brand-600';

  return (
    <Modal
      open={open}
      onClose={loading ? undefined : onClose}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            {cancelText}
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} loading={loading} disabled={confirmDisabled}>
            {confirmText}
          </Button>
        </>
      }
    >
      <div className="flex gap-4">
        <div className={`flex size-11 shrink-0 items-center justify-center rounded-full ${iconClass}`}>
          <Icon className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-slate-800">{title}</h3>
          {message && <div className="mt-1 text-sm text-slate-600">{message}</div>}
          {children && <div className="mt-4">{children}</div>}
        </div>
      </div>
    </Modal>
  );
}
