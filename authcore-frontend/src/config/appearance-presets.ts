import type { Appearance, ColorMode, ThemePresetId } from '../types/theme.types.ts';

/**
 * One-tap looks on the Appearance page ("Quick presets"). Applying one resets everything
 * to the project defaults first, then applies `changes`. Swatch: four tiles shown on the
 * card (background, surface, accent, contrast).
 */
export interface QuickPreset {
  id: string;
  label: string;
  description: string;
  changes: { mode?: ColorMode; preset?: ThemePresetId; appearance?: Partial<Appearance> };
  swatch: readonly [string, string, string, string];
}

export const QUICK_PRESETS: readonly QuickPreset[] = [
  {
    id: 'default',
    label: 'Default',
    description: 'Your starting point',
    changes: {},
    swatch: ['#f1f5f9', '#ffffff', '#2563eb', '#0f172a'],
  },
  {
    id: 'midnight',
    label: 'Midnight',
    description: 'Deep indigo, floating UI',
    changes: {
      mode: 'dark',
      preset: 'indigo',
      appearance: { sidebar: 'floating', navbar: 'floating', radius: 'large' },
    },
    swatch: ['#0b1020', '#161b2e', '#818cf8', '#e2e8f0'],
  },
  {
    id: 'sunrise',
    label: 'Sunrise',
    description: 'Warm serif, relaxed spacing',
    changes: {
      mode: 'light',
      preset: 'orange',
      appearance: { font: 'serif', density: 'spacious' },
    },
    swatch: ['#fff7ed', '#ffffff', '#c2410c', '#1c1917'],
  },
  {
    id: 'forest',
    label: 'Forest',
    description: 'Calm green, native font',
    changes: { mode: 'light', preset: 'emerald', appearance: { font: 'system' } },
    swatch: ['#f0fdf4', '#ffffff', '#047857', '#052e16'],
  },
  {
    id: 'ocean',
    label: 'Ocean',
    description: 'Airy sky blue, gradient',
    changes: {
      mode: 'light',
      preset: 'sky',
      appearance: { gradientButtons: 'on', radius: 'large', density: 'spacious' },
    },
    swatch: ['#f0f9ff', '#ffffff', '#0284c7', '#082f49'],
  },
  {
    id: 'high-contrast',
    label: 'High contrast',
    description: 'Sharp, large, accessible',
    changes: {
      mode: 'light',
      preset: 'default',
      appearance: { contrast: 'high', radius: 'sharp', fontSize: '16', strongFocus: 'on' },
    },
    swatch: ['#ffffff', '#ffffff', '#1d4ed8', '#000000'],
  },
];

/** Corner radius per option, in px (styles/appearance.css → --radius-base). */
export const RADIUS_PX = { sharp: 0, small: 4, medium: 6, large: 8, pill: 14 } as const;
