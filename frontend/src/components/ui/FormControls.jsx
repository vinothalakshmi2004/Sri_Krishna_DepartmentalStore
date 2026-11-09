/**
 * Form building blocks: Field (label + error), Input, Textarea, Select, Toggle.
 */
import { forwardRef } from 'react';

// text-base (16px) on phones: iPhone Safari zooms into inputs smaller than 16px
const CONTROL =
  'w-full rounded-xl border bg-white px-3.5 py-2.5 text-base sm:text-sm text-slate-800 placeholder:text-slate-400 ' +
  'transition focus:outline-none focus:ring-4 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500';

const stateClass = (invalid) =>
  invalid
    ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
    : 'border-slate-200 hover:border-slate-300 focus:border-brand-400 focus:ring-brand-100';

/** Label, hint and error message around any control */
export function Field({ label, htmlFor, error, hint, required, className = '', children }) {
  return (
    <div className={className}>
      {label && (
        <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-slate-700">
          {label}
          {required && <span className="ml-0.5 text-red-500">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="mt-1 text-xs font-medium text-red-600 [overflow-wrap:anywhere]">{error}</p>
      ) : (
        hint && <p className="mt-1 text-xs text-slate-500 [overflow-wrap:anywhere]">{hint}</p>
      )}
    </div>
  );
}

export const Input = forwardRef(function Input({ invalid, icon: Icon, className = '', ...props }, ref) {
  if (!Icon) return <input ref={ref} className={`${CONTROL} ${stateClass(invalid)} ${className}`} {...props} />;
  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
      <input ref={ref} className={`${CONTROL} ${stateClass(invalid)} pl-10 ${className}`} {...props} />
    </div>
  );
});

export const Textarea = forwardRef(function Textarea({ invalid, className = '', rows = 3, ...props }, ref) {
  return <textarea ref={ref} rows={rows} className={`${CONTROL} ${stateClass(invalid)} resize-y ${className}`} {...props} />;
});

export const Select = forwardRef(function Select({ invalid, className = '', children, ...props }, ref) {
  return (
    <select ref={ref} className={`${CONTROL} ${stateClass(invalid)} cursor-pointer pr-9 ${className}`} {...props}>
      {children}
    </select>
  );
});

/** On/off switch */
export function Toggle({ checked, onChange, disabled, label, description, size = 'md', id }) {
  const track = size === 'sm' ? 'h-5 w-9' : 'h-6 w-11';
  const knob = size === 'sm' ? 'size-4' : 'size-5';
  const shift = size === 'sm' ? 'translate-x-4' : 'translate-x-5';

  const button = (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      className={`relative inline-flex shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors duration-200 focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-100 disabled:cursor-not-allowed disabled:opacity-60 ${track} ${
        checked ? 'bg-brand-500' : 'bg-slate-300'
      }`}
    >
      <span className={`${knob} rounded-full bg-white shadow transition-transform duration-200 ${checked ? shift : 'translate-x-0'}`} />
    </button>
  );

  if (!label) return button;
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-slate-700">{label}</p>
        {description && <p className="text-xs text-slate-500">{description}</p>}
      </div>
      {button}
    </div>
  );
}
