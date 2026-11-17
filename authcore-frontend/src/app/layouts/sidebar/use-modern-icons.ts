import { useSyncExternalStore } from 'react';

import type { modernIcons as ModernIconMap } from '@/config/modern-icons';

/**
 * Phosphor icons are loaded on demand (own chunk): classic-icon users never download them.
 * One shared load; every icon re-renders when it arrives (until then: the classic icon).
 */
let cache: typeof ModernIconMap | null = null;
let loading = false;
const listeners = new Set<() => void>();

async function fetchIcons(): Promise<void> {
  try {
    cache = (await import('@/config/modern-icons')).modernIcons;
    for (const listener of listeners) listener();
  } catch {
    loading = false; // try again next time (e.g. offline); classic icons meanwhile
  }
}

function load(): void {
  if (cache || loading) return;
  loading = true;
  void fetchIcons();
}

export function useModernIcons(enabled: boolean): typeof ModernIconMap | null {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      if (enabled) load();
      return () => listeners.delete(onChange);
    },
    () => (enabled ? cache : null),
    () => null,
  );
}
