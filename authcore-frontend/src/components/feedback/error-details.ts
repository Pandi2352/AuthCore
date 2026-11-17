import { ApiError, getErrorMessage, isAbortError } from '@/lib/api';
import { CLIENT_ERROR_CODES } from '@/lib/constants';

/** Should the user see a support reference (request id)? Only for failures that are ours. */
export function showsReference(error: unknown): error is ApiError {
  return (
    error instanceof ApiError &&
    !!error.requestId &&
    (error.isServerError || error.code === CLIENT_ERROR_CODES.HTTP_ERROR || error.isTimeout)
  );
}

/** Errors that need no message: cancelled requests, and an expired session (sign-out handles it). */
export function isSilentError(error: unknown): boolean {
  return (
    isAbortError(error) ||
    (error instanceof ApiError && error.code === CLIENT_ERROR_CODES.AUTH_SESSION_EXPIRED)
  );
}

/**
 * Message + field errors that are NOT shown next to an input (so nothing is lost when the
 * backend reports a field the form doesn't have).
 */
export function describeError(
  error: unknown,
  options: { fallback?: string; inlineFields?: readonly string[] } = {},
): { message: string; otherFieldErrors: Array<{ field: string; message: string }> } {
  const { fallback, inlineFields = [] } = options;
  if (error instanceof ApiError && error.errors.length > 0) {
    const others = error.errors.filter((e) => !inlineFields.includes(e.field));
    const inlineCount = error.errors.length - others.length;
    return {
      message:
        inlineCount > 0
          ? 'Please correct the highlighted fields.'
          : getErrorMessage(error, fallback),
      otherFieldErrors: others.map(({ field, message }) => ({ field, message })),
    };
  }
  return { message: getErrorMessage(error, fallback), otherFieldErrors: [] };
}
