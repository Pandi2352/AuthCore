import { useCallback, useMemo, useState } from 'react';

import { getFieldErrors, isAbortError } from '@/lib/api';

interface ErrorStateValue {
  error: unknown;
  fallback?: string;
}

/**
 * Error state for a form or an action: keeps the thrown value (ApiError with field errors,
 * request id, Retry-After …) instead of flattening it to a string.
 *
 *   const { error, fallback, setError, fieldError } = useApiError();
 *   try { await api.save(values) } catch (err) { setError(err, 'Could not save') }
 *   <ErrorAlert error={error} fallback={fallback} fields={['email']} onClose={() => setError(null)} />
 *   <Input label="Email" error={fieldError('email')} … />
 *
 * Cancelled requests are ignored; a string sets a plain message ("Passwords do not match").
 */
export function useApiError() {
  const [state, setState] = useState<ErrorStateValue | null>(null);

  const setError = useCallback((error: unknown, fallback?: string) => {
    if (error === null || error === undefined) {
      setState(null);
      return;
    }
    if (isAbortError(error)) return;
    setState({ error: typeof error === 'string' ? new Error(error) : error, fallback });
  }, []);

  const clearError = useCallback(() => setState(null), []);

  const fieldErrors = useMemo(() => (state ? getFieldErrors(state.error) : {}), [state]);
  const fieldError = useCallback(
    (field: string): string | undefined => fieldErrors[field],
    [fieldErrors],
  );

  return {
    error: state?.error ?? null,
    fallback: state?.fallback,
    hasError: state !== null,
    fieldErrors,
    fieldError,
    setError,
    clearError,
  };
}
