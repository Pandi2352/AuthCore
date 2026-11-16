import { HttpStatus } from '@nestjs/common';
import type { Model } from 'mongoose';

import { ErrorCode } from '@common/constants/error-codes.constants';
import { AppException } from '@common/exceptions/app.exception';
import type { ApiFieldError } from '@common/interfaces/api-response.interface';

/**
 * The rules that clash with existing records (empty = all values free).
 * Used by assertUnique and by "does this name exist?" endpoints.
 */
export async function findConflicts<T>(
  model: Model<T>,
  rules: UniqueRule[],
  excludeId?: string,
): Promise<ApiFieldError[]> {
  const errors: ApiFieldError[] = [];
  for (const rule of rules) {
    const filter = excludeId
      ? { ...rule.filter, _id: { $ne: excludeId } }
      : rule.filter;
    const query = model.exists(filter);
    if (rule.isCaseInsensitive) {
      query.collation(CASE_INSENSITIVE);
    }
    if (await query) {
      errors.push({ field: rule.field, message: rule.message });
    }
  }
  return errors;
}

/** Case-insensitive comparison (same collation as the unique indexes). */
export const CASE_INSENSITIVE = { locale: 'en', strength: 2 } as const;

export interface UniqueRule {
  /** Field reported to the client, e.g. "roleKey". */
  field: string;
  /** Conditions that identify a clash, e.g. { roleKey: 'ADMIN', isDeleted: false }. */
  filter: Record<string, unknown>;
  message: string;
  /** Compare case-insensitively. */
  isCaseInsensitive?: boolean;
}

/**
 * Checks several uniqueness rules and throws one 409 DUPLICATE_RESOURCE that
 * lists every clashing field. `excludeId` skips the record being updated.
 *
 * Friendly error only: two parallel requests can both pass this check, so
 * each rule must also be backed by a unique index (the exception filter maps
 * index violations to the same 409).
 */
export async function assertUnique<T>(
  model: Model<T>,
  rules: UniqueRule[],
  excludeId?: string,
): Promise<void> {
  const errors = await findConflicts(model, rules, excludeId);
  if (errors.length > 0) {
    throw new AppException(
      HttpStatus.CONFLICT,
      ErrorCode.DuplicateResource,
      errors.length === 1
        ? (errors[0]?.message ?? 'Already exists')
        : 'Some values are already in use',
      errors,
    );
  }
}
