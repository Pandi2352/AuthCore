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
      fontSize: '14',
      contrast: 'standard',
      contentWidth: 'fluid', // fluid · boxed (88 %) · narrow (72 %)
      sidebarPosition: 'left',
      navbarSearch: 'on',
      breadcrumbs: 'on',
      striped: 'off',
      gradientButtons: 'off',
      strongFocus: 'off',
      reduceMotion: 'off',
      tooltips: 'on',
      autoDark: 'off',
      customColor: '',
    },
  },
  userCustomizable: {
    mode: true,
    preset: true,
    appearance: [
      'radius',
      'density',
      'font',
      'fontSize',
      'shadows',
      'contrast',
      'contentWidth',
      'sidebar',
      'sidebarPosition',
      'navbar',
      'navbarSearch',
      'breadcrumbs',
      'icons',
      'striped',
      'gradientButtons',
      'strongFocus',
      'reduceMotion',
      'tooltips',
      'autoDark',
      'customColor',
    ],
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
    'custom',
  ],
};
