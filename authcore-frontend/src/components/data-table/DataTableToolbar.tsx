import { ArrowDown, ArrowUp, ChevronDown, RotateCcw, SlidersHorizontal } from 'lucide-react';
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
} from '@/components/ui';
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
        <Button
          variant="outline"
          size="md"
          rightIcon={<ChevronDown />}
          aria-label={`Filter by ${filter.label}${selected.length ? `, ${selected.length} selected` : ''}`}
          className={cn(selected.length > 0 && 'border-primary')}
        >
          {filter.label}
          {selected.length > 0 && (
            <Badge size="sm" tone="primary" variant="solid">
              {selected.length}
            </Badge>
          )}
        </Button>
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
function ViewOptions<T>({
  columns,
  layout,
}: {
  columns: DataTableColumn<T>[];
  layout: TableLayoutApi<T>;
}) {
  const { order, hidden, density } = layout.layout;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <IconButton
          aria-label="Table view options"
          icon={<SlidersHorizontal />}
          variant="outline"
        />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-4 p-4">
        <fieldset>
          <legend className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Density
          </legend>
          <div className="grid grid-cols-3 gap-1 rounded-md bg-muted p-1">
            {(Object.keys(DENSITY_LABEL) as TableDensity[]).map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={density === d}
                onClick={() => layout.setDensity(d)}
                className={cn(
                  'h-8 cursor-pointer rounded-md text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring',
                  density === d
                    ? 'bg-surface text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {DENSITY_LABEL[d]}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Columns
          </legend>
          <ul className="space-y-1">
            {order.map((id, index) => {
              const column = columns.find((c) => c.id === id);
              if (!column) return null;
              const locked = index === 0 || column.hideable === false;
              return (
                <li key={id} className="flex items-center gap-1">
                  <Checkbox
                    label={column.header}
                    checked={!hidden.includes(id)}
                    disabled={locked}
                    onCheckedChange={() => layout.toggleColumn(id)}
                  />
                  <span className="flex-1" />
                  {index > 0 && (
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
        <Button variant="ghost" size="sm" leftIcon={<RotateCcw />} onClick={layout.reset}>
          Reset layout
        </Button>
      </PopoverContent>
    </Popover>
  );
}

export function DataTableToolbar<T>({
  table,
  columns,
  layout,
  searchPlaceholder,
  actions,
}: {
  table: ServerTable<T>;
  columns: DataTableColumn<T>[];
  layout: TableLayoutApi<T>;
  searchPlaceholder: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="w-full sm:w-72">
        <SearchInput
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
        <ViewOptions columns={columns} layout={layout} />
        {actions}
      </div>
    </div>
  );
}
