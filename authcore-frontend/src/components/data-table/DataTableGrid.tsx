import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import {
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
} from 'react';

import { Checkbox, Skeleton } from '@/components/ui';
import { cn } from '@/lib/utils';

import type { DataTableColumn, TableDensity } from './types';
import type { ServerTable } from './use-server-table';
import { MIN_COLUMN_WIDTH, type TableLayoutApi } from './use-table-layout';

const SELECT_WIDTH = 48;
const ACTIONS_WIDTH = 96;

/** Cell padding / text per density. Never below 13 px; touch screens get at least 44 px rows. */
const CELL: Record<TableDensity, string> = {
  compact: 'py-1.5 text-[13px] pointer-coarse:py-2.5',
  comfortable: 'py-2.5 text-sm',
  spacious: 'py-4 text-sm',
};

/** Text width in px for a CSS font (one shared canvas). */
let measureCanvas: HTMLCanvasElement | null = null;
function textWidth(text: string, font: string): number {
  measureCanvas ??= document.createElement('canvas');
  const ctx = measureCanvas.getContext('2d');
  if (!ctx) return text.length * 8;
  ctx.font = font;
  return ctx.measureText(text).width;
}

/** Widths of `fitText` columns: widest line (semibold 14px) or header, plus cell padding. */
function measureFitText<T>(
  columns: DataTableColumn<T>[],
  rows: readonly T[],
): Record<string, number> {
  const widths: Record<string, number> = {};
  if (rows.length === 0 || typeof document === 'undefined') return widths;
  const family = getComputedStyle(document.body).fontFamily;
  for (const c of columns) {
    if (!c.fitText) continue;
    const cellFont = `600 14px ${family}`;
    let widest = textWidth(String(c.header).toUpperCase(), `600 12px ${family}`) * 1.1 + 20;
    for (const row of rows) {
      for (const line of c.fitText(row)) widest = Math.max(widest, textWidth(line, cellFont));
    }
    // 24 px cell padding + a little room; never wider than `width`.
    widths[c.id] = Math.min(Math.ceil(widest) + 30, c.width ?? 360);
  }
  return widths;
}

const alignClass = <T,>(c: DataTableColumn<T>) =>
  c.numeric || c.align === 'right'
    ? 'text-right tabular-nums'
    : c.align === 'center'
      ? 'text-center'
      : 'text-left';

const isInteractive = (target: EventTarget | null) =>
  target instanceof Element &&
  target.closest('button, a, input, label, select, textarea, [role="menuitem"]') !== null;

export interface DataTableGridProps<T> {
  table: ServerTable<T>;
  columns: DataTableColumn<T>[];
  layout: TableLayoutApi<T>;
  rowLabel: (row: T) => string;
  rowActions?: (row: T) => ReactNode;
  onRowOpen?: (row: T) => void;
  /** Checkbox column (select rows / all on the page). */
  selectable?: boolean;
  actionsWidth?: number;
  /** Shown in the body when there are no rows (first run / no results). */
  empty: ReactNode;
  caption: string;
  /** Cap the height and scroll inside (default: no cap, the page scrolls). */
  maxHeight?: string;
}

/**
 * Desktop grid: native <table> (th scope, aria-sort, aria-selected), sticky header and
 * frozen select + first column, resizable columns (pointer or ← / → on the handle),
 * roving row focus (↑ / ↓ / Home / End, Space selects, Enter opens).
 */
export function DataTableGrid<T>({
  table,
  columns,
  layout,
  rowLabel,
  rowActions,
  onRowOpen,
  selectable = true,
  actionsWidth = ACTIONS_WIDTH,
  empty,
  caption,
  maxHeight,
}: DataTableGridProps<T>) {
  const density = layout.layout.density;
  const [activeRow, setActiveRow] = useState(0);
  const [liveWidths, setLiveWidths] = useState<Record<string, number>>({});
  const bodyRef = useRef<HTMLTableSectionElement | null>(null);
  const baseId = useId();

  const textWidths = useMemo(() => measureFitText(columns, table.rows), [columns, table.rows]);
  const widthOf = (c: DataTableColumn<T>) =>
    textWidths[c.id] ?? liveWidths[c.id] ?? layout.widthOf(c);
  const isFixed = (c: DataTableColumn<T>) => c.fit === true || c.fitText !== undefined;
  const selectWidth = selectable ? SELECT_WIDTH : 0;
  const tableWidth =
    selectWidth + columns.reduce((sum, c) => sum + widthOf(c), 0) + (rowActions ? actionsWidth : 0);
  // Fixed columns (checkbox, actions) keep their px width; data columns share the rest in
  // proportion to their configured / resized widths.
  const fittedWidth = columns.filter(isFixed).reduce((sum, c) => sum + widthOf(c), 0);
  const fixedWidth = selectWidth + (rowActions ? actionsWidth : 0) + fittedWidth;
  const dataWidth = Math.max(1, tableWidth - fixedWidth);
  const shareOf = (c: DataTableColumn<T>) =>
    isFixed(c)
      ? `${widthOf(c)}px`
      : `calc((100% - ${fixedWidth}px) * ${(widthOf(c) / dataWidth).toFixed(4)})`;
  const sortRules = table.query.sort;
  const { rows } = table;
  const colSpan = columns.length + (selectable ? 1 : 0) + (rowActions ? 1 : 0);
  const allOnPage = table.pageRowCount > 0 && table.selectedOnPage === table.pageRowCount;
  const someOnPage = table.selectedOnPage > 0 && !allOnPage;

  // ---- resizing
  const startResize = (column: DataTableColumn<T>, event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    const handle = event.currentTarget;
    const startX = event.clientX;
    const startWidth = widthOf(column);
    handle.setPointerCapture(event.pointerId);
    const widthAt = (x: number) => Math.max(MIN_COLUMN_WIDTH, startWidth + x - startX);
    const move = (e: PointerEvent) =>
      setLiveWidths((w) => ({ ...w, [column.id]: widthAt(e.clientX) }));
    const up = (e: PointerEvent) => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      layout.setWidth(column.id, widthAt(e.clientX));
      setLiveWidths((w) => {
        const next = { ...w };
        delete next[column.id];
        return next;
      });
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
  };

  // ---- keyboard: rows
  const rowElements = () =>
    Array.from(bodyRef.current?.querySelectorAll<HTMLTableRowElement>('tr[data-row]') ?? []);
  const onBodyKeyDown = (event: ReactKeyboardEvent<HTMLTableSectionElement>) => {
    const target = event.target as HTMLElement;
    if (target.tagName !== 'TR') return;
    const list = rowElements();
    const index = list.indexOf(target as HTMLTableRowElement);
    const row = rows[index];
    const focusAt = (i: number) => {
      const next = list[Math.max(0, Math.min(list.length - 1, i))];
      next?.focus();
    };
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        focusAt(index + 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        focusAt(index - 1);
        break;
      case 'Home':
        event.preventDefault();
        focusAt(0);
        break;
      case 'End':
        event.preventDefault();
        focusAt(list.length - 1);
        break;
      case ' ':
        event.preventDefault();
        if (row) table.toggleRow(table.getRowId(row));
        break;
      case 'Enter':
        if (row && onRowOpen) {
          event.preventDefault();
          onRowOpen(row);
        }
        break;
    }
  };
  const onRowClick = (row: T, event: ReactMouseEvent) => {
    if (onRowOpen && !isInteractive(event.target)) onRowOpen(row);
  };

  const sortIcon = (id: string) => {
    const index = sortRules.findIndex((r) => r.id === id);
    const rule = sortRules[index];
    if (!rule) return <ArrowUpDown className="size-3.5 opacity-40" aria-hidden="true" />;
    const Icon = rule.desc ? ArrowDown : ArrowUp;
    return (
      <span className="inline-flex items-center gap-0.5 text-primary">
        <Icon className="size-3.5" aria-hidden="true" />
        {sortRules.length > 1 && (
          <span className="text-[11px] font-semibold tabular-nums" aria-hidden="true">
            {index + 1}
          </span>
        )}
      </span>
    );
  };

  const headCell =
    'border-b border-border bg-muted px-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase';
  const bodyCell = cn('border-b border-border px-3', CELL[density]);

  return (
    <div
      className={cn(
        'relative scrollbar-slim rounded-md border border-border bg-surface',
        // No height cap: every row shows and the page scrolls (no scrollbar in the table).
        maxHeight ? 'overflow-auto' : 'overflow-x-auto overflow-y-hidden',
      )}
      style={{ maxHeight }}
      aria-busy={table.isFetching || undefined}
    >
      {table.isFetching && table.hasLoaded && (
        <div
          aria-hidden="true"
          className="sticky top-0 left-0 z-40 -mb-0.5 h-0.5 w-full overflow-hidden bg-primary-soft"
        >
          <div className="absolute h-full w-1/3 animate-[progress-indeterminate_1.2s_ease-in-out_infinite] bg-primary" />
        </div>
      )}
      <table
        aria-rowcount={table.total + 1}
        className="w-full table-fixed border-separate border-spacing-0"
        // Always exactly as wide as the container: no sideways scrollbar.
        style={{ width: '100%' }}
      >
        <caption className="sr-only">{caption}</caption>
        <colgroup>
          {selectable && <col style={{ width: SELECT_WIDTH }} />}
          {columns.map((c) => (
            <col key={c.id} style={{ width: shareOf(c) }} />
          ))}
          {rowActions && <col style={{ width: actionsWidth }} />}
        </colgroup>
        <thead>
          <tr className="h-10">
            {selectable && (
              <th scope="col" className={cn(headCell, 'sticky top-0 left-0 z-30')}>
                <span className="sr-only">Select</span>
                <span className="flex justify-center">
                  <label
                    htmlFor={`${baseId}-all`}
                    className="inline-flex size-6 cursor-pointer items-center justify-center pointer-coarse:size-11"
                  >
                    <Checkbox
                      id={`${baseId}-all`}
                      aria-label="Select all rows on this page"
                      checked={allOnPage}
                      indeterminate={someOnPage}
                      disabled={table.pageRowCount === 0}
                      onCheckedChange={(on) => table.setPageSelected(on)}
                    />
                  </label>
                </span>
              </th>
            )}
            {columns.map((column, index) => {
              const rule = sortRules.find((r) => r.id === column.id);
              return (
                <th
                  key={column.id}
                  scope="col"
                  aria-sort={
                    column.sortable
                      ? rule
                        ? rule.desc
                          ? 'descending'
                          : 'ascending'
                        : 'none'
                      : undefined
                  }
                  className={cn(
                    headCell,
                    'relative sticky top-0 z-20',
                    alignClass(column),
                    index === 0 && (selectable ? 'left-12 z-30' : 'left-0 z-30'),
                  )}
                >
                  {column.sortable ? (
                    <button
                      type="button"
                      title="Click to sort · Shift+click to sort by more columns"
                      onClick={(e) => table.toggleSort(column.id, e.shiftKey)}
                      className={cn(
                        '-mx-1.5 inline-flex max-w-full cursor-pointer items-center gap-1 rounded-md px-1.5 py-1 uppercase hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-ring',
                        (column.numeric || column.align === 'right') && 'flex-row-reverse',
                        rule && 'text-foreground',
                      )}
                    >
                      <span className="truncate">{column.header}</span>
                      {sortIcon(column.id)}
                    </button>
                  ) : (
                    <span className="block truncate">{column.header}</span>
                  )}
                  {/* Resize handle: drag, or focus and use ← / → */}
                  <button
                    type="button"
                    aria-label={`Resize ${column.header} column (${widthOf(column)} px, use left / right arrows)`}
                    onPointerDown={(e) => startResize(column, e)}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                        e.preventDefault();
                        layout.setWidth(
                          column.id,
                          widthOf(column) + (e.key === 'ArrowRight' ? 16 : -16),
                        );
                      }
                    }}
                    className="absolute top-1.5 right-0 bottom-1.5 w-2 cursor-col-resize touch-none after:absolute after:inset-y-0 after:right-0.5 after:w-0.5 after:rounded-md after:bg-border hover:after:bg-primary focus-visible:outline-2 focus-visible:outline-ring focus-visible:after:bg-primary"
                  />
                </th>
              );
            })}
            {rowActions && (
              <th scope="col" className={cn(headCell, 'sticky top-0 right-0 z-30 text-right')}>
                Action
              </th>
            )}
          </tr>
        </thead>
        {/* Row keyboard navigation is delegated here; the rows themselves are focusable (roving tabIndex). */}
        {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
        <tbody
          ref={bodyRef}
          onKeyDown={onBodyKeyDown}
          className={cn('transition-opacity', table.isFetching && table.hasLoaded && 'opacity-60')}
        >
          {!table.hasLoaded &&
            Array.from({ length: Math.min(table.query.pageSize, 10) }, (_, i) => (
              <tr key={`skeleton-${i}`} aria-hidden="true">
                {selectable && (
                  <td className={bodyCell}>
                    <Skeleton className="mx-auto size-4" />
                  </td>
                )}
                {columns.map((c) => (
                  <td key={c.id} className={bodyCell}>
                    <Skeleton className={cn('h-4', c.numeric ? 'ml-auto w-12' : 'w-3/4')} />
                  </td>
                ))}
                {rowActions && (
                  <td className={bodyCell}>
                    <Skeleton className="ml-auto size-6" />
                  </td>
                )}
              </tr>
            ))}
          {table.hasLoaded && rows.length === 0 && (
            <tr>
              <td colSpan={colSpan} className="border-b border-border">
                {empty}
              </td>
            </tr>
          )}
          {rows.map((row, index) => {
            const id = table.getRowId(row);
            const selected = table.isSelected(id);
            return (
              <tr
                key={id}
                data-row=""
                aria-rowindex={(table.query.page - 1) * table.query.pageSize + index + 2}
                aria-selected={selected}
                data-selected={selected || undefined}
                tabIndex={index === Math.min(activeRow, rows.length - 1) ? 0 : -1}
                onFocus={(e) => e.target === e.currentTarget && setActiveRow(index)}
                onClick={(e) => onRowClick(row, e)}
                className={cn(
                  'group/row bg-surface transition-colors duration-100 even:bg-muted/60 hover:bg-accent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring data-selected:bg-[color-mix(in_oklch,var(--primary)_11%,var(--surface))]',
                  onRowOpen && 'cursor-pointer',
                )}
              >
                {selectable && (
                  <td className={cn(bodyCell, 'relative sticky left-0 z-10 bg-inherit')}>
                    {/* Selected: tint + checked box + accent bar (not color alone). */}
                    {selected && (
                      <span
                        aria-hidden="true"
                        className="absolute inset-y-0 left-0 w-0.5 bg-primary"
                      />
                    )}
                    <span className="flex justify-center">
                      <label
                        htmlFor={`${baseId}-${id}`}
                        className="inline-flex size-6 cursor-pointer items-center justify-center pointer-coarse:size-11"
                      >
                        <Checkbox
                          id={`${baseId}-${id}`}
                          aria-label={`Select ${rowLabel(row)}`}
                          checked={selected}
                          onCheckedChange={() => table.toggleRow(id)}
                        />
                      </label>
                    </span>
                  </td>
                )}
                {columns.map((column, ci) => (
                  <td
                    key={column.id}
                    className={cn(
                      bodyCell,
                      alignClass(column),
                      column.wrap ? 'break-words whitespace-normal' : 'truncate',
                      ci === 0 &&
                        cn('sticky z-10 bg-inherit font-medium', selectable ? 'left-12' : 'left-0'),
                    )}
                  >
                    {column.cell(row)}
                  </td>
                ))}
                {rowActions && (
                  <td className={cn(bodyCell, 'sticky right-0 z-10 bg-inherit text-right')}>
                    {rowActions(row)}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
