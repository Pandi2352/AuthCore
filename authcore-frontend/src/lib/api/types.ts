/**
 * The backend's response envelopes (authcore-backend: common/interfaces/api-response.interface.ts).
 * The client unwraps them: callers get `data` (or `Paginated<T>` for lists), never the envelope.
 */

export interface PaginationMeta {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface ApiSuccessResponse<T = unknown> {
  success: true;
  message: string;
  data: T;
  /** Only on paginated list responses. */
  meta?: PaginationMeta;
  /** ISO 8601, UTC. */
  timestamp: string;
  path: string;
}

export interface ApiFieldError {
  /** Dot path of the invalid field, e.g. "address.city". */
  field: string;
  message: string;
}

export interface ApiErrorResponse {
  success: false;
  message: string;
  code: string;
  errors: ApiFieldError[];
  statusCode: number;
  timestamp: string;
  path: string;
}

/** A page of a list endpoint, as returned by apiClient.getPage(). */
export interface Paginated<T> {
  items: T[];
  meta: PaginationMeta;
}

/** @deprecated use ApiSuccessResponse */
export type ApiResponse<T = unknown> = ApiSuccessResponse<T>;
/** @deprecated use Paginated */
export type PaginatedResult<T> = Paginated<T>;

export const isSuccessEnvelope = (value: unknown): value is ApiSuccessResponse =>
  typeof value === 'object' &&
  value !== null &&
  (value as { success?: unknown }).success === true &&
  'data' in value;

export const isErrorEnvelope = (value: unknown): value is ApiErrorResponse =>
  typeof value === 'object' &&
  value !== null &&
  (value as { success?: unknown }).success === false &&
  typeof (value as { code?: unknown }).code === 'string';
