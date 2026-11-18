import { useEffect } from 'react';

import { businessSettingsApi } from '@/features/settings';
import { useBranding } from '@/hooks';
import { applyBrandingToHead, brandingStore, toBranding } from '@/lib/branding';

/**
 * Loads the public Business settings once per page load (site name, description, logos,
 * favicon) into the branding store, and keeps <head> in sync with it. On failure the cached
 * or built-in values stay: branding never blocks the app.
 */
export function BrandingSync() {
  const branding = useBranding();

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const next = toBranding(await businessSettingsApi.getPublic(controller.signal));
        if (next) brandingStore.set(next);
      } catch {
        // Offline / backend down: keep what we have.
      }
    })();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    applyBrandingToHead(branding);
  }, [branding]);

  return null;
}
