import { createContext } from 'react';

import type {
  Appearance,
  ColorMode,
  ResolvedColorMode,
  ThemeConfig,
  ThemePresetId,
  ThemeState,
} from '@/types/theme.types';

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
  /** Back to the project defaults (clears the stored choice). */
  reset: () => void;
  /** True when anything differs from the defaults. */
  isCustomized: boolean;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);
