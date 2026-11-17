export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data: T;
  meta?: PaginationMeta;
  timestamp: string;
  path: string;
}

export interface ApiErrorDetail {
  field?: string;
  message: string;
}

export interface ApiErrorResponse {
  success: false;
  message: string;
  code: string;
  errors?: ApiErrorDetail[];
  statusCode: number;
  timestamp: string;
  path: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PaginatedResult<T> {
  items: T[];
  meta: PaginationMeta;
}
