import { useCallback, useSyncExternalStore } from 'react';

import {
  BREAKPOINT_ORDER,
  BREAKPOINTS,
  minWidthQuery,
  type BreakpointName,
} from '@/lib/constants/breakpoints';

export { BREAKPOINTS };

/** Live result of a CSS media query (re-renders when it changes). */
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

/** True at and above the breakpoint (e.g. `useBreakpoint('lg')` → desktop). Same as Tailwind `lg:`. */
export function useBreakpoint(breakpoint: BreakpointName): boolean {
  return useMediaQuery(minWidthQuery(breakpoint));
}

/** The largest breakpoint currently matched, or 'base' below `sm`. */
export function useCurrentBreakpoint(): BreakpointName | 'base' {
  const sm = useBreakpoint('sm');
  const md = useBreakpoint('md');
  const lg = useBreakpoint('lg');
  const xl = useBreakpoint('xl');
  const xxl = useBreakpoint('2xl');
  const matched = [sm, md, lg, xl, xxl];
  const last = matched.lastIndexOf(true);
  return last < 0 ? 'base' : (BREAKPOINT_ORDER[last] ?? 'base');
}

/** Touch screens (coarse primary pointer): bigger targets, no hover-only UI. */
export function useIsTouch(): boolean {
  return useMediaQuery('(pointer: coarse)');
}

/** User asked the OS for less motion. */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}
