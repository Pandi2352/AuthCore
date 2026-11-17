/**
 * Responsive breakpoints (min-width, px) — the single source of truth.
 * Identical to Tailwind's defaults, so `md:` in classes and `useBreakpoint('md')` agree.
 * If you change one here, change Tailwind's `--breakpoint-*` in styles/tokens.css too.
 */
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

export type BreakpointName = keyof typeof BREAKPOINTS;

export const BREAKPOINT_ORDER: readonly BreakpointName[] = ['sm', 'md', 'lg', 'xl', '2xl'];

/** Media query for "at least this breakpoint". */
export const minWidthQuery = (name: BreakpointName): string =>
  `(min-width: ${BREAKPOINTS[name]}px)`;

/** WCAG 2.5.5 (AAA) / platform guideline minimum touch target, px. */
export const MIN_TOUCH_TARGET = 44;
