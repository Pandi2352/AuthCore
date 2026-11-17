import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

type ParamValue = string | number | boolean | null | undefined;

/**
 * Typed search-param state (filters, page, tab) — the URL is the source of truth, so
 * links, refresh and back / forward keep the state.
 *
 *   const [params, setParams] = useQueryParams({ page: 1, q: '', tab: 'overview' });
 *   setParams({ page: 2 });            // merges; default values are removed from the URL
 */
export function useQueryParams<T extends Record<string, string | number | boolean>>(
  defaults: T,
): [T, (changes: Partial<Record<keyof T, ParamValue>>, options?: { replace?: boolean }) => void] {
  const [searchParams, setSearchParams] = useSearchParams();

  const values = useMemo(() => {
    const result: Record<string, string | number | boolean> = { ...defaults };
    for (const [key, fallback] of Object.entries(defaults)) {
      const raw = searchParams.get(key);
      if (raw === null) continue;
      if (typeof fallback === 'number') {
        const n = Number(raw);
        if (Number.isFinite(n)) result[key] = n;
      } else if (typeof fallback === 'boolean') {
        result[key] = raw === 'true';
      } else {
        result[key] = raw;
      }
    }
    return result as T;
    // defaults is expected to be a stable literal per call site
    // oxlint-disable-next-line react/exhaustive-deps
  }, [searchParams]);

  const setValues = useCallback(
    (changes: Partial<Record<keyof T, ParamValue>>, options: { replace?: boolean } = {}) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          for (const [key, value] of Object.entries(changes)) {
            const isDefault = value === defaults[key];
            if (value === null || value === undefined || value === '' || isDefault)
              next.delete(key);
            else next.set(key, String(value));
          }
          return next;
        },
        { replace: options.replace ?? true },
      );
    },
    // oxlint-disable-next-line react/exhaustive-deps
    [setSearchParams],
  );

  return [values, setValues];
}
