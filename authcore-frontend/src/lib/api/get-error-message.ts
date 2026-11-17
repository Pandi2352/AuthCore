import { CLIENT_ERROR_CODES, ERROR_CODES } from '../constants/error-codes';
import { HTTP_STATUS, isServerError } from '../constants/http';
import { ApiError } from './api-error';

const BY_CODE: Record<string, string> = {
  [CLIENT_ERROR_CODES.NETWORK_ERROR]:
    'Cannot reach the server. Check your connection and try again.',
  [CLIENT_ERROR_CODES.TIMEOUT]: 'The server took too long to respond. Try again.',
  [CLIENT_ERROR_CODES.AUTH_SESSION_EXPIRED]: 'Your session has expired. Please sign in again.',
  [ERROR_CODES.AUTH_ACCESS_TOKEN_EXPIRED]: 'Your session has expired. Please sign in again.',
  [ERROR_CODES.TOO_MANY_REQUESTS]: 'Too many requests. Wait a moment and try again.',
};

const BY_STATUS: Record<number, string> = {
  403: "You don't have permission to do this.",
  404: 'The requested item was not found.',
  408: 'The request timed out. Try again.',
  429: 'Too many requests. Wait a moment and try again.',
  500: 'Something went wrong on our side. Try again later.',
  502: 'The service is temporarily unavailable. Try again later.',
  503: 'The service is temporarily unavailable. Try again later.',
  504: 'The server took too long to respond. Try again.',
};

/** Any thrown value → text a user can read (API message, known code / status, or fallback). */
export function getErrorMessage(
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  if (error instanceof ApiError) {
    const known = BY_CODE[error.code];
    if (known) return known;
    if (isServerError(error.statusCode)) {
      return (
        BY_STATUS[error.statusCode] ?? BY_STATUS[HTTP_STATUS.INTERNAL_SERVER_ERROR] ?? fallback
      );
    }
    return error.message || BY_STATUS[error.statusCode] || fallback;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

/** Request id of an API error (for support), if any. */
export const getRequestId = (error: unknown): string | undefined =>
  error instanceof ApiError ? error.requestId : undefined;
