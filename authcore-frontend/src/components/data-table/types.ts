import type { ReactNode } from 'react';

/** Row height / padding. Persisted per user and table. */
export type TableDensity = 'compact' | 'comfortable' | 'spacious';

export interface SortRule {
  id: string;
  desc: boolean;
}

export interface DataTableColumn<T> {
  /** Stable id: sort key sent to the server, persisted layout key. */
  id: string;
  /** Header text (also the label in the columns menu and on mobile cards). */
  header: string;
  /** Cell content. */
  cell: (row: T) => ReactNode;
  /** Header becomes a sort button (server-side sort — the id is the sort key). */
  sortable?: boolean;
  /** Numbers / currency: right-aligned with tabular figures. */
  numeric?: boolean;
  align?: 'left' | 'center' | 'right';
  /** Initial width in px (users can resize; min 80). */
  width?: number;
  /** Can be hidden from the columns menu (default true). The first column always shows. */
  hideable?: boolean;
  /** Hidden until the user turns it on. */
  defaultHidden?: boolean;
  /**
   * Mobile card role: title (one, bold), subtitle (under the title), field (label: value
   * grid, default) or hidden.
   */
  mobile?: 'title' | 'subtitle' | 'field' | 'hidden';
}

export interface FilterOption {
  value: string;
  label: string;
}

/** A visible filter (dropdown with multi-select options) — active values show as chips. */
export interface DataTableFilter {
  id: string;
  label: string;
  options: readonly FilterOption[];
}

/** What the server receives for one page. */
export interface TableQuery {
  page: number;
  pageSize: number;
  search: string;
  sort: SortRule[];
  /** Filter id → selected values (only filters with values). */
  filters: Record<string, string[]>;
}

export interface TablePage<T> {
  items: T[];
  /** Total rows matching the query (all pages) — always shown, never "page 3 of ?". */
  total: number;
}

/**
 * Selection: explicit ids (persist across pages), or "everything matching the query"
 * minus exclusions — the scope the user picked is always explicit.
 */
export type TableSelection =
  { mode: 'ids'; ids: ReadonlySet<string> } | { mode: 'all'; excluded: ReadonlySet<string> };

/** What a bulk action receives. */
export type BulkTarget =
  | { mode: 'ids'; ids: string[] }
  | { mode: 'all'; excludedIds: string[]; query: TableQuery; count: number };

export interface BulkAction {
  id: string;
  label: string;
  icon?: ReactNode;
  /** Guarded with a confirmation dialog. */
  destructive?: boolean;
  /** Confirmation text; required for destructive actions (default text otherwise). */
  confirm?: { title: string; description?: string; confirmText?: string };
  run: (target: BulkTarget) => void | Promise<unknown>;
}

/** Persisted per user and table. */
export interface TableLayout {
  density: TableDensity;
  /** Column ids in display order (unknown / new columns are appended). */
  order: string[];
  hidden: string[];
  widths: Record<string, number>;
}
