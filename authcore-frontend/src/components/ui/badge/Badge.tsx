import React from 'react';

import { cn } from '@/lib/utils';
import type { BadgeTone } from '@/types/config.types';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeTone;
}

const variants: Record<BadgeTone, string> = {
  neutral: 'border-border bg-muted text-muted-foreground',
  primary: 'border-primary/25 bg-primary-soft text-primary-soft-foreground',
  success: 'border-success/25 bg-success-soft text-success-soft-foreground',
  warning: 'border-warning/25 bg-warning-soft text-warning-soft-foreground',
  danger: 'border-danger/25 bg-danger-soft text-danger-soft-foreground',
  info: 'border-info/25 bg-info-soft text-info-soft-foreground',
};

export const Badge: React.FC<BadgeProps> = ({
  children,
  className,
  variant = 'neutral',
  ...props
}) => (
  <span
    className={cn(
      'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium',
      variants[variant],
      className,
    )}
    {...props}
  >
    {children}
  </span>
);
