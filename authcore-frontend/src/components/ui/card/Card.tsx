import React from 'react';

import { cn } from '@/lib/utils';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  subtitle?: string;
  footer?: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  children,
  className,
  title,
  subtitle,
  footer,
  ...props
}) => {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-md border border-border bg-surface text-surface-foreground shadow-card',
        className,
      )}
      {...props}
    >
      {(title || subtitle) && (
        <div className="border-b border-border px-card py-4">
          {title && <h3 className="text-lg font-semibold text-foreground">{title}</h3>}
          {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
      )}
      <div className="p-card">{children}</div>
      {footer && (
        <div className="flex items-center justify-end gap-3 border-t border-border bg-muted px-card py-3.5">
          {footer}
        </div>
      )}
    </div>
  );
};
