/**
 * AppConfig on its own, without imports: vite.config.ts reads app.config.ts at
 * build time, so this type must not pull in browser / React types.
 */

export interface AppConfig {
  /** Display name: browser tab, sidebar, auth pages. Same as the backend's project.config.json. */
  name: string;
  /** Short name for tight places (collapsed sidebar tooltip, PWA). */
  shortName: string;
  /** Machine name: lowercase letters, digits and "-". Storage-key prefix, file names. Same as the backend. */
  slug: string;
  description: string;
  /** Browser UI color (mobile address bar). */
  themeColor: { light: string; dark: string };
  /** Paths under public/ (start with "/") or https URLs. */
  logos: {
    /** Full logo on light backgrounds. null → initial + name. */
    light: string | null;
    /** Full logo on dark backgrounds (falls back to `light`). */
    dark: string | null;
    /** Square mark for the collapsed sidebar and small spaces. */
    mark: string | null;
  };
  favicon: string;
  locale: {
    /** BCP 47 language of the UI until i18n arrives, e.g. "en". */
    defaultLanguage: string;
    /** IANA time zone for dates when the user has none, e.g. "Asia/Kolkata". */
    defaultTimeZone: string;
  };
  branding: {
    /** Brand color (#rrggbb): the "brand" theme preset and email-like accents. */
    primaryColor: string;
    companyName: string | null;
    supportEmail: string | null;
    websiteUrl: string | null;
  };
  /** Footer / auth-page links; null hides the link. */
  legal: {
    privacyUrl: string | null;
    termsUrl: string | null;
  };
}
