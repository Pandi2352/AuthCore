import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { useId } from 'react';

import { cn } from '@/lib/utils';

import { Button } from '../button';
import { Select } from '../select';
import { pageRange } from './page-range';

const DEFAULT_PAGE_SIZES = [10, 20, 50, 100];

export interface PaginationProps {
  /** 1-based current page. */
  page: number;
  /** Total number of items (pageCount is derived). */
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  /** Shows a page-size picker when provided. */
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  /** Hide the "1–10 of 95" text. */
  hideSummary?: boolean;
  className?: string;
}

/** Page navigation with summary and page-size picker (works with API PaginationMeta). */
export function Pagination({
  page,
  total,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = DEFAULT_PAGE_SIZES,
  hideSummary = false,
  className,
}: PaginationProps) {
  const sizeLabelId = useId();
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(page, 1), pageCount);
  const from = total === 0 ? 0 : (current - 1) * pageSize + 1;
  const to = Math.min(current * pageSize, total);
  const go = (target: number) => {
    const next = Math.min(Math.max(target, 1), pageCount);
    if (next !== current) onPageChange(next);
  };

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-between gap-3 text-sm sm:flex-row',
        className,
      )}
    >
      <div className="flex items-center gap-3 text-muted-foreground">
        {!hideSummary && (
          <span aria-live="polite">
            {from}–{to} of {total}
          </span>
        )}
        {onPageSizeChange && (
          <div className="flex items-center gap-2">
            <span id={sizeLabelId}>Rows per page</span>
            <div className="w-20">
              <Select
                size="sm"
                aria-labelledby={sizeLabelId}
                value={String(pageSize)}
                onValueChange={(v) => v && onPageSizeChange(Number(v))}
                options={pageSizeOptions.map((n) => ({ value: String(n), label: String(n) }))}
              />
            </div>
          </div>
        )}
      </div>
      <nav aria-label="Pagination" className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => go(1)}
          disabled={current === 1}
          aria-label="First page"
        >
          <ChevronsLeft />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => go(current - 1)}
          disabled={current === 1}
          aria-label="Previous page"
        >
          <ChevronLeft />
        </Button>
        <ul className="hidden items-center gap-1 sm:flex">
          {pageRange(current, pageCount).map((item, index, all) =>
            item === 'ellipsis' ? (
              <li
                key={index < all.length / 2 ? 'ellipsis-start' : 'ellipsis-end'}
                className="px-1 text-muted-foreground"
                aria-hidden="true"
              >
                …
              </li>
            ) : (
              <li key={item}>
                <Button
                  variant={item === current ? 'outline' : 'ghost'}
                  size="icon-sm"
                  onClick={() => go(item)}
                  aria-label={`Page ${item}`}
                  aria-current={item === current ? 'page' : undefined}
                  className={cn(item === current && 'border-primary text-primary')}
                >
                  {item}
                </Button>
              </li>
            ),
          )}
        </ul>
        <span className="px-2 text-muted-foreground sm:hidden">
          {current} / {pageCount}
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => go(current + 1)}
          disabled={current === pageCount}
          aria-label="Next page"
        >
          <ChevronRight />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => go(pageCount)}
          disabled={current === pageCount}
          aria-label="Last page"
        >
          <ChevronsRight />
        </Button>
      </nav>
    </div>
  );
}
