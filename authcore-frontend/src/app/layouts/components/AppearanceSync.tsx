import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { useTheme } from '@/app/theme';
import { useAuth } from '@/features/auth';
import {
  appearanceApi,
  appearanceSyncStore,
  themeValues,
  toOrganization,
} from '@/features/settings';
import { isAbortError } from '@/lib/api';

/** Changes are pushed this long after the last one (sliders, quick clicks → one request). */
const PUSH_DELAY_MS = 1000;

/**
 * Keeps the theme in sync with the server:
 * - the organization appearance (defaults + locked options) on every page load, signed in or not;
 * - signed in with sync on: the user's look is pulled once, then every change is pushed
 *   (debounced). Failures never block the UI — the local look keeps working.
 */
export function AppearanceSync() {
  const theme = useTheme();
  const { setOrganization, applyTheme } = theme;
  const { isAuthenticated, user } = useAuth();
  const userId = isAuthenticated ? (user?.id ?? null) : null;
  const sync = useSyncExternalStore(appearanceSyncStore.subscribe, appearanceSyncStore.get);
  const [pulledFor, setPulledFor] = useState<string | null>(null);
  const lastSent = useRef<string | null>(null);
  const skipNextPush = useRef(false);

  // Organization look (public endpoint).
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        setOrganization(toOrganization(await appearanceApi.getOrgPublic(controller.signal)));
      } catch {
        // Keep the cached organization look.
      }
    })();
    return () => controller.abort();
  }, [setOrganization]);

  // Pull the user's look once per sign-in.
  useEffect(() => {
    if (!userId) {
      appearanceSyncStore.set({ isAvailable: false, status: 'idle' });
      return;
    }
    const controller = new AbortController();
    void (async () => {
      try {
        const mine = await appearanceApi.getMine(controller.signal);
        appearanceSyncStore.set({
          isAvailable: true,
          syncEnabled: mine.syncEnabled,
          lastSyncedAt: mine.updatedAt,
          status: 'idle',
        });
        if (mine.syncEnabled && mine.theme) {
          // The look from the account wins over this browser's; don't push it straight back.
          skipNextPush.current = true;
          applyTheme({
            ...(mine.theme.mode ? { mode: mine.theme.mode as never } : {}),
            ...(mine.theme.preset ? { preset: mine.theme.preset as never } : {}),
            appearance: mine.theme.appearance as never,
          });
        }
        setPulledFor(userId);
      } catch (error) {
        if (!isAbortError(error)) appearanceSyncStore.set({ isAvailable: false, status: 'error' });
      }
    })();
    return () => controller.abort();
  }, [userId, applyTheme]);

  // Push changes (sync on, after the pull).
  const values = theme.isCustomized ? themeValues(theme) : null;
  const key = JSON.stringify(values);
  useEffect(() => {
    if (!userId || pulledFor !== userId || !sync.syncEnabled) return;
    if (skipNextPush.current) {
      skipNextPush.current = false;
      lastSent.current = key;
      return;
    }
    if (key === lastSent.current) return;
    const timer = window.setTimeout(() => {
      void (async () => {
        appearanceSyncStore.set({ status: 'saving' });
        try {
          const saved = await appearanceApi.updateMine({
            syncEnabled: true,
            theme: JSON.parse(key) as ReturnType<typeof themeValues> | null,
          });
          lastSent.current = key;
          appearanceSyncStore.set({ status: 'saved', lastSyncedAt: saved.updatedAt });
        } catch {
          appearanceSyncStore.set({ status: 'error' });
        }
      })();
    }, PUSH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [key, userId, pulledFor, sync.syncEnabled]);

  return null;
}
