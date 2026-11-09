/**
 * Bulk upload: pick hundreds of product photos at once.
 *  - Photo with a barcode  -> name, brand, size, category and product photo filled from the internet
 *  - Photo without barcode -> the photo becomes the product picture, the file name the item name
 * Nothing has to be filled in before saving: items without a name, category
 * or price are saved hidden and can be completed later, here or on the Items
 * page. Saved items stay editable (details and photo) on this page.
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { AlertTriangle, ArrowLeft, CircleCheck, Copy, EyeOff, ImageOff, ImagePlus, Images, Pencil, RefreshCw, Save, Sparkles, Upload, X } from 'lucide-react';
import { itemsApi } from '../../api/adminApi';
import { getErrorMessage } from '../../api/client';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import useFetch from '../../hooks/useFetch';
import { ITEM_UNITS } from '../../utils/constants';
import { createPhotoReader, dataUrlToFile } from '../../utils/barcode';
import PageHeader from '../../components/admin/PageHeader';
import Button from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/FormControls';
import { Spinner } from '../../components/ui/Loader';

const MAX_PHOTOS = 500;
const LOOKUPS_AT_ONCE = 2;
const LOOKUP_GAP_MS = 700; // stays well inside the free product databases' rate limits
const SAVES_AT_ONCE = 3;
const SKIPPED_KINDS = ['exists', 'duplicate', 'unreadable'];
const UNCATEGORISED = 'Uncategorised'; // saved for items whose category is not filled in yet

/** Run at most `size` tasks at once, starting them at least `gapMs` apart */
const createLimiter = (size, gapMs = 0) => {
  const queue = [];
  let active = 0;
  let lastStart = 0;
  let timer = null;
  const next = () => {
    if (timer || active >= size || !queue.length) return;
    const wait = lastStart + gapMs - Date.now();
    if (wait > 0) {
      timer = setTimeout(() => {
        timer = null;
        next();
      }, wait);
      return;
    }
    const { task, resolve, reject } = queue.shift();
    active += 1;
    lastStart = Date.now();
    task()
      .then(resolve, reject)
      .finally(() => {
        active -= 1;
        next();
      });
    next();
  };
  return (task) =>
    new Promise((resolve, reject) => {
      queue.push({ task, resolve, reject });
      next();
    });
};

// Names given by cameras and chat apps say nothing about the product
const CAMERA_FILE = /^(img|dsc|dscn|dcim|pxl|mvimg|photo|image|screenshot|whatsapp image|wa)[\s_-]*\d/i;
const withoutExtension = (fileName) => fileName.replace(/\.[a-z0-9]{2,5}$/i, '');

/** "aashirvaad_atta-5kg (1).jpg" -> "Aashirvaad Atta 5kg"; "IMG_20261020_1234.jpg" -> "" */
const nameFromFile = (fileName) => {
  let name = withoutExtension(fileName).replace(/\s*\(\d+\)$/, '').replace(/_+/g, ' ');
  if (!name.includes(' ')) name = name.replace(/-+/g, ' ');
  name = name.replace(/\s+/g, ' ').trim();
  if (!name || CAMERA_FILE.test(name) || !/\p{L}{2}/u.test(name)) return '';
  if (name === name.toLowerCase()) name = name.replace(/(^|\s)(\p{L})/gu, (m, space, letter) => space + letter.toUpperCase());
  return name.slice(0, 100);
};

/** Name saved while the real name is not typed yet - the photo's file name makes it easy to find */
const placeholderFor = (row) => `New item - ${withoutExtension(row.fileName)}`.slice(0, 100);

let rowSeq = 0;
const newRow = (file) => {
  rowSeq += 1;
  return {
    id: rowSeq,
    file,
    fileName: file.name,
    phase: 'queued', // queued | reading | looking | ready
    kind: '', // found | notonline | nobarcode | lookupfail | exists | duplicate | unreadable
    message: '',
    barcode: '',
    source: '',
    existing: null,
    photoBlob: null,
    photoUrl: '',
    onlineImage: '',
    photoChoice: 'none', // online | own | none
    include: true,
    name: '',
    description: '',
    category: '',
    unit: 'packet',
    price: '',
    stock: '',
    errors: {},
    save: '', // '' | saving | saved | failed
    itemId: null, // set once the item is in the store
    placeholderName: '',
    visible: false, // shown to customers
    dirty: false, // changed after it was saved
    photoChanged: false,
  };
};

const isSkipped = (row) => SKIPPED_KINDS.includes(row.kind);
/** Ticked and ready, but not in the store yet */
const needsCreate = (row) => row.phase === 'ready' && row.include && !isSkipped(row) && !row.itemId && row.save !== 'saving';
/** Already in the store and changed since */
const needsUpdate = (row) => Boolean(row.itemId) && row.dirty && row.save !== 'saving';
/** What is still missing before customers can see the item */
const missingDetails = (row) =>
  [!row.name.trim() && 'name', !row.category.trim() && 'category', !(Number(row.price) > 0) && 'price'].filter(Boolean);
const isComplete = (row) => missingDetails(row).length === 0;

/** Only wrong numbers stop a save - missing details just keep the item hidden */
const numberErrors = (row) => {
  const errors = {};
  if (row.price !== '' && (Number.isNaN(Number(row.price)) || Number(row.price) < 0)) errors.price = '0 or more';
  if (row.stock !== '' && (Number.isNaN(Number(row.stock)) || Number(row.stock) < 0)) errors.stock = '0 or more';
  return errors;
};

const photoOptions = (row) => [row.onlineImage && 'online', row.photoBlob && 'own', 'none'].filter(Boolean);
const PHOTO_LABEL = { online: 'Online photo', own: 'Your photo', none: 'No photo' };

const TONES = {
  brand: 'bg-brand-50 text-brand-800',
  amber: 'bg-amber-50 text-amber-800',
  red: 'bg-red-50 text-red-700',
  slate: 'bg-slate-100 text-slate-600',
};
const KIND_META = {
  found: { label: 'Found online', tone: 'brand', icon: Sparkles },
  notonline: { label: 'Barcode not found online', tone: 'amber', icon: AlertTriangle },
  nobarcode: { label: 'No barcode - photo used', tone: 'amber', icon: Images },
  lookupfail: { label: 'Lookup failed', tone: 'red', icon: AlertTriangle },
  exists: { label: 'Already in store', tone: 'slate', icon: CircleCheck },
  duplicate: { label: 'Duplicate', tone: 'slate', icon: Copy },
  unreadable: { label: 'Cannot open photo', tone: 'red', icon: ImageOff },
};

function Chip({ tone = 'slate', icon: Icon, spin, children }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${TONES[tone]}`}>
      {spin ? <Spinner className="size-3" /> : Icon && <Icon className="size-3" />}
      {children}
    </span>
  );
}

function StatusChip({ row }) {
  if (row.save === 'saving') return <Chip spin>Saving</Chip>;
  if (row.save === 'failed') return <Chip tone="red" icon={AlertTriangle}>Not saved</Chip>;
  if (row.itemId && row.dirty) return <Chip tone="amber" icon={Pencil}>Changed - not saved</Chip>;
  if (row.itemId) {
    return row.visible ? (
      <Chip tone="brand" icon={CircleCheck}>Saved · shown to customers</Chip>
    ) : (
      <Chip tone="amber" icon={EyeOff}>Saved · hidden</Chip>
    );
  }
  if (row.phase === 'queued') return <Chip>Waiting</Chip>;
  if (row.phase === 'reading') return <Chip spin>Reading photo</Chip>;
  if (row.phase === 'looking') return <Chip spin>Finding details</Chip>;
  const meta = KIND_META[row.kind];
  return (
    <Chip tone={meta.tone} icon={meta.icon}>
      {row.kind === 'found' && row.source ? `Found on ${row.source}` : meta.label}
    </Chip>
  );
}

function MiniField({ label, error, className = '', children }) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className="mb-1 block text-[11px] font-medium text-slate-500">{label}</span>
      {children}
      {error && <span className="mt-0.5 block text-[11px] font-medium text-red-600">{error}</span>}
    </label>
  );
}

const BulkRow = memo(function BulkRow({ row, locked, defaultStock, onChange, onPhoto, onRemove, onRetry }) {
  const skipped = isSkipped(row);
  const saved = Boolean(row.itemId);
  const editable = row.phase === 'ready' && !skipped && !locked && row.save !== 'saving';
  const options = photoOptions(row);
  const thumb = row.photoChoice === 'online' ? row.onlineImage : row.photoChoice === 'own' ? row.photoUrl : '';
  const missing = missingDetails(row);
  const set = (field) => (event) => onChange(row.id, field, event.target.value);

  let note = null;
  if (row.save === 'failed') note = <span className="text-red-600">Not saved: {row.message}</span>;
  else if (saved && row.dirty) note = <span className="text-amber-700">You changed this item - press Save at the bottom to update it.</span>;
  else if (saved && row.visible) note = <span className="text-brand-700">In the store and shown to customers. You can still change it here.</span>;
  else if (saved) {
    note = (
      <span className="text-amber-700">
        Hidden from customers until the {missing.join(', ')} {missing.length === 1 ? 'is' : 'are'} filled in. Fill {missing.length === 1 ? 'it' : 'them'} in here and
        press Save, or later on the Items page.
      </span>
    );
  } else if (row.kind === 'exists') note = <span>Already in your store as "{row.existing.name}" - skipped.</span>;
  else if (row.kind === 'duplicate') note = <span>{row.message} - skipped.</span>;
  else if (row.kind === 'unreadable') note = <span className="text-red-600">{row.message}</span>;
  else if (!row.include && row.message) note = <span>{row.message}</span>;
  else if (row.kind === 'lookupfail') {
    note = (
      <span className="flex flex-wrap items-center gap-2 text-red-600">
        {row.message}
        <Button size="xs" variant="outline" icon={RefreshCw} onClick={() => onRetry(row)} disabled={!editable}>
          Try again
        </Button>
      </span>
    );
  } else if (row.phase === 'ready' && row.include && missing.length) {
    note = <span>Missing {missing.join(', ')} - you can fill {missing.length === 1 ? 'it' : 'them'} in now or later. It is saved hidden until then.</span>;
  }

  return (
    <div
      id={`bulk-row-${row.id}`}
      className={`rounded-2xl border bg-white p-3 shadow-card transition ${
        row.save === 'failed' ? 'border-red-200' : saved && !row.dirty ? 'border-brand-200 bg-brand-50/40' : 'border-slate-100'
      } ${skipped || (!row.include && !saved) ? 'opacity-60' : ''}`}
    >
      {/* Phones: photo and status on top, fields full width below. Computers: fields beside the photo. */}
      <div className="grid grid-cols-[auto_4rem_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2.5 sm:grid-cols-[auto_5rem_minmax(0,1fr)_auto]">
        <input
          type="checkbox"
          className="mt-1 size-4 cursor-pointer accent-brand-600 disabled:cursor-not-allowed lg:row-span-3"
          checked={saved || (row.include && !skipped)}
          disabled={skipped || saved || !editable}
          onChange={(e) => onChange(row.id, 'include', e.target.checked)}
          aria-label={`Add ${row.name || row.fileName}`}
        />

        <div className="lg:row-span-3">
          <button
            type="button"
            onClick={() => onPhoto(row.id)}
            disabled={!editable}
            className="group relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl border border-slate-100 bg-mint disabled:cursor-default"
            aria-label={`Change the photo of ${row.name || row.fileName}`}
            title={editable ? 'Change photo' : undefined}
          >
            {thumb ? (
              <img src={thumb} alt="" className="size-full object-cover" />
            ) : row.phase !== 'ready' ? (
              <Spinner className="size-5 text-brand-400" />
            ) : (
              <ImageOff className="size-5 text-brand-300" />
            )}
            {editable && (
              <span className="absolute bottom-1 right-1 rounded-full bg-white/90 p-1 text-brand-700 shadow-sm transition group-hover:bg-white">
                <ImagePlus className="size-3.5" />
              </span>
            )}
          </button>
          {row.phase === 'ready' && !skipped && (
            <button
              type="button"
              disabled={options.length < 2 || !editable}
              onClick={() => onChange(row.id, 'photoChoice', options[(options.indexOf(row.photoChoice) + 1) % options.length])}
              className="mt-1 w-full text-center text-[10px] font-medium leading-tight text-brand-700 enabled:hover:underline disabled:text-slate-400"
              title={options.length > 1 ? 'Switch between the photos of this item' : undefined}
            >
              {PHOTO_LABEL[row.photoChoice]}
              {options.length > 1 && editable && <span className="block text-slate-400">tap to switch</span>}
            </button>
          )}
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <StatusChip row={row} />
          {row.barcode && <span className="font-mono text-slate-500">{row.barcode}</span>}
          <span className="min-w-0 max-w-full truncate text-slate-400" title={row.fileName}>
            {row.fileName}
          </span>
        </div>

        <button
          type="button"
          onClick={() => onRemove(row)}
          disabled={locked || row.save === 'saving'}
          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40 lg:row-span-3"
          aria-label={`Remove ${row.fileName} from this list`}
          title={saved ? 'Remove from this list (the item stays in the store)' : 'Remove from this list'}
        >
          <X className="size-4" />
        </button>

        {row.phase === 'ready' && !skipped && (
          <div className="col-span-4 grid grid-cols-2 gap-2 lg:col-span-1 lg:col-start-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_120px_104px_96px]">
            <MiniField label="Item name" className="col-span-2 lg:col-span-1">
              <Input value={row.name} onChange={set('name')} maxLength={100} placeholder={row.placeholderName || 'Type now or later'} disabled={!editable} />
            </MiniField>
            <MiniField label="Category">
              <Input value={row.category} onChange={set('category')} list="bulk-categories" maxLength={50} placeholder="Now or later" disabled={!editable} />
            </MiniField>
            <MiniField label="Unit">
              <Select value={row.unit} onChange={set('unit')} disabled={!editable}>
                {ITEM_UNITS.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </Select>
            </MiniField>
            <MiniField label="Price (₹)" error={row.errors.price}>
              <Input type="number" inputMode="decimal" min="0" step="0.01" value={row.price} onChange={set('price')} placeholder="Later" invalid={Boolean(row.errors.price)} disabled={!editable} />
            </MiniField>
            <MiniField label="Stock" error={row.errors.stock}>
              <Input type="number" inputMode="decimal" min="0" step="any" value={row.stock} onChange={set('stock')} placeholder={saved ? 'Same' : defaultStock || '0'} invalid={Boolean(row.errors.stock)} disabled={!editable} />
            </MiniField>
          </div>
        )}

        {note && <p className="col-span-4 text-xs text-slate-500 [overflow-wrap:anywhere] lg:col-span-1 lg:col-start-3">{note}</p>}
      </div>
    </div>
  );
});

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'missing', label: 'Missing name / category / price' },
  { value: 'changed', label: 'Changed' },
  { value: 'saved', label: 'Saved' },
  { value: 'skipped', label: 'Skipped' },
];

const matchesFilter = (row, filter) => {
  if (filter === 'missing') return (needsCreate(row) || Boolean(row.itemId)) && !isComplete(row);
  if (filter === 'changed') return needsUpdate(row);
  if (filter === 'saved') return Boolean(row.itemId);
  if (filter === 'skipped') return row.phase === 'ready' && !row.itemId && (isSkipped(row) || !row.include);
  return true;
};

export default function BulkUpload() {
  useDocumentTitle('Bulk upload');
  const navigate = useNavigate();
  const categories = useFetch(() => itemsApi.categories(), [], { initialData: [] });
  const [rows, setRows] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [defaultStock, setDefaultStock] = useState('');
  const [fillCategory, setFillCategory] = useState('');
  const [filter, setFilter] = useState('all');
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef(null);
  const photoInput = useRef(null);
  const photoTarget = useRef(null); // row whose photo is being replaced

  const readerRef = useRef(null);
  const queueRef = useRef([]); // photos waiting to be read: { id, file }
  const busyRef = useRef(false);
  const seenRef = useRef(new Map()); // barcode -> { id, fileName } of the first photo with it
  const urlsRef = useRef(new Set());
  const aliveRef = useRef(true);
  // lower-case item name -> '' (already in the store) or the file name of the photo in this list that has it
  const namesRef = useRef(new Map());
  const namesLoaded = useRef(null);
  const lookupLimit = useMemo(() => createLimiter(LOOKUPS_AT_ONCE, LOOKUP_GAP_MS), []);

  useEffect(() => {
    aliveRef.current = true;
    const urls = urlsRef.current;
    return () => {
      aliveRef.current = false;
      if (readerRef.current) readerRef.current.close();
      readerRef.current = null;
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  // Names of the items already in the store, so photos without a barcode are not added twice
  useEffect(() => {
    namesLoaded.current = (async () => {
      for (let page = 1; page <= 20; page += 1) {
        try {
          const res = await itemsApi.list({ limit: 500, page, sort: 'name' });
          res.data.forEach((item) => namesRef.current.set(item.name.trim().toLowerCase(), ''));
          if (page >= res.pagination.pages) return;
        } catch {
          return; // duplicates by name are only a convenience check
        }
      }
    })();
  }, []);

  const getReader = () => {
    if (!readerRef.current) readerRef.current = createPhotoReader();
    return readerRef.current;
  };

  const trackUrl = (blob) => {
    const url = URL.createObjectURL(blob);
    urlsRef.current.add(url);
    return url;
  };

  /** Name for a photo without a barcode, unticked when that name is already taken */
  const nameFields = (fileName) => {
    const name = nameFromFile(fileName);
    const key = name.toLowerCase();
    if (!name || !namesRef.current.has(key)) {
      if (name) namesRef.current.set(key, fileName);
      return { name };
    }
    const taken = namesRef.current.get(key);
    return {
      name,
      include: false,
      message: taken
        ? `Same name as ${taken} - not ticked. Tick it to add anyway.`
        : `"${name}" is already in your store - not ticked. Tick it to add anyway.`,
    };
  };

  const updateRow = useCallback((id, patch) => {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...(typeof patch === 'function' ? patch(row) : patch) } : row)));
  }, []);

  const lookupRow = useCallback(
    async (id, code, fileName) => {
      try {
        const result = await itemsApi.lookupBarcode(code);
        if (!aliveRef.current) return;
        if (result.item) {
          updateRow(id, { phase: 'ready', kind: 'exists', include: false, existing: { _id: result.item._id, name: result.item.name } });
        } else if (result.product) {
          const p = result.product;
          updateRow(id, (row) => ({
            phase: 'ready',
            kind: 'found',
            source: p.source,
            name: row.name || p.name,
            description: p.description || '',
            category: row.category || p.category || '',
            unit: p.unit || row.unit,
            onlineImage: p.image || '',
            photoChoice: p.image ? 'online' : row.photoChoice,
          }));
        } else {
          updateRow(id, (row) => ({
            phase: 'ready',
            kind: result.unreachable ? 'lookupfail' : 'notonline',
            message: result.unreachable ? 'Could not reach the online product databases.' : '',
            name: row.name || nameFromFile(fileName),
          }));
        }
      } catch (err) {
        if (aliveRef.current) {
          updateRow(id, (row) => ({ phase: 'ready', kind: 'lookupfail', message: getErrorMessage(err), name: row.name || nameFromFile(fileName) }));
        }
      }
    },
    [updateRow]
  );

  // Photos are read one by one (in a background worker); barcodes are looked up two at a time meanwhile
  const processQueue = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setProcessing(true);
    const reader = getReader();
    await namesLoaded.current;
    const lookups = [];

    while (queueRef.current.length && aliveRef.current) {
      const { id, file } = queueRef.current.shift();
      updateRow(id, { phase: 'reading' });
      let code = null;
      let photo = null;
      try {
        ({ code, photo } = await reader.read(file));
      } catch {
        /* handled below as an unreadable photo */
      }
      if (!aliveRef.current) break;

      const base = { photoBlob: photo, photoUrl: photo ? trackUrl(photo) : '', photoChoice: photo ? 'own' : 'none' };

      if (!photo) {
        updateRow(id, { ...base, phase: 'ready', kind: 'unreadable', include: false, message: 'This photo could not be opened. Please use a JPG or PNG photo.' });
      } else if (!code) {
        updateRow(id, { ...base, phase: 'ready', kind: 'nobarcode', ...nameFields(file.name) });
      } else if (seenRef.current.has(code)) {
        updateRow(id, { ...base, phase: 'ready', kind: 'duplicate', barcode: code, include: false, message: `Same barcode as ${seenRef.current.get(code).fileName}` });
      } else {
        seenRef.current.set(code, { id, fileName: file.name });
        updateRow(id, { ...base, phase: 'looking', barcode: code });
        lookups.push(lookupLimit(() => lookupRow(id, code, file.name)));
      }
    }

    await Promise.all(lookups);
    busyRef.current = false;
    if (!aliveRef.current) return;
    setProcessing(false);
    if (queueRef.current.length) processQueue(); // photos added during the last lookups
  }, [lookupLimit, lookupRow, updateRow]);

  const addFiles = (fileList) => {
    const images = Array.from(fileList || []).filter((f) => f.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(f.name));
    if (!images.length) {
      toast.error('Please choose photos (JPG or PNG).');
      return;
    }
    const room = Math.max(0, MAX_PHOTOS - rows.length);
    const accepted = images.slice(0, room);
    if (accepted.length < images.length) {
      toast.error(`Up to ${MAX_PHOTOS} photos at a time - ${images.length - accepted.length} photos were left out. Add them after saving these.`);
    }
    if (!accepted.length) return;
    const created = accepted.map(newRow);
    setRows((prev) => [...prev, ...created]);
    queueRef.current.push(...created.map((row) => ({ id: row.id, file: row.file })));
    setFilter('all');
    processQueue();
  };

  const onChange = useCallback(
    (id, field, value) =>
      updateRow(id, (row) => ({
        [field]: value,
        errors: row.errors[field] ? { ...row.errors, [field]: undefined } : row.errors,
        dirty: row.itemId ? true : row.dirty,
        photoChanged: field === 'photoChoice' ? true : row.photoChanged,
      })),
    [updateRow]
  );

  // Pick a new photo for one item (before or after it is saved)
  const onPhoto = useCallback((id) => {
    photoTarget.current = id;
    if (photoInput.current) photoInput.current.click();
  }, []);

  const replacePhoto = async (file) => {
    const id = photoTarget.current;
    if (!file || !id) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose a photo (JPG or PNG).');
      return;
    }
    try {
      const { photo } = await getReader().read(file);
      if (!aliveRef.current) return;
      const photoUrl = trackUrl(photo);
      updateRow(id, (row) => ({ photoBlob: photo, photoUrl, photoChoice: 'own', photoChanged: true, dirty: row.itemId ? true : row.dirty }));
    } catch {
      toast.error('This photo could not be opened. Please use a JPG or PNG photo.');
    }
  };

  const forgetRow = (row) => {
    queueRef.current = queueRef.current.filter((job) => job.id !== row.id);
    const seen = row.barcode && seenRef.current.get(row.barcode);
    if (seen && seen.id === row.id && !row.itemId) seenRef.current.delete(row.barcode);
    const nameKey = row.name.trim().toLowerCase();
    if (!row.itemId && namesRef.current.get(nameKey) === row.fileName) namesRef.current.delete(nameKey);
  };

  const onRemove = useCallback((row) => {
    if (needsUpdate(row) && !window.confirm('Your changes to this item are not saved yet. Remove it from the list anyway?')) return;
    forgetRow(row);
    setRows((prev) => prev.filter((r) => r.id !== row.id));
  }, []);

  const onRetry = useCallback(
    (row) => {
      updateRow(row.id, { phase: 'looking', kind: '', message: '' });
      lookupLimit(() => lookupRow(row.id, row.barcode, row.fileName));
    },
    [lookupLimit, lookupRow, updateRow]
  );

  const counts = useMemo(() => {
    const c = { total: rows.length, done: 0, toCreate: 0, toUpdate: 0, incomplete: 0, saved: 0, hidden: 0 };
    Object.keys(KIND_META).forEach((kind) => {
      c[kind] = 0;
    });
    rows.forEach((row) => {
      if (row.phase === 'ready') {
        c.done += 1;
        if (row.kind) c[row.kind] += 1;
      }
      if (row.itemId) {
        c.saved += 1;
        if (!row.visible) c.hidden += 1;
      }
      if (needsCreate(row)) {
        c.toCreate += 1;
        if (!isComplete(row)) c.incomplete += 1;
      }
      if (needsUpdate(row)) c.toUpdate += 1;
    });
    return c;
  }, [rows]);
  const toSave = counts.toCreate + counts.toUpdate;

  useEffect(() => {
    if (!toSave) return undefined;
    const warn = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [toSave]);

  const leave = () => {
    if (toSave && !window.confirm('Leave this page? Some items here are not saved yet.')) return;
    navigate('/admin/items');
  };

  const clearRows = (which) => {
    if (which === 'all' && toSave && !window.confirm('Remove all photos from this list? Items that are not saved yet will be lost.')) return;
    const keep = (row) => (which === 'saved' ? !row.itemId || row.dirty : row.save === 'saving');
    rows.filter((row) => !keep(row)).forEach(forgetRow);
    setRows((prev) => prev.filter(keep));
  };

  const applyCategory = () => {
    const value = fillCategory.trim();
    if (!value) return;
    const ids = new Set(rows.filter((row) => (needsCreate(row) || row.itemId) && !row.category.trim()).map((row) => row.id));
    if (!ids.size) {
      toast.success('Every item already has a category');
      return;
    }
    setRows((prev) => prev.map((row) => (ids.has(row.id) ? { ...row, category: value, dirty: row.itemId ? true : row.dirty } : row)));
    toast.success(`Category set for ${ids.size} item${ids.size === 1 ? '' : 's'}`);
  };

  const rowImage = async (row) => {
    if (row.photoChoice === 'online' && row.onlineImage) return dataUrlToFile(row.onlineImage, `barcode-${row.barcode}`);
    if (row.photoChoice === 'own' && row.photoBlob) return new File([row.photoBlob], 'photo.jpg', { type: 'image/jpeg' });
    return null;
  };

  /** Create a new item or update a saved one. Incomplete items are saved hidden. */
  const saveRow = async (row, result) => {
    const isNew = !row.itemId;
    const placeholder = row.placeholderName || placeholderFor(row);
    updateRow(row.id, { save: 'saving', errors: {} });
    try {
      const data = new FormData();
      data.append('barcode', row.barcode);
      data.append('name', row.name.trim() || placeholder);
      data.append('description', row.description.trim());
      data.append('price', row.price !== '' ? row.price : '0');
      data.append('unit', row.unit);
      data.append('category', row.category.trim() || UNCATEGORISED);
      data.append('isAvailable', String(isComplete(row)));
      if (isNew) {
        data.append('stock', row.stock !== '' ? row.stock : defaultStock || '0');
        const image = await rowImage(row);
        if (image) data.append('image', image);
      } else {
        if (row.stock !== '') data.append('stock', row.stock);
        if (row.photoChanged) {
          const image = await rowImage(row);
          if (image) data.append('image', image);
          else data.append('removeImage', 'true');
        }
      }
      const res = isNew ? await itemsApi.create(data) : await itemsApi.update(row.itemId, data);
      const item = res.data;
      namesRef.current.set(item.name.trim().toLowerCase(), '');
      if (isNew) result.added += 1;
      else result.updated += 1;
      if (!item.isAvailable) result.hidden += 1;
      if (aliveRef.current) {
        updateRow(row.id, {
          save: 'saved',
          itemId: item._id,
          placeholderName: row.name.trim() ? '' : placeholder,
          visible: item.isAvailable,
          dirty: false,
          photoChanged: false,
          message: '',
        });
      }
    } catch (err) {
      result.failed += 1;
      if (aliveRef.current) updateRow(row.id, { save: 'failed', message: getErrorMessage(err) });
    }
  };

  const saveAll = async () => {
    const targets = rows.filter((row) => needsCreate(row) || needsUpdate(row));
    if (!targets.length) return;

    const invalid = new Map();
    targets.forEach((row) => {
      const errors = numberErrors(row);
      if (Object.keys(errors).length) invalid.set(row.id, errors);
    });
    if (invalid.size) {
      setRows((prev) => prev.map((row) => (invalid.has(row.id) ? { ...row, errors: invalid.get(row.id) } : row)));
      toast.error(`${invalid.size} item${invalid.size === 1 ? ' has' : 's have'} a wrong price or stock - marked in red.`);
      setFilter('all');
      const firstId = [...invalid.keys()][0];
      setTimeout(() => {
        const el = document.getElementById(`bulk-row-${firstId}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 50);
      return;
    }

    setSaving(true);
    const limit = createLimiter(SAVES_AT_ONCE);
    const result = { added: 0, updated: 0, hidden: 0, failed: 0 };
    await Promise.all(targets.map((row) => limit(() => (aliveRef.current ? saveRow(row, result) : Promise.resolve()))));
    if (!aliveRef.current) return;
    setSaving(false);
    categories.refetch({ silent: true });

    const done = [
      result.added && `${result.added} item${result.added === 1 ? '' : 's'} added`,
      result.updated && `${result.updated} updated`,
    ].filter(Boolean);
    if (done.length) {
      toast.success(`${done.join(', ')}${result.hidden ? ` · ${result.hidden} hidden until name, category and price are filled in` : ''}`);
    }
    if (result.failed) toast.error(`${result.failed} item${result.failed === 1 ? '' : 's'} could not be saved - see the red rows.`);
  };

  const visibleRows = filter === 'all' ? rows : rows.filter((row) => matchesFilter(row, filter));
  const filterCount = (value) => (value === 'all' ? rows.length : rows.filter((row) => matchesFilter(row, value)).length);
  const percent = counts.total ? Math.round((counts.done / counts.total) * 100) : 0;
  let saveLabel = `Save ${toSave} items`;
  if (!counts.toUpdate) saveLabel = `Add ${counts.toCreate} item${counts.toCreate === 1 ? '' : 's'}`;
  else if (!counts.toCreate) saveLabel = `Save ${counts.toUpdate} change${counts.toUpdate === 1 ? '' : 's'}`;

  const pickPhotos = () => fileInput.current && fileInput.current.click();
  const dropProps = {
    onDragOver: (e) => {
      e.preventDefault();
      setDragOver(true);
    },
    onDragLeave: () => setDragOver(false),
    onDrop: (e) => {
      e.preventDefault();
      setDragOver(false);
      addFiles(e.dataTransfer.files);
    },
  };

  return (
    <div className="pb-4">
      <PageHeader
        title="Bulk upload items"
        description="Select many product photos at once and save them straight away. Fill in the details now or later."
        actions={
          <Button variant="outline" icon={ArrowLeft} onClick={leave}>
            Back to items
          </Button>
        }
      />

      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <input
        ref={photoInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          replacePhoto(e.target.files[0]);
          e.target.value = '';
        }}
      />

      {rows.length === 0 ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <div
            {...dropProps}
            className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition sm:p-12 ${
              dragOver ? 'border-brand-500 bg-brand-50' : 'border-brand-200 bg-mint'
            }`}
          >
            <Images className="size-12 text-brand-400" />
            <p className="mt-3 text-lg font-semibold text-slate-800">Select product photos</p>
            <p className="mt-1 max-w-md text-sm text-slate-500">
              Choose up to {MAX_PHOTOS} photos at once - from the phone gallery or a folder on the computer. You can also drop them here.
            </p>
            <Button size="lg" icon={Upload} className="mt-5" onClick={pickPhotos}>
              Choose photos
            </Button>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-card">
            <h3 className="font-semibold">How it works</h3>
            <ul className="mt-3 space-y-3 text-sm text-slate-600">
              <li className="flex gap-2.5">
                <Sparkles className="mt-0.5 size-4 shrink-0 text-brand-600" />
                <span>
                  <b className="font-semibold text-slate-800">Photo of the barcode</b> - name, brand, size, category and a product photo are filled in from free online product databases.
                </span>
              </li>
              <li className="flex gap-2.5">
                <Images className="mt-0.5 size-4 shrink-0 text-brand-600" />
                <span>
                  <b className="font-semibold text-slate-800">Photo without a barcode</b> - the photo becomes the product picture and the file name the item name (e.g. "Aashirvaad Atta 5kg.jpg").
                </span>
              </li>
              <li className="flex gap-2.5">
                <EyeOff className="mt-0.5 size-4 shrink-0 text-amber-500" />
                <span>
                  <b className="font-semibold text-slate-800">No details needed to save.</b> Items without a name, category or price are saved hidden and shown to customers once you fill them in.
                </span>
              </li>
              <li className="flex gap-2.5">
                <Pencil className="mt-0.5 size-4 shrink-0 text-brand-600" />
                <span>After saving you can still change every item and its photo here, or one by one on the Items page.</span>
              </li>
            </ul>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Progress and summary */}
          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-slate-800">
                  {processing ? `Reading photos... ${counts.done} of ${counts.total}` : `${counts.total} photo${counts.total === 1 ? '' : 's'} read`}
                </p>
                <p className="text-xs text-slate-500">
                  {counts.saved
                    ? `${counts.saved} saved in the store${counts.hidden ? ` · ${counts.hidden} hidden until complete` : ''}`
                    : 'Fill in what you know, then press "Add items". The rest can be done later.'}
                </p>
              </div>
              <div {...dropProps} className={`rounded-xl ${dragOver ? 'ring-4 ring-brand-100' : ''}`}>
                <Button variant="outline" icon={Upload} onClick={pickPhotos} disabled={saving}>
                  Add more photos
                </Button>
              </div>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full bg-brand-500 transition-all duration-300" style={{ width: `${percent}%` }} />
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {Object.entries(KIND_META).map(([kind, meta]) =>
                counts[kind] ? (
                  <Chip key={kind} tone={meta.tone} icon={meta.icon}>
                    {meta.label}: {counts[kind]}
                  </Chip>
                ) : null
              )}
            </div>
            {counts.hidden > 0 && !saving && (
              <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {counts.hidden} saved item{counts.hidden === 1 ? ' is' : 's are'} hidden from customers until the name, category and price are filled in. Fill them in below and press
                Save, or{' '}
                <Link to="/admin/items?filter=hidden" className="font-semibold underline">
                  edit them one by one on the Items page
                </Link>
                .
              </p>
            )}
          </div>

          {/* Fill in many rows at once */}
          <div className="grid gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-card md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.4fr)] md:items-end">
            <MiniField label="Category for items without one">
              <div className="flex gap-2">
                <Input value={fillCategory} onChange={(e) => setFillCategory(e.target.value)} list="bulk-categories" maxLength={50} placeholder="e.g. Snacks" className="min-w-0 flex-1" />
                <Button variant="secondary" onClick={applyCategory} disabled={!fillCategory.trim() || saving} className="shrink-0">
                  Apply
                </Button>
              </div>
            </MiniField>
            <MiniField label="Stock for new items without one">
              <Input type="number" inputMode="decimal" min="0" step="any" value={defaultStock} onChange={(e) => setDefaultStock(e.target.value)} placeholder="0" />
            </MiniField>
            <p className="flex gap-2 rounded-xl border border-slate-100 bg-slate-50/60 p-3 text-xs text-slate-600">
              <EyeOff className="mt-0.5 size-4 shrink-0 text-amber-500" />
              Items without a name, category or price are saved hidden. They are shown to customers once all three are filled in.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => {
              const count = filterCount(f.value);
              if (f.value !== 'all' && !count) return null;
              return (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setFilter(f.value)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    filter === f.value ? 'border-brand-500 bg-brand-500 text-on-brand' : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300'
                  }`}
                >
                  {f.label} ({count})
                </button>
              );
            })}
          </div>

          <datalist id="bulk-categories">
            {(categories.data || []).map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>

          <div className="space-y-2.5">
            {visibleRows.map((row) => (
              <BulkRow
                key={row.id}
                row={row}
                locked={saving}
                defaultStock={defaultStock}
                onChange={onChange}
                onPhoto={onPhoto}
                onRemove={onRemove}
                onRetry={onRetry}
              />
            ))}
            {visibleRows.length === 0 && <p className="rounded-2xl bg-white p-6 text-center text-sm text-slate-500">Nothing to show here.</p>}
          </div>

          {/* Save bar */}
          <div className="sticky bottom-3 z-10 rounded-2xl border border-slate-100 bg-white/95 p-3 shadow-soft backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="min-w-0 text-sm text-slate-600">
                {toSave ? (
                  <>
                    {counts.toCreate > 0 && (
                      <>
                        <b className="font-semibold text-slate-800">{counts.toCreate}</b> new
                      </>
                    )}
                    {counts.toCreate > 0 && counts.toUpdate > 0 && ' · '}
                    {counts.toUpdate > 0 && (
                      <>
                        <b className="font-semibold text-slate-800">{counts.toUpdate}</b> changed
                      </>
                    )}
                    {counts.incomplete > 0 && <span className="text-amber-700"> · {counts.incomplete} will be saved hidden until complete</span>}
                  </>
                ) : (
                  'Everything is saved.'
                )}
              </p>
              <div className="flex flex-wrap gap-2">
                {counts.saved > 0 && (
                  <Button variant="ghost" onClick={() => clearRows('saved')} disabled={saving}>
                    Remove saved
                  </Button>
                )}
                <Button variant="ghost" onClick={() => clearRows('all')} disabled={saving}>
                  Clear all
                </Button>
                <Button icon={counts.toCreate ? Upload : Save} onClick={saveAll} loading={saving} disabled={!toSave}>
                  {saving ? 'Saving...' : saveLabel}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
