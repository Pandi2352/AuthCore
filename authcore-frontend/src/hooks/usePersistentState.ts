import { useCallback, useEffect, useState } from 'react';

import { appConfig } from '@/config';
import { storage } from '@/lib/storage';

/**
 * State remembered in localStorage under `<slug>:<name>:v<version>`, synced across tabs.
 * `validate` turns the stored value into T (or null → default), so old / bad data is ignored.
 */
export function usePersistentState<T>(
  name: string,
  defaultValue: T,
  validate: (value: unknown) => T | null,
  version = 1,
): [T, (next: T | ((current: T) => T)) => void] {
  const key = `${appConfig.slug}:${name}:v${version}`;
  const [value, setValue] = useState<T>(() => validate(storage.read(key)) ?? defaultValue);

  useEffect(
    () => storage.subscribe(key, (next) => setValue(validate(next) ?? defaultValue)),
    // defaultValue / validate are expected to be stable (module constants)
    // oxlint-disable-next-line react/exhaustive-deps
    [key],
  );

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

  return [value, update];
}
