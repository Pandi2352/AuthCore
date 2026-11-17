import { appConfig } from '../../config/app.config';

/**
 * Every localStorage entry the app uses — one list, so names never collide and a version
 * bump is a one-line change. Full key: `<app slug>:<name>:v<version>` (storageKey()).
 * (The theme key is built in app/theme/theme-options.ts, which vite.config.ts also reads.)
 */
export const STORAGE_KEYS = {
  theme: { name: 'theme', version: 1 },
  sidebarCollapsed: { name: 'sidebar-collapsed', version: 1 },
  sidebarExpanded: { name: 'sidebar-expanded', version: 1 },
  devCounter: { name: 'dev-counter', version: 1 },
  // DataTable layouts (density, column order / visibility / widths), keyed by table + user
  dataTables: { name: 'data-tables', version: 1 },
} as const satisfies Record<string, { name: string; version: number }>;

export type StorageKeyId = keyof typeof STORAGE_KEYS;

/** `<slug>:<name>:v<version>`, e.g. "authcore:sidebar-collapsed:v1". */
export function storageKey(name: string, version = 1): string {
  return `${appConfig.slug}:${name}:v${version}`;
}

/** Full key of a registered entry. */
export const keyOf = (id: StorageKeyId): string =>
  storageKey(STORAGE_KEYS[id].name, STORAGE_KEYS[id].version);
