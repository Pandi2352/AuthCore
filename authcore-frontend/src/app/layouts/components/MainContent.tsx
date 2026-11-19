import type { ReactNode } from 'react';

import { layoutConfig } from '@/config';
import { cn } from '@/lib/utils';

const PADDING = {
  compact: 'px-2 py-4 sm:px-3',
  comfortable: 'px-2 py-page sm:px-4 lg:px-6',
  spacious: 'px-3 py-8 sm:px-6 lg:px-8',
} as const;

/** <main> landmark: skip-link target, content width and padding from layout.config.ts. */
export function MainContent({ children, className }: { children: ReactNode; className?: string }) {
  const { padding } = layoutConfig.content;
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className={cn('flex flex-1 flex-col outline-none', className)}
    >
      <div
        className={cn(
          'mx-auto flex w-full flex-1 flex-col',
          // Content width: theme appearance.contentWidth → --content-max-width (fluid / 88 % / 72 %).
          'max-w-(--content-max-width)',
          PADDING[padding],
          // Full-bleed pages (status / coming soon / crash): background to the edges.
          'has-[[data-full-bleed]]:max-w-none has-[[data-full-bleed]]:p-0',
        )}
      >
        {children}
      </div>
    </main>
  );
}
