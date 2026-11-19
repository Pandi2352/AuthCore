import { useEffect, useSyncExternalStore } from 'react';

import { accountApi } from '../api/account.api';

/**
 * My profile picture link, shared by the sidebar card and the profile header: loaded once,
 * reloaded after an upload / removal (`reloadMyAvatar`).
 */
let url: string | null = null;
let state: 'idle' | 'loading' | 'done' = 'idle';
/** Whose picture `url` is (another sign-in starts over). */
let owner: string | undefined;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

async function load() {
  state = 'loading';
  try {
    url = await accountApi.getAvatarUrl();
  } catch {
    url = null;
  } finally {
    state = 'done';
    emit();
  }
}

/** Fetch again (after changing the picture). */
export function reloadMyAvatar(): void {
  void load();
}

/** Forget it (signed out). */
export function clearMyAvatar(): void {
  url = null;
  state = 'idle';
  emit();
}

export function useMyAvatar(userId: string | undefined): string | null {
  const value = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => url,
  );
  useEffect(() => {
    if (!userId) return;
    if (owner !== userId) {
      owner = userId;
      url = null;
      void load();
    } else if (state === 'idle') {
      void load();
    }
  }, [userId]);
  return userId ? value : null;
}
