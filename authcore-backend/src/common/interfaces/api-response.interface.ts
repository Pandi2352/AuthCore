import { ErrorCode } from '@common/constants/error-codes.constants';

export interface PaginationMeta {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/** What a service returns for a list endpoint. */
export interface Paginated<T> {
  items: T[];
  meta: PaginationMeta;
}

export interface ApiSuccessResponse<T> {
  success: true;
  message: string;
  data: T;
  /** Present only on paginated list responses. */
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
  code: ErrorCode;
  errors: ApiFieldError[];
  statusCode: number;
  /** ISO 8601, UTC. */
  timestamp: string;
  path: string;
}
