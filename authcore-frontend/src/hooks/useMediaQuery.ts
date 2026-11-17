import { useCallback, useSyncExternalStore } from 'react';

import type { Breakpoint } from '@/types/config.types';

/** Tailwind's default breakpoints (min-width). */
export const BREAKPOINTS: Record<Breakpoint, number> = { sm: 640, md: 768, lg: 1024, xl: 1280 };

/** Live result of a CSS media query. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** True at and above the breakpoint (e.g. `useBreakpoint('lg')` → desktop). */
export function useBreakpoint(breakpoint: Breakpoint): boolean {
  return useMediaQuery(`(min-width: ${BREAKPOINTS[breakpoint]}px)`);
}
