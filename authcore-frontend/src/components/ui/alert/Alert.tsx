import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import type { HTMLAttributes, ReactNode } from 'react';

import { cn, variants } from '@/lib/utils';

const alertVariants = variants({
  base: 'relative flex items-start gap-3 rounded-md border p-4 text-sm [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:shrink-0',
  variants: {
    variant: {
      info: 'border-info/25 bg-info-soft text-info-soft-foreground',
      success: 'border-success/25 bg-success-soft text-success-soft-foreground',
      warning: 'border-warning/25 bg-warning-soft text-warning-soft-foreground',
      danger: 'border-danger/25 bg-danger-soft text-danger-soft-foreground',
      neutral: 'border-border bg-muted text-foreground',
    },
  },
  defaultVariants: { variant: 'info' },
});

export type AlertVariant = 'info' | 'success' | 'warning' | 'danger' | 'neutral';

const ICONS: Record<AlertVariant, ReactNode> = {
  info: <Info aria-hidden="true" />,
  success: <CheckCircle2 aria-hidden="true" />,
  warning: <AlertTriangle aria-hidden="true" />,
  danger: <AlertCircle aria-hidden="true" />,
  neutral: <Info aria-hidden="true" />,
};

export interface AlertProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  variant?: AlertVariant;
  title?: ReactNode;
  message?: ReactNode;
  /** Custom icon; `false` hides it. */
  icon?: ReactNode | false;
  /** Button / link on the right (e.g. "Retry"). */
  action?: ReactNode;
  /** Shows a close button. */
  onClose?: () => void;
}

/** Inline message. Errors and warnings are announced (role="alert"), the rest politely. */
export function Alert({
  variant = 'info',
  title,
  message,
  icon,
  action,
  onClose,
  className,
  children,
  ...props
}: AlertProps) {
  return (
    <div
      role={variant === 'danger' || variant === 'warning' ? 'alert' : 'status'}
      className={alertVariants({ variant, className })}
      {...props}
    >
      {icon === false ? null : (icon ?? ICONS[variant])}
      <div className="min-w-0 flex-1 space-y-1">
        {title && <p className="leading-snug font-semibold">{title}</p>}
        {message && <p className="leading-snug">{message}</p>}
        {children}
      </div>
      {action && <div className="shrink-0">{action}</div>}
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className={cn(
            'touch-target -m-1 inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md opacity-70 transition-opacity hover:opacity-100',
          )}
          aria-label="Dismiss"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
