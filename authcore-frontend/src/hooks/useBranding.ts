import { useSyncExternalStore } from 'react';

import { brandingStore, type Branding } from '@/lib/branding';

/**
 * Site name, description, logos and favicon from Business settings (live: re-renders when an
 * admin saves, in this tab or another one).
 *
 *   const { siteName, assets } = useBranding();
 */
export function useBranding(): Branding {
  return useSyncExternalStore(brandingStore.subscribe, brandingStore.get, brandingStore.get);
}
