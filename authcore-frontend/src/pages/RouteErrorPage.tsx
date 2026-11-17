import { AlertTriangle, RefreshCw } from 'lucide-react';
import { isRouteErrorResponse, Link, useRouteError } from 'react-router-dom';

import { Button } from '@/components/ui';
import { env, paths } from '@/config';

import { NotFoundPage } from './NotFoundPage';
import { StatusPage } from './StatusPage';

/** A lazy chunk that no longer exists (new deployment while the tab was open). */
const isChunkLoadError = (error: unknown): boolean =>
  error instanceof Error &&
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk \d+ failed/i.test(
    error.message,
  );

/** errorElement for the root and each layout: render errors, chunk-load errors, 404 responses. */
export function RouteErrorPage() {
  const error = useRouteError();

  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundPage />;

  if (isChunkLoadError(error)) {
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
  if (env.isDevelopment) console.error(error);

  return (
    <StatusPage
      fullScreen
      icon={<AlertTriangle aria-hidden="true" />}
      title="Something went wrong"
      description="An unexpected error occurred. Try again, or go back to the dashboard."
      actions={
        <>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Try again
          </Button>
          <Button asChild>
            <Link to={paths.dashboard} reloadDocument>
              Go to dashboard
            </Link>
          </Button>
        </>
      }
    >
      {env.isDevelopment && (
        <pre className="mt-6 max-w-2xl overflow-auto rounded-md border border-border bg-muted p-4 text-left font-mono text-xs text-danger">
          {message}
        </pre>
      )}
    </StatusPage>
  );
}
