// Relative .ts imports (not '@/config'): vite.config.ts also loads this file at build time
// to generate the no-flash script, and the config index pulls in browser-only modules.
import { appConfig } from '../../config/app.config.ts';
import { FONTS, googleFontUrl } from '../../config/fonts.ts';
import { themeConfig } from '../../config/theme.config.ts';
import { APPEARANCE_VALUES, COLOR_MODES } from '../../types/theme.types.ts';
import type { ThemeRuntimeOptions } from './theme-core.ts';

/** Storage key of the user's theme choice; bump the version when the stored shape changes. */
export const THEME_STORAGE_KEY = `${appConfig.slug}:theme:v1`;

export const themeRuntimeOptions: ThemeRuntimeOptions = {
  storageKey: THEME_STORAGE_KEY,
  defaults: themeConfig.defaults,
  customizable: themeConfig.userCustomizable,
  allowed: {
    modes: COLOR_MODES,
    presets: themeConfig.presets.includes(themeConfig.defaults.preset)
      ? themeConfig.presets
      : [themeConfig.defaults.preset, ...themeConfig.presets],
    appearance: APPEARANCE_VALUES,
  },
  brandColor: appConfig.branding.primaryColor,
  themeColor: appConfig.themeColor,
  fonts: Object.fromEntries(
    FONTS.map((font) => [font.id, { family: font.family, url: googleFontUrl(font) }]),
  ),
};
