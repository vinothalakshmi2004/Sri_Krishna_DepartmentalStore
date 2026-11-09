/**
 * Store settings: everything shown on the landing page plus ordering rules,
 * images (logo, hero, gallery) and social links.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  ExternalLink,
  ImagePlus,
  Images,
  Info,
  MapPin,
  Phone,
  Plus,
  Power,
  Save,
  Share2,
  Store,
  Trash2,
  Truck,
  Upload,
  X,
} from 'lucide-react';
import { settingsApi } from '../../api/adminApi';
import { getErrorList, getErrorMessage } from '../../api/client';
import { useStore } from '../../context/StoreContext';
import useFetch from '../../hooks/useFetch';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { imageUrl, instagramId, instagramUrl, isInstagramValue } from '../../utils/links';
import { formatCurrency } from '../../utils/format';
import { deliveryRule } from '../../utils/pricing';
import PageHeader from '../../components/admin/PageHeader';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import EmptyState from '../../components/ui/EmptyState';
import PageLoader from '../../components/ui/Loader';
import { Field, Input, Textarea, Toggle } from '../../components/ui/FormControls';

const MAX_GALLERY = 20;
const MAX_MB = 5;
const SOCIAL_FIELDS = [
  { key: 'facebook', label: 'Facebook', placeholder: 'https://facebook.com/yourstore' },
  { key: 'instagram', label: 'Instagram ID', placeholder: 'srikrishnastore', hint: 'Just the ID (or paste the full link). Shown as an icon on the About section and footer.', type: 'text' },
  { key: 'youtube', label: 'YouTube', placeholder: 'https://youtube.com/@yourstore' },
  { key: 'twitter', label: 'X (Twitter)', placeholder: 'https://x.com/yourstore' },
];

/** Settings document -> editable form values */
const toForm = (s) => ({
  storeName: s.storeName || '',
  tagline: s.tagline || '',
  about: s.about || '',
  phone: s.phone || '',
  extraPhones: s.extraPhones || [],
  whatsapp: s.whatsapp || '',
  email: s.email || '',
  address: s.address || '',
  mapLink: s.mapLink || '',
  mapEmbedUrl: s.mapEmbedUrl || '',
  openingHours: s.openingHours || '',
  deliveryCharge: String(s.deliveryCharge ?? 0),
  freeDeliveryAbove: String(s.freeDeliveryAbove ?? 0),
  minOrderAmount: String(s.minOrderAmount ?? 0),
  allowedPincodes: s.allowedPincodes || [],
  socialLinks: {
    facebook: s.socialLinks?.facebook || '',
    instagram: instagramId(s.socialLinks?.instagram),
    youtube: s.socialLinks?.youtube || '',
    twitter: s.socialLinks?.twitter || '',
  },
});

const validate = (form) => {
  const errors = {};
  if (!form.storeName.trim()) errors.storeName = 'Store name is required';
  ['phone', 'whatsapp'].forEach((key) => {
    if (form[key] && !/^[\d\s+\-()]{0,20}$/.test(form[key])) errors[key] = 'Only digits, spaces, +, - and ()';
  });
  if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errors.email = 'Enter a valid email';
  if (form.mapLink.trim() && !/^https:\/\/\S+$/i.test(form.mapLink.trim())) {
    errors.mapLink = 'Paste the Google Maps link (starts with https://)';
  }
  if (form.mapEmbedUrl.trim() && !/^(https:\/\/\S+|<iframe[\s\S]*src=["']https:\/\/)/i.test(form.mapEmbedUrl.trim())) {
    errors.mapEmbedUrl = 'Paste the https:// embed link or the whole <iframe> code';
  }
  ['deliveryCharge', 'freeDeliveryAbove', 'minOrderAmount'].forEach((key) => {
    if (form[key] === '' || Number.isNaN(Number(form[key])) || Number(form[key]) < 0) errors[key] = 'Enter 0 or more';
  });
  SOCIAL_FIELDS.forEach(({ key }) => {
    const value = form.socialLinks[key].trim();
    if (key === 'instagram') {
      if (!isInstagramValue(value)) errors[`social.${key}`] = 'Type the Instagram ID (letters, numbers, . and _) or the full link';
    } else if (value && !/^https?:\/\/\S+$/i.test(value)) errors[`social.${key}`] = 'Link must start with https://';
  });
  return errors;
};

/**
 * List of values shown as removable chips: type a value and press Enter / Add.
 * Used for delivery pincodes and extra contact numbers.
 */
function ChipListInput({ value, onChange, placeholder, splitPattern, isValid, invalidMessage, emptyText, max, inputMode, id }) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');

  const add = () => {
    const entries = draft.split(splitPattern).map((c) => c.trim()).filter(Boolean);
    if (!entries.length) return;
    const bad = entries.find((c) => !isValid(c));
    if (bad) {
      setError(invalidMessage(bad));
      return;
    }
    const next = [...new Set([...value, ...entries])];
    if (max && next.length > max) {
      setError(`You can add at most ${max}`);
      return;
    }
    onChange(next);
    setDraft('');
    setError('');
  };

  return (
    <div>
      <div className="flex gap-2">
        <Input
          id={id}
          value={draft}
          inputMode={inputMode}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          invalid={Boolean(error)}
        />
        <Button variant="secondary" icon={Plus} onClick={add}>
          Add
        </Button>
      </div>
      {error && <p className="mt-1 text-xs font-medium text-red-600">{error}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {value.length === 0 ? (
          <p className="text-sm text-slate-500">{emptyText}</p>
        ) : (
          value.map((code) => (
            <span key={code} className="inline-flex items-center gap-1 rounded-full bg-brand-50 py-1 pl-3 pr-1 text-sm font-medium text-brand-800 ring-1 ring-brand-200">
              {code}
              <button type="button" onClick={() => onChange(value.filter((c) => c !== code))} className="rounded-full p-0.5 hover:bg-brand-100" aria-label={`Remove ${code}`}>
                <X className="size-3.5" />
              </button>
            </span>
          ))
        )}
      </div>
    </div>
  );
}

/** Delivery pincode chips (6 digits each) */
function PincodeInput({ value, onChange }) {
  return (
    <ChipListInput
      value={value}
      onChange={onChange}
      inputMode="numeric"
      splitPattern={/[\s,]+/}
      isValid={(c) => /^\d{6}$/.test(c)}
      invalidMessage={(bad) => `"${bad}" is not a 6-digit pincode`}
      placeholder="e.g. 641019 (comma separate many)"
      emptyText={<>No pincodes added — the store delivers to <strong>all pincodes</strong>.</>}
      max={500}
    />
  );
}

/** Image slot (logo / full logo / hero) with upload + remove */
function ImageSlot({ label, hint, src, aspect, fit = 'cover', uploading, onUpload, onDelete }) {
  const input = useRef(null);
  return (
    <div>
      <p className="text-sm font-medium text-slate-700">{label}</p>
      <p className="mb-2 text-xs text-slate-500">{hint}</p>
      <div className={`relative overflow-hidden rounded-2xl border-2 border-dashed border-brand-200 ${src && fit === 'contain' ? 'bg-white' : 'bg-mint'} ${aspect}`}>
        {src ? (
          <img src={imageUrl(src)} alt={label} className={`size-full ${fit === 'contain' ? 'object-contain p-2' : 'object-cover'}`} />
        ) : (
          <button type="button" onClick={() => input.current && input.current.click()} className="flex size-full flex-col items-center justify-center gap-2 text-slate-500 hover:text-brand-700">
            <ImagePlus className="size-8 text-brand-400" />
            <span className="text-xs">Upload {label.toLowerCase()}</span>
          </button>
        )}
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70 text-sm font-medium text-brand-800">Uploading...</div>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          if (e.target.files[0]) onUpload(e.target.files[0]);
          e.target.value = '';
        }}
      />
      <div className="mt-2 flex gap-2">
        <Button size="xs" variant="secondary" icon={Upload} loading={uploading} onClick={() => input.current && input.current.click()}>
          {src ? 'Replace' : 'Upload'}
        </Button>
        {src && (
          <Button size="xs" variant="ghost" icon={Trash2} className="text-red-600 hover:bg-red-50" onClick={onDelete}>
            Remove
          </Button>
        )}
      </div>
    </div>
  );
}

const checkFile = (file) => {
  if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) return 'Please choose JPG, PNG, WEBP or GIF images';
  if (file.size > MAX_MB * 1024 * 1024) return `Each image must be smaller than ${MAX_MB} MB`;
  return null;
};

export default function StoreSettings() {
  useDocumentTitle('Store settings');
  const store = useStore();
  const { data: settings, setData: setSettings, loading, error, refetch } = useFetch(() => settingsApi.get(), []);
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [togglingOpen, setTogglingOpen] = useState(false);
  const [uploading, setUploading] = useState('');
  const [toDelete, setToDelete] = useState(null); // { type, url, label }
  const [deleting, setDeleting] = useState(false);
  const galleryInput = useRef(null);

  useEffect(() => {
    if (settings && !form) setForm(toForm(settings));
  }, [settings, form]);

  const saved = useMemo(() => (settings ? toForm(settings) : null), [settings]);
  const dirty = Boolean(form && saved && JSON.stringify(form) !== JSON.stringify(saved));

  // Warn before leaving with unsaved changes
  useEffect(() => {
    if (!dirty) return undefined;
    const onBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  if (loading && !settings) return <PageLoader label="Loading settings..." />;
  if (error && !settings) return <EmptyState title="Could not load settings" message={error} action={<Button onClick={() => refetch()}>Retry</Button>} />;
  if (!form) return null;

  const set = (name) => (event) => setForm((prev) => ({ ...prev, [name]: event.target.value }));
  const setSocial = (key) => (event) => setForm((prev) => ({ ...prev, socialLinks: { ...prev.socialLinks, [key]: event.target.value } }));

  /** Apply a fresh settings document from the server everywhere */
  const applyServerSettings = (next, { resetForm = false } = {}) => {
    setSettings(next);
    if (resetForm) setForm(toForm(next));
    store.refresh(); // public site context in this tab
  };

  const save = async () => {
    const validation = validate(form);
    setErrors(validation);
    if (Object.keys(validation).length) {
      toast.error('Please fix the highlighted fields');
      return;
    }
    setSaving(true);
    try {
      const res = await settingsApi.update({
        ...form,
        storeName: form.storeName.trim(),
        email: form.email.trim(),
        mapLink: form.mapLink.trim(),
        mapEmbedUrl: form.mapEmbedUrl.trim(),
        deliveryCharge: Number(form.deliveryCharge),
        freeDeliveryAbove: Number(form.freeDeliveryAbove),
        minOrderAmount: Number(form.minOrderAmount),
        // Instagram can be typed as just the ID; the website needs the full link
        socialLinks: { ...form.socialLinks, instagram: instagramUrl(form.socialLinks.instagram) },
      });
      applyServerSettings(res.data, { resetForm: true });
      if (res.notice) toast(res.notice, { icon: '⚠️', duration: 7000 });
      else toast.success('Settings saved. The store page is updated.');
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

  const toggleStoreOpen = async (value) => {
    setTogglingOpen(true);
    try {
      const res = await settingsApi.update({ isStoreOpen: value });
      applyServerSettings(res.data);
      toast.success(value ? 'Store is now OPEN for orders' : 'Store is now CLOSED for orders');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setTogglingOpen(false);
    }
  };

  const uploadImages = async (field, files) => {
    const list = Array.from(files);
    const problem = list.map(checkFile).find(Boolean);
    if (problem) {
      toast.error(problem);
      return;
    }
    if (field === 'galleryImages' && settings.galleryImages.length + list.length > MAX_GALLERY) {
      toast.error(`The gallery holds up to ${MAX_GALLERY} photos. You can add ${MAX_GALLERY - settings.galleryImages.length} more.`);
      return;
    }
    const data = new FormData();
    list.forEach((file) => data.append(field, file));
    setUploading(field);
    try {
      const res = await settingsApi.uploadImages(data);
      applyServerSettings(res.data);
      toast.success(list.length > 1 ? `${list.length} photos uploaded` : 'Image uploaded');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setUploading('');
    }
  };

  const confirmDeleteImage = async () => {
    setDeleting(true);
    try {
      const res = await settingsApi.deleteImage(toDelete.type, toDelete.url);
      applyServerSettings(res.data);
      toast.success('Image removed');
      setToDelete(null);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  const err = (name) => errors[name];

  return (
    <div className={dirty ? 'pb-24' : ''}>
      <PageHeader
        title="Store settings"
        description="Everything on your customer website comes from here."
        actions={
          <>
            <Button variant="outline" icon={ExternalLink} href="/" target="_blank" rel="noopener noreferrer">
              Preview store
            </Button>
            <Button icon={Save} onClick={save} loading={saving} disabled={!dirty}>
              Save changes
            </Button>
          </>
        }
      />

      {/* Open / closed */}
      <div
        className={`mb-6 flex flex-col gap-4 rounded-2xl border p-5 shadow-card sm:flex-row sm:items-center sm:justify-between ${
          settings.isStoreOpen ? 'border-brand-200 bg-brand-50' : 'border-red-200 bg-red-50'
        }`}
      >
        <div className="flex items-center gap-3">
          <span className={`flex size-12 items-center justify-center rounded-2xl text-white ${settings.isStoreOpen ? 'bg-brand-500' : 'bg-red-500'}`}>
            <Power className="size-6" />
          </span>
          <div>
            <p className="font-semibold text-slate-800">Store is {settings.isStoreOpen ? 'OPEN' : 'CLOSED'}</p>
            <p className="text-sm text-slate-600">
              {settings.isStoreOpen ? 'Customers can place orders right now.' : 'Customers can browse but cannot place orders.'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-slate-700">{settings.isStoreOpen ? 'Accepting orders' : 'Not accepting'}</span>
          <Toggle checked={settings.isStoreOpen} disabled={togglingOpen} onChange={toggleStoreOpen} />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Store details" icon={Store} bodyClassName="space-y-4 p-5">
          <Field label="Store name" htmlFor="storeName" required error={err('storeName')}>
            <Input id="storeName" value={form.storeName} onChange={set('storeName')} maxLength={100} invalid={Boolean(err('storeName'))} />
          </Field>
          <Field label="Tagline" htmlFor="tagline" error={err('tagline')} hint="Shown under the store name on the home page">
            <Input id="tagline" value={form.tagline} onChange={set('tagline')} maxLength={150} />
          </Field>
          <Field label="About the store" htmlFor="about" error={err('about')}>
            <Textarea id="about" value={form.about} onChange={set('about')} maxLength={2000} rows={5} />
          </Field>
          <Field label="Opening hours" htmlFor="openingHours" error={err('openingHours')}>
            <Input id="openingHours" value={form.openingHours} onChange={set('openingHours')} placeholder="Mon - Sun: 7:00 AM - 10:00 PM" maxLength={200} />
          </Field>
        </Card>

        <Card title="Contact & location" icon={Phone} bodyClassName="space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Phone" htmlFor="phone" error={err('phone')}>
              <Input id="phone" type="tel" value={form.phone} onChange={set('phone')} maxLength={20} invalid={Boolean(err('phone'))} />
            </Field>
            <Field label="WhatsApp number" htmlFor="whatsapp" error={err('whatsapp')} hint="Enquiry number for every WhatsApp button and icon">
              <Input id="whatsapp" type="tel" value={form.whatsapp} onChange={set('whatsapp')} maxLength={20} invalid={Boolean(err('whatsapp'))} />
            </Field>
          </div>
          <Field label="Other contact numbers" htmlFor="extraPhones" error={err('extraPhones')} hint="Shown with the main phone on the website (up to 5)">
            <ChipListInput
              id="extraPhones"
              value={form.extraPhones}
              onChange={(numbers) => setForm((prev) => ({ ...prev, extraPhones: numbers }))}
              inputMode="tel"
              splitPattern={/,/}
              isValid={(n) => /^[\d\s+\-()]{6,20}$/.test(n)}
              invalidMessage={(bad) => `"${bad}" is not a valid phone number`}
              placeholder="e.g. 9360586396 (comma separate many)"
              emptyText="No other numbers added."
              max={5}
            />
          </Field>
          <Field label="Email" htmlFor="email" error={err('email')}>
            <Input id="email" type="email" value={form.email} onChange={set('email')} maxLength={100} invalid={Boolean(err('email'))} />
          </Field>
          <Field label="Address" htmlFor="address" error={err('address')}>
            <Textarea id="address" value={form.address} onChange={set('address')} maxLength={300} rows={2} />
          </Field>
          <Field
            label="Google Maps link"
            htmlFor="mapLink"
            error={err('mapLink')}
            hint="Google Maps → open your store → Share → Copy link, then paste here. The map on the website is created automatically."
          >
            <Input id="mapLink" type="url" icon={MapPin} value={form.mapLink} onChange={set('mapLink')} maxLength={500} placeholder="https://maps.app.goo.gl/..." invalid={Boolean(err('mapLink'))} />
          </Field>
          <Field
            label="Map embed (advanced)"
            htmlFor="mapEmbedUrl"
            error={err('mapEmbedUrl')}
            hint="Filled automatically from the link above. Only change it if you want a different map."
          >
            <Textarea id="mapEmbedUrl" value={form.mapEmbedUrl} onChange={set('mapEmbedUrl')} rows={2} placeholder='<iframe src="https://www.google.com/maps/embed?..."></iframe>' invalid={Boolean(err('mapEmbedUrl'))} />
          </Field>
          {settings.mapEmbedUrl && (
            <div className="overflow-hidden rounded-xl border border-slate-100">
              <iframe src={settings.mapEmbedUrl} title="Map preview" className="h-40 w-full border-0" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
            </div>
          )}
        </Card>

        <Card title="Delivery & ordering rules" icon={Truck} bodyClassName="space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Delivery charge (₹)" htmlFor="deliveryCharge" error={err('deliveryCharge')} hint="0 = free delivery">
              <Input id="deliveryCharge" type="number" min="0" inputMode="decimal" value={form.deliveryCharge} onChange={set('deliveryCharge')} invalid={Boolean(err('deliveryCharge'))} />
            </Field>
            <Field label="Free delivery above (₹)" htmlFor="freeDeliveryAbove" error={err('freeDeliveryAbove')} hint="Only used when there is a delivery charge (0 = off)">
              <Input id="freeDeliveryAbove" type="number" min="0" inputMode="decimal" value={form.freeDeliveryAbove} onChange={set('freeDeliveryAbove')} invalid={Boolean(err('freeDeliveryAbove'))} />
            </Field>
            <Field label="Minimum order for delivery (₹)" htmlFor="minOrderAmount" error={err('minOrderAmount')} hint="Orders below this cannot be placed (0 = no minimum)">
              <Input id="minOrderAmount" type="number" min="0" inputMode="decimal" value={form.minOrderAmount} onChange={set('minOrderAmount')} invalid={Boolean(err('minOrderAmount'))} />
            </Field>
          </div>
          {/* Plain-language summary of what customers will see */}
          <p className="flex items-start gap-2 rounded-xl bg-beige p-3 text-xs text-slate-600">
            <Info className="mt-0.5 size-4 shrink-0 text-brand-600" />
            <span>
              Customers see: <strong>&ldquo;{deliveryRule({ deliveryCharge: form.deliveryCharge, freeDeliveryAbove: form.freeDeliveryAbove, minOrderAmount: form.minOrderAmount })}&rdquo;</strong>
              {Number(form.minOrderAmount) > 0 && Number(form.deliveryCharge) > 0 && (
                <>. Orders below {formatCurrency(Number(form.minOrderAmount))} cannot be placed</>
              )}
              .
            </span>
          </p>
          <Field label="Delivery pincodes" hint="Only these pincodes can order. Leave empty to deliver everywhere.">
            <PincodeInput value={form.allowedPincodes} onChange={(codes) => setForm((prev) => ({ ...prev, allowedPincodes: codes }))} />
          </Field>
        </Card>

        <Card title="Social links" icon={Share2} bodyClassName="grid gap-4 p-5 sm:grid-cols-2">
          {SOCIAL_FIELDS.map(({ key, label, placeholder, hint, type = 'url' }) => (
            <Field key={key} label={label} htmlFor={`social-${key}`} error={err(`social.${key}`)} hint={hint}>
              <Input
                id={`social-${key}`}
                type={type}
                value={form.socialLinks[key]}
                onChange={setSocial(key)}
                placeholder={placeholder}
                autoCapitalize="none"
                spellCheck={false}
                invalid={Boolean(err(`social.${key}`))}
              />
            </Field>
          ))}
        </Card>

        <Card
          title="Logos & hero image"
          description="Changes show on the website right after upload"
          icon={ImagePlus}
          bodyClassName="grid gap-6 p-5 sm:grid-cols-[170px_1fr] lg:grid-cols-[170px_1fr_1fr]"
          className="xl:col-span-2"
        >
          <ImageSlot
            label="Logo (square icon)"
            hint="Header, admin menu, browser tab"
            src={settings.logo}
            aspect="aspect-square"
            fit="contain"
            uploading={uploading === 'logo'}
            onUpload={(file) => uploadImages('logo', [file])}
            onDelete={() => setToDelete({ type: 'logo', label: 'logo' })}
          />
          <ImageSlot
            label="Full logo (with store name)"
            hint="Footer, login page, printed bills"
            src={settings.logoFull}
            aspect="aspect-[2/1]"
            fit="contain"
            uploading={uploading === 'logoFull'}
            onUpload={(file) => uploadImages('logoFull', [file])}
            onDelete={() => setToDelete({ type: 'logoFull', label: 'full logo' })}
          />
          <div className="sm:col-span-2 lg:col-span-1">
            <ImageSlot
              label="Hero image"
              hint="Big picture beside the store name on the home page (4:3 works best)"
              src={settings.heroImage}
              aspect="aspect-[4/3]"
              uploading={uploading === 'heroImage'}
              onUpload={(file) => uploadImages('heroImage', [file])}
              onDelete={() => setToDelete({ type: 'heroImage', label: 'hero image' })}
            />
          </div>
        </Card>

        <Card
          title={`Gallery (${settings.galleryImages.length}/${MAX_GALLERY})`}
          description="Photos of your store shown on the home page"
          icon={Images}
          className="xl:col-span-2"
          actions={
            <Button
              size="sm"
              icon={Upload}
              loading={uploading === 'galleryImages'}
              disabled={settings.galleryImages.length >= MAX_GALLERY}
              onClick={() => galleryInput.current && galleryInput.current.click()}
            >
              Add photos
            </Button>
          }
        >
          <input
            ref={galleryInput}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files).slice(0, 10);
              if (e.target.files.length > 10) toast('Uploading the first 10 photos', { icon: 'ℹ️' });
              if (files.length) uploadImages('galleryImages', files);
              e.target.value = '';
            }}
          />
          {settings.galleryImages.length === 0 ? (
            <EmptyState compact icon={Images} title="No gallery photos yet" message="Add up to 10 photos at a time." />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {settings.galleryImages.map((src, index) => (
                <div key={src} className="group relative overflow-hidden rounded-xl">
                  <img src={imageUrl(src)} alt={`Gallery ${index + 1}`} className="aspect-square w-full object-cover" loading="lazy" />
                  <button
                    type="button"
                    onClick={() => setToDelete({ type: 'gallery', url: src, label: 'this photo' })}
                    className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-full bg-white/95 text-red-600 shadow transition hover:bg-red-50 sm:opacity-0 sm:group-hover:opacity-100"
                    aria-label="Delete photo"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <p className="mt-6 flex items-center gap-2 text-xs text-slate-500">
        <MapPin className="size-3.5" /> Changes appear on the customer website as soon as they are saved.
      </p>

      {/* Unsaved changes bar */}
      {dirty && (
        <div className="fixed inset-x-0 bottom-0 z-30 animate-slide-up border-t border-brand-100 bg-white/95 px-4 py-3 shadow-2xl backdrop-blur lg:left-64">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
            <p className="text-sm font-medium text-slate-700">You have unsaved changes</p>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setForm(toForm(settings));
                  setErrors({});
                }}
                disabled={saving}
              >
                Discard
              </Button>
              <Button icon={Save} onClick={save} loading={saving}>
                Save changes
              </Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDeleteImage}
        loading={deleting}
        title={`Remove ${toDelete ? toDelete.label : 'image'}?`}
        message="The image will be deleted from the server and removed from the store page."
        confirmText="Remove"
      />
    </div>
  );
}
