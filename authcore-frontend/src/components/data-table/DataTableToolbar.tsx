import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Columns3,
  Columns3Cog,
  Lock,
  RefreshCcwDot,
  RotateCcw,
  Rows2,
  Rows3,
  Rows4,
} from 'lucide-react';
import type { ReactNode } from 'react';

import { SearchInput } from '@/components/common/SearchInput';
import {
  Badge,
  Button,
  Checkbox,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  IconButton,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tooltip,
} from '@/components/ui';
import { controlVariants } from '@/components/ui/input/input.variants';
import { cn } from '@/lib/utils';

import type { DataTableColumn, DataTableFilter, TableDensity } from './types';
import type { ServerTable } from './use-server-table';
import type { TableLayoutApi } from './use-table-layout';

const DENSITY_LABEL: Record<TableDensity, string> = {
  compact: 'Compact',
  comfortable: 'Comfortable',
  spacious: 'Spacious',
};

/** One always-visible filter: a dropdown of checkable options with the active count. */
function FilterMenu<T>({ filter, table }: { filter: DataTableFilter; table: ServerTable<T> }) {
  const selected = table.query.filters[filter.id] ?? [];
  const toggle = (value: string) =>
    table.setFilter(
      filter.id,
      selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value],
    );
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Filter by ${filter.label}${selected.length ? `, ${selected.length} selected` : ''}`}
          // Same look as the other fields (Input / Select), not a colored button.
          className={cn(
            controlVariants({ size: 'toolbar' }),
            'inline-flex w-auto shrink-0 cursor-pointer items-center gap-2 text-left hover:bg-accent/50 aria-expanded:border-primary',
          )}
        >
          <span className={selected.length > 0 ? 'text-foreground' : 'text-muted-foreground'}>
            {filter.label}
          </span>
          {selected.length > 0 && (
            <Badge size="sm" tone="primary" variant="solid">
              {selected.length}
            </Badge>
          )}
          <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-52">
        <DropdownMenuLabel>{filter.label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {filter.options.map((option) => (
          <DropdownMenuCheckboxItem
            key={option.value}
            checked={selected.includes(option.value)}
            onCheckedChange={() => toggle(option.value)}
          >
            {option.label}
          </DropdownMenuCheckboxItem>
        ))}
        {selected.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => table.setFilter(filter.id, [])}>
              Clear {filter.label.toLowerCase()} filter
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Density + column visibility / order + reset (remembered per user). */
const DENSITY_ICON: Record<TableDensity, typeof Rows4> = {
  compact: Rows4,
  comfortable: Rows3,
  spacious: Rows2,
};

/** Reload the current page of rows (same search, filters, sort and page). */
function RefreshButton({ isBusy, onClick }: { isBusy: boolean; onClick: () => void }) {
  return (
    <Tooltip content={isBusy ? 'Refreshing…' : 'Refresh'}>
      <IconButton
        aria-label="Refresh the table"
        aria-busy={isBusy || undefined}
        icon={
          <RefreshCcwDot
            className={cn(isBusy && 'animate-spin [animation-direction:reverse]')}
            aria-hidden="true"
          />
        }
        variant="ghost"
        size="sm"
        onClick={() => !isBusy && onClick()}
        // Field look like the search and filters, the icon in the success color.
        className="size-control-toolbar! border border-field bg-surface text-success hover:border-success hover:bg-success-soft aria-busy:cursor-progress"
      />
    </Tooltip>
  );
}

/** "Table view": density and columns (order + visibility), remembered per user and table. */
function ViewOptions<T>({
  columns,
  layout,
}: {
  columns: DataTableColumn<T>[];
  layout: TableLayoutApi<T>;
}) {
  const { order, hidden, density } = layout.layout;
  const shownCount = order.filter((id) => !hidden.includes(id)).length;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <IconButton
          aria-label="Table view: density and columns"
          icon={<Columns3Cog />}
          variant="ghost"
          size="sm"
          // Field look, same height as the search and filters; the icon in the theme color.
          className="size-control-toolbar! border border-field bg-surface text-primary hover:bg-primary-soft aria-expanded:border-primary aria-expanded:bg-primary-soft"
        />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 overflow-hidden p-0">
        <header className="flex items-center gap-3 border-b border-border bg-primary-soft px-4 py-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Columns3Cog className="size-4.5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-primary-soft-foreground">Table view</p>
            <p className="text-xs text-muted-foreground">Saved for you on this table</p>
          </div>
        </header>

        <div className="space-y-4 p-4">
          <fieldset>
            <legend className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <Rows3 className="size-3.5 text-muted-foreground" aria-hidden="true" />
              Row spacing
            </legend>
            <div className="grid grid-cols-3 gap-1 rounded-md border border-border bg-muted/60 p-1">
              {(Object.keys(DENSITY_LABEL) as TableDensity[]).map((d) => {
                const Icon = DENSITY_ICON[d];
                return (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={density === d}
                    onClick={() => layout.setDensity(d)}
                    className={cn(
                      'flex h-14 cursor-pointer flex-col items-center justify-center gap-1 rounded-md text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring',
                      density === d
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-surface hover:text-foreground',
                    )}
                  >
                    <Icon className="size-4" aria-hidden="true" />
                    {DENSITY_LABEL[d]}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 flex w-full items-center gap-1.5 text-xs font-semibold text-foreground">
              <Columns3 className="size-3.5 text-muted-foreground" aria-hidden="true" />
              Columns
              <span className="ml-auto font-normal text-muted-foreground">
                {shownCount} of {order.length} shown
              </span>
            </legend>
            <ul className="max-h-64 space-y-0.5 overflow-y-auto rounded-md border border-border p-1">
              {order.map((id, index) => {
                const column = columns.find((c) => c.id === id);
                if (!column) return null;
                const locked = index === 0 || column.hideable === false;
                return (
                  <li
                    key={id}
                    className="flex items-center gap-1 rounded-md px-2 py-1 transition-colors hover:bg-accent/60"
                  >
                    <Checkbox
                      label={column.header}
                      checked={!hidden.includes(id)}
                      disabled={locked}
                      onCheckedChange={() => layout.toggleColumn(id)}
                    />
                    <span className="flex-1" />
                    {locked ? (
                      <Lock className="size-3.5 text-muted-foreground" aria-label="Always shown" />
                    ) : (
                      <>
                        <IconButton
                          aria-label={`Move ${column.header} up`}
                          icon={<ArrowUp />}
                          size="sm"
                          variant="ghost"
                          disabled={index === 1}
                          onClick={() => layout.moveColumn(id, -1)}
                        />
                        <IconButton
                          aria-label={`Move ${column.header} down`}
                          icon={<ArrowDown />}
                          size="sm"
                          variant="ghost"
                          disabled={index === order.length - 1}
                          onClick={() => layout.moveColumn(id, 1)}
                        />
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          </fieldset>
        </div>

        <footer className="flex items-center justify-between gap-2 border-t border-border bg-muted/50 px-4 py-2.5">
          <p className="text-xs text-muted-foreground">Drag a header edge to resize</p>
          <Button variant="outline" size="sm" leftIcon={<RotateCcw />} onClick={layout.reset}>
            Reset
          </Button>
        </footer>
      </PopoverContent>
    </Popover>
  );
}

export function DataTableToolbar<T>({
  table,
  columns,
  layout,
  viewOptions = true,
  onRefresh,
  searchPlaceholder,
  actions,
}: {
  table: ServerTable<T>;
  columns: DataTableColumn<T>[];
  layout: TableLayoutApi<T>;
  /** Show the "Table view" button. */
  viewOptions?: boolean;
  /** Also reload page extras (e.g. count cards) when Refresh is pressed. */
  onRefresh?: () => void;
  searchPlaceholder: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="w-full sm:w-96 lg:w-[28rem]">
        <SearchInput
          size="toolbar"
          value={table.query.search}
          onSearch={table.setSearch}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
        />
      </div>
      {table.filters.map((filter) => (
        <FilterMenu key={filter.id} filter={filter} table={table} />
      ))}
      <div className="ml-auto flex items-center gap-2">
        {viewOptions && <ViewOptions columns={columns} layout={layout} />}
        {actions}
        <RefreshButton
          isBusy={table.isFetching}
          onClick={() => {
            table.refresh();
            onRefresh?.();
          }}
        />
      </div>
    </div>
  );
}
