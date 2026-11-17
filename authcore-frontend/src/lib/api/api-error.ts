import { CLIENT_ERROR_CODES, ERROR_CODES } from '../constants/error-codes';
import { HTTP_STATUS, isServerError } from '../constants/http';
import type { ApiFieldError } from './types';

export interface ApiErrorInit {
  /** HTTP status; 0 when there was no response (network error, timeout, abort). */
  status: number;
  /** Machine-readable code (lib/constants/error-codes.ts). */
  code: string;
  message: string;
  errors?: readonly ApiFieldError[];
  /** X-Request-Id of the request (quote it to support). */
  requestId?: string;
  /** Seconds to wait before retrying (Retry-After), e.g. after 429. */
  retryAfter?: number;
  method?: string;
  path?: string;
  cause?: unknown;
}

/** `[{ field: 'email', message: '…' }]` → `{ email: '…' }` (first message per field). */
function toFieldErrors(errors: readonly ApiFieldError[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const { field, message } of errors) {
    if (field && !(field in map)) map[field] = message;
  }
  return map;
}

/**
 * Every failure from the API layer is an ApiError — HTTP errors (from the backend envelope)
 * and client-side ones (network, timeout, abort). Branch on `code`, never on `message`.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  /** Field errors as sent by the backend. */
  readonly errors: readonly ApiFieldError[];
  /** Field errors by field path, ready for forms: `fieldErrors.email`. */
  readonly fieldErrors: Readonly<Record<string, string>>;
  readonly requestId?: string;
  readonly retryAfter?: number;
  readonly method?: string;
  readonly path?: string;

  constructor(init: ApiErrorInit) {
    super(
      init.message || 'An unexpected error occurred',
      init.cause === undefined ? undefined : { cause: init.cause },
    );
    this.name = 'ApiError';
    this.status = init.status;
    this.code = init.code;
    this.errors = init.errors ?? [];
    this.fieldErrors = toFieldErrors(this.errors);
    this.requestId = init.requestId;
    this.retryAfter = init.retryAfter;
    this.method = init.method;
    this.path = init.path;
  }

  /** Backend naming (`statusCode` in the error envelope). */
  get statusCode(): number {
    return this.status;
  }

  /** True when the code is one of the given ones. */
  is(...codes: string[]): boolean {
    return codes.includes(this.code);
  }

  get isNetworkError(): boolean {
    return this.code === CLIENT_ERROR_CODES.NETWORK_ERROR;
  }
  get isTimeout(): boolean {
    return this.code === CLIENT_ERROR_CODES.TIMEOUT;
  }
  /** Cancelled by the caller (navigated away, new search …): usually ignore it. */
  get isAborted(): boolean {
    return this.code === CLIENT_ERROR_CODES.ABORTED;
  }
  get isUnauthorized(): boolean {
    return this.status === HTTP_STATUS.UNAUTHORIZED;
  }
  get isForbidden(): boolean {
    return this.status === HTTP_STATUS.FORBIDDEN;
  }
  get isNotFound(): boolean {
    return this.status === HTTP_STATUS.NOT_FOUND;
  }
  /** Input problems the user can fix (field errors or VALIDATION_FAILED). */
  get isValidation(): boolean {
    return this.code === ERROR_CODES.VALIDATION_FAILED || this.errors.length > 0;
  }
  get isServerError(): boolean {
    return isServerError(this.status);
  }
}

export const isApiError = (error: unknown): error is ApiError => error instanceof ApiError;

/** Caller-cancelled request (ApiError ABORTED or a DOM AbortError). */
export const isAbortError = (error: unknown): boolean =>
  (error instanceof ApiError && error.isAborted) ||
  (error instanceof DOMException && error.name === 'AbortError');
