import { RotateCcw } from 'lucide-react';
import type { ReactNode } from 'react';

import { SearchInput } from '@/components/common/SearchInput';
import { Button, Select, type SelectOption } from '@/components/ui';
import { useQueryParams } from '@/hooks/useQueryParams';
import { cn } from '@/lib/utils';

const NO_FILTERS: readonly FilterDefinition[] = [];

export interface FilterDefinition {
  /** URL search-param name. */
  key: string;
  label: string;
  options: SelectOption[];
  /** Text for "no filter" (value ''). */
  allLabel?: string;
}

export interface FilterBarProps {
  /** Search box bound to this URL param (omit for no search). */
  searchKey?: string;
  searchPlaceholder?: string;
  filters?: readonly FilterDefinition[];
  /** Param reset to 1 whenever search or a filter changes (pagination). */
  pageKey?: string;
  /** Extra controls on the right (e.g. an export button). */
  children?: ReactNode;
  className?: string;
}

/**
 * Search + filters + reset, stored in the URL (shareable, survives refresh, back / forward).
 * The page reads the same params with useQueryParams({ q: '', status: '', page: 1 }).
 */
export function FilterBar({
  searchKey,
  searchPlaceholder = 'Search…',
  filters = NO_FILTERS,
  pageKey = 'page',
  children,
  className,
}: FilterBarProps) {
  const defaults = Object.fromEntries([
    ...(searchKey ? [[searchKey, '']] : []),
    ...filters.map((f) => [f.key, '']),
  ]) as Record<string, string>;
  const [values, setValues] = useQueryParams(defaults);
  const isFiltered = Object.values(values).some((v) => v !== '');

  const update = (changes: Record<string, string>) => setValues({ ...changes, [pageKey]: null });

  return (
    <search
      className={cn('flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center', className)}
    >
      {searchKey && (
        <div className="w-full sm:max-w-xs">
          <SearchInput
            aria-label={searchPlaceholder.replace(/…$/, '')}
            placeholder={searchPlaceholder}
            value={values[searchKey] ?? ''}
            onSearch={(text) => update({ [searchKey]: text })}
          />
        </div>
      )}
      {filters.map((filter) => (
        <div key={filter.key} className="w-full sm:w-48">
          <Select
            aria-label={filter.label}
            value={values[filter.key] ?? ''}
            onValueChange={(value) => update({ [filter.key]: value ?? '' })}
            options={[
              { value: '', label: filter.allLabel ?? `All ${filter.label.toLowerCase()}` },
              ...filter.options,
            ]}
          />
        </div>
      ))}
      {isFiltered && (
        <Button
          variant="ghost"
          leftIcon={<RotateCcw />}
          onClick={() => update(Object.fromEntries(Object.keys(defaults).map((k) => [k, ''])))}
        >
          Reset
        </Button>
      )}
      {children && <div className="flex items-center gap-2 sm:ml-auto">{children}</div>}
    </search>
  );
}
