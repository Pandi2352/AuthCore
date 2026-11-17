import type { ThemeConfig } from '../types/theme.types.ts';

/**
 * Default theme and what users may change. Applied by the ThemeProvider
 * (theme module, docs/frontend/theme-system.md).
 */
export const themeConfig: ThemeConfig = {
  defaults: {
    mode: 'system',
    preset: 'default',
    appearance: {
      radius: 'medium',
      density: 'comfortable',
      font: 'system',
      shadows: 'none', // project default: flat, no shadows
      borders: 'subtle',
      sidebar: 'classic',
      navbar: 'classic',
      cards: 'bordered',
      inputs: 'outlined',
      buttons: 'solid',
      icons: 'classic', // classic · modern · duotone · color (navigation icons)
    },
  },
  userCustomizable: {
    mode: true,
    preset: true,
    appearance: ['radius', 'density', 'sidebar', 'navbar', 'icons'],
  },
  presets: [
    'default',
    'indigo',
    'violet',
    'pink',
    'rose',
    'orange',
    'amber',
    'lime',
    'emerald',
    'teal',
    'sky',
    'slate',
    'brand',
  ],
};
