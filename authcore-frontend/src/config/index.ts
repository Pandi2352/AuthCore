/**
 * Everything a new project edits lives in this folder:
 *   app.config.ts         name, logos, favicon, locale, branding, legal links
 *   features.config.ts    feature toggles (UI, auth flows, account pages, admin)
 *   navigation.config.ts  sidebar groups and items
 *   layout.config.ts      sidebar / navbar / content sizes and behavior
 *   theme.config.ts       default theme and what users may change
 *   theme.presets.ts      registered color presets
 *   icons.ts              icon names usable in configs
 *   paths.ts              every URL of the app
 *   env.ts                VITE_ environment variables (the only reader)
 */
import { appConfig } from './app.config';
import { featuresConfig } from './features.config';
import { layoutConfig } from './layout.config';
import { navigationConfig, navigationFooterConfig } from './navigation.config';
import { themeConfig } from './theme.config';
import { themePresets } from './theme.presets';
import { validateConfig } from './validate-config';

export { appConfig } from './app.config';
export { env } from './env';
export { featuresConfig, isFeatureEnabled } from './features.config';
export { icons, isIconName, type IconName } from './icons';
export { layoutConfig } from './layout.config';
export { navigationConfig, navigationFooterConfig } from './navigation.config';
export { paths, routePatterns, withQuery } from './paths';
export { themeConfig } from './theme.config';
export { findThemePreset, themePresets } from './theme.presets';

/** Problems in the current configuration (empty array = valid). */
export function getConfigProblems(): string[] {
  return validateConfig({
    app: appConfig,
    features: featuresConfig,
    navigation: navigationConfig,
    navigationFooter: navigationFooterConfig,
    layout: layoutConfig,
    theme: themeConfig,
    presets: themePresets,
  });
}
