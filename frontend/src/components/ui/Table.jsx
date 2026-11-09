import { Skeleton } from './Loader';
import EmptyState from './EmptyState';

/**
 * Simple data table with loading skeleton and empty state.
 *
 *   <Table
 *     columns={[{ key: 'name', header: 'Name', render: (row) => row.name, className: 'font-medium' }]}
 *     data={rows} loading={loading} onRowClick={(row) => open(row)}
 *     empty={<EmptyState title="No orders" />}
 *   />
 */
export default function Table({
  columns,
  data = [],
  loading = false,
  rowKey = '_id',
  onRowClick,
  rowClassName,
  empty,
  skeletonRows = 6,
  minWidth = 'min-w-[720px]',
  className = '',
}) {
  const showSkeleton = loading && data.length === 0;

  return (
    <div className={`overflow-x-auto rounded-2xl border border-slate-100 bg-white ${className}`}>
      <table className={`w-full text-left text-sm ${minWidth}`}>
        <thead className="bg-brand-50/70">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={`whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-brand-800/80 ${col.headerClassName || ''}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className={`divide-y divide-slate-100 ${loading && data.length ? 'opacity-60 transition-opacity' : ''}`}>
          {showSkeleton &&
            Array.from({ length: skeletonRows }).map((_, i) => (
              // eslint-disable-next-line react/no-array-index-key
              <tr key={`skeleton-${i}`}>
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3.5">
                    <Skeleton className="h-4 w-full max-w-[140px]" />
                  </td>
                ))}
              </tr>
            ))}

          {!showSkeleton && data.length === 0 && (
            <tr>
              <td colSpan={columns.length}>{empty || <EmptyState compact title="No records found" />}</td>
            </tr>
          )}

          {!showSkeleton &&
            data.map((row) => (
              <tr
                key={row[rowKey]}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={`transition-colors hover:bg-brand-50/40 ${onRowClick ? 'cursor-pointer' : ''} ${
                  rowClassName ? rowClassName(row) || '' : ''
                }`}
              >
                {columns.map((col) => (
                  <td key={col.key} className={`px-4 py-3 align-middle ${col.className || ''}`}>
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
