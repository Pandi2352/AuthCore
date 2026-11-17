import { CLIENT_ERROR_CODES, ERROR_CODES } from '../constants/error-codes';
import { HTTP_STATUS, isServerError } from '../constants/http';
import { ApiError } from './api-error';

const BY_CODE: Record<string, string> = {
  [CLIENT_ERROR_CODES.NETWORK_ERROR]:
    'Cannot reach the server. Check your connection and try again.',
  [CLIENT_ERROR_CODES.TIMEOUT]: 'The server took too long to respond. Try again.',
  [CLIENT_ERROR_CODES.ABORTED]: 'The request was cancelled.',
  [CLIENT_ERROR_CODES.HTTP_ERROR]: 'The server sent an unexpected response. Try again.',
  [CLIENT_ERROR_CODES.AUTH_SESSION_EXPIRED]: 'Your session has expired. Please sign in again.',
  [ERROR_CODES.AUTH_ACCESS_TOKEN_EXPIRED]: 'Your session has expired. Please sign in again.',
};

const BY_STATUS: Record<number, string> = {
  [HTTP_STATUS.FORBIDDEN]: "You don't have permission to do this.",
  [HTTP_STATUS.NOT_FOUND]: 'The requested item was not found.',
  408: 'The request timed out. Try again.',
  [HTTP_STATUS.PAYLOAD_TOO_LARGE]: 'The file or request is too large.',
  [HTTP_STATUS.TOO_MANY_REQUESTS]: 'Too many requests. Wait a moment and try again.',
  [HTTP_STATUS.INTERNAL_SERVER_ERROR]: 'Something went wrong on our side. Try again later.',
  [HTTP_STATUS.BAD_GATEWAY]: 'The service is temporarily unavailable. Try again later.',
  [HTTP_STATUS.SERVICE_UNAVAILABLE]: 'The service is temporarily unavailable. Try again later.',
  [HTTP_STATUS.GATEWAY_TIMEOUT]: 'The server took too long to respond. Try again.',
};

/** 75 → "1 minute", 900 → "15 minutes", 30 → "30 seconds". */
function describeWait(seconds: number): string {
  if (seconds < 60) return `${seconds} second${seconds === 1 ? '' : 's'}`;
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  const hours = Math.ceil(minutes / 60);
  return `${hours} hour${hours === 1 ? '' : 's'}`;
}

/**
 * Any thrown value → text a user can read:
 * - known client codes (offline, timeout, session) → fixed friendly text
 * - 5xx → generic text (server details are never shown)
 * - other API errors → the backend message (written for users), plus "try again in …"
 *   when the backend sent Retry-After
 */
export function getErrorMessage(
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  if (error instanceof ApiError) {
    if (error.isNetworkError && typeof navigator !== 'undefined' && navigator.onLine === false) {
      return "You're offline. Check your connection and try again.";
    }
    const known = BY_CODE[error.code];
    if (known) return known;
    if (isServerError(error.status)) {
      return BY_STATUS[error.status] ?? BY_STATUS[HTTP_STATUS.INTERNAL_SERVER_ERROR] ?? fallback;
    }
    const message = error.message || BY_STATUS[error.status] || fallback;
    if (error.retryAfter && error.retryAfter > 0 && !/try again in/i.test(message)) {
      const wait = `Try again in ${describeWait(error.retryAfter)}.`;
      // "… Try again later." → "… Try again in 15 minutes."
      if (/try again later\.?/i.test(message)) return message.replace(/try again later\.?/i, wait);
      return `${message.replace(/\.?\s*$/, '.')} ${wait}`;
    }
    return message;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

/** Field errors by field path (`{ email: 'Already in use' }`), empty for other errors. */
export function getFieldErrors(error: unknown): Readonly<Record<string, string>> {
  return error instanceof ApiError ? error.fieldErrors : {};
}

/** Request id of an API error (for support), if any. */
export const getRequestId = (error: unknown): string | undefined =>
  error instanceof ApiError ? error.requestId : undefined;
