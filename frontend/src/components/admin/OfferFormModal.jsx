/**
 * Add / edit offer.
 *  - "Special price": pick an item + offer price. While live, customers pay this price.
 *  - "Announcement":  any message (free delivery, festival sale...). Display only.
 * Title and badge can be left empty for special prices - they are generated
 * automatically (e.g. "Ponni Raw Rice at just ₹55", "11% OFF").
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { CalendarDays, ImagePlus, Megaphone, Tag, Trash2, Upload } from 'lucide-react';
import { itemsApi, offersApi } from '../../api/adminApi';
import { getErrorList, getErrorMessage } from '../../api/client';
import { formatCurrency, toInputDate } from '../../utils/format';
import { discountPercent } from '../../utils/pricing';
import { imageUrl } from '../../utils/links';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import SegmentedControl from '../ui/SegmentedControl';
import { Field, Input, Select, Textarea, Toggle } from '../ui/FormControls';

const MAX_MB = 5;

// Must match the backend's automatic wording (offerController.buildOfferData)
const autoTitle = (name, price) => `${name} at just ₹${price}`;
const autoBadge = (price, original) => `${discountPercent(price, original)}% OFF`;

const addDays = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return toInputDate(d);
};

const DATE_PRESETS = [
  { label: 'Today only', apply: () => ({ startDate: toInputDate(), endDate: toInputDate(), noEnd: false }) },
  { label: '3 days', apply: () => ({ startDate: toInputDate(), endDate: addDays(2), noEnd: false }) },
  { label: '1 week', apply: () => ({ startDate: toInputDate(), endDate: addDays(6), noEnd: false }) },
  { label: 'No end date', apply: () => ({ noEnd: true }) },
];

const emptyForm = () => ({
  type: 'item',
  item: '',
  offerPrice: '',
  title: '',
  badge: '',
  description: '',
  startDate: toInputDate(),
  endDate: toInputDate(), // daily offer by default
  noEnd: false,
  isActive: true,
});

/** Existing offer -> form values (auto-generated title/badge are shown as empty = "automatic") */
const toForm = (offer) => {
  const item = offer.item && typeof offer.item === 'object' ? offer.item : null;
  const titleIsAuto = item && offer.title === autoTitle(item.name, offer.offerPrice);
  const badgeIsAuto = item && offer.badge === autoBadge(offer.offerPrice, item.price);
  return {
    type: offer.type,
    item: item ? item._id : '',
    offerPrice: offer.offerPrice != null ? String(offer.offerPrice) : '',
    title: titleIsAuto ? '' : offer.title || '',
    badge: badgeIsAuto ? '' : offer.badge || '',
    description: offer.description || '',
    startDate: toInputDate(offer.startDate),
    endDate: offer.endDate ? toInputDate(offer.endDate) : toInputDate(),
    noEnd: !offer.endDate,
    isActive: offer.isActive,
  };
};

export default function OfferFormModal({ open, offer, onClose, onSaved }) {
  const isEdit = Boolean(offer);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [items, setItems] = useState([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [file, setFile] = useState(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInput = useRef(null);

  // Item list for the picker
  useEffect(() => {
    if (!open) return undefined;
    let active = true;
    setItemsLoading(true);
    itemsApi
      .list({ limit: 500, sort: 'name' })
      .then((res) => active && setItems(res.data))
      .catch(() => active && toast.error('Could not load items'))
      .finally(() => active && setItemsLoading(false));
    return () => {
      active = false;
    };
  }, [open]);

  // Reset when opened
  useEffect(() => {
    if (!open) return;
    setForm(offer ? toForm(offer) : emptyForm());
    setErrors({});
    setFile(null);
    setRemoveImage(false);
  }, [open, offer]);

  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

  const isItemOffer = form.type === 'item';
  const selectedItem = useMemo(() => {
    const fromList = items.find((i) => i._id === form.item);
    if (fromList) return fromList;
    return offer && offer.item && offer.item._id === form.item ? offer.item : null;
  }, [items, form.item, offer]);

  const price = Math.round(Number(form.offerPrice) * 100) / 100;
  const priceValid = Boolean(selectedItem && price > 0 && price < selectedItem.price);
  const suggestedTitle = selectedItem && price > 0 ? autoTitle(selectedItem.name, price) : 'e.g. Ponni Raw Rice at just ₹55';
  const suggestedBadge = priceValid ? autoBadge(price, selectedItem.price) : 'e.g. 10% OFF';

  const ownImage = preview || (!removeImage && offer && offer.image ? imageUrl(offer.image) : null);
  const fallbackImage = !ownImage && isItemOffer && selectedItem && selectedItem.image ? imageUrl(selectedItem.image) : null;

  const set = (name) => (event) => setForm((prev) => ({ ...prev, [name]: event.target.value }));

  const pickFile = (chosen) => {
    if (!chosen) return;
    if (!/^image\/(jpeg|png|webp|gif)$/.test(chosen.type)) {
      toast.error('Please choose a JPG, PNG, WEBP or GIF image');
      return;
    }
    if (chosen.size > MAX_MB * 1024 * 1024) {
      toast.error(`Image must be smaller than ${MAX_MB} MB`);
      return;
    }
    setFile(chosen);
    setRemoveImage(false);
  };

  const validate = () => {
    const next = {};
    if (isItemOffer) {
      if (!form.item) next.item = 'Choose the item for this offer';
      if (!(price > 0)) next.offerPrice = 'Enter the offer price';
      else if (selectedItem && price >= selectedItem.price) next.offerPrice = `Must be lower than the current price ${formatCurrency(selectedItem.price)}`;
    } else if (!form.title.trim()) {
      next.title = 'Write a title for the announcement';
    }
    if (!form.startDate) next.startDate = 'Pick a start date';
    if (!form.noEnd) {
      if (!form.endDate) next.endDate = 'Pick an end date or choose "No end date"';
      else if (form.endDate < form.startDate) next.endDate = 'End date must be on or after the start date';
    }
    return next;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const validation = validate();
    setErrors(validation);
    if (Object.keys(validation).length) return;

    const data = new FormData();
    data.append('type', form.type);
    data.append('title', form.title.trim());
    data.append('badge', form.badge.trim());
    data.append('description', form.description.trim());
    data.append('startDate', form.startDate);
    data.append('endDate', form.noEnd ? '' : form.endDate);
    data.append('isActive', String(form.isActive));
    if (isItemOffer) {
      data.append('item', form.item);
      data.append('offerPrice', String(price));
    }
    if (file) data.append('image', file);
    else if (isEdit && removeImage) data.append('removeImage', 'true');

    setSaving(true);
    try {
      const res = isEdit ? await offersApi.update(offer._id, data) : await offersApi.create(data);
      toast.success(isEdit ? 'Offer updated' : form.isActive ? 'Offer published to the Offer Zone' : 'Offer saved (paused)');
      onSaved(res.data);
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err));
      const fieldErrors = {};
      getErrorList(err).forEach((e) => {
        if (e.field) fieldErrors[e.field] = e.message;
      });
      setErrors(fieldErrors);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={saving ? undefined : onClose}
      size="xl"
      title={isEdit ? 'Edit offer' : 'Add offer'}
      description="Live offers appear in the Offer Zone on the store home page."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="offer-form" loading={saving}>
            {isEdit ? 'Save changes' : form.isActive ? 'Publish offer' : 'Save offer'}
          </Button>
        </>
      }
    >
      <form id="offer-form" onSubmit={handleSubmit} noValidate className="space-y-5">
        <SegmentedControl
          value={form.type}
          onChange={(type) => {
            setForm((prev) => ({ ...prev, type }));
            setErrors({});
          }}
          options={[
            { value: 'item', label: 'Special price on an item', icon: Tag },
            { value: 'general', label: 'Announcement', icon: Megaphone },
          ]}
          scrollable
        />

        <div className="grid gap-5 md:grid-cols-[240px_1fr]">
          {/* Image */}
          <div>
            <p className="mb-1.5 text-sm font-medium text-slate-700">Offer image</p>
            <button
              type="button"
              onClick={() => fileInput.current && fileInput.current.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                pickFile(e.dataTransfer.files[0]);
              }}
              className="relative flex aspect-[16/10] w-full items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-amber-200 bg-amber-50/60 transition hover:border-amber-400"
            >
              {ownImage || fallbackImage ? (
                <img src={ownImage || fallbackImage} alt="Offer preview" className={`size-full object-cover ${ownImage ? '' : 'opacity-70'}`} />
              ) : (
                <span className="flex flex-col items-center gap-1.5 p-3 text-center">
                  <ImagePlus className="size-8 text-amber-400" />
                  <span className="text-xs text-slate-500">Click or drop an image</span>
                </span>
              )}
              {!ownImage && fallbackImage && (
                <span className="absolute bottom-2 left-2 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-medium text-slate-600">Using item photo</span>
              )}
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(e) => {
                pickFile(e.target.files[0]);
                e.target.value = '';
              }}
            />
            <div className="mt-2 flex gap-2">
              <Button size="xs" variant="secondary" icon={Upload} onClick={() => fileInput.current && fileInput.current.click()}>
                {ownImage ? 'Change' : 'Upload'}
              </Button>
              {ownImage && (
                <Button
                  size="xs"
                  variant="ghost"
                  icon={Trash2}
                  className="text-red-600 hover:bg-red-50"
                  onClick={() => {
                    setFile(null);
                    setRemoveImage(true);
                  }}
                >
                  Remove
                </Button>
              )}
            </div>
            <p className="mt-1 text-[11px] text-slate-400">Optional · JPG/PNG/WEBP · max {MAX_MB} MB</p>
          </div>

          {/* Fields */}
          <div className="space-y-4">
            {isItemOffer && (
              <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
                <Field label="Item" htmlFor="offer-item" required error={errors.item}>
                  <Select id="offer-item" value={form.item} onChange={set('item')} invalid={Boolean(errors.item)} disabled={itemsLoading}>
                    <option value="">{itemsLoading ? 'Loading items...' : 'Choose an item...'}</option>
                    {items.map((i) => (
                      <option key={i._id} value={i._id}>
                        {i.name} — ₹{i.price}/{i.unit}
                        {i.isAvailable ? '' : ' (hidden)'}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Offer price (₹)" htmlFor="offer-price" required error={errors.offerPrice}>
                  <Input id="offer-price" type="number" inputMode="decimal" min="0" step="0.01" value={form.offerPrice} onChange={set('offerPrice')} invalid={Boolean(errors.offerPrice)} placeholder="0" />
                </Field>
              </div>
            )}

            {isItemOffer && selectedItem && (
              <div className={`rounded-xl px-3 py-2.5 text-sm ${priceValid ? 'bg-brand-50 text-brand-800' : 'bg-slate-50 text-slate-600'}`}>
                Regular price <strong>{formatCurrency(selectedItem.price)}</strong> / {selectedItem.unit}
                {priceValid && (
                  <>
                    {' '}→ offer <strong>{formatCurrency(price)}</strong> · <strong>{discountPercent(price, selectedItem.price)}% OFF</strong> · customers save{' '}
                    {formatCurrency(selectedItem.price - price)} per {selectedItem.unit}
                  </>
                )}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
              <Field
                label="Title"
                htmlFor="offer-title"
                required={!isItemOffer}
                error={errors.title}
                hint={isItemOffer ? 'Leave empty to use the suggested title' : undefined}
              >
                <Input
                  id="offer-title"
                  value={form.title}
                  onChange={set('title')}
                  maxLength={100}
                  placeholder={isItemOffer ? suggestedTitle : 'e.g. Free delivery this Sunday'}
                  invalid={Boolean(errors.title)}
                />
              </Field>
              <Field label="Badge" htmlFor="offer-badge" error={errors.badge} hint="Short label on the card">
                <Input id="offer-badge" value={form.badge} onChange={set('badge')} maxLength={30} placeholder={isItemOffer ? suggestedBadge : 'e.g. FREE DELIVERY'} />
              </Field>
            </div>

            <Field label="Description" htmlFor="offer-description" error={errors.description}>
              <Textarea id="offer-description" value={form.description} onChange={set('description')} maxLength={500} rows={2} placeholder="Optional details shown to customers" />
            </Field>

            {/* Dates */}
            <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-3">
              <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-slate-700">
                <CalendarDays className="size-4 text-brand-600" /> When should this offer run?
              </p>
              <div className="mb-3 flex flex-wrap gap-2">
                {DATE_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, ...preset.apply() }))}
                    className="rounded-full border border-brand-200 bg-white px-3 py-1 text-xs font-medium text-brand-800 transition hover:bg-brand-50"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Start date" htmlFor="offer-start" error={errors.startDate}>
                  <Input id="offer-start" type="date" value={form.startDate} onChange={set('startDate')} invalid={Boolean(errors.startDate)} />
                </Field>
                <Field label="End date" htmlFor="offer-end" error={errors.endDate} hint={form.noEnd ? 'Runs until you pause or delete it' : 'Ends at midnight'}>
                  <Input
                    id="offer-end"
                    type="date"
                    value={form.noEnd ? '' : form.endDate}
                    min={form.startDate}
                    disabled={form.noEnd}
                    onChange={(e) => setForm((prev) => ({ ...prev, endDate: e.target.value, noEnd: false }))}
                    invalid={Boolean(errors.endDate)}
                  />
                </Field>
              </div>
              <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" checked={form.noEnd} onChange={(e) => setForm((prev) => ({ ...prev, noEnd: e.target.checked }))} className="size-4 accent-brand-500" />
                No end date
              </label>
            </div>

            <div className="rounded-xl border border-slate-100 bg-white p-3">
              <Toggle
                checked={form.isActive}
                onChange={(value) => setForm((prev) => ({ ...prev, isActive: value }))}
                label="Show on the website"
                description="Turn off to save the offer without showing it yet"
              />
            </div>
          </div>
        </div>
      </form>
    </Modal>
  );
}
