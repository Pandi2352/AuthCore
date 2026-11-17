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
      navbar: 'standard',
      cards: 'bordered',
      inputs: 'outlined',
      buttons: 'solid',
      icons: 'classic', // classic · modern · duotone · color (navigation icons)
    },
  },
  userCustomizable: {
    mode: true,
    preset: true,
    appearance: ['radius', 'density', 'sidebar', 'icons'],
  },
  presets: ['default', 'emerald', 'violet', 'orange', 'brand'],
};
