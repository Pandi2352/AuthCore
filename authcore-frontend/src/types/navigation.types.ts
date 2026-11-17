import type { IconName } from '@/config/icons';

import type { BadgeTone, FeatureFlag } from './config.types';

/** Icon name: a key of the registry in src/config/icons.ts (configs stay plain data). */
export type { IconName };

export type NavItemStatus = 'ready' | 'planned';

export type NavBadge =
  | { text: string; tone?: BadgeTone }
  /** Live count (e.g. pending invites); hidden when undefined or 0. */
  | { useCount: () => number | undefined; tone?: BadgeTone };

/** Palette for the "color" icon style (tokens --nav-<color> in styles/themes.css). */
export const NAV_ICON_COLORS = [
  'blue',
  'violet',
  'emerald',
  'amber',
  'rose',
  'cyan',
  'orange',
  'indigo',
] as const;
export type NavIconColor = (typeof NAV_ICON_COLORS)[number];

export interface NavItem {
  /** Unique across the whole navigation; stable (keys, persisted expand state). */
  id: string;
  title: string;
  /** From config/paths.ts; absolute http(s) URL when `external`. Omit for a parent that only groups children. */
  path?: string;
  icon?: IconName;
  /** Icon color for the "color" icon style; default: picked from the id (stable). */
  iconColor?: NavIconColor;
  /** One nested level (children have no children). */
  children?: NavItem[];
  badge?: NavBadge;
  /** Opens in a new tab with an external-link icon. */
  external?: boolean;
  disabled?: boolean;
  hidden?: boolean;
  /** Hidden when this feature flag is off. */
  featureFlag?: FeatureFlag;
  /** Hidden without this permission (any of the list). Applied from Level 2 (auth). */
  permission?: string | readonly string[];
  /** "planned" → the route shows a "not built yet" page until the module exists. */
  status?: NavItemStatus;
  /** Active when the URL equals the path (exact) or starts with it (prefix, default). */
  match?: 'exact' | 'prefix';
}

export interface NavGroup {
  id: string;
  /** Group label; omit for an unlabeled first group. */
  title?: string;
  items: NavItem[];
  featureFlag?: FeatureFlag;
  permission?: string | readonly string[];
}
