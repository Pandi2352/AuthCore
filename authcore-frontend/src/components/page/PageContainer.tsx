import type { HTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

const WIDTH = {
  /** As wide as the layout allows (layout.config.ts → content.maxWidth). */
  default: '',
  /** Forms and settings pages. */
  narrow: 'mx-auto max-w-3xl',
  /** Reading width. */
  prose: 'mx-auto max-w-prose',
  full: 'max-w-none',
} as const;

export interface PageContainerProps extends HTMLAttributes<HTMLDivElement> {
  width?: keyof typeof WIDTH;
}

/**
 * Page wrapper: consistent vertical rhythm between header and sections (density token) and
 * an optional narrower width. Outer width / padding come from the layout (MainContent).
 */
export function PageContainer({ width = 'default', className, ...props }: PageContainerProps) {
  return (
    <div className={cn('flex w-full flex-col gap-section', WIDTH[width], className)} {...props} />
  );
}
