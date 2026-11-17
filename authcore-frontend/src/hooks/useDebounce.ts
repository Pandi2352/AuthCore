import { useCallback, useEffect, useRef, useState } from 'react';

/** The value, updated only after it stopped changing for `delay` ms (search boxes). */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/** A stable callback that runs `delay` ms after the last call; `.cancel()` / `.flush()` included. */
export function useDebouncedCallback<A extends unknown[]>(
  callback: (...args: A) => void,
  delay = 300,
) {
  const latest = useRef(callback);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pending = useRef<A | null>(null);
  useEffect(() => {
    latest.current = callback;
  });
  useEffect(() => () => clearTimeout(timer.current), []);

  const cancel = useCallback(() => {
    clearTimeout(timer.current);
    pending.current = null;
  }, []);
  const flush = useCallback(() => {
    clearTimeout(timer.current);
    if (pending.current) latest.current(...pending.current);
    pending.current = null;
  }, []);
  const run = useCallback(
    (...args: A) => {
      pending.current = args;
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        pending.current = null;
        latest.current(...args);
      }, delay);
    },
    [delay],
  );
  return { run, cancel, flush };
}
