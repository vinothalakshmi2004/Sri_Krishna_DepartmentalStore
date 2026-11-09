import { useEffect, useRef, useState } from 'react';
import { Check, LoaderCircle, Pencil } from 'lucide-react';

/**
 * Click-to-edit number (quick price / stock edits in the items list).
 * Enter or blur saves, Escape cancels. `onSave` must return a promise.
 */
export default function InlineNumberEdit({ value, onSave, format = (v) => v, min = 0, step = 'any', suffix, className = '', label = 'value' }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);
  // Refs guard against a second save: disabling/unmounting the focused input fires "blur" after Enter
  const busyRef = useRef(false);
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    if (!editing) setDraft(String(value));
  }, [value, editing]);

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.select();
  }, [editing]);

  const save = async () => {
    if (busyRef.current) return;
    const number = Number(draft);
    if (draft === '' || Number.isNaN(number) || number < min) {
      setDraft(String(valueRef.current));
      setEditing(false);
      return;
    }
    if (number === Number(valueRef.current)) {
      setEditing(false);
      return;
    }
    busyRef.current = true;
    setSaving(true);
    try {
      await onSave(number);
      setEditing(false);
    } catch {
      setDraft(String(valueRef.current)); // the caller shows the error toast
    } finally {
      busyRef.current = false;
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div className={`flex items-center gap-1 ${className}`} onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          type="number"
          inputMode="decimal"
          min={min}
          step={step}
          value={draft}
          disabled={saving}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save();
            if (e.key === 'Escape') {
              setDraft(String(value));
              setEditing(false);
            }
          }}
          className="w-24 rounded-lg border border-brand-300 bg-white px-2 py-1 text-base font-medium text-slate-800 focus:outline-none focus:ring-4 focus:ring-brand-100 sm:text-sm"
          aria-label={`Edit ${label}`}
        />
        {saving ? <LoaderCircle className="size-4 animate-spin text-brand-500" /> : <Check className="size-4 text-brand-500" />}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setEditing(true);
      }}
      className={`group inline-flex items-center gap-1.5 rounded-lg px-1.5 py-0.5 -mx-1.5 text-left font-medium text-slate-800 transition hover:bg-brand-50 ${className}`}
      title={`Click to edit ${label}`}
    >
      {format(value)}
      {suffix && <span className="text-xs font-normal text-slate-500">{suffix}</span>}
      <Pencil className="size-3 text-slate-300 transition group-hover:text-brand-600" />
    </button>
  );
}
