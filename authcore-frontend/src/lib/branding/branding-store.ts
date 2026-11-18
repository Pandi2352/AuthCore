import { appConfig } from '@/config/app.config';

import { keyOf } from '../constants/storage-keys';
import { storage } from '../storage';

/**
 * Business settings every page shows: site name, description, logos and favicon.
 * Source: GET /settings/business/public (BrandingSync), cached in localStorage so the next
 * visit starts with the right name / favicon (vite.config.ts applies it before the first paint).
 * Until the backend answers, the values from app.config.ts are used.
 */
export interface BrandingAssets {
  /** Full logo: expanded sidebar. */
  logo: string | null;
  /** Square mark: collapsed sidebar. */
  logoMark: string | null;
  /** Sign-in / sign-up pages (falls back to `logo`). */
  authLogo: string | null;
  /** Browser tab icon. */
  favicon: string | null;
}

export interface Branding {
  siteName: string;
  siteDescription: string;
  assets: BrandingAssets;
  /** Backend version (0 = project defaults). */
  version: number;
}

export const DEFAULT_BRANDING: Branding = Object.freeze({
  siteName: appConfig.name,
  siteDescription: appConfig.description,
  assets: Object.freeze({ logo: null, logoMark: null, authLogo: null, favicon: null }),
  version: 0,
});

const KEY = keyOf('branding');
/** Image URLs must be http(s) or same-origin paths (never javascript:, data: …). */
const SAFE_URL = /^(https?:\/\/|\/(?!\/))/i;

const safeUrl = (value: unknown): string | null =>
  typeof value === 'string' && SAFE_URL.test(value) ? value : null;

/** Validates anything (API response, localStorage) into a Branding, or null. */
export function toBranding(value: unknown): Branding | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.siteName !== 'string' || v.siteName.trim() === '') return null;
  const assets = (typeof v.assets === 'object' && v.assets !== null ? v.assets : {}) as Record<
    string,
    unknown
  >;
  return {
    siteName: v.siteName,
    siteDescription: typeof v.siteDescription === 'string' ? v.siteDescription : '',
    assets: {
      logo: safeUrl(assets.logo),
      logoMark: safeUrl(assets.logoMark),
      authLogo: safeUrl(assets.authLogo),
      favicon: safeUrl(assets.favicon),
    },
    version: typeof v.version === 'number' ? v.version : 0,
  };
}

let current: Branding = toBranding(storage.read(KEY)) ?? DEFAULT_BRANDING;
const listeners = new Set<() => void>();

const notify = () => {
  for (const listener of listeners) listener();
};

const same = (a: Branding, b: Branding) => JSON.stringify(a) === JSON.stringify(b);

export const brandingStore = {
  get: (): Branding => current,

  /** New values (from the API or the settings page): stored and pushed to every subscriber. */
  set(next: Branding): void {
    if (same(next, current)) return;
    current = next;
    storage.write(KEY, next);
    notify();
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

// Other tabs: the settings page saved there.
storage.subscribe(KEY, (value) => {
  const next = toBranding(value);
  if (next && !same(next, current)) {
    current = next;
    notify();
  }
});

// ---------------------------------------------------------------- <head>

function setMeta(name: string, content: string): void {
  const meta = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (meta && meta.content !== content) meta.content = content;
}

/** Favicon, description and app names in <head> (document.title is set by PageTitle). */
export function applyBrandingToHead(branding: Branding): void {
  if (typeof document === 'undefined') return;
  const href = branding.assets.favicon ?? appConfig.favicon;
  let icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!icon) {
    icon = document.createElement('link');
    icon.rel = 'icon';
    document.head.appendChild(icon);
  }
  if (icon.getAttribute('href') !== href) {
    icon.setAttribute('href', href);
    // Uploaded favicons are PNG / WebP / JPEG; let the browser sniff the default SVG.
    icon.removeAttribute('type');
  }
  setMeta('description', branding.siteDescription);
  setMeta('application-name', branding.siteName);
  setMeta('apple-mobile-web-app-title', branding.siteName);
}
