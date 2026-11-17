import { forwardRef, type HTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

export interface ScrollAreaProps extends HTMLAttributes<HTMLDivElement> {
  orientation?: 'vertical' | 'horizontal' | 'both';
  /** Max height (any CSS length) before it scrolls, e.g. "20rem". */
  maxHeight?: string;
}

/**
 * Scroll container with thin themed scrollbars. Native scrolling (keyboard, touch, wheel,
 * screen readers) — only the look changes. Focusable so keyboard users can scroll it.
 */
export const ScrollArea = forwardRef<HTMLDivElement, ScrollAreaProps>(function ScrollArea(
  { orientation = 'vertical', maxHeight, className, style, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      tabIndex={0}
      className={cn(
        'scrollbar-slim rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        orientation === 'vertical' && 'overflow-x-hidden overflow-y-auto',
        orientation === 'horizontal' && 'overflow-x-auto overflow-y-hidden',
        orientation === 'both' && 'overflow-auto',
        className,
      )}
      style={{ maxHeight, ...style }}
      {...props}
    />
  );
});
