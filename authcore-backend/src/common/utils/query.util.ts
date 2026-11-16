import { HttpStatus } from '@nestjs/common';

import { ErrorCode } from '@common/constants/error-codes.constants';
import { AppException } from '@common/exceptions/app.exception';

export type SortOrder = 'asc' | 'desc';

/** Escapes user input for use inside a RegExp (no regex injection, no ReDoS patterns). */
export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Case-insensitive "contains" match for a search term. */
export function containsPattern(value: string): RegExp {
  return new RegExp(escapeRegex(value.trim()), 'i');
}

/**
 * Sort from an allowlisted field (DTOs restrict `sortBy` too). `_id` is a
 * tie-breaker so pages are stable when values are equal.
 */
export function buildSort(
  sortBy: string | undefined,
  sortOrder: SortOrder | undefined,
  allowed: readonly string[],
  fallback: string,
): Record<string, 1 | -1> {
  const field =
    sortBy !== undefined && allowed.includes(sortBy) ? sortBy : fallback;
  const direction = sortOrder === 'asc' ? 1 : -1;
  return { [field]: direction, _id: direction };
}

/**
 * Mongo range condition for [from, to]; undefined when neither is given.
 * 400 if from is after to.
 */
export function buildDateRange(
  field: string,
  from?: Date,
  to?: Date,
): Record<string, Date> | undefined {
  if (from && to && from > to) {
    throw new AppException(
      HttpStatus.BAD_REQUEST,
      ErrorCode.ValidationFailed,
      'Invalid date range',
      [
        {
          field: `${field}From`,
          message: `${field}From must not be after ${field}To`,
        },
      ],
    );
  }
  if (!from && !to) {
    return undefined;
  }
  return { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) };
}
