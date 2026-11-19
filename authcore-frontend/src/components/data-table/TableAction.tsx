import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

import { Tooltip } from '@/components/ui';
import { cn } from '@/lib/utils';

export type TableActionTone =
  'primary' | 'info' | 'success' | 'warning' | 'danger' | 'violet' | 'cyan' | 'neutral';

/** Full class names per tone (Tailwind only generates classes it can find in the source). */
const TONE: Record<TableActionTone, string> = {
  primary: 'border-primary/40 text-primary hover:border-primary hover:bg-primary-soft',
  info: 'border-info/40 text-info hover:border-info hover:bg-info-soft',
  success: 'border-success/40 text-success hover:border-success hover:bg-success-soft',
  warning: 'border-warning/50 text-warning hover:border-warning hover:bg-warning-soft',
  danger: 'border-danger/40 text-danger hover:border-danger hover:bg-danger-soft',
  violet: 'border-nav-violet/40 text-nav-violet hover:border-nav-violet hover:bg-nav-violet/10',
  cyan: 'border-nav-cyan/40 text-nav-cyan hover:border-nav-cyan hover:bg-nav-cyan/10',
  neutral: 'border-border text-muted-foreground hover:bg-accent hover:text-foreground',
};

export interface TableActionProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'children'
> {
  /** Accessible name (say which row, e.g. "Edit Support Manager"). */
  label: string;
  /** Short tooltip, e.g. "Edit" (defaults to `label`). */
  tooltip?: string;
  icon: ReactNode;
  /**
   * One color per kind of action, the same in every table: info = view, primary = edit,
   * danger = delete, success = assign permissions, warning = assign roles / members,
   * violet = permission matrix, cyan = resend.
   */
  tone?: TableActionTone;
  /** Visible text next to the icon (e.g. "Assign"); icon-only when omitted. */
  text?: string;
  /** Turn off the tooltip (e.g. when used as a menu trigger). */
  showTooltip?: boolean;
  /** Shown but unavailable: dimmed, does nothing, and the tooltip explains why. */
  disabledReason?: string;
}

/**
 * The action button of every table row: small, color-outlined icon button with a tooltip.
 * Same look in all tables (users, roles, groups, invites, schemas …).
 */
export const TableAction = forwardRef<HTMLButtonElement, TableActionProps>(function TableAction(
  {
    label,
    tooltip,
    icon,
    tone = 'neutral',
    text,
    showTooltip = true,
    disabledReason,
    className,
    type = 'button',
    onClick,
    ...props
  },
  ref,
) {
  const button = (
    <button
      ref={ref}
      type={type}
      aria-label={disabledReason ? `${label} (${disabledReason})` : label}
      // aria-disabled, not disabled: a disabled button gets no hover, so no tooltip.
      aria-disabled={disabledReason ? true : undefined}
      onClick={disabledReason ? undefined : onClick}
      className={cn(
        'inline-flex h-7 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-md border bg-surface text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-45 aria-disabled:cursor-not-allowed aria-disabled:opacity-45 aria-disabled:hover:bg-surface pointer-coarse:h-11 [&_svg]:size-3.5 [&_svg]:shrink-0',
        text ? 'px-2.5' : 'w-7 pointer-coarse:w-11',
        TONE[tone],
        className,
      )}
      {...props}
    >
      {icon}
      {text && <span>{text}</span>}
    </button>
  );
  return showTooltip && (!text || disabledReason) ? (
    <Tooltip content={disabledReason ?? tooltip ?? label}>{button}</Tooltip>
  ) : (
    button
  );
});
