import { useCallback, useEffect, useRef, useState } from 'react';

import { appConfig } from '@/config';
import { storage } from '@/lib/storage';

export interface UseLocalStorageOptions<T> {
  /** Turn the stored value into T, or null to fall back to the default (old / tampered data). */
  validate?: (value: unknown) => T | null;
  /** Bump when the stored shape changes: old values are ignored. */
  version?: number;
}

/** Key for app data in localStorage: `<slug>:<name>:v<version>`. */
export const storageKey = (name: string, version = 1): string =>
  `${appConfig.slug}:${name}:v${version}`;

/**
 * State remembered in localStorage (namespaced by the app slug, JSON-safe, never throws,
 * synced across tabs). Without `validate`, any stored JSON of the same type as the default
 * is accepted.
 *
 *   const [view, setView, resetView] = useLocalStorage('users-view', 'table', {
 *     validate: (v) => (v === 'table' || v === 'cards' ? v : null),
 *   });
 */
export function useLocalStorage<T>(
  name: string,
  defaultValue: T,
  options: UseLocalStorageOptions<T> = {},
): [T, (next: T | ((current: T) => T)) => void, () => void] {
  const { version = 1 } = options;
  const key = storageKey(name, version);
  const latest = useRef({ defaultValue, validate: options.validate });
  useEffect(() => {
    latest.current = { defaultValue, validate: options.validate };
  });

  const read = useCallback((raw: unknown): T => {
    const { defaultValue: fallback, validate } = latest.current;
    if (raw === null || raw === undefined) return fallback;
    if (validate) return validate(raw) ?? fallback;
    return typeof raw === typeof fallback ? (raw as T) : fallback;
  }, []);

  const [value, setValue] = useState<T>(() => {
    const raw = storage.read(key);
    if (raw === null) return defaultValue;
    if (options.validate) return options.validate(raw) ?? defaultValue;
    return typeof raw === typeof defaultValue ? (raw as T) : defaultValue;
  });

  // Other tabs
  useEffect(() => storage.subscribe(key, (raw) => setValue(read(raw))), [key, read]);

  const update = useCallback(
    (next: T | ((current: T) => T)) => {
      setValue((current) => {
        const resolved = typeof next === 'function' ? (next as (c: T) => T)(current) : next;
        storage.write(key, resolved);
        return resolved;
      });
    },
    [key],
  );

  const remove = useCallback(() => {
    storage.remove(key);
    setValue(latest.current.defaultValue);
  }, [key]);

  return [value, update, remove];
}
