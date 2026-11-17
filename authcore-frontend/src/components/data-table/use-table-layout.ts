import { useCallback, useMemo } from 'react';

import { useLocalStorage } from '@/hooks/useLocalStorage';

import type { DataTableColumn, TableDensity, TableLayout } from './types';

const DENSITIES: ReadonlySet<string> = new Set<TableDensity>([
  'compact',
  'comfortable',
  'spacious',
]);
export const MIN_COLUMN_WIDTH = 80;
export const DEFAULT_COLUMN_WIDTH = 160;

type LayoutMap = Record<string, Partial<TableLayout>>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Old / tampered storage → ignored entry by entry, never a crash. */
function validateLayouts(value: unknown): LayoutMap | null {
  if (!isRecord(value)) return null;
  const result: LayoutMap = {};
  for (const [key, raw] of Object.entries(value)) {
    if (!isRecord(raw)) continue;
    const entry: Partial<TableLayout> = {};
    if (typeof raw.density === 'string' && DENSITIES.has(raw.density))
      entry.density = raw.density as TableDensity;
    if (Array.isArray(raw.order)) entry.order = raw.order.filter((v) => typeof v === 'string');
    if (Array.isArray(raw.hidden)) entry.hidden = raw.hidden.filter((v) => typeof v === 'string');
    if (isRecord(raw.widths)) {
      entry.widths = Object.fromEntries(
        Object.entries(raw.widths).filter(
          ([, w]) => typeof w === 'number' && w >= MIN_COLUMN_WIDTH,
        ),
      ) as Record<string, number>;
    }
    result[key] = entry;
  }
  return result;
}

/** Stored layout merged with the current column list (new columns appended, removed ones dropped). */
function resolveLayout<T>(stored: Partial<TableLayout> | undefined, columns: DataTableColumn<T>[]) {
  const ids = columns.map((c) => c.id);
  const order = [
    ...(stored?.order ?? []).filter((id) => ids.includes(id)),
    ...ids.filter((id) => !(stored?.order ?? []).includes(id)),
  ];
  const first = ids[0];
  const hidden = (stored?.hidden ?? columns.filter((c) => c.defaultHidden).map((c) => c.id)).filter(
    (id) => ids.includes(id) && id !== first,
  );
  return {
    density: stored?.density ?? 'comfortable',
    // The first column (row label) stays first.
    order: first ? [first, ...order.filter((id) => id !== first)] : order,
    hidden,
    widths: stored?.widths ?? {},
  } satisfies TableLayout;
}

/**
 * Density, column order / visibility / widths — remembered per `layoutKey` (pass table id +
 * user id, so every user keeps their own layout).
 */
export function useTableLayout<T>(layoutKey: string, columns: DataTableColumn<T>[]) {
  const [layouts, setLayouts] = useLocalStorage<LayoutMap>(
    'dataTables',
    {},
    { validate: validateLayouts },
  );
  const layout = useMemo(
    () => resolveLayout(layouts[layoutKey], columns),
    [layouts, layoutKey, columns],
  );

  const update = useCallback(
    (change: (current: TableLayout) => Partial<TableLayout>) =>
      setLayouts((all) => {
        const current = resolveLayout(all[layoutKey], columns);
        return { ...all, [layoutKey]: { ...current, ...change(current) } };
      }),
    [setLayouts, layoutKey, columns],
  );

  const visibleColumns = useMemo(
    () =>
      layout.order
        .filter((id) => !layout.hidden.includes(id))
        .map((id) => columns.find((c) => c.id === id))
        .filter((c): c is DataTableColumn<T> => Boolean(c)),
    [layout, columns],
  );

  return {
    layout,
    visibleColumns,
    widthOf: (column: DataTableColumn<T>) =>
      layout.widths[column.id] ?? column.width ?? DEFAULT_COLUMN_WIDTH,
    setDensity: (density: TableDensity) => update(() => ({ density })),
    toggleColumn: (id: string) =>
      update((c) => ({
        hidden: c.hidden.includes(id) ? c.hidden.filter((h) => h !== id) : [...c.hidden, id],
      })),
    moveColumn: (id: string, direction: -1 | 1) =>
      update((c) => {
        const order = [...c.order];
        const from = order.indexOf(id);
        const to = from + direction;
        // index 0 is the pinned first column
        if (from < 1 || to < 1 || to >= order.length) return {};
        [order[from], order[to]] = [order[to] as string, order[from] as string];
        return { order };
      }),
    setWidth: (id: string, width: number) =>
      update((c) => ({
        widths: { ...c.widths, [id]: Math.max(MIN_COLUMN_WIDTH, Math.round(width)) },
      })),
    reset: () =>
      setLayouts((all) => {
        const next = { ...all };
        delete next[layoutKey];
        return next;
      }),
  };
}

export type TableLayoutApi<T> = ReturnType<typeof useTableLayout<T>>;
