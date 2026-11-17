import { Home, RotateCw } from 'lucide-react';

import { Button } from '@/components/ui';
import { env, paths } from '@/config';

import { StatusPage } from './StatusPage';

/**
 * Error-boundary fallback in the status-page design (theme background, code badge, actions).
 * - page: inside the app layout (sidebar / navbar keep working), "Try again" re-renders the page
 * - app: full screen, outside the router and providers — plain links, "Reload" restarts the app
 */
export function CrashPage({
  error,
  reset,
  level = 'page',
}: {
  error: Error;
  reset: () => void;
  level?: 'page' | 'app';
}) {
  const isApp = level === 'app';
  return (
    <StatusPage
      fullScreen={isApp}
      code="Error"
      title={isApp ? 'Something went wrong!' : 'This page ran into a problem!'}
      description={
        isApp
          ? 'Oops! The application hit an unexpected error. Reload to start again.'
          : 'Oops! Something broke while showing this page. The rest of the app still works — try again or go back to the dashboard.'
      }
      actions={
        <>
          <Button
            size="md"
            leftIcon={<RotateCw />}
            onClick={isApp ? () => window.location.reload() : reset}
          >
            {isApp ? 'Reload' : 'Try again'}
          </Button>
          <Button variant="outline" size="md" leftIcon={<Home />} asChild>
            <a href={paths.dashboard}>Go to dashboard</a>
          </Button>
        </>
      }
    >
      {env.isDevelopment && (
        <pre className="mt-6 max-w-xl overflow-auto rounded-md border border-border bg-surface/90 p-4 text-left font-mono text-xs text-danger">
          {error.message}
        </pre>
      )}
    </StatusPage>
  );
}
