import type { ReactNode } from 'react';

import { Card } from '@/components/ui';

export interface AuthCardProps {
  /** Page heading (the page's only <h1>). */
  title: ReactNode;
  /** Friendly line under the title. */
  description?: ReactNode;
  children?: ReactNode;
  /** Links under a divider ("Don't have an account? Sign up"). */
  footer?: ReactNode;
  className?: string;
}

/**
 * The card every auth page is built from: welcome title and message at the top, the form in
 * the middle, the "other options" links in the footer. Deliberately no icon tile.
 */
export function AuthCard({ title, description, children, footer, className }: AuthCardProps) {
  return (
    <Card className={className} contentClassName="p-6 sm:p-8">
      <div className={children || footer ? 'mb-6' : undefined}>
        <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-sm text-pretty text-muted-foreground/90">{description}</p>
        )}
      </div>

      {children}

      {footer && (
        <div className="mt-6 space-y-2 border-t border-border pt-5 text-center text-sm text-muted-foreground">
          {footer}
        </div>
      )}
    </Card>
  );
}
