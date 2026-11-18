import { createContext } from 'react';

import type {
  Appearance,
  ColorMode,
  ResolvedColorMode,
  ThemeConfig,
  ThemePresetId,
  ThemeState,
} from '@/types/theme.types';

import type { OrganizationAppearance } from './theme-core';

export interface ThemeContextValue extends ThemeState {
  /** `mode` with "system" resolved to light / dark. */
  resolvedMode: ResolvedColorMode;
  /** What the project lets users change (theme.config.ts). */
  userCustomizable: ThemeConfig['userCustomizable'];
  /** Presets offered to users, in order. */
  presets: readonly ThemePresetId[];
  setMode: (mode: ColorMode) => void;
  setPreset: (preset: ThemePresetId) => void;
  setAppearance: (changes: Partial<Appearance>) => void;
  /** Several changes at once (quick presets). */
  applyTheme: (changes: {
    mode?: ColorMode;
    preset?: ThemePresetId;
    appearance?: Partial<Appearance>;
  }) => void;
  /** Back to the project defaults (clears the stored choice). */
  reset: () => void;
  /** True when anything differs from the defaults (organization's look, else theme.config.ts). */
  isCustomized: boolean;
  /** The organization's look set by an admin (null = none). */
  organization: OrganizationAppearance | null;
  /** What "Reset to default" goes back to. */
  defaults: ThemeState;
  /** Options the organization locked ("mode", "preset", appearance keys). */
  lockedOptions: readonly string[];
  isLocked: (key: string) => boolean;
  /** Apply / cache a new organization appearance (from the API). */
  setOrganization: (organization: OrganizationAppearance | null) => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);
