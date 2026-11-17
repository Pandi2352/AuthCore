import { forwardRef, type HTMLAttributes } from 'react';

import { cn, variants } from '@/lib/utils';
import type { BadgeTone } from '@/types/config.types';

const badgeVariants = variants({
  base: 'inline-flex max-w-full items-center gap-1.5 rounded-md border font-medium whitespace-nowrap [&_svg]:size-3',
  variants: {
    variant: { soft: '', solid: 'border-transparent', outline: 'bg-transparent' },
    tone: { neutral: '', primary: '', success: '', warning: '', danger: '', info: '' },
    size: { sm: 'px-1.5 py-0 text-[11px] leading-5', md: 'px-2 py-0.5 text-xs' },
  },
  compoundVariants: [
    { variant: 'soft', tone: 'neutral', className: 'border-border bg-muted text-muted-foreground' },
    {
      variant: 'soft',
      tone: 'primary',
      className: 'border-primary/25 bg-primary-soft text-primary-soft-foreground',
    },
    {
      variant: 'soft',
      tone: 'success',
      className: 'border-success/25 bg-success-soft text-success-soft-foreground',
    },
    {
      variant: 'soft',
      tone: 'warning',
      className: 'border-warning/25 bg-warning-soft text-warning-soft-foreground',
    },
    {
      variant: 'soft',
      tone: 'danger',
      className: 'border-danger/25 bg-danger-soft text-danger-soft-foreground',
    },
    {
      variant: 'soft',
      tone: 'info',
      className: 'border-info/25 bg-info-soft text-info-soft-foreground',
    },
    { variant: 'solid', tone: 'neutral', className: 'bg-foreground text-background' },
    { variant: 'solid', tone: 'primary', className: 'bg-primary text-primary-foreground' },
    { variant: 'solid', tone: 'success', className: 'bg-success text-success-foreground' },
    { variant: 'solid', tone: 'warning', className: 'bg-warning text-warning-foreground' },
    { variant: 'solid', tone: 'danger', className: 'bg-danger text-danger-foreground' },
    { variant: 'solid', tone: 'info', className: 'bg-info text-info-foreground' },
    { variant: 'outline', tone: 'neutral', className: 'border-border text-foreground' },
    { variant: 'outline', tone: 'primary', className: 'border-primary text-primary' },
    { variant: 'outline', tone: 'success', className: 'border-success text-success' },
    { variant: 'outline', tone: 'warning', className: 'border-warning text-warning' },
    { variant: 'outline', tone: 'danger', className: 'border-danger text-danger' },
    { variant: 'outline', tone: 'info', className: 'border-info text-info' },
  ],
  defaultVariants: { variant: 'soft', tone: 'neutral', size: 'md' },
});

const DOT: Record<BadgeTone, string> = {
  neutral: 'bg-muted-foreground',
  primary: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  /** Color meaning. */
  tone?: BadgeTone;
  variant?: 'soft' | 'solid' | 'outline';
  size?: 'sm' | 'md';
  /** Small status dot before the text. */
  dot?: boolean;
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { tone = 'neutral', variant = 'soft', size, dot = false, className, children, ...props },
  ref,
) {
  return (
    <span ref={ref} className={badgeVariants({ variant, tone, size, className })} {...props}>
      {dot && (
        <span
          className={cn(
            'size-1.5 shrink-0 rounded-full',
            variant === 'solid' ? 'bg-current' : DOT[tone],
          )}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
});
