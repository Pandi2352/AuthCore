import { AlertTriangle, RotateCw, WifiOff } from 'lucide-react';
import { useState } from 'react';

import { CopyButton } from '@/components/common/CopyButton';
import { Button } from '@/components/ui';
import { env } from '@/config';
import { ApiError, getErrorMessage, getRequestId } from '@/lib/api';
import { cn } from '@/lib/utils';

export interface ErrorStateProps {
  /** What was thrown (ApiError, Error, anything). */
  error: unknown;
  title?: string;
  /** Shows "Try again"; may return a promise (button spins until it settles). */
  onRetry?: () => void | Promise<unknown>;
  size?: 'compact' | 'default';
  className?: string;
}

/**
 * Failed to load: readable message (getErrorMessage), the request id to quote to support
 * (copyable), a retry button, technical details in development.
 */
export function ErrorState({
  error,
  title,
  onRetry,
  size = 'default',
  className,
}: ErrorStateProps) {
  const [isRetrying, setIsRetrying] = useState(false);
  const requestId = getRequestId(error);
  const isOffline = error instanceof ApiError && error.code === 'NETWORK_ERROR';
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
