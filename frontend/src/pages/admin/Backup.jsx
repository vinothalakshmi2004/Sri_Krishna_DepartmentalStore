/**
 * Database backup: download the whole database (.json) or its structure
 * (.csv for Excel) in one click, and see what is inside.
 */
import { useState } from 'react';
import toast from 'react-hot-toast';
import { DatabaseBackup, Download, FileSpreadsheet, FolderOpen, Info, RefreshCw, ShieldCheck, Terminal } from 'lucide-react';
import { backupApi } from '../../api/adminApi';
import { getErrorMessage } from '../../api/client';
import useFetch from '../../hooks/useFetch';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { formatNumber } from '../../utils/format';
import PageHeader from '../../components/admin/PageHeader';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import { Skeleton } from '../../components/ui/Loader';

// Friendly names for the collections
const COLLECTION_LABELS = {
  admins: 'Admin logins',
  counters: 'Order number counter',
  expenses: 'Expenses',
  incomes: 'Income',
  items: 'Items (products)',
  offers: 'Offers',
  orders: 'Orders',
  settings: 'Store settings',
};

function DownloadCard({ icon: Icon, tone, title, description, points, buttonLabel, onDownload, loading }) {
  return (
    <div className="flex min-w-0 flex-col rounded-2xl border border-slate-100 bg-white p-5 shadow-card">
      <div className="flex items-start gap-3">
        <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${tone}`}>
          <Icon className="size-5" />
        </span>
        <div>
          <h3 className="text-base font-semibold">{title}</h3>
          <p className="mt-0.5 text-sm text-slate-500">{description}</p>
        </div>
      </div>
      <ul className="mt-4 flex-1 space-y-1.5 text-sm text-slate-600">
        {points.map((point) => (
          <li key={point} className="flex gap-2">
            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-brand-400" />
            {point}
          </li>
        ))}
      </ul>
      <Button icon={Download} size="lg" fullWidth className="mt-5" loading={loading} onClick={onDownload}>
        <span className="whitespace-normal text-center">{buttonLabel}</span>
      </Button>
    </div>
  );
}

export default function Backup() {
  useDocumentTitle('Database backup');
  const { data: summary, loading, error, refetch } = useFetch(() => backupApi.summary(), []);
  const [busy, setBusy] = useState('');

  const download = async (key, action) => {
    setBusy(key);
    try {
      const fileName = await action();
      toast.success(`Downloaded ${fileName}`);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Download failed. Please try again.'));
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="space-y-6 pb-4">
      <PageHeader
        title="Database backup"
        description="Download a copy of all your store data. Keep it safe on your computer, pen drive or Google Drive."
      />

      <div className="grid gap-4 md:grid-cols-2">
        <DownloadCard
          icon={DatabaseBackup}
          tone="bg-brand-50 text-brand-600"
          title="Full backup"
          description="Every order, item, offer, income, expense and setting in one file."
          points={[
            'One .json file - keeps IDs and dates exactly, so it can be restored',
            'Includes the database structure as well',
            'Admin passwords are never included',
          ]}
          buttonLabel="Download full backup"
          loading={busy === 'data'}
          onDownload={() => download('data', backupApi.downloadData)}
        />
        <DownloadCard
          icon={FileSpreadsheet}
          tone="bg-sky-50 text-sky-600"
          title="Database structure"
          description="All collections and their fields, ready to open in Excel."
          points={[
            'One row per field: type, required, default and allowed values',
            'Shows which fields are unique or indexed',
            'Handy for developers or when moving to a new server',
          ]}
          buttonLabel="Download structure (Excel)"
          loading={busy === 'structure'}
          onDownload={() => download('structure', backupApi.downloadStructure)}
        />
      </div>

      <Card
        title="What is in your database"
        description={summary ? `Database "${summary.database}" · ${formatNumber(summary.totalDocuments)} records` : 'Collections and record counts'}
        icon={Info}
        actions={
          <Button size="sm" variant="ghost" icon={RefreshCw} onClick={() => refetch()} disabled={loading}>
            Refresh
          </Button>
        }
        bodyClassName="p-4 sm:p-5"
      >
        {loading && !summary && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        )}
        {error && !summary && <EmptyState title="Could not load the summary" message={error} action={<Button onClick={() => refetch()}>Try again</Button>} />}
        {summary && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {summary.collections.map((collection) => (
              <div key={collection.name} className="rounded-xl bg-brand-50/60 p-3">
                <p className="truncate text-xs text-slate-500" title={collection.name}>
                  {COLLECTION_LABELS[collection.name] || collection.name}
                </p>
                <p className="mt-0.5 text-lg font-bold text-brand-800">{formatNumber(collection.count)}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Good to know" icon={ShieldCheck} bodyClassName="space-y-3 p-4 text-sm text-slate-600 sm:p-5">
        <p className="flex gap-2.5">
          <FolderOpen className="mt-0.5 size-4 shrink-0 text-brand-600" />
          <span>
            Product photos, the logo and gallery pictures are stored as files in the <strong>backend/uploads</strong> folder, not in the
            database. Copy that folder too for a complete backup.
          </span>
        </p>
        <p className="flex gap-2.5">
          <Terminal className="mt-0.5 size-4 shrink-0 text-brand-600" />
          <span>
            To restore a backup, run this in the <strong>backend</strong> folder:{' '}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-800">npm run restore -- &quot;path\to\backup.json&quot;</code>.
            Collections that already have data are skipped; add <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-800">--replace</code> to
            overwrite them.
          </span>
        </p>
        <p className="flex gap-2.5">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand-600" />
          <span>The backup has customer names, phone numbers and addresses - share it only with people you trust.</span>
        </p>
      </Card>
    </div>
  );
}
