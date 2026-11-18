/**
 * What an admin can lock for everyone, one switch per Appearance section. Locking a group
 * locks all of its options (stored as option keys: "mode", "preset", appearance keys).
 */
export const LOCK_GROUPS = [
  { id: 'mode', label: 'Mode', keys: ['mode', 'autoDark'] },
  { id: 'color', label: 'Color', keys: ['preset', 'customColor'] },
  { id: 'radius', label: 'Corner radius', keys: ['radius'] },
  { id: 'density', label: 'Density', keys: ['density'] },
  { id: 'sidebar', label: 'Sidebar style & position', keys: ['sidebar', 'sidebarPosition'] },
  {
    id: 'navbar',
    label: 'Navbar, search bar & breadcrumbs',
    keys: ['navbar', 'navbarSearch', 'breadcrumbs'],
  },
  { id: 'icons', label: 'Icon style', keys: ['icons'] },
  { id: 'typography', label: 'Typography', keys: ['font', 'fontSize'] },
  {
    id: 'effects',
    label: 'Contrast, shadows & content width',
    keys: ['contrast', 'shadows', 'contentWidth'],
  },
  {
    id: 'preferences',
    label: 'Preferences (rows, gradient, focus, motion, tooltips)',
    keys: ['striped', 'gradientButtons', 'strongFocus', 'reduceMotion', 'tooltips'],
  },
] as const;

export type LockGroupId = (typeof LOCK_GROUPS)[number]['id'];

export const lockKeysOf = (id: LockGroupId): readonly string[] =>
  LOCK_GROUPS.find((g) => g.id === id)?.keys ?? [];

/** Locked option keys → the groups that are fully locked. */
export const lockedGroups = (locked: readonly string[]): Set<LockGroupId> =>
  new Set(LOCK_GROUPS.filter((g) => g.keys.every((k) => locked.includes(k))).map((g) => g.id));
