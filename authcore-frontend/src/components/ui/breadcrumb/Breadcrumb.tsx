import { ChevronRight, MoreHorizontal } from 'lucide-react';
import {
  forwardRef,
  type AnchorHTMLAttributes,
  type HTMLAttributes,
  type LiHTMLAttributes,
} from 'react';

import { cn } from '@/lib/utils';

import { Slot } from '../primitives/Slot';

/**
 * Composable breadcrumb trail. Router-agnostic: wrap router links with asChild:
 *   <BreadcrumbLink asChild><Link to={paths.dashboard}>Home</Link></BreadcrumbLink>
 */
export function Breadcrumb({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <nav aria-label="Breadcrumb" className={className} {...props} />;
}

export function BreadcrumbList({ className, ...props }: HTMLAttributes<HTMLOListElement>) {
  return (
    <ol
      className={cn(
        'flex min-w-0 flex-wrap items-center gap-1.5 text-sm text-muted-foreground',
        className,
      )}
      {...props}
    />
  );
}

export function BreadcrumbItem({ className, ...props }: LiHTMLAttributes<HTMLLIElement>) {
  return <li className={cn('inline-flex min-w-0 items-center gap-1.5', className)} {...props} />;
}

export const BreadcrumbLink = forwardRef<
  HTMLAnchorElement,
  AnchorHTMLAttributes<HTMLAnchorElement> & { asChild?: boolean }
>(function BreadcrumbLink({ asChild, className, ...props }, ref) {
  const Comp = asChild ? Slot : 'a';
  return (
    <Comp
      ref={ref}
      className={cn(
        'cursor-pointer truncate rounded-md transition-colors hover:text-foreground',
        className,
      )}
      {...props}
    />
  );
});

/** The current page (not a link). */
export function BreadcrumbPage({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      aria-current="page"
      className={cn('truncate font-medium text-foreground', className)}
      {...props}
    />
  );
}

export function BreadcrumbSeparator({ className, ...props }: LiHTMLAttributes<HTMLLIElement>) {
  return (
    <li
      role="presentation"
      aria-hidden="true"
      className={cn('[&_svg]:size-3.5', className)}
      {...props}
    >
      <ChevronRight />
    </li>
  );
}

/** "…" for collapsed middle items. */
export function BreadcrumbEllipsis({ className }: { className?: string }) {
  return (
    <span className={cn('flex size-5 items-center justify-center', className)}>
      <MoreHorizontal className="size-4" aria-hidden="true" />
      <span className="sr-only">More pages</span>
    </span>
  );
}
