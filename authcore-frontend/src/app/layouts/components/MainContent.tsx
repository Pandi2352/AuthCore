import type { ReactNode } from 'react';

import { layoutConfig } from '@/config';
import { cn } from '@/lib/utils';

const WIDTH = {
  full: 'max-w-none',
  container: 'max-w-(--content-max-width)',
  narrow: 'max-w-3xl',
} as const;
const PADDING = {
  compact: 'px-3 py-4 sm:px-4',
  comfortable: 'px-4 py-page sm:px-6 lg:px-8',
  spacious: 'px-5 py-8 sm:px-8 lg:px-12',
} as const;

/** <main> landmark: skip-link target, content width and padding from layout.config.ts. */
export function MainContent({ children, className }: { children: ReactNode; className?: string }) {
  const { maxWidth, padding } = layoutConfig.content;
  return (
    <main id="main-content" tabIndex={-1} className={cn('flex-1 outline-none', className)}>
      <div className={cn('mx-auto w-full', WIDTH[maxWidth], PADDING[padding])}>{children}</div>
    </main>
  );
}
