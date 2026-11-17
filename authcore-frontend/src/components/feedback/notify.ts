import { toast, type ToastOptions } from '@/components/ui';
import { getErrorMessage } from '@/lib/api';

import { isSilentError, showsReference } from './error-details';

/**
 * Errors of user actions (save, delete, revoke …) as a toast. Cancelled requests and an
 * expired session are silent (sign-out handles that). Server failures get a reference id.
 *
 *   try { await api.revoke(id); notifySuccess('Session revoked') } catch (err) { notifyError(err, 'Could not revoke the session') }
 */
export function notifyError(error: unknown, fallback?: string, options: ToastOptions = {}): void {
  if (isSilentError(error)) return;
  toast.error(getErrorMessage(error, fallback), {
    ...options,
    description:
      options.description ?? (showsReference(error) ? `Reference: ${error.requestId}` : undefined),
  });
}

export function notifySuccess(message: string, options?: ToastOptions): void {
  toast.success(message, options);
}
