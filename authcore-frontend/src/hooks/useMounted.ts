import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';

const noopSubscribe = () => () => undefined;

/**
 * true once rendering on the client (false during server rendering / before hydration).
 * Use it to render browser-only UI (window size, localStorage-based content) without
 * hydration mismatches.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

/**
 * A function telling whether the component is still mounted — for async work that finishes
 * after the user left the page:
 *
 *   const isMounted = useIsMounted();
 *   const data = await api.load();
 *   if (isMounted()) setData(data);
 */
export function useIsMounted(): () => boolean {
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  return useCallback(() => mounted.current, []);
}
