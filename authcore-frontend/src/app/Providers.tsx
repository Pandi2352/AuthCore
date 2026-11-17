import type { ReactNode } from 'react';

import { Toaster } from '@/components/ui';
import { AuthProvider } from '@/features/auth';

import { ThemeProvider } from './theme';

/** App-wide providers, outermost first: Theme → Auth (+ the toast region). */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        {children}
        <Toaster />
      </AuthProvider>
    </ThemeProvider>
  );
}
