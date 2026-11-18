import type { AppConfig } from '../types/app-config.types.ts';

/**
 * Project identity. Plain data (no runtime imports, no import.meta.env): it is
 * also read by vite.config.ts to fill <title> / <meta> / favicon in
 * index.html at build time, and edited by `npm run project:init`.
 * Keep name and slug in sync with the backend's project.config.json.
 */
export const appConfig: AppConfig = {
  name: 'AuthCore',
  shortName: 'AuthCore',
  slug: 'authcore',
  description: 'Reusable authentication and authorization service',
  themeColor: { light: '#ffffff', dark: '#0f172a' },
  logos: {
    light: '/assets/logo/logo.png',
    dark: '/assets/logo/logo-dark.png',
    mark: '/assets/logo/logo-mark.png',
    auth: '/assets/logo/auth-logo.png',
    authDark: '/assets/logo/auth-logo-dark.png',
  },
  favicon: '/assets/logo/favicon.png',
  locale: {
    defaultLanguage: 'en',
    defaultTimeZone: 'UTC',
  },
  branding: {
    primaryColor: '#4f46e5',
    companyName: 'AuthCore Identity',
    supportEmail: 'support@authcore.local',
    websiteUrl: null,
  },
  legal: {
    privacyUrl: null,
    termsUrl: null,
  },
};
