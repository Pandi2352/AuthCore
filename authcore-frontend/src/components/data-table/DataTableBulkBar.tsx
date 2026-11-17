import { X } from 'lucide-react';
import { useState } from 'react';

import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Button } from '@/components/ui';

import type { BulkAction } from './types';
import type { ServerTable } from './use-server-table';

/**
 * Contextual toolbar while rows are selected: count, explicit select-all scope, actions
 * (destructive ones need confirmation), clear.
 */
export function DataTableBulkBar<T>({
  table,
  actions,
  itemsLabel,
}: {
  table: ServerTable<T>;
  actions: readonly BulkAction[];
  itemsLabel: string;
}) {
  const [pending, setPending] = useState<BulkAction | null>(null);
  const { selectedCount, total, selection, selectedOnPage, pageRowCount } = table;
  if (selectedCount === 0) return null;

  const wholePageSelected = pageRowCount > 0 && selectedOnPage === pageRowCount;
  const run = async (action: BulkAction) => {
    await action.run(table.bulkTarget());
    table.clearSelection();
  };

  return (
    <section
      aria-label="Bulk actions"
      className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-primary/30 bg-primary-soft px-3 py-2 text-sm text-primary-soft-foreground"
    >
      <span className="font-semibold">
        {selectedCount} {selectedCount === 1 ? 'selected' : 'selected'}
      </span>
      {/* Select-all scope is always explicit. */}
      {selection.mode === 'ids' && wholePageSelected && total > pageRowCount && (
        <span>
          All {pageRowCount} on this page are selected.{' '}
          <Button variant="link" size="sm" onClick={table.selectAllMatching}>
            Select all {total} {itemsLabel}
          </Button>
        </span>
      )}
      {selection.mode === 'all' && (
        <span>
          All {total} matching {itemsLabel} are selected (across every page).
        </span>
      )}
      <div className="ml-auto flex flex-wrap items-center gap-2">
        {actions.map((action) => (
          <Button
            key={action.id}
            size="sm"
            variant={action.destructive ? 'destructive' : 'outline'}
            leftIcon={action.icon}
            onClick={() =>
              action.destructive || action.confirm ? setPending(action) : void run(action)
            }
          >
            {action.label}
          </Button>
        ))}
        <Button size="sm" variant="ghost" leftIcon={<X />} onClick={table.clearSelection}>
          Clear selection
        </Button>
      </div>
      {pending && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setPending(null)}
          title={pending.confirm?.title ?? `${pending.label} ${selectedCount} ${itemsLabel}?`}
          description={
            pending.confirm?.description ??
            (pending.destructive ? 'This cannot be undone.' : undefined)
          }
          confirmText={pending.confirm?.confirmText ?? pending.label}
          destructive={pending.destructive}
          onConfirm={async () => {
            await run(pending);
            setPending(null);
          }}
        />
      )}
    </section>
  );
}
