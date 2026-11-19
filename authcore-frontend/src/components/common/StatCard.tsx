import { useId, type ComponentType, type ReactNode } from 'react';

import { Skeleton } from '@/components/ui';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';

export type StatTone = 'primary' | 'info' | 'success' | 'warning' | 'danger' | 'violet' | 'cyan';

/** Background artwork; give each card in a row a different one. */
export type StatPattern =
  'rings' | 'dots' | 'waves' | 'grid' | 'stripes' | 'bubbles' | 'bars' | 'sparkles';

/** Full class names per tone (Tailwind only generates classes it can find in the source). */
const TONE: Record<StatTone, { card: string; icon: string; label: string; art: string }> = {
  primary: {
    card: 'border-primary/20 from-primary-soft',
    icon: 'bg-primary text-primary-foreground',
    label: 'text-primary-soft-foreground',
    art: 'text-primary',
  },
  info: {
    card: 'border-info/20 from-info-soft',
    icon: 'bg-info text-info-foreground',
    label: 'text-info-soft-foreground',
    art: 'text-info',
  },
  success: {
    card: 'border-success/20 from-success-soft',
    icon: 'bg-success text-success-foreground',
    label: 'text-success-soft-foreground',
    art: 'text-success',
  },
  warning: {
    card: 'border-warning/25 from-warning-soft',
    icon: 'bg-warning text-warning-foreground',
    label: 'text-warning-soft-foreground',
    art: 'text-warning',
  },
  danger: {
    card: 'border-danger/20 from-danger-soft',
    icon: 'bg-danger text-danger-foreground',
    label: 'text-danger-soft-foreground',
    art: 'text-danger',
  },
  violet: {
    card: 'border-nav-violet/25 from-nav-violet/10',
    icon: 'bg-nav-violet text-primary-foreground',
    label: 'text-nav-violet',
    art: 'text-nav-violet',
  },
  cyan: {
    card: 'border-nav-cyan/25 from-nav-cyan/10',
    icon: 'bg-nav-cyan text-primary-foreground',
    label: 'text-nav-cyan',
    art: 'text-nav-cyan',
  },
};

/** Decorative SVG on the right side of the card, in the tone color (currentColor). */
function Artwork({ pattern, id }: { pattern: StatPattern; id: string }) {
  const tile = (size: number, body: ReactNode) => (
    <>
      <defs>
        <pattern id={id} width={size} height={size} patternUnits="userSpaceOnUse">
          {body}
        </pattern>
      </defs>
      <rect width="160" height="100" fill={`url(#${id})`} />
    </>
  );
  switch (pattern) {
    case 'rings':
      return (
        <g fill="none" stroke="currentColor" strokeWidth="1.5">
          {[14, 28, 42, 56, 70].map((r) => (
            <circle key={r} cx="150" cy="8" r={r} opacity={1 - r / 90} />
          ))}
        </g>
      );
    case 'dots':
      return tile(12, <circle cx="2" cy="2" r="1.6" fill="currentColor" />);
    case 'waves':
      return (
        <g fill="none" stroke="currentColor" strokeWidth="2">
          {[58, 72, 86].map((y, i) => (
            <path
              key={y}
              d={`M0 ${y} Q20 ${y - 12} 40 ${y} T80 ${y} T120 ${y} T160 ${y}`}
              opacity={0.9 - i * 0.25}
            />
          ))}
        </g>
      );
    case 'grid':
      return tile(14, <path d="M14 0H0V14" fill="none" stroke="currentColor" strokeWidth="1" />);
    case 'stripes':
      return tile(
        10,
        <path d="M-2 12 12 -2M8 12 12 8M-2 2 2 -2" stroke="currentColor" strokeWidth="2" />,
      );
    case 'bubbles':
      return (
        <g fill="currentColor">
          <circle cx="138" cy="20" r="26" opacity="0.55" />
          <circle cx="104" cy="72" r="16" opacity="0.4" />
          <circle cx="150" cy="80" r="10" opacity="0.7" />
          <circle cx="86" cy="18" r="6" opacity="0.5" />
        </g>
      );
    case 'bars':
      return (
        <g fill="currentColor">
          {[30, 46, 38, 62, 54, 78].map((h, i) => (
            <rect
              key={`bar-${String(h)}`}
              x={70 + i * 15}
              y={100 - h}
              width="9"
              height={h}
              rx="2"
              opacity={0.35 + i * 0.1}
            />
          ))}
        </g>
      );
    case 'sparkles':
      return (
        <g fill="currentColor">
          {[
            [136, 22, 9],
            [100, 60, 6],
            [148, 70, 5],
            [116, 30, 3.5],
            [84, 24, 4],
          ].map(([x = 0, y = 0, s = 0]) => (
            <path
              key={`${x}-${y}`}
              d={`M${x} ${y - s} Q${x} ${y} ${x + s} ${y} Q${x} ${y} ${x} ${y + s} Q${x} ${y} ${x - s} ${y} Q${x} ${y} ${x} ${y - s}Z`}
            />
          ))}
        </g>
      );
  }
}

/**
 * A light, colorful count card: soft tinted wash, solid icon tile and its own background
 * artwork (`pattern`). `value` null shows a skeleton; text values use a smaller size.
 */
export function StatCard({
  tone,
  pattern = 'rings',
  icon: Icon,
  label,
  value,
  hint,
  selected,
  onClick,
}: {
  tone: StatTone;
  pattern?: StatPattern;
  icon: ComponentType<{ className?: string }>;
  label: string;
  /** A count, or text (e.g. a category name); null shows a skeleton. */
  value: number | ReactNode | null;
  hint?: ReactNode;
  /** Clickable card (e.g. filters a table); shown as pressed while selected. */
  selected?: boolean;
  onClick?: () => void;
}) {
  const t = TONE[tone];
  // useId has characters (: « ») that break url(#…) references.
  const patternId = `stat-${useId().replace(/[^\w-]/g, '')}`;
  const Root = onClick ? 'button' : 'div';
  return (
    <Root
      {...(onClick ? { type: 'button' as const, onClick, 'aria-pressed': selected ?? false } : {})}
      className={cn(
        'group relative flex w-full items-center gap-3.5 overflow-hidden rounded-md border bg-linear-to-br to-surface p-4 text-left transition-transform hover:-translate-y-0.5 motion-reduce:hover:translate-y-0',
        t.card,
        onClick &&
          'cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        // Selected: a ring in the card's own color.
        selected && cn('ring-2 ring-current ring-offset-2 ring-offset-background', t.art),
      )}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 160 100"
        preserveAspectRatio="xMaxYMid slice"
        className={cn(
          'pointer-events-none absolute inset-y-0 right-0 h-full w-3/5 [mask-image:linear-gradient(to_left,black_40%,transparent)] opacity-20 transition-transform duration-300 group-hover:scale-105',
          t.art,
        )}
      >
        <Artwork pattern={pattern} id={patternId} />
      </svg>
      <span
        className={cn(
          'relative flex size-11 shrink-0 items-center justify-center rounded-md shadow-card',
          t.icon,
        )}
      >
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <div className="relative min-w-0">
        <p className={cn('truncate text-xs font-semibold', t.label)}>{label}</p>
        {value === null ? (
          <Skeleton className="my-1 h-7 w-12" />
        ) : typeof value === 'number' ? (
          <p className="text-2xl leading-tight font-bold text-foreground tabular-nums">
            {formatNumber(value)}
          </p>
        ) : (
          <p className="truncate py-0.5 text-base leading-tight font-bold text-foreground">
            {value}
          </p>
        )}
        {hint && <p className="truncate text-xs text-muted-foreground">{hint}</p>}
      </div>
    </Root>
  );
}
