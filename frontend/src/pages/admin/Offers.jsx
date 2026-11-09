/**
 * Offers: post daily offers for the landing page "Offer Zone".
 * Special-price offers change what customers pay while they are live.
 * The switch at the top turns offers on/off for the whole website.
 */
import { useState } from 'react';
import toast from 'react-hot-toast';
import {
  BadgePercent,
  CalendarDays,
  ExternalLink,
  Eye,
  EyeOff,
  Info,
  Megaphone,
  Pencil,
  Plus,
  RotateCcw,
  Tag,
  Trash2,
} from 'lucide-react';
import { offersApi, settingsApi } from '../../api/adminApi';
import { getErrorMessage } from '../../api/client';
import { useStore } from '../../context/StoreContext';
import useFetch from '../../hooks/useFetch';
import useDebounce from '../../hooks/useDebounce';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { OFFER_STATUS_META } from '../../utils/constants';
import { formatCurrency, formatDate } from '../../utils/format';
import PageHeader from '../../components/admin/PageHeader';
import FilterBar, { SearchInput } from '../../components/admin/FilterBar';
import OfferFormModal from '../../components/admin/OfferFormModal';
import ProductImage from '../../components/public/ProductImage';
import SegmentedControl from '../../components/ui/SegmentedControl';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import EmptyState from '../../components/ui/EmptyState';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { Toggle } from '../../components/ui/FormControls';
import { Skeleton } from '../../components/ui/Loader';

/**
 * Offers ON/OFF for the website. OFF hides the Offers menu, the Offer Zone,
 * offer badges and offer prices from customers; offers stay saved here.
 */
function OffersSwitch() {
  const { settings, offersEnabled, refresh } = useStore();
  const [saving, setSaving] = useState(false);

  const toggle = async (value) => {
    setSaving(true);
    try {
      await settingsApi.update({ offersEnabled: value });
      await refresh();
      toast.success(value ? 'Offers are ON - customers can see them now' : 'Offers are OFF - hidden from the website', { id: 'offers-switch' });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (!settings) return <Skeleton className="mb-4 h-20 w-full rounded-2xl" />;

  const Icon = offersEnabled ? Eye : EyeOff;
  return (
    <div
      className={`mb-4 flex items-center justify-between gap-4 rounded-2xl border p-4 transition ${
        offersEnabled ? 'border-brand-200 bg-brand-50' : 'border-slate-200 bg-slate-100'
      }`}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span
          className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${
            offersEnabled ? 'bg-brand-500 text-on-brand' : 'bg-slate-300 text-slate-700'
          }`}
        >
          <Icon className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="font-semibold text-slate-800">{offersEnabled ? 'Offers are ON' : 'Offers are OFF'}</p>
          <p className="text-sm text-slate-600">
            {offersEnabled
              ? 'Customers see the Offers menu, the Offer Zone and offer prices.'
              : 'Hidden from customers: no Offers menu, no Offer Zone and regular prices only. Your offers stay saved here.'}
          </p>
        </div>
      </div>
      <Toggle checked={offersEnabled} onChange={toggle} disabled={saving} />
    </div>
  );
}

const TABS = [
  { value: '', label: 'All', key: 'all' },
  { value: 'active', label: 'Live', key: 'active' },
  { value: 'scheduled', label: 'Scheduled', key: 'scheduled' },
  { value: 'paused', label: 'Paused', key: 'paused' },
  { value: 'expired', label: 'Expired', key: 'expired' },
];

const dateRange = (offer) => {
  const start = formatDate(offer.startDate);
  if (!offer.endDate) return `From ${start} · no end date`;
  const end = formatDate(offer.endDate);
  return start === end ? `${start} (one day)` : `${start} → ${end}`;
};

function OfferAdminCard({ offer, busy, onToggle, onRepeat, onEdit, onDelete }) {
  const status = OFFER_STATUS_META[offer.status] || { label: offer.status, color: 'gray' };
  const item = offer.item && typeof offer.item === 'object' ? offer.item : null;
  const image = offer.image || (item && item.image);
  const expired = offer.status === 'Expired';

  return (
    <div className={`flex flex-col overflow-hidden rounded-2xl border bg-white shadow-card transition hover:shadow-soft ${expired ? 'border-dashed border-slate-300' : 'border-slate-100'}`}>
      <div className="relative">
        {image ? (
          <ProductImage src={image} alt={offer.title} className={`aspect-[16/9] w-full ${expired ? 'opacity-60 grayscale' : ''}`} />
        ) : (
          <div className={`flex aspect-[16/9] w-full items-center justify-center bg-gradient-to-br from-brand-400 to-brand-600 ${expired ? 'opacity-60 grayscale' : ''}`}>
            <BadgePercent className="size-12 text-on-brand/90" strokeWidth={1.5} />
          </div>
        )}
        <div className="absolute left-2 top-2 rounded-full bg-white shadow-sm">
          <Badge color={status.color} dot>
            {status.label}
          </Badge>
        </div>
        {offer.badge && (
          <span className="absolute right-2 top-2 max-w-[50%] truncate rounded-full bg-amber-400 px-2.5 py-0.5 text-xs font-extrabold uppercase text-amber-950 shadow">
            {offer.badge}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
          {offer.type === 'item' ? <Tag className="size-3.5" /> : <Megaphone className="size-3.5" />}
          {offer.type === 'item' ? 'Special price' : 'Announcement'}
        </p>
        <h3 className="mt-1 line-clamp-2 font-semibold text-slate-800">{offer.title}</h3>

        {offer.type === 'item' &&
          (item ? (
            <p className="mt-1 text-sm text-slate-600">
              {item.name}: <span className="text-slate-400 line-through">{formatCurrency(item.price)}</span>{' '}
              <span className="font-bold text-brand-800">{formatCurrency(offer.offerPrice)}</span>
              <span className="text-slate-500"> / {item.unit}</span>
              {offer.discountPercent > 0 && <span className="ml-1 font-semibold text-amber-700">({offer.discountPercent}% off)</span>}
              {!item.isAvailable && <span className="ml-1 text-xs font-medium text-red-600">· item hidden</span>}
            </p>
          ) : (
            <p className="mt-1 text-sm font-medium text-red-600">The item of this offer was deleted.</p>
          ))}

        {offer.description && <p className="mt-1 line-clamp-2 text-sm text-slate-500">{offer.description}</p>}

        <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
          <CalendarDays className="size-3.5 text-brand-600" /> {dateRange(offer)}
        </p>

        <div className="mt-auto flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
          {expired ? (
            <Button size="xs" variant="secondary" icon={RotateCcw} loading={busy === 'repeat'} onClick={onRepeat}>
              Repeat today
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Toggle size="sm" checked={offer.isActive} disabled={busy === 'toggle'} onChange={onToggle} />
              <span className="text-xs text-slate-600">{offer.isActive ? 'On website' : 'Hidden'}</span>
            </div>
          )}
          <div className="flex gap-1">
            <Button size="icon" variant="ghost" onClick={onEdit} aria-label="Edit offer" title="Edit">
              <Pencil className="size-4" />
            </Button>
            <Button size="icon" variant="ghost" className="text-red-500 hover:bg-red-50" onClick={onDelete} aria-label="Delete offer" title="Delete">
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Offers() {
  useDocumentTitle('Offers');
  const { offersEnabled } = useStore();
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState({ open: false, offer: null });
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState({}); // { [offerId]: 'toggle' | 'repeat' }
  const debouncedSearch = useDebounce(search, 350);

  const { data, loading, error, refetch } = useFetch(
    () => offersApi.list({ status, search: debouncedSearch.trim() }),
    [status, debouncedSearch]
  );
  const offers = data ? data.data : [];
  const counts = data ? data.statusCounts : null;

  const runAction = async (offer, key, action) => {
    setBusy((prev) => ({ ...prev, [offer._id]: key }));
    try {
      const res = await action();
      toast.success(res.message, { id: 'offer-action' });
      refetch({ silent: true });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy((prev) => ({ ...prev, [offer._id]: undefined }));
    }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await offersApi.remove(toDelete._id);
      toast.success('Offer deleted');
      setToDelete(null);
      refetch({ silent: true });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Offers"
        description="Post today's offers. Live offers show in the Offer Zone on the store home page."
        actions={
          <>
            {offersEnabled && (
              <Button variant="outline" icon={ExternalLink} href="/#offers" target="_blank" rel="noopener noreferrer">
                View Offer Zone
              </Button>
            )}
            <Button icon={Plus} onClick={() => setModal({ open: true, offer: null })}>
              Add offer
            </Button>
          </>
        }
      />

      <OffersSwitch />

      <div className="mb-4 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <Info className="mt-0.5 size-4 shrink-0" />
        <p>
          <strong>Special price</strong> offers change what customers pay while they are live (product list, cart and bill).
          Daily offers end automatically at midnight — use <strong>Repeat today</strong> to run one again.
        </p>
      </div>

      <SegmentedControl
        className="mb-4"
        scrollable
        value={status}
        onChange={setStatus}
        options={TABS.map((tab) => ({ value: tab.value, label: tab.label, count: counts ? counts[tab.key] : undefined }))}
      />

      <FilterBar>
        <SearchInput value={search} onChange={setSearch} placeholder="Search offers" className="lg:w-72" />
      </FilterBar>

      {error && !data && <EmptyState title="Could not load offers" message={error} action={<Button onClick={() => refetch()}>Retry</Button>} />}

      {loading && !data && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-80 rounded-2xl" />
          ))}
        </div>
      )}

      {data && offers.length === 0 && (
        <div className="rounded-2xl border border-slate-100 bg-white">
          <EmptyState
            icon={BadgePercent}
            title={status || search ? 'No offers here' : 'No offers yet'}
            message={status || search ? 'Try another tab or search.' : "Post today's first offer — it appears on the store home page right away."}
            action={
              !status &&
              !search && (
                <Button icon={Plus} onClick={() => setModal({ open: true, offer: null })}>
                  Add offer
                </Button>
              )
            }
          />
        </div>
      )}

      {offers.length > 0 && (
        <div className={`grid gap-4 sm:grid-cols-2 xl:grid-cols-3 ${loading ? 'opacity-60' : ''}`}>
          {offers.map((offer) => (
            <OfferAdminCard
              key={offer._id}
              offer={offer}
              busy={busy[offer._id]}
              onToggle={(value) => runAction(offer, 'toggle', () => offersApi.toggle(offer._id, value))}
              onRepeat={() => runAction(offer, 'repeat', () => offersApi.repeatToday(offer._id))}
              onEdit={() => setModal({ open: true, offer })}
              onDelete={() => setToDelete(offer)}
            />
          ))}
        </div>
      )}

      <OfferFormModal
        open={modal.open}
        offer={modal.offer}
        onClose={() => setModal({ open: false, offer: null })}
        onSaved={() => refetch({ silent: true })}
      />

      <ConfirmDialog
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        loading={deleting}
        title="Delete this offer?"
        message={toDelete ? `"${toDelete.title}" will be removed from the Offer Zone.` : ''}
        confirmText="Delete offer"
      />
    </div>
  );
}
