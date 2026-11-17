import type { HTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

const TONE = {
  primary: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
} as const;
const SIZE = { sm: 'h-1', md: 'h-2', lg: 'h-3' } as const;

export interface ProgressProps extends HTMLAttributes<HTMLDivElement> {
  /** 0–max. Omit (or null) for an indeterminate bar. */
  value?: number | null;
  max?: number;
  tone?: keyof typeof TONE;
  size?: keyof typeof SIZE;
  /** Accessible name, e.g. "Upload progress". */
  label?: string;
  /** Show "45%" next to the bar. */
  showValue?: boolean;
}

export function Progress({
  value = null,
  max = 100,
  tone = 'primary',
  size = 'md',
  label,
  showValue = false,
  className,
  ...props
}: ProgressProps) {
  const isIndeterminate = value === null;
  const percent = isIndeterminate ? 0 : Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className={cn('flex items-center gap-3', className)} {...props}>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={isIndeterminate ? undefined : value}
        aria-busy={isIndeterminate || undefined}
        className={cn('relative w-full overflow-hidden rounded-md bg-muted', SIZE[size])}
      >
        <div
          className={cn(
            'h-full rounded-md transition-[width]',
            TONE[tone],
            isIndeterminate &&
              'absolute w-1/3 animate-[progress-indeterminate_1.2s_ease-in-out_infinite]',
          )}
          style={isIndeterminate ? undefined : { width: `${percent}%` }}
        />
      </div>
      {showValue && !isIndeterminate && (
        <span className="w-10 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
          {Math.round(percent)}%
        </span>
      )}
    </div>
  );
}
