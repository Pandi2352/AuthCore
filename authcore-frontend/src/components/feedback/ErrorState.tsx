import { AlertTriangle, RotateCw, SearchX, WifiOff } from 'lucide-react';
import { useState } from 'react';

import { CopyButton } from '@/components/common/CopyButton';
import { Button } from '@/components/ui';
import { env } from '@/config';
import { ApiError, getErrorMessage, getRequestId } from '@/lib/api';
import { ERROR_CODES } from '@/lib/constants';
import { cn } from '@/lib/utils';

import { isSilentError } from './error-details';
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
 * Failed to load — the right state for the error:
 * - 403 → "no access" (NoPermissionState), 404 → "not found", offline → offline message
 * - anything else: readable message (getErrorMessage), request id for support (copyable),
 *   retry button, technical details in development
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
  const Icon = isOffline ? WifiOff : AlertTriangle;

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
    return <NoPermissionState className={className} />;
  }
  if (error instanceof ApiError && error.isNotFound) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center gap-3 text-center',
          pad,
          className,
        )}
      >
        <div
          className="flex size-12 items-center justify-center rounded-md bg-muted text-muted-foreground [&_svg]:size-6"
          aria-hidden="true"
        >
          <SearchX />
        </div>
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
        'flex flex-col items-center justify-center gap-3 text-center',
        size === 'compact' ? 'px-4 py-8' : 'px-4 py-16',
        className,
      )}
    >
      <div
        className="flex size-12 items-center justify-center rounded-md bg-danger-soft text-danger-soft-foreground [&_svg]:size-6"
        aria-hidden="true"
      >
        <Icon />
      </div>
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
