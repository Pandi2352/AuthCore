/**
 * Project identity. Plain data only (no imports, no import.meta.env): it is
 * also read by vite.config.ts to fill the <title> and <meta> tags of
 * index.html at build time. A new project changes these values.
 */
export interface AppConfig {
  /** Display name: browser tab, sidebar, emails. Keep in sync with the backend's project.config.json. */
  name: string;
  /** Machine name: storage-key prefix, file names. Lowercase letters, digits and "-". */
  slug: string;
  description: string;
  /** Browser UI color (mobile address bar), light and dark. */
  themeColor: { light: string; dark: string };
  /** HTML lang attribute until i18n arrives. */
  defaultLanguage: string;
  branding: {
    primaryColor: string;
    logoUrl: string | null;
    companyName: string | null;
    supportEmail: string | null;
    websiteUrl: string | null;
  };
}

export const appConfig: AppConfig = {
  name: 'AuthCore',
  slug: 'authcore',
  description: 'Reusable authentication and authorization service',
  themeColor: { light: '#ffffff', dark: '#0f172a' },
  defaultLanguage: 'en',
  branding: {
    primaryColor: '#4f46e5',
    logoUrl: null,
    companyName: 'AuthCore Identity',
    supportEmail: 'support@authcore.local',
    websiteUrl: null,
  },
};
