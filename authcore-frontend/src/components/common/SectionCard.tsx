import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export type SectionTone = 'primary' | 'warning' | 'violet' | 'success' | 'cyan' | 'info' | 'danger';

/** Full class names per tone (Tailwind only generates classes it can find in the source). */
const TONE: Record<SectionTone, { box: string; head: string; icon: string }> = {
  primary: {
    box: 'border-primary/30 border-l-primary',
    head: 'bg-primary-soft/60',
    icon: 'bg-primary text-primary-foreground',
  },
  warning: {
    box: 'border-warning/35 border-l-warning',
    head: 'bg-warning-soft/60',
    icon: 'bg-warning text-warning-foreground',
  },
  violet: {
    box: 'border-nav-violet/30 border-l-nav-violet',
    head: 'bg-nav-violet/10',
    icon: 'bg-nav-violet text-primary-foreground',
  },
  success: {
    box: 'border-success/30 border-l-success',
    head: 'bg-success-soft/60',
    icon: 'bg-success text-success-foreground',
  },
  cyan: {
    box: 'border-nav-cyan/30 border-l-nav-cyan',
    head: 'bg-nav-cyan/10',
    icon: 'bg-nav-cyan text-primary-foreground',
  },
  info: {
    box: 'border-info/30 border-l-info',
    head: 'bg-info-soft/60',
    icon: 'bg-info text-info-foreground',
  },
  danger: {
    box: 'border-danger/30 border-l-danger',
    head: 'bg-danger-soft/60',
    icon: 'bg-danger text-danger-foreground',
  },
};

/**
 * A form / settings card with its own light color: tinted header with a solid icon tile, a
 * colored left edge, then the content. Used by Create user, Password policy and Settings so
 * every form page looks the same.
 */
export function SectionCard({
  title,
  description,
  icon,
  tone,
  aside,
  className,
  bodyClassName,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  icon: ReactNode;
  tone: SectionTone;
  /** Right side of the header (a button, a badge …). */
  aside?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  const t = TONE[tone];
  return (
    <section
      aria-label={typeof title === 'string' ? title : undefined}
      className={cn('overflow-hidden rounded-md border border-l-4 bg-surface', t.box, className)}
    >
      <header className={cn('flex items-start gap-3 px-card py-3', t.head)}>
        <span
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-md shadow-card [&_svg]:size-4.5',
            t.icon,
          )}
        >
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {aside && <div className="shrink-0 self-center">{aside}</div>}
      </header>
      <div className={cn('p-card', bodyClassName)}>{children}</div>
    </section>
  );
}
