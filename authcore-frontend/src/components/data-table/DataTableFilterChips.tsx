import { X } from 'lucide-react';

import { Button } from '@/components/ui';

import type { ServerTable } from './use-server-table';

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-surface pr-1 pl-2.5 text-sm text-foreground">
      {label}
      <button
        type="button"
        aria-label={`Remove filter ${label}`}
        onClick={onRemove}
        className="touch-target inline-flex size-6 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-ring"
      >
        <X className="size-3.5" aria-hidden="true" />
      </button>
    </span>
  );
}

/** Active search + filters as removable chips, with the active count and "Clear all". */
export function DataTableFilterChips<T>({ table }: { table: ServerTable<T> }) {
  const { search, filters } = table.query;
  const chips = [
    ...(search
      ? [{ key: 'q', label: `Search: “${search}”`, remove: () => table.setSearch('') }]
      : []),
    ...table.filters
      .filter((f) => filters[f.id]?.length)
      .map((f) => {
        const values = filters[f.id] ?? [];
        const labels = values.map((v) => f.options.find((o) => o.value === v)?.label ?? v);
        return {
          key: f.id,
          label: `${f.label}: ${labels.join(', ')}`,
          remove: () => table.setFilter(f.id, []),
        };
      }),
  ];
  if (chips.length === 0) return null;
  return (
    <section className="flex flex-wrap items-center gap-2" aria-label="Active filters">
      <span className="text-sm text-muted-foreground">
        {chips.length} active {chips.length === 1 ? 'filter' : 'filters'}
      </span>
      {chips.map((chip) => (
        <Chip key={chip.key} label={chip.label} onRemove={chip.remove} />
      ))}
      <Button variant="link" size="sm" onClick={table.clearFilters}>
        Clear all
      </Button>
    </section>
  );
}
