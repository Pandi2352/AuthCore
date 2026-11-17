import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import {
  forwardRef,
  type HTMLAttributes,
  type ReactNode,
  type TdHTMLAttributes,
  type ThHTMLAttributes,
} from 'react';

import { cn } from '@/lib/utils';

import { Skeleton } from '../skeleton';

export interface TableProps extends HTMLAttributes<HTMLTableElement> {
  /** Header row stays visible while the table body scrolls (set a max height on the wrapper). */
  stickyHeader?: boolean;
  /** Classes / max height for the scroll wrapper. */
  wrapperClassName?: string;
  density?: 'compact' | 'normal';
}

/** Table primitives. Narrow screens scroll horizontally inside the wrapper (no page scroll). */
export const Table = forwardRef<HTMLTableElement, TableProps>(function Table(
  { stickyHeader = false, wrapperClassName, density = 'normal', className, ...props },
  ref,
) {
  return (
    <div
      className={cn(
        'relative w-full scrollbar-thin overflow-auto rounded-md border border-border',
        wrapperClassName,
      )}
      data-sticky-header={stickyHeader || undefined}
      data-density={density}
    >
      <table
        ref={ref}
        className={cn('w-full caption-bottom border-collapse text-sm', className)}
        {...props}
      />
    </div>
  );
});

export function TableHeader({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn(
        'bg-muted [[data-sticky-header]_&]:sticky [[data-sticky-header]_&]:top-0 [[data-sticky-header]_&]:z-10',
        className,
      )}
      {...props}
    />
  );
}

export function TableBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn('[&_tr:last-child]:border-0', className)} {...props} />;
}

export function TableRow({
  className,
  selected,
  ...props
}: HTMLAttributes<HTMLTableRowElement> & { selected?: boolean }) {
  return (
    <tr
      aria-selected={selected}
      data-state={selected ? 'selected' : undefined}
      className={cn(
        'border-b border-border transition-colors hover:bg-muted/50 data-[state=selected]:bg-primary-soft',
        props.onClick && 'cursor-pointer',
        className,
      )}
      {...props}
    />
  );
}

export type SortDirection = 'asc' | 'desc' | false;

export interface TableHeadProps extends ThHTMLAttributes<HTMLTableCellElement> {
  /** Makes the header a sort button. */
  sortable?: boolean;
  sortDirection?: SortDirection;
  onSort?: () => void;
}

export function TableHead({
  sortable,
  sortDirection = false,
  onSort,
  className,
  children,
  ...props
}: TableHeadProps) {
  const ariaSort =
    sortDirection === 'asc' ? 'ascending' : sortDirection === 'desc' ? 'descending' : 'none';
  return (
    <th
      scope="col"
      aria-sort={sortable ? ariaSort : undefined}
      className={cn(
        'h-10 px-3 text-left align-middle text-xs font-semibold tracking-wide whitespace-nowrap text-muted-foreground uppercase [[data-density=compact]_&]:h-8',
        className,
      )}
      {...props}
    >
      {sortable ? (
        <button
          type="button"
          onClick={onSort}
          className="-mx-1.5 inline-flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-1 uppercase hover:bg-accent hover:text-accent-foreground"
        >
          {children}
          {sortDirection === 'asc' ? (
            <ArrowUp className="size-3.5" aria-hidden="true" />
          ) : sortDirection === 'desc' ? (
            <ArrowDown className="size-3.5" aria-hidden="true" />
          ) : (
            <ArrowUpDown className="size-3.5 opacity-50" aria-hidden="true" />
          )}
        </button>
      ) : (
        children
      )}
    </th>
  );
}

export function TableCell({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn('px-3 py-3 align-middle [[data-density=compact]_&]:py-1.5', className)}
      {...props}
    />
  );
}

export function TableCaption({ className, ...props }: HTMLAttributes<HTMLTableCaptionElement>) {
  return <caption className={cn('py-3 text-sm text-muted-foreground', className)} {...props} />;
}

/** One full-width row: "No users found" + optional action. */
export function TableEmpty({
  colSpan,
  title = 'No results',
  description,
  action,
}: {
  colSpan: number;
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-3 py-12 text-center">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        {action && <div className="mt-4 flex justify-center">{action}</div>}
      </td>
    </tr>
  );
}

/** Skeleton rows while data loads. */
export function TableLoadingRows({ rows = 5, columns }: { rows?: number; columns: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_row, r) => (
        <tr key={r} className="border-b border-border" aria-hidden="true">
          {Array.from({ length: columns }, (_cell, c) => (
            <td key={c} className="px-3 py-3">
              <Skeleton className={cn('h-4', c === 0 ? 'w-3/4' : 'w-1/2')} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
