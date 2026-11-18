import { useId, type ReactNode } from 'react';

import { Checkbox, Select, Skeleton } from '@/components/ui';
import { cn } from '@/lib/utils';

import type { DataTableColumn } from './types';
import type { ServerTable } from './use-server-table';

/**
 * Small screens: every row is a card (title, subtitle, label / value fields, actions) — not
 * a shrunken grid. Sorting moves into a "Sort by" picker (there is no header row).
 */
export function DataTableCards<T>({
  table,
  columns,
  rowLabel,
  rowActions,
  onRowOpen,
  empty,
}: {
  table: ServerTable<T>;
  columns: DataTableColumn<T>[];
  rowLabel: (row: T) => string;
  rowActions?: (row: T) => ReactNode;
  onRowOpen?: (row: T) => void;
  empty: ReactNode;
}) {
  const baseId = useId();
  const title = columns.find((c) => c.mobile === 'title') ?? columns[0];
  const subtitle = columns.find((c) => c.mobile === 'subtitle');
  const fields = columns.filter((c) => c !== title && c !== subtitle && c.mobile !== 'hidden');
  const sortOptions = columns.flatMap((c) =>
    !c.sortable
      ? []
      : [
          { value: `${c.id}.asc`, label: `${c.header} (ascending)` },
          { value: `${c.id}.desc`, label: `${c.header} (descending)` },
        ],
  );
  const primarySort = table.query.sort[0];

  return (
    <div className="space-y-3">
      {sortOptions.length > 0 && (
        <Select
          aria-label="Sort by"
          size="sm"
          placeholder="Sort by"
          value={primarySort ? `${primarySort.id}.${primarySort.desc ? 'desc' : 'asc'}` : null}
          onValueChange={(value) => {
            if (!value) return;
            const [id, dir] = value.split('.');
            table.setSort([{ id: id as string, desc: dir === 'desc' }]);
          }}
          options={sortOptions}
        />
      )}

      {!table.hasLoaded && (
        <ul className="space-y-2" aria-hidden="true">
          {Array.from({ length: 4 }, (_, i) => (
            <li key={i} className="space-y-2 rounded-md border border-border bg-surface p-4">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </li>
          ))}
        </ul>
      )}
      {table.hasLoaded && table.rows.length === 0 && (
        <div className="rounded-md border border-border bg-surface">{empty}</div>
      )}
      {table.rows.length > 0 && (
        <ul
          aria-label="Results"
          aria-busy={table.isFetching || undefined}
          className={cn('space-y-2 transition-opacity', table.isFetching && 'opacity-60')}
        >
          {table.rows.map((row) => {
            const id = table.getRowId(row);
            const selected = table.isSelected(id);
            return (
              <li
                key={id}
                className={cn(
                  'relative rounded-md border bg-surface p-3',
                  selected ? 'border-primary bg-primary-soft' : 'border-border',
                )}
              >
                <div className="flex items-start gap-2">
                  <label
                    htmlFor={`${baseId}-${id}`}
                    className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center"
                  >
                    <Checkbox
                      id={`${baseId}-${id}`}
                      aria-label={`Select ${rowLabel(row)}`}
                      checked={selected}
                      onCheckedChange={() => table.toggleRow(id)}
                    />
                  </label>
                  <div className="min-w-0 flex-1 py-2">
                    {onRowOpen ? (
                      <button
                        type="button"
                        onClick={() => onRowOpen(row)}
                        className="block max-w-full cursor-pointer truncate text-left text-sm font-semibold text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                      >
                        {title?.cell(row)}
                      </button>
                    ) : (
                      <div className="truncate text-sm font-semibold text-foreground">
                        {title?.cell(row)}
                      </div>
                    )}
                    {subtitle && (
                      <div className="mt-0.5 truncate text-sm text-muted-foreground">
                        {subtitle.cell(row)}
                      </div>
                    )}
                  </div>
                  {rowActions && <div className="shrink-0 py-1">{rowActions(row)}</div>}
                </div>
                {fields.length > 0 && (
                  <dl className="mt-1 grid grid-cols-2 gap-x-4 gap-y-2 pl-13 text-sm">
                    {fields.map((c) => (
                      <div key={c.id} className="min-w-0">
                        <dt className="text-xs text-muted-foreground">{c.header}</dt>
                        <dd className={cn('truncate text-foreground', c.numeric && 'tabular-nums')}>
                          {c.cell(row)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
