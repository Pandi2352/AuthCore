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
  /** Personal light / dark / system (stored in this browser). */
  setMode: (mode: ColorMode) => void;
  setPreset: (preset: ThemePresetId) => void;
  setAppearance: (changes: Partial<Appearance>) => void;
  /** Several changes at once (quick presets). */
  applyTheme: (changes: {
    mode?: ColorMode;
    preset?: ThemePresetId;
    appearance?: Partial<Appearance>;
  }) => void;
  /** The application look back to the built-in defaults (editors). */
  reset: () => void;
  /** True when the application look differs from the built-in defaults. */
  isCustomized: boolean;
  /** Everyone's default mode (Appearance page); `setMode` is the personal choice. */
  setDefaultMode: (mode: ColorMode) => void;
  /** The application look (null = never saved: built-in defaults). */
  organization: OrganizationAppearance | null;
  /** The application's default mode (the personal `mode` may differ). */
  defaultMode: ColorMode;
  /** True for users allowed to change the application look (APPEARANCE_SETTINGS_MANAGE). */
  canEdit: boolean;
  setCanEdit: (canEdit: boolean) => void;
  /** Apply / cache the look from the server. */
  setOrganization: (look: OrganizationAppearance | null) => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);
