import { PAGINATION } from '@common/constants/api.constants';
import {
  Paginated,
  PaginationMeta,
} from '@common/interfaces/api-response.interface';

/** Clamps page/limit to safe values so no query is ever unbounded. */
export function normalizePagination(page?: number, limit?: number) {
  const safePage = Math.max(1, Math.floor(page ?? PAGINATION.DEFAULT_PAGE));
  const safeLimit = Math.min(
    PAGINATION.MAX_LIMIT,
    Math.max(1, Math.floor(limit ?? PAGINATION.DEFAULT_LIMIT)),
  );
  return {
    page: safePage,
    limit: safeLimit,
    skip: (safePage - 1) * safeLimit,
  };
}

export function buildPaginationMeta(
  page: number,
  limit: number,
  totalItems: number,
): PaginationMeta {
  const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / limit);
  return {
    page,
    limit,
    totalItems,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1 && totalPages > 0,
  };
}

export function paginate<T>(
  items: T[],
  page: number,
  limit: number,
  totalItems: number,
): Paginated<T> {
  return { items, meta: buildPaginationMeta(page, limit, totalItems) };
}
