/**
 * Theme options the API stores. Keep in sync with the frontend
 * (authcore-frontend/src/types/theme.types.ts → APPEARANCE_VALUES). The backend checks keys
 * and value shape; the frontend whitelists the exact values when it applies them.
 */
export const APPEARANCE_KEYS = [
  'radius',
  'density',
  'font',
  'shadows',
  'borders',
  'sidebar',
  'navbar',
  'cards',
  'inputs',
  'buttons',
  'icons',
  'fontSize',
  'contrast',
  'contentWidth',
  'sidebarPosition',
  'navbarSearch',
  'breadcrumbs',
  'striped',
  'gradientButtons',
  'strongFocus',
  'reduceMotion',
  'tooltips',
  'autoDark',
  'customColor',
] as const;

/** Option values: short tokens (e.g. "dark", "rounded-md"), or a #rrggbb color, or empty. */
export const OPTION_VALUE = /^(#[0-9a-fA-F]{6}|[a-z0-9-]{1,40})?$/;

export const GLOBAL_APPEARANCE_KEY = 'global';
/** Organization appearance reads are cached this long per instance. */
export const APPEARANCE_CACHE_TTL_MS = 15_000;
/** Saves are debounced in the browser; this still allows quick editing. */
export const APPEARANCE_WRITE_THROTTLE = { limit: 60, ttl: 60_000 } as const;
