import { DEFAULT_SUCCESS_MESSAGE } from '@common/constants/api.constants';
import { ErrorCode } from '@common/constants/error-codes.constants';
import {
  ApiErrorResponse,
  ApiFieldError,
  ApiSuccessResponse,
  Paginated,
} from '@common/interfaces/api-response.interface';

/** Current time as ISO 8601 in UTC, e.g. 2026-11-14T10:00:00.000Z */
export function utcNow(): string {
  return new Date().toISOString();
}

export function isPaginated(value: unknown): value is Paginated<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as Paginated<unknown>).items) &&
    typeof (value as Paginated<unknown>).meta === 'object'
  );
}

/** Builds the standard success envelope. Paginated results get `data` + `meta`. */
export function buildSuccessResponse(
  payload: unknown,
  path: string,
  message: string = DEFAULT_SUCCESS_MESSAGE,
): ApiSuccessResponse<unknown> {
  if (isPaginated(payload)) {
    return {
      success: true,
      message,
      data: payload.items,
      meta: payload.meta,
      timestamp: utcNow(),
      path,
    };
  }
  return {
    success: true,
    message,
    data: payload ?? null,
    timestamp: utcNow(),
    path,
  };
}

export function buildErrorResponse(params: {
  statusCode: number;
  code: ErrorCode;
  message: string;
  path: string;
  errors?: ApiFieldError[];
}): ApiErrorResponse {
  return {
    success: false,
    message: params.message,
    code: params.code,
    errors: params.errors ?? [],
    statusCode: params.statusCode,
    timestamp: utcNow(),
    path: params.path,
  };
}
