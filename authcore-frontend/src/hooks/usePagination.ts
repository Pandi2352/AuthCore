import { useCallback, useMemo, useState } from 'react';

import { useQueryParams } from './useQueryParams';

export interface Pagination {
  /** 1-based, always within 1…pageCount. */
  page: number;
  pageSize: number;
  pageCount: number;
  total: number;
  /** For APIs that take offset / limit. */
  offset: number;
  /** "Showing from–to of total" (from = 0 when there are no items). */
  from: number;
  to: number;
  hasPrevious: boolean;
  hasNext: boolean;
  setPage: (page: number) => void;
  /** Changing the page size goes back to page 1. */
  setPageSize: (pageSize: number) => void;
  next: () => void;
  previous: () => void;
  first: () => void;
  last: () => void;
}

export interface UsePaginationOptions {
  /** Total number of items (e.g. meta.totalItems from the API); 0 while unknown. */
  total: number;
  defaultPageSize?: number;
  defaultPage?: number;
}

/** Pure page maths shared by both hooks. */
export function computePagination(
  rawPage: number,
  pageSize: number,
  total: number,
  setPageRaw: (page: number) => void,
  setPageSize: (size: number) => void,
): Pagination {
  const size = Math.max(1, Math.floor(pageSize) || 1);
  const pageCount = Math.max(1, Math.ceil(Math.max(0, total) / size));
  const page = Math.min(Math.max(1, Math.floor(rawPage) || 1), pageCount);
  const setPage = (target: number) =>
    setPageRaw(Math.min(Math.max(1, Math.floor(target) || 1), pageCount));
  return {
    page,
    pageSize: size,
    pageCount,
    total,
    offset: (page - 1) * size,
    from: total === 0 ? 0 : (page - 1) * size + 1,
    to: Math.min(page * size, total),
    hasPrevious: page > 1,
    hasNext: page < pageCount,
    setPage,
    setPageSize,
    next: () => setPage(page + 1),
    previous: () => setPage(page - 1),
    first: () => setPage(1),
    last: () => setPage(pageCount),
  };
}

/**
 * Page / page-size state with all the derived numbers (local state).
 *
 *   const pager = usePagination({ total: meta.totalItems, defaultPageSize: 20 });
 *   api.list({ page: pager.page, limit: pager.pageSize });
 *   <Pagination page={pager.page} total={pager.total} pageSize={pager.pageSize}
 *               onPageChange={pager.setPage} onPageSizeChange={pager.setPageSize} />
 */
export function usePagination({
  total,
  defaultPageSize = 20,
  defaultPage = 1,
}: UsePaginationOptions): Pagination {
  const [page, setPage] = useState(defaultPage);
  const [pageSize, setPageSizeState] = useState(defaultPageSize);
  const setPageSize = useCallback((size: number) => {
    setPageSizeState(size);
    setPage(1);
  }, []);
  return useMemo(
    () => computePagination(page, pageSize, total, setPage, setPageSize),
    [page, pageSize, total, setPageSize],
  );
}

/**
 * Same, stored in the URL (`?page=3&pageSize=50`): shareable, survives refresh and back /
 * forward. Use for list pages; the FilterBar resets `page` when filters change.
 */
export function useUrlPagination({
  total,
  defaultPageSize = 20,
  pageKey = 'page',
  pageSizeKey = 'pageSize',
}: UsePaginationOptions & { pageKey?: string; pageSizeKey?: string }): Pagination {
  const [params, setParams] = useQueryParams({ [pageKey]: 1, [pageSizeKey]: defaultPageSize });
  const page = Number(params[pageKey]) || 1;
  const pageSize = Number(params[pageSizeKey]) || defaultPageSize;
  return useMemo(
    () =>
      computePagination(
        page,
        pageSize,
        total,
        (next) => setParams({ [pageKey]: next }, { replace: false }),
        (size) => setParams({ [pageSizeKey]: size, [pageKey]: 1 }),
      ),
    [page, pageSize, total, setParams, pageKey, pageSizeKey],
  );
}
