import { useCallback, useEffect, useMemo, useState } from 'react';

import { isAbortError } from '@/lib/api';

import type {
  BulkTarget,
  DataTableFilter,
  SortRule,
  TablePage,
  TableQuery,
  TableSelection,
} from './types';

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const encodeSort = (rules: SortRule[]): string =>
  rules.map((r) => `${r.id}.${r.desc ? 'desc' : 'asc'}`).join(',');
const decodeSort = (raw: string): SortRule[] =>
  raw
    .split(',')
    .map((part) => part.split('.'))
    .filter(([id, dir]) => id && (dir === 'asc' || dir === 'desc'))
    .map(([id, dir]) => ({ id: id as string, desc: dir === 'desc' }));
const splitList = (raw: string): string[] => (raw ? raw.split(',').filter(Boolean) : []);

const EMPTY_IDS: ReadonlySet<string> = new Set();
const NO_SELECTION: TableSelection = { mode: 'ids', ids: EMPTY_IDS };

export interface UseServerTableOptions<T> {
  /** Loads one page (server-side search, filters, sort and paging). Keep it stable. */
  fetchPage: (query: TableQuery, signal: AbortSignal) => Promise<TablePage<T>>;
  getRowId: (row: T) => string;
  filters?: readonly DataTableFilter[];
  defaultSort?: SortRule[];
  defaultPageSize?: number;
  /** Plural noun for announcements ("users"). */
  itemsLabel?: string;
}

/**
 * State + data for a server-paged table. Page, page size, search, sort and filters are local
 * state, not the URL: changing them only refetches and redraws the table (no navigation,
 * no route re-render). Paging, sorting and filtering happen on the
 * server — the client never sorts one page of a paginated result. Previous rows stay
 * visible (dimmed) while the next page loads, so the layout never jumps.
 */
export function useServerTable<T>({
  fetchPage,
  getRowId,
  filters = [],
  defaultSort = [],
  defaultPageSize = 25,
  itemsLabel = 'rows',
}: UseServerTableOptions<T>) {
  type Params = Record<string, string | number>;
  const [params, setParamsState] = useState<Params>(() => ({
    page: 1,
    size: defaultPageSize,
    q: '',
    sort: encodeSort(defaultSort),
    ...Object.fromEntries(filters.map((f) => [f.id, ''])),
  }));
  const setParams = useCallback(
    (patch: Params) => setParamsState((current) => ({ ...current, ...patch })),
    [],
  );

  const pageSize = PAGE_SIZE_OPTIONS.includes(Number(params.size))
    ? Number(params.size)
    : defaultPageSize;
  const filterValues = Object.fromEntries(
    filters
      .map((f) => [f.id, splitList(String(params[f.id] ?? ''))] as const)
      .filter(([, values]) => values.length > 0),
  );
  const query: TableQuery = {
    page: Math.max(1, Number(params.page) || 1),
    pageSize,
    search: String(params.q ?? ''),
    sort: decodeSort(String(params.sort ?? '')),
    filters: filterValues,
  };
  const queryKey = JSON.stringify(query);

  // ---- data
  const [nonce, setNonce] = useState(0);
  const requestKey = `${queryKey}#${nonce}`;
  const [result, setResult] = useState<{ key: string; page: TablePage<T> } | null>(null);
  const [failure, setFailure] = useState<{ key: string; error: unknown } | null>(null);
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    const current = JSON.parse(queryKey) as TableQuery;
    const load = async () => {
      try {
        const page = await fetchPage(current, controller.signal);
        setResult({ key: requestKey, page });
        const from = page.total === 0 ? 0 : (current.page - 1) * current.pageSize + 1;
        const to = Math.min(current.page * current.pageSize, page.total);
        setAnnouncement(
          page.total === 0
            ? `No ${itemsLabel} found`
            : `Showing ${from} to ${to} of ${page.total} ${itemsLabel}`,
        );
      } catch (error) {
        if (!isAbortError(error)) setFailure({ key: requestKey, error });
      }
    };
    void load();
    return () => controller.abort();
  }, [requestKey, queryKey, fetchPage, itemsLabel]);

  const isFetching = result?.key !== requestKey && failure?.key !== requestKey;
  const error = failure?.key === requestKey ? failure.error : null;
  const page = result?.page ?? null;
  const total = page?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  // A page past the end (rows deleted) → go to the last page.
  useEffect(() => {
    if (page && !isFetching && query.page > pageCount) {
      setParams({ page: pageCount });
    }
    // oxlint-disable-next-line react/exhaustive-deps
  }, [page, isFetching, query.page, pageCount]);

  // ---- selection: kept across pages and sorting; cleared when search / filters change
  // (the "all matching" scope would silently mean something else).
  const scopeKey = JSON.stringify([query.search, query.filters]);
  const [selection, setSelection] = useState<TableSelection>(NO_SELECTION);
  const [selectionScope, setSelectionScope] = useState(scopeKey);
  if (selectionScope !== scopeKey) {
    setSelectionScope(scopeKey);
    setSelection(NO_SELECTION);
  }

  const rows = useMemo(() => page?.items ?? [], [page]);
  const pageIds = useMemo(() => rows.map(getRowId), [rows, getRowId]);
  const isSelected = (id: string) =>
    selection.mode === 'ids' ? selection.ids.has(id) : !selection.excluded.has(id);
  const selectedCount =
    selection.mode === 'ids' ? selection.ids.size : Math.max(0, total - selection.excluded.size);
  const selectedOnPage = pageIds.filter(isSelected).length;

  const announceSelection = (count: number) =>
    setAnnouncement(count === 0 ? 'Selection cleared' : `${count} selected`);

  // Event handlers only: computed from the current selection (no side effects in updaters).
  const applySelection = (next: TableSelection) => {
    setSelection(next);
    announceSelection(
      next.mode === 'ids' ? next.ids.size : Math.max(0, total - next.excluded.size),
    );
  };

  const toggleRow = (id: string) => {
    if (selection.mode === 'ids') {
      const ids = new Set(selection.ids);
      if (ids.has(id)) ids.delete(id);
      else ids.add(id);
      applySelection({ mode: 'ids', ids });
    } else {
      const excluded = new Set(selection.excluded);
      if (excluded.has(id)) excluded.delete(id);
      else excluded.add(id);
      applySelection({ mode: 'all', excluded });
    }
  };

  const setPageSelected = (on: boolean) => {
    if (selection.mode === 'ids') {
      const ids = new Set(selection.ids);
      for (const id of pageIds) {
        if (on) ids.add(id);
        else ids.delete(id);
      }
      applySelection({ mode: 'ids', ids });
    } else {
      const excluded = new Set(selection.excluded);
      for (const id of pageIds) {
        if (on) excluded.delete(id);
        else excluded.add(id);
      }
      applySelection({ mode: 'all', excluded });
    }
  };

  const selectAllMatching = () => {
    setSelection({ mode: 'all', excluded: EMPTY_IDS });
    setAnnouncement(`All ${total} ${itemsLabel} selected`);
  };
  const clearSelection = () => {
    setSelection(NO_SELECTION);
    announceSelection(0);
  };

  const bulkTarget = (): BulkTarget =>
    selection.mode === 'ids'
      ? { mode: 'ids', ids: [...selection.ids] }
      : {
          mode: 'all',
          excludedIds: [...selection.excluded],
          query,
          count: selectedCount,
        };

  // ---- query setters
  const setPage = (next: number) => setParams({ page: next });
  const setPageSize = (next: number) => setParams({ size: next, page: 1 });
  const setSearch = (next: string) => setParams({ q: next.trim(), page: 1 });
  const setFilter = (id: string, values: string[]) =>
    setParams({ [id]: values.join(','), page: 1 });
  const clearFilters = () =>
    setParams({
      q: '',
      page: 1,
      ...Object.fromEntries(filters.map((f) => [f.id, ''])),
    });

  /** Click: asc → desc → off (single sort). Shift+click: add / cycle a secondary sort. */
  const toggleSort = (id: string, additive: boolean) => {
    const current = query.sort;
    const existing = current.find((r) => r.id === id);
    let next: SortRule[];
    if (!additive) {
      next = !existing ? [{ id, desc: false }] : !existing.desc ? [{ id, desc: true }] : [];
    } else if (!existing) {
      next = [...current, { id, desc: false }];
    } else if (!existing.desc) {
      next = current.map((r) => (r.id === id ? { ...r, desc: true } : r));
    } else {
      next = current.filter((r) => r.id !== id);
    }
    setParams({ sort: encodeSort(next) || encodeSort(defaultSort), page: 1 });
    const primary = next[0];
    setAnnouncement(
      primary
        ? `Sorted by ${next.map((r) => `${r.id} ${r.desc ? 'descending' : 'ascending'}`).join(', then ')}`
        : 'Sorting removed',
    );
  };
  const setSort = (rules: SortRule[]) => setParams({ sort: encodeSort(rules), page: 1 });

  const retry = useCallback(() => setNonce((n) => n + 1), []);

  return {
    query,
    rows,
    total,
    pageCount,
    hasLoaded: page !== null,
    isFetching,
    error,
    retry,
    refresh: retry,
    announcement,
    filters,
    hasActiveQuery: query.search !== '' || Object.keys(query.filters).length > 0,
    // query
    setPage,
    setPageSize,
    setSearch,
    setFilter,
    clearFilters,
    toggleSort,
    setSort,
    // selection
    getRowId,
    selection,
    isSelected,
    selectedCount,
    selectedOnPage,
    pageRowCount: pageIds.length,
    toggleRow,
    setPageSelected,
    selectAllMatching,
    clearSelection,
    bulkTarget,
  };
}

export type ServerTable<T> = ReturnType<typeof useServerTable<T>>;
