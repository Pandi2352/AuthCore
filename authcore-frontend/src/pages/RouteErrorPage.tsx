import { RefreshCw, RotateCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  isRouteErrorResponse,
  Link,
  useLocation,
  useNavigate,
  useRouteError,
} from 'react-router-dom';

import { CopyButton } from '@/components/common/CopyButton';
import { ErrorAlertIllustration } from '@/components/feedback';
import { Button, Spinner } from '@/components/ui';
import { env, paths } from '@/config';
import { getRequestId } from '@/lib/api';
import { isChunkLoadError, reloadOnceForChunkError, reportError } from '@/lib/errors';

import { NotFoundPage } from './NotFoundPage';
import { StatusPage } from './StatusPage';

/**
 * errorElement for the root and each layout:
 * - 404 responses → NotFoundPage
 * - chunk-load errors (new deployment while the tab was open) → reload once automatically,
 *   then "a new version is available" if that didn't help
 * - anything else → reported (reportError) and shown with "Try again" (re-runs the route,
 *   no full reload), reload, dashboard, and the request id for API errors
 */
export function RouteErrorPage() {
  const error = useRouteError();
  const navigate = useNavigate();
  const location = useLocation();
  const isChunk = isChunkLoadError(error);
  // Decide once, while rendering the first time: reload (returns true) or show the page.
  const [isReloading] = useState(() => isChunk && reloadOnceForChunkError());

  useEffect(() => {
    if (!isChunk && !(isRouteErrorResponse(error) && error.status === 404)) {
      reportError(error, { source: 'route', extra: { path: location.pathname } });
    }
  }, [error, isChunk, location.pathname]);

  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundPage />;

  if (isChunk) {
    if (isReloading) {
      return (
        <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-background text-primary">
          <Spinner size="lg" label={null} />
          <p className="text-sm text-muted-foreground" aria-live="polite">
            Loading the latest version…
          </p>
        </div>
      );
    }
    return (
      <StatusPage
        fullScreen
        icon={<RefreshCw aria-hidden="true" />}
        title="A new version is available"
        description="The application was updated while this page was open. Reload to get the latest version."
        actions={<Button onClick={() => window.location.reload()}>Reload</Button>}
      />
    );
  }

  const message =
    error instanceof Error
      ? error.message
      : isRouteErrorResponse(error)
        ? `${error.status} ${error.statusText}`
        : String(error);
  const requestId = getRequestId(error);

  return (
    <StatusPage
      fullScreen
      icon={<ErrorAlertIllustration size="default" />}
      code="500"
      title="Something went wrong!"
      description="Oops! An unexpected error occurred while loading this page. Please try again or return to the dashboard."
      actions={
        <>
          <Button
            size="md"
            leftIcon={<RotateCw />}
            // Navigating to the same location clears the route error and re-runs it.
            onClick={() =>
              navigate(`${location.pathname}${location.search}${location.hash}`, { replace: true })
            }
          >
            Try again
          </Button>
          <Button variant="outline" size="md" onClick={() => window.location.reload()}>
            Reload page
          </Button>
          <Button variant="ghost" size="md" asChild>
            <Link to={paths.dashboard} reloadDocument>
              Go to dashboard
            </Link>
          </Button>
        </>
      }
    >
      {requestId && (
        <p className="mt-4 inline-flex items-center gap-1 text-xs text-muted-foreground">
          Reference: <code className="font-mono">{requestId}</code>
          <CopyButton value={requestId} label="Copy reference" size="sm" />
        </p>
      )}
      {env.isDevelopment && (
        <pre className="mt-6 max-w-2xl overflow-auto rounded-md border border-border bg-muted p-4 text-left font-mono text-xs text-danger">
          {message}
        </pre>
      )}
    </StatusPage>
  );
}
