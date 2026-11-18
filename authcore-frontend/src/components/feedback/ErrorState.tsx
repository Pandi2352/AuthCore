import { RotateCw } from 'lucide-react';
import { useState } from 'react';

import { CopyButton } from '@/components/common/CopyButton';
import { Button } from '@/components/ui';
import { env } from '@/config';
import { ApiError, getErrorMessage, getRequestId } from '@/lib/api';
import { ERROR_CODES } from '@/lib/constants';
import { cn } from '@/lib/utils';

import { isSilentError } from './error-details';
import {
  ErrorAlertIllustration,
  NotFoundIllustration,
  OfflineIllustration,
} from './FeedbackIllustrations';
import { NoPermissionState } from './NoPermissionState';

export interface ErrorStateProps {
  /** What was thrown (ApiError, Error, anything). */
  error: unknown;
  title?: string;
  /** Shows "Try again"; may return a promise (button spins until it settles). */
  onRetry?: () => void | Promise<unknown>;
  size?: 'compact' | 'default';
  /** Title for a 404 ("User not found"); default "Not found". */
  notFoundTitle?: string;
  className?: string;
}

/**
 * Failed to load — displays the right vector feedback state for the error:
 * - 403 → "no access" (NoPermissionState with 3D security lock illustration)
 * - 404 → "not found" (NotFoundIllustration with 3D search crystal prism)
 * - offline → (OfflineIllustration with 3D signal node)
 * - general error: (ErrorAlertIllustration with 3D warning prism), request ID, retry button
 * Cancelled requests and an expired session render nothing.
 */
export function ErrorState({
  error,
  title,
  onRetry,
  size = 'default',
  notFoundTitle = 'Not found',
  className,
}: ErrorStateProps) {
  const [isRetrying, setIsRetrying] = useState(false);
  const pad = size === 'compact' ? 'px-4 py-8' : 'px-4 py-16';
  const requestId = getRequestId(error);
  const isOffline = error instanceof ApiError && error.code === ERROR_CODES.NETWORK_ERROR;

  const retry = async () => {
    if (!onRetry) return;
    setIsRetrying(true);
    try {
      await onRetry();
    } finally {
      setIsRetrying(false);
    }
  };

  if (isSilentError(error)) return null;
  if (error instanceof ApiError && error.isForbidden) {
    return <NoPermissionState size={size} className={className} />;
  }
  if (error instanceof ApiError && error.isNotFound) {
    return (
      <div
        className={cn(
          'relative isolate flex flex-col items-center justify-center gap-3 text-center',
          pad,
          className,
        )}
      >
        <NotFoundIllustration size={size} />
        <p className="text-base font-semibold text-foreground">{notFoundTitle}</p>
        <p className="max-w-md text-sm text-muted-foreground">
          {getErrorMessage(error, 'It may have been deleted or moved.')}
        </p>
      </div>
    );
  }

  return (
    <div
      role="alert"
      className={cn(
        'relative isolate flex flex-col items-center justify-center gap-3 text-center',
        size === 'compact' ? 'px-4 py-8' : 'px-4 py-16',
        className,
      )}
    >
      {isOffline ? <OfflineIllustration size={size} /> : <ErrorAlertIllustration size={size} />}
      <p className="text-base font-semibold text-foreground">
        {title ?? (isOffline ? "You're offline" : "Couldn't load this")}
      </p>
      <p className="max-w-md text-sm text-muted-foreground">{getErrorMessage(error)}</p>
      {requestId && (
        <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          Request ID: <code className="font-mono">{requestId}</code>
          <CopyButton value={requestId} label="Copy request ID" size="sm" />
        </p>
      )}
      {onRetry && (
        <Button
          variant="outline"
          leftIcon={<RotateCw />}
          isLoading={isRetrying}
          onClick={() => void retry()}
          className="mt-1"
        >
          Try again
        </Button>
      )}
      {env.isDevelopment && error instanceof Error && (
        <details className="mt-2 max-w-2xl text-left text-xs">
          <summary className="cursor-pointer text-muted-foreground">Technical details</summary>
          <pre className="mt-2 overflow-auto rounded-md border border-border bg-muted p-3 font-mono text-danger">
            {error.name}: {error.message}
            {error instanceof ApiError && `\n${error.statusCode} ${error.code}`}
          </pre>
        </details>
      )}
    </div>
  );
}
