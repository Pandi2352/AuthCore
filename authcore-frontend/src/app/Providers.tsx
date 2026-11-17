import type { ReactNode } from 'react';

import { ErrorBoundary, OfflineBanner } from '@/components/feedback';
import { Toaster } from '@/components/ui';
import { AuthProvider } from '@/features/auth';

import { ThemeProvider } from './theme';

/**
 * App-wide providers, outermost first: ErrorBoundary (last-resort fallback for errors outside
 * the routes) → Theme → Auth, plus the toast region and the offline banner.
 * Route pages have their own errorElement (RouteErrorPage).
 */
export function Providers({ children }: { children: ReactNode }) {
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
