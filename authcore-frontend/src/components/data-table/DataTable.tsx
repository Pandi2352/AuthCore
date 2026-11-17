import { SearchX } from 'lucide-react';
import type { ReactNode } from 'react';

import { EmptyState, ErrorState } from '@/components/feedback';
import { Button, Pagination } from '@/components/ui';
import { useBreakpoint } from '@/hooks/useMediaQuery';

import { DataTableBulkBar } from './DataTableBulkBar';
import { DataTableCards } from './DataTableCards';
import { DataTableFilterChips } from './DataTableFilterChips';
import { DataTableGrid } from './DataTableGrid';
import { DataTableToolbar } from './DataTableToolbar';
import type { BulkAction, DataTableColumn } from './types';
import { PAGE_SIZE_OPTIONS, type ServerTable } from './use-server-table';
import { useTableLayout } from './use-table-layout';

const NO_ACTIONS: readonly BulkAction[] = [];

export interface DataTableProps<T> {
  /** From useServerTable (URL state, server paging / sort / filters, selection). */
  table: ServerTable<T>;
  /** Keep the array stable (module constant or useMemo). */
  columns: DataTableColumn<T>[];
  /** Persisted layout key — include the user id: `users-list:${user.id}`. */
  layoutKey: string;
  /** "user" / "users": captions, empty states, announcements, select-all scope. */
  itemName: { singular: string; plural: string };
  /** Accessible name of a row (checkbox label): usually the name. */
  rowLabel: (row: T) => string;
  /** Always-visible actions (e.g. a ⋯ menu) — never hover-only. */
  rowActions?: (row: T) => ReactNode;
  /** Row click / Enter / card title. */
  onRowOpen?: (row: T) => void;
  bulkActions?: readonly BulkAction[];
  /** Toolbar end (e.g. "Invite user"). */
  toolbarActions?: ReactNode;
  searchPlaceholder?: string;
  /** First run (no data at all): copy and the next action. */
  emptyState: { title: string; description?: ReactNode; action?: ReactNode; icon?: ReactNode };
}

/**
 * Reusable server-side data table: search, visible filters with chips, multi-sort,
 * pagination with totals, explicit selection scope + bulk actions, density and column
 * layout remembered per user, sticky header / first column, mobile cards, skeleton /
 * empty / error states, live-region announcements. See docs/frontend/data-table.md.
 */
export function DataTable<T>({
  table,
  columns,
  layoutKey,
  itemName,
  rowLabel,
  rowActions,
  onRowOpen,
  bulkActions = NO_ACTIONS,
  toolbarActions,
  searchPlaceholder = `Search ${itemName.plural}…`,
  emptyState,
}: DataTableProps<T>) {
  const isDesktop = useBreakpoint('md');
  const layout = useTableLayout(layoutKey, columns);

  const empty = table.hasActiveQuery ? (
    <EmptyState
      size="compact"
      icon={<SearchX />}
      title={`No ${itemName.plural} match your filters`}
      description="Try a different search, or clear the filters to see everything."
      action={
        <Button variant="outline" size="sm" onClick={table.clearFilters}>
          Clear filters
        </Button>
      }
    />
  ) : (
    <EmptyState
      size="compact"
      icon={emptyState.icon}
      title={emptyState.title}
      description={emptyState.description}
      action={emptyState.action}
    />
  );

  return (
    <section aria-label={`${itemName.plural} table`} className="space-y-3">
      <DataTableToolbar
        table={table}
        columns={columns}
        layout={layout}
        searchPlaceholder={searchPlaceholder}
        actions={toolbarActions}
      />
      <DataTableFilterChips table={table} />
      {bulkActions.length > 0 && (
        <DataTableBulkBar table={table} actions={bulkActions} itemsLabel={itemName.plural} />
      )}

      {table.error ? (
        // Never a half-rendered grid: a clear failure with retry.
        <div className="rounded-md border border-border bg-surface">
          <ErrorState
            error={table.error}
            title={`Couldn't load ${itemName.plural}`}
            onRetry={table.retry}
          />
        </div>
      ) : isDesktop ? (
        <DataTableGrid
          table={table}
          columns={layout.visibleColumns}
          layout={layout}
          rowLabel={rowLabel}
          rowActions={rowActions}
          onRowOpen={onRowOpen}
          empty={empty}
          caption={`${itemName.plural}, ${table.total} total, page ${table.query.page} of ${table.pageCount}`}
        />
      ) : (
        <DataTableCards
          table={table}
          columns={layout.visibleColumns}
          rowLabel={rowLabel}
          rowActions={rowActions}
          onRowOpen={onRowOpen}
          empty={empty}
        />
      )}

      {!table.error && table.hasLoaded && table.total > 0 && (
        <Pagination
          page={table.query.page}
          total={table.total}
          pageSize={table.query.pageSize}
          onPageChange={table.setPage}
          onPageSizeChange={table.setPageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
        />
      )}

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {table.announcement}
      </p>
    </section>
  );
}
