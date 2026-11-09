/**
 * Add / edit forms for manual income entries and expenses.
 */
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { incomeApi, expensesApi } from '../../api/adminApi';
import { getErrorList, getErrorMessage } from '../../api/client';
import { EXPENSE_CATEGORIES, LEDGER_PAYMENT_MODES, paymentModeLabel } from '../../utils/constants';
import { toInputDate } from '../../utils/format';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { Field, Input, Select, Textarea } from '../ui/FormControls';

const fieldErrorsFrom = (err) =>
  getErrorList(err).reduce((map, e) => (e.field ? { ...map, [e.field]: e.message } : map), {});

function PaymentModeSelect({ value, onChange, id }) {
  return (
    <Select id={id} value={value} onChange={onChange}>
      {LEDGER_PAYMENT_MODES.map((mode) => (
        <option key={mode} value={mode}>
          {paymentModeLabel(mode)}
        </option>
      ))}
    </Select>
  );
}

/** Manual income entry */
export function IncomeFormModal({ open, entry, onClose, onSaved }) {
  const isEdit = Boolean(entry);
  const [form, setForm] = useState({ amount: '', date: toInputDate(), paymentMode: 'Cash', note: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setForm(
      entry
        ? { amount: String(entry.amount), date: toInputDate(entry.date), paymentMode: entry.paymentMode, note: entry.note || '' }
        : { amount: '', date: toInputDate(), paymentMode: 'Cash', note: '' }
    );
  }, [open, entry]);

  const set = (name) => (event) => setForm((prev) => ({ ...prev, [name]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    const nextErrors = {};
    if (!(Number(form.amount) > 0)) nextErrors.amount = 'Enter an amount more than 0';
    if (!form.date) nextErrors.date = 'Pick a date';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    const payload = { amount: Number(form.amount), date: form.date, paymentMode: form.paymentMode, note: form.note.trim() };
    setSaving(true);
    try {
      const res = isEdit ? await incomeApi.update(entry._id, payload) : await incomeApi.create(payload);
      toast.success(isEdit ? 'Income updated' : 'Income added');
      onSaved(res.data);
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err));
      setErrors(fieldErrorsFrom(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={saving ? undefined : onClose}
      title={isEdit ? 'Edit income' : 'Add manual income'}
      description="For money received outside website orders (bulk sales, counter sales...)"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="income-form" loading={saving}>
            {isEdit ? 'Save changes' : 'Add income'}
          </Button>
        </>
      }
    >
      <form id="income-form" onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        <Field label="Amount (₹)" htmlFor="income-amount" required error={errors.amount}>
          <Input id="income-amount" type="number" inputMode="decimal" min="0" step="0.01" value={form.amount} onChange={set('amount')} invalid={Boolean(errors.amount)} autoFocus />
        </Field>
        <Field label="Date" htmlFor="income-date" required error={errors.date}>
          <Input id="income-date" type="date" max={toInputDate()} value={form.date} onChange={set('date')} invalid={Boolean(errors.date)} />
        </Field>
        <Field label="Payment mode" htmlFor="income-mode" className="sm:col-span-2">
          <PaymentModeSelect id="income-mode" value={form.paymentMode} onChange={set('paymentMode')} />
        </Field>
        <Field label="Note" htmlFor="income-note" error={errors.note} className="sm:col-span-2">
          <Textarea id="income-note" value={form.note} onChange={set('note')} placeholder="What is this income for?" maxLength={500} rows={2} />
        </Field>
      </form>
    </Modal>
  );
}

/** Expense entry */
export function ExpenseFormModal({ open, entry, onClose, onSaved }) {
  const isEdit = Boolean(entry);
  const [form, setForm] = useState({ title: '', category: 'Purchase', amount: '', date: toInputDate(), paymentMode: 'Cash', note: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setForm(
      entry
        ? {
            title: entry.title,
            category: entry.category,
            amount: String(entry.amount),
            date: toInputDate(entry.date),
            paymentMode: entry.paymentMode,
            note: entry.note || '',
          }
        : { title: '', category: 'Purchase', amount: '', date: toInputDate(), paymentMode: 'Cash', note: '' }
    );
  }, [open, entry]);

  const set = (name) => (event) => setForm((prev) => ({ ...prev, [name]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    const nextErrors = {};
    if (!form.title.trim()) nextErrors.title = 'Title is required';
    if (!(Number(form.amount) > 0)) nextErrors.amount = 'Enter an amount more than 0';
    if (!form.date) nextErrors.date = 'Pick a date';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    const payload = {
      title: form.title.trim(),
      category: form.category,
      amount: Number(form.amount),
      date: form.date,
      paymentMode: form.paymentMode,
      note: form.note.trim(),
    };
    setSaving(true);
    try {
      const res = isEdit ? await expensesApi.update(entry._id, payload) : await expensesApi.create(payload);
      toast.success(isEdit ? 'Expense updated' : 'Expense added');
      onSaved(res.data);
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err));
      setErrors(fieldErrorsFrom(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={saving ? undefined : onClose}
      title={isEdit ? 'Edit expense' : 'Add expense'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="expense-form" loading={saving}>
            {isEdit ? 'Save changes' : 'Add expense'}
          </Button>
        </>
      }
    >
      <form id="expense-form" onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        <Field label="Title" htmlFor="expense-title" required error={errors.title} className="sm:col-span-2">
          <Input id="expense-title" value={form.title} onChange={set('title')} placeholder="e.g. Rice stock purchase" maxLength={120} invalid={Boolean(errors.title)} autoFocus />
        </Field>
        <Field label="Category" htmlFor="expense-category" required>
          <Select id="expense-category" value={form.category} onChange={set('category')}>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Amount (₹)" htmlFor="expense-amount" required error={errors.amount}>
          <Input id="expense-amount" type="number" inputMode="decimal" min="0" step="0.01" value={form.amount} onChange={set('amount')} invalid={Boolean(errors.amount)} />
        </Field>
        <Field label="Date" htmlFor="expense-date" required error={errors.date}>
          <Input id="expense-date" type="date" max={toInputDate()} value={form.date} onChange={set('date')} invalid={Boolean(errors.date)} />
        </Field>
        <Field label="Payment mode" htmlFor="expense-mode">
          <PaymentModeSelect id="expense-mode" value={form.paymentMode} onChange={set('paymentMode')} />
        </Field>
        <Field label="Note" htmlFor="expense-note" className="sm:col-span-2">
          <Textarea id="expense-note" value={form.note} onChange={set('note')} placeholder="Optional details" maxLength={500} rows={2} />
        </Field>
      </form>
    </Modal>
  );
}
