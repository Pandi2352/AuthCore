import { useEffect, type ReactNode } from 'react';

import { ErrorBoundary, OfflineBanner } from '@/components/feedback';
import { Toaster } from '@/components/ui';
import { AuthProvider } from '@/features/auth';
import { apiClient } from '@/lib/api';
import { reportError } from '@/lib/errors';

import { ThemeProvider } from './theme';

/**
 * App-wide providers, outermost first: ErrorBoundary (last-resort fallback for errors outside
 * the routes) → Theme → Auth, plus the toast region and the offline banner.
 * Route pages have their own errorElement (RouteErrorPage).
 */
export function Providers({ children }: { children: ReactNode }) {
  // 5xx / unexpected API responses go to the error reporter (4xx are expected outcomes).
  useEffect(
    () =>
      apiClient.on('serverError', (error) =>
        reportError(error, { source: 'api', extra: { method: error.method, path: error.path } }),
      ),
    [],
  );

  return (
    <ErrorBoundary level="app">
      <ThemeProvider>
        <AuthProvider>
          {children}
          <Toaster />
          <OfflineBanner />
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
