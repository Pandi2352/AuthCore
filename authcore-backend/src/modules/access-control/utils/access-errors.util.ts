import { HttpStatus } from '@nestjs/common';

import { ErrorCode } from '@common/constants/error-codes.constants';
import { AppException } from '@common/exceptions/app.exception';
import type { ApiFieldError } from '@common/interfaces/api-response.interface';

/** Consistent errors for the access-control services. */
export const AccessErrors = {
  notFound: (entity: string, errors: ApiFieldError[] = []): AppException =>
    new AppException(
      HttpStatus.NOT_FOUND,
      ErrorCode.NotFound,
      `${entity} not found`,
      errors,
    ),

  systemProtected: (entity: string): AppException =>
    new AppException(
      HttpStatus.CONFLICT,
      ErrorCode.SystemResourceProtected,
      `This is a system ${entity.toLowerCase()} and cannot be changed or deleted`,
    ),

  inUse: (message: string, errors: ApiFieldError[]): AppException =>
    new AppException(
      HttpStatus.CONFLICT,
      ErrorCode.ResourceInUse,
      message,
      errors,
    ),

  inactive: (message: string, errors: ApiFieldError[]): AppException =>
    new AppException(
      HttpStatus.BAD_REQUEST,
      ErrorCode.ResourceInactive,
      message,
      errors,
    ),

  versionConflict: (entity: string): AppException =>
    new AppException(
      HttpStatus.CONFLICT,
      ErrorCode.VersionConflict,
      `This ${entity.toLowerCase()} was changed by someone else. Reload it and try again.`,
    ),

  hierarchy: (message: string): AppException =>
    new AppException(
      HttpStatus.BAD_REQUEST,
      ErrorCode.InvalidGroupHierarchy,
      message,
      [{ field: 'parentGroupId', message }],
    ),

  forbidden: (message: string, errors: ApiFieldError[] = []): AppException =>
    new AppException(
      HttpStatus.FORBIDDEN,
      ErrorCode.Forbidden,
      message,
      errors,
    ),
};

/** Only the fields that differ, for audit entries. */
export function changedValues(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): { before: Record<string, unknown>; after: Record<string, unknown> } {
  const keys = Object.keys(after).filter(
    (key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]),
  );
  return {
    before: Object.fromEntries(keys.map((key) => [key, before[key]])),
    after: Object.fromEntries(keys.map((key) => [key, after[key]])),
  };
}
