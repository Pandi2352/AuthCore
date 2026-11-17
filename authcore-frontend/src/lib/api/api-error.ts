import type { ApiErrorResponse } from './types';

/** Error thrown by apiClient for every non-2xx response (backend error envelope). */
export class ApiError extends Error {
  statusCode: number;
  code: string;
  errors?: Array<{ field?: string; message: string }>;
  raw: ApiErrorResponse;

  constructor(response: ApiErrorResponse) {
    super(response.message || 'An unexpected error occurred');
    this.name = 'ApiError';
    this.statusCode = response.statusCode;
    this.code = response.code;
    this.errors = response.errors;
    this.raw = response;
  }
}
