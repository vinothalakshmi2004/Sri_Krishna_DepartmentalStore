/**
 * Add / edit item modal with image upload and preview.
 * Scanning a barcode fills in the details (and photo) found online.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { AlertTriangle, Barcode, CircleCheck, ExternalLink, ImagePlus, Pencil, ScanBarcode, Search, Sparkles, Trash2, Upload } from 'lucide-react';
import { itemsApi } from '../../api/adminApi';
import { getErrorList, getErrorMessage } from '../../api/client';
import { ITEM_UNITS } from '../../utils/constants';
import { imageUrl } from '../../utils/links';
import { BARCODE_PATTERN, dataUrlToFile } from '../../utils/barcode';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { Field, Input, Select, Textarea, Toggle } from '../ui/FormControls';
import { Spinner } from '../ui/Loader';
import BarcodeScanner from './BarcodeScanner';

const MAX_MB = 5;
const BARCODE_ERROR = 'Barcode can have 3-40 letters or numbers';
const EMPTY = {
  barcode: '',
  name: '',
  description: '',
  price: '',
  unit: 'kg',
  category: '',
  stock: '0',
  lowStockLimit: '5',
  isAvailable: true,
};

const toForm = (item) =>
  item
    ? {
        barcode: item.barcode || '',
        name: item.name || '',
        description: item.description || '',
        price: String(item.price ?? ''),
        unit: item.unit || 'kg',
        category: item.category || '',
        stock: String(item.stock ?? 0),
        lowStockLimit: String(item.lowStockLimit ?? 5),
        isAvailable: item.isAvailable !== false,
      }
    : EMPTY;

const validate = (form) => {
  const errors = {};
  if (form.barcode.trim() && !BARCODE_PATTERN.test(form.barcode.trim())) errors.barcode = BARCODE_ERROR;
  if (!form.name.trim()) errors.name = 'Item name is required';
  if (form.price === '' || Number.isNaN(Number(form.price)) || Number(form.price) < 0) errors.price = 'Enter a valid price';
  if (!form.category.trim()) errors.category = 'Category is required';
  if (form.stock === '' || Number.isNaN(Number(form.stock)) || Number(form.stock) < 0) errors.stock = 'Stock must be 0 or more';
  if (form.lowStockLimit === '' || Number(form.lowStockLimit) < 0) errors.lowStockLimit = 'Must be 0 or more';
  return errors;
};

/** Copy online product details into the form: a fresh form takes everything, otherwise only empty fields are filled */
const fillFromProduct = (form, product, fresh) => ({
  ...form,
  name: form.name.trim() ? form.name : product.name || '',
  description: form.description.trim() ? form.description : product.description || '',
  category: form.category.trim() ? form.category : product.category || '',
  unit: fresh && product.unit ? product.unit : form.unit,
});

const TONES = {
  brand: 'border-brand-200 bg-brand-50 text-brand-800',
  amber: 'border-amber-200 bg-amber-50 text-amber-800',
  red: 'border-red-200 bg-red-50 text-red-700',
  slate: 'border-slate-200 bg-slate-50 text-slate-600',
};

/** Result of the last barcode lookup, shown under the barcode box */
function LookupBanner({ lookup, onOpenItem }) {
  if (!lookup) return null;
  const { status, code } = lookup;
  let tone = 'amber';
  let icon = <AlertTriangle className="size-4" />;
  let text;
  let extra = null;

  if (status === 'loading') {
    tone = 'slate';
    icon = <Spinner className="size-4" />;
    text = `Looking up barcode ${code}...`;
  } else if (status === 'found') {
    tone = 'brand';
    icon = <Sparkles className="size-4" />;
    text = `Details${lookup.photo ? ' and photo' : ''} filled from ${lookup.source}. Please check them and enter the price and stock.`;
    if (lookup.sourceUrl) {
      extra = (
        <a href={lookup.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium underline-offset-2 hover:underline">
          View on {lookup.source} <ExternalLink className="size-3" />
        </a>
      );
    }
  } else if (status === 'notfound') {
    text = `${lookup.online ? `No details found online for ${code}.` : `${code} is not a standard product barcode, so it was not searched online.`} Type the details below - the barcode is saved with the item, so the next scan finds it straight away.`;
  } else if (status === 'offline') {
    text = 'Could not reach the online product databases right now. Type the details below - the barcode will still be saved.';
  } else if (status === 'exists') {
    tone = 'red';
    text = `Barcode ${code} is already used by "${lookup.existing.name}".`;
    if (onOpenItem) {
      extra = (
        <Button size="xs" variant="outline" icon={Pencil} onClick={() => onOpenItem(lookup.existing)}>
          Edit {lookup.existing.name}
        </Button>
      );
    }
  } else if (status === 'same') {
    tone = 'brand';
    icon = <CircleCheck className="size-4" />;
    text = 'This barcode already belongs to this item.';
  } else {
    tone = 'red';
    text = `${lookup.message || 'Could not look up this barcode.'} You can still type the details.`;
  }

  return (
    <div role="status" className={`flex gap-2.5 rounded-xl border px-3 py-2.5 text-sm ${TONES[tone]}`}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0 space-y-1.5 [overflow-wrap:anywhere]">
        <p>{text}</p>
        {extra}
      </div>
    </div>
  );
}

/**
 * prefill: barcode lookup result from the Items page scanner, applied to a new item.
 * onOpenItem(item): switch to editing another item (when a scanned barcode is already used).
 */
export default function ItemFormModal({ open, item, prefill, categories = [], onClose, onSaved, onOpenItem }) {
  const isEdit = Boolean(item);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [file, setFile] = useState(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [lookup, setLookup] = useState(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [availabilityTouched, setAvailabilityTouched] = useState(false);
  // Hidden item without a price (e.g. saved by bulk upload): giving it a price shows it to customers
  const isDraft = isEdit && item.isAvailable === false && !(Number(item.price) > 0);
  const fileInput = useRef(null);
  const lookupSeq = useRef(0); // ignores lookups that finish after a newer one started

  /** Show a lookup result and copy the details (and photo) into the form */
  const applyResult = async (result, { fresh, hasImage }) => {
    const seq = lookupSeq.current;
    const code = result.barcode;
    if (result.error) {
      setLookup({ status: 'error', code, message: result.error });
      return;
    }
    if (result.item) {
      setLookup(item && result.item._id === item._id ? { status: 'same', code } : { status: 'exists', code, existing: result.item });
      return;
    }
    if (!result.product) {
      setLookup({ status: result.unreachable ? 'offline' : 'notfound', code, online: result.online });
      return;
    }

    const { product } = result;
    setForm((prev) => fillFromProduct(prev, product, fresh));
    setErrors({});
    let photo = false;
    if (product.image && !hasImage) {
      try {
        const imageFile = await dataUrlToFile(product.image, `barcode-${code}`);
        if (seq === lookupSeq.current) {
          setFile(imageFile);
          setRemoveImage(false);
          photo = true;
        }
      } catch {
        /* keep the details without the photo */
      }
    }
    if (seq === lookupSeq.current) setLookup({ status: 'found', code, source: product.source, sourceUrl: product.sourceUrl, photo });
  };

  useEffect(() => {
    if (!open) return;
    lookupSeq.current += 1;
    setForm(toForm(item));
    setErrors({});
    setFile(null);
    setRemoveImage(false);
    setLookup(null);
    setScannerOpen(false);
    setAvailabilityTouched(false);
    if (prefill && !item) {
      setForm((prev) => ({ ...prev, barcode: prefill.barcode || '' }));
      applyResult(prefill, { fresh: true, hasImage: false });
    }
  }, [open, item, prefill]);

  const runLookup = async (value) => {
    const code = value.trim();
    if (!BARCODE_PATTERN.test(code)) {
      setErrors((prev) => ({ ...prev, barcode: BARCODE_ERROR }));
      return;
    }
    lookupSeq.current += 1;
    const seq = lookupSeq.current;
    const options = { fresh: !isEdit && !form.name.trim(), hasImage: Boolean(file || (item && item.image && !removeImage)) };
    setForm((prev) => ({ ...prev, barcode: code }));
    setErrors((prev) => ({ ...prev, barcode: undefined }));
    setLookup({ status: 'loading', code });
    try {
      const result = await itemsApi.lookupBarcode(code);
      if (seq === lookupSeq.current) await applyResult(result, options);
    } catch (err) {
      if (seq === lookupSeq.current) setLookup({ status: 'error', code, message: getErrorMessage(err) });
    }
  };

  // Preview URL for a newly chosen file (revoked when it changes)
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

  const currentImage = preview || (!removeImage && item && item.image ? imageUrl(item.image) : null);

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

  const handleSubmit = async (event) => {
    event.preventDefault();
    const validation = validate(form);
    setErrors(validation);
    if (Object.keys(validation).length) return;

    const data = new FormData();
    data.append('barcode', form.barcode.trim());
    data.append('name', form.name.trim());
    data.append('description', form.description.trim());
    data.append('price', form.price);
    data.append('unit', form.unit);
    data.append('category', form.category.trim());
    data.append('stock', form.stock);
    data.append('lowStockLimit', form.lowStockLimit);
    data.append('isAvailable', String(form.isAvailable));
    if (file) data.append('image', file);
    else if (isEdit && removeImage) data.append('removeImage', 'true');

    setSaving(true);
    try {
      const res = isEdit ? await itemsApi.update(item._id, data) : await itemsApi.create(data);
      toast.success(isEdit ? 'Item updated' : 'Item added');
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

  const typedCode = form.barcode.trim();
  const canFind = Boolean(typedCode) && (!lookup || lookup.code !== typedCode);
  const filledFromScan = Boolean(prefill && prefill.product);

  return (
    <Modal
      open={open}
      onClose={saving ? undefined : onClose}
      title={isEdit ? 'Edit item' : 'Add new item'}
      description={isEdit ? item.name : 'Scan the barcode to fill in packed items, or type the details.'}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="item-form" loading={saving}>
            {isEdit ? 'Save changes' : 'Add item'}
          </Button>
        </>
      }
    >
      <form id="item-form" onSubmit={handleSubmit} noValidate className="space-y-5">
        {isDraft && (
          <p className="flex gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            This item is hidden from customers because it has no price yet. Check the name, category and photo, add the price and save - it will then be
            shown to customers.
          </p>
        )}

        {/* Barcode */}
        <div className="space-y-2.5">
          <Field
            label="Barcode"
            htmlFor="item-barcode"
            error={errors.barcode}
            hint="Scan with the camera, upload a photo of the barcode, or use a barcode scanner. Leave empty for loose items."
          >
            <div className="flex gap-2">
              <div className="min-w-0 flex-1">
                <Input
                  id="item-barcode"
                  icon={Barcode}
                  value={form.barcode}
                  onChange={set('barcode')}
                  onKeyDown={(e) => {
                    // Enter (typed, or sent by a barcode scanner) looks the code up instead of saving
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (typedCode) runLookup(typedCode);
                    }
                  }}
                  placeholder="Scan or type the barcode"
                  maxLength={40}
                  autoComplete="off"
                  enterKeyHint="search"
                  invalid={Boolean(errors.barcode)}
                  autoFocus={!isEdit && !prefill}
                />
              </div>
              {canFind && (
                <Button variant="outline" icon={Search} onClick={() => runLookup(typedCode)} className="shrink-0">
                  Find
                </Button>
              )}
              <Button icon={ScanBarcode} onClick={() => setScannerOpen(true)} className="shrink-0">
                Scan
              </Button>
            </div>
          </Field>
          <LookupBanner lookup={lookup} onOpenItem={onOpenItem} />
        </div>

        <div className="grid gap-5 md:grid-cols-[220px_1fr]">
          {/* Image */}
          <div>
            <p className="mb-1.5 text-sm font-medium text-slate-700">Photo</p>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                pickFile(e.dataTransfer.files[0]);
              }}
              className={`relative flex aspect-square max-w-48 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed transition md:max-w-none ${
                dragOver ? 'border-brand-500 bg-brand-50' : 'border-brand-200 bg-mint hover:border-brand-400'
              }`}
              onClick={() => fileInput.current && fileInput.current.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && fileInput.current && fileInput.current.click()}
            >
              {currentImage ? (
                <img src={currentImage} alt="Item preview" className="size-full object-cover" />
              ) : (
                <div className="flex flex-col items-center gap-2 p-4 text-center">
                  <ImagePlus className="size-9 text-brand-400" />
                  <p className="text-xs text-slate-500">Click or drop an image</p>
                  <p className="text-[11px] text-slate-400">JPG, PNG, WEBP · max {MAX_MB} MB</p>
                </div>
              )}
            </div>
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
                {currentImage ? 'Change' : 'Upload'}
              </Button>
              {currentImage && (
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
          </div>

          {/* Fields */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Item name" htmlFor="item-name" required error={errors.name} className="sm:col-span-2">
              <Input id="item-name" value={form.name} onChange={set('name')} placeholder="e.g. Ponni Raw Rice" maxLength={100} invalid={Boolean(errors.name)} autoFocus={isEdit && !isDraft} />
            </Field>
            <Field label="Description" htmlFor="item-description" error={errors.description} className="sm:col-span-2">
              <Textarea id="item-description" value={form.description} onChange={set('description')} placeholder="Short description shown to customers" maxLength={500} rows={2} />
            </Field>
            <Field label="Price (₹)" htmlFor="item-price" required error={errors.price}>
              <Input
                id="item-price"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={form.price}
                onChange={(e) => {
                  const price = e.target.value;
                  setForm((prev) => ({ ...prev, price, isAvailable: prev.isAvailable || (isDraft && !availabilityTouched && Number(price) > 0) }));
                }}
                placeholder="0"
                invalid={Boolean(errors.price)}
                autoFocus={filledFromScan || isDraft}
              />
            </Field>
            <Field label="Unit" htmlFor="item-unit" hint="Price is per this unit">
              <Select id="item-unit" value={form.unit} onChange={set('unit')}>
                {ITEM_UNITS.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Category" htmlFor="item-category" required error={errors.category} className="sm:col-span-2">
              <Input
                id="item-category"
                list="item-categories"
                value={form.category}
                onChange={set('category')}
                placeholder="Pick or type a new category"
                maxLength={50}
                invalid={Boolean(errors.category)}
              />
              <datalist id="item-categories">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Field>
            <Field label="Stock" htmlFor="item-stock" required error={errors.stock} hint={`In ${form.unit}`}>
              <Input id="item-stock" type="number" inputMode="decimal" min="0" step="any" value={form.stock} onChange={set('stock')} invalid={Boolean(errors.stock)} />
            </Field>
            <Field label="Low stock alert at" htmlFor="item-low" error={errors.lowStockLimit} hint="Warn when stock falls to this">
              <Input id="item-low" type="number" inputMode="decimal" min="0" step="any" value={form.lowStockLimit} onChange={set('lowStockLimit')} invalid={Boolean(errors.lowStockLimit)} />
            </Field>
            <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 sm:col-span-2">
              <Toggle
                checked={form.isAvailable}
                onChange={(value) => {
                  setAvailabilityTouched(true);
                  setForm((prev) => ({ ...prev, isAvailable: value }));
                }}
                label="Available for customers"
                description="Turn off to hide this item from the order page"
              />
            </div>
          </div>
        </div>
      </form>

      <BarcodeScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onDetected={(code) => {
          setScannerOpen(false);
          runLookup(code);
        }}
      />
    </Modal>
  );
}
