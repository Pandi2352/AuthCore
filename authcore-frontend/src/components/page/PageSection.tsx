import { useId, type ReactNode } from 'react';

import { Card } from '@/components/ui';
import { cn } from '@/lib/utils';

export interface PageSectionProps {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** Card around the content (default) or a plain section. */
  variant?: 'card' | 'plain';
  /** Card footer (buttons). */
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** A titled part of a page (labelled region). */
export function PageSection({
  title,
  description,
  actions,
  variant = 'card',
  footer,
  children,
  className,
}: PageSectionProps) {
  const headingId = useId();
  if (variant === 'card') {
    return (
      <section aria-labelledby={title ? headingId : undefined} className={className}>
        <Card
          title={title ? <span id={headingId}>{title}</span> : undefined}
          subtitle={description}
          actions={actions}
          footer={footer}
        >
          {children}
        </Card>
      </section>
    );
  }
  return (
    <section aria-labelledby={title ? headingId : undefined} className={cn('space-y-4', className)}>
      {(title || actions) && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            {title && (
              <h2 id={headingId} className="text-lg font-semibold text-foreground">
                {title}
              </h2>
            )}
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
      {footer && <div className="flex justify-end gap-3">{footer}</div>}
    </section>
  );
}
