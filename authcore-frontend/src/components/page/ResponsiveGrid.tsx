import type { HTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

type Cols = 1 | 2 | 3 | 4 | 5 | 6;

// Literal class names so Tailwind generates them.
const BASE: Record<Cols, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-5',
  6: 'grid-cols-6',
};
const SM: Record<Cols, string> = {
  1: 'sm:grid-cols-1',
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-3',
  4: 'sm:grid-cols-4',
  5: 'sm:grid-cols-5',
  6: 'sm:grid-cols-6',
};
const MD: Record<Cols, string> = {
  1: 'md:grid-cols-1',
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-3',
  4: 'md:grid-cols-4',
  5: 'md:grid-cols-5',
  6: 'md:grid-cols-6',
};
const LG: Record<Cols, string> = {
  1: 'lg:grid-cols-1',
  2: 'lg:grid-cols-2',
  3: 'lg:grid-cols-3',
  4: 'lg:grid-cols-4',
  5: 'lg:grid-cols-5',
  6: 'lg:grid-cols-6',
};
const XL: Record<Cols, string> = {
  1: 'xl:grid-cols-1',
  2: 'xl:grid-cols-2',
  3: 'xl:grid-cols-3',
  4: 'xl:grid-cols-4',
  5: 'xl:grid-cols-5',
  6: 'xl:grid-cols-6',
};
const DEFAULT_COLS = { base: 1, sm: 2, lg: 3 } as const;
const GAP = { sm: 'gap-3', md: 'gap-4', lg: 'gap-6' } as const;

export interface ResponsiveGridProps extends HTMLAttributes<HTMLDivElement> {
  /** Columns per breakpoint, mobile first: { base: 1, md: 2, xl: 3 }. */
  cols?: { base?: Cols; sm?: Cols; md?: Cols; lg?: Cols; xl?: Cols };
  gap?: keyof typeof GAP;
}

/** Card / stat grid: one column on phones, more as space allows. */
export function ResponsiveGrid({
  cols = DEFAULT_COLS,
  gap = 'md',
  className,
  ...props
}: ResponsiveGridProps) {
  return (
    <div
      className={cn(
        'grid',
        BASE[cols.base ?? 1],
        cols.sm && SM[cols.sm],
        cols.md && MD[cols.md],
        cols.lg && LG[cols.lg],
        cols.xl && XL[cols.xl],
        GAP[gap],
        className,
      )}
      {...props}
    />
  );
}
