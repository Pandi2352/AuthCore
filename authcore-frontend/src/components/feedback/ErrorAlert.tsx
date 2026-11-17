import { CopyButton } from '@/components/common/CopyButton';
import { Alert } from '@/components/ui';
import { humanize } from '@/lib/utils';

import { describeError, isSilentError, showsReference } from './error-details';

export interface ErrorAlertProps {
  /** Whatever was caught (ApiError, Error, string via useApiError). null → nothing rendered. */
  error: unknown;
  /** Text when the error has no readable message. */
  fallback?: string;
  /** Fields the form shows inline (their errors aren't repeated here). */
  fields?: readonly string[];
  title?: string;
  onClose?: () => void;
  className?: string;
}

/**
 * The error box for forms and actions: readable message (Retry-After wait, offline …),
 * field errors the form can't show inline, and a copyable request id for server failures.
 */
export function ErrorAlert({
  error,
  fallback,
  fields,
  title,
  onClose,
  className,
}: ErrorAlertProps) {
  if (error === null || error === undefined || isSilentError(error)) return null;
  const { message, otherFieldErrors } = describeError(error, { fallback, inlineFields: fields });
  return (
    <Alert variant="danger" title={title} message={message} onClose={onClose} className={className}>
      {otherFieldErrors.length > 0 && (
        <ul className="mt-1 list-disc space-y-0.5 pl-5">
          {otherFieldErrors.map((e) => (
            <li key={`${e.field}:${e.message}`}>
              <span className="font-medium">{humanize(e.field)}:</span> {e.message}
            </li>
          ))}
        </ul>
      )}
      {showsReference(error) && (
        <p className="mt-1 inline-flex items-center gap-1 text-xs opacity-90">
          Reference: <code className="font-mono">{error.requestId}</code>
          <CopyButton value={error.requestId ?? ''} label="Copy reference" size="sm" />
        </p>
      )}
    </Alert>
  );
}
