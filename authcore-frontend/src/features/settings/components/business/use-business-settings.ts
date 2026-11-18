import { useCallback, useEffect, useState } from 'react';

import { isAbortError } from '@/lib/api';
import { brandingStore, toBranding } from '@/lib/branding';

import { businessSettingsApi } from '../../api/business-settings.api';
import type { BusinessSettings } from '../../types/business-settings.types';

type LoadState =
  | { status: 'loading'; data: null; error: null }
  | { status: 'ready'; data: BusinessSettings; error: null }
  | { status: 'error'; data: null; error: unknown };

/** What every page shows, from the admin view (pushed to the live branding store). */
export const toPublicBranding = (settings: BusinessSettings) =>
  toBranding({
    siteName: settings.siteName,
    siteDescription: settings.siteDescription,
    assets: {
      logo: settings.assets.logo?.url ?? null,
      logoMark: settings.assets.logoMark?.url ?? null,
      authLogo: settings.assets.authLogo?.url ?? null,
      favicon: settings.assets.favicon?.url ?? null,
    },
    version: settings.version,
  });

/**
 * Admin business settings: load (cancelled on unmount / reload), and `apply()` for every
 * server answer (save, upload, remove) so the page, the sidebar, the tab title and the
 * favicon all update at once.
 */
export function useBusinessSettings(enabled: boolean) {
  // Each load has a key; results are tagged with it, so the status is derived (no "loading"
  // state to set) and a stale answer can never overwrite a newer one.
  const [nonce, setNonce] = useState(0);
  const requestKey = String(nonce);
  const [result, setResult] = useState<{ key: string; data: BusinessSettings } | null>(null);
  const [failure, setFailure] = useState<{ key: string; error: unknown } | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const load = async () => {
      try {
        const data = await businessSettingsApi.get(controller.signal);
        setResult({ key: requestKey, data });
      } catch (error) {
        if (!isAbortError(error)) setFailure({ key: requestKey, error });
      }
    };
    void load();
    return () => controller.abort();
  }, [enabled, requestKey]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  const apply = useCallback(
    (data: BusinessSettings) => {
      setResult({ key: requestKey, data });
      const branding = toPublicBranding(data);
      if (branding) brandingStore.set(branding);
    },
    [requestKey],
  );

  let state: LoadState;
  if (result?.key === requestKey) state = { status: 'ready', data: result.data, error: null };
  else if (failure?.key === requestKey)
    state = { status: 'error', data: null, error: failure.error };
  else state = { status: 'loading', data: null, error: null };

  return { ...state, reload, apply };
}
