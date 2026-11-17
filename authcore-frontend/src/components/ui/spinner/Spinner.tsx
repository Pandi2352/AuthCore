import { Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';

const SIZE = { xs: 'size-3', sm: 'size-4', md: 'size-5', lg: 'size-8' } as const;

export interface SpinnerProps {
  size?: keyof typeof SIZE;
  /** Screen-reader text (role="status"). Pass null when a parent already announces it. */
  label?: string | null;
  className?: string;
}

export function Spinner({ size = 'md', label = 'Loading', className }: SpinnerProps) {
  return (
    <span role={label ? 'status' : undefined} className={cn('inline-flex', className)}>
      <Loader2 className={cn('animate-spin', SIZE[size])} aria-hidden="true" />
      {label && <span className="sr-only">{label}</span>}
    </span>
  );
}
