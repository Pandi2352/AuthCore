import { useEffect, useRef } from 'react';

import { useTheme } from '@/app/theme';
import { usePermissions } from '@/features/auth';
import { appearanceApi, appearanceSyncStore, toOrganization } from '@/features/settings';

/** Edits are saved this long after the last change (sliders, quick clicks → one request). */
const SAVE_DELAY_MS = 1000;

/**
 * The application look (Settings → Appearance):
 * - loaded from the server on every page load, for everyone (also the sign-in pages);
 * - users with APPEARANCE_SETTINGS_MANAGE (the super admin) may change it: their edits are
 *   saved automatically. Failures never block the UI — the cached look keeps working.
 */
export function AppearanceSync() {
  const { organization, setOrganization, setCanEdit } = useTheme();
  const { hasPermission } = usePermissions();
  const canEdit = hasPermission('APPEARANCE_SETTINGS_MANAGE');
  /** The look as the server has it (JSON); edits differ from it until saved. */
  const serverLook = useRef<string | null>(null);

  useEffect(() => setCanEdit(canEdit), [canEdit, setCanEdit]);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const look = toOrganization(await appearanceApi.getPublic(controller.signal));
        serverLook.current = JSON.stringify(look);
        setOrganization(look);
      } catch {
        // Keep the cached look.
      }
    })();
    return () => controller.abort();
  }, [setOrganization]);

  // Save the editor's changes (only after the server look is known).
  const key = JSON.stringify(organization);
  useEffect(() => {
    if (!canEdit || serverLook.current === null || key === serverLook.current) return;
    const look = organization;
    if (!look?.mode || !look.preset) return;
    const timer = window.setTimeout(() => {
      void (async () => {
        appearanceSyncStore.set({ status: 'saving' });
        try {
          const saved = await appearanceApi.update({
            mode: look.mode ?? 'system',
            preset: look.preset ?? 'default',
            appearance: look.appearance ?? {},
          });
          serverLook.current = key;
          appearanceSyncStore.set({ status: 'saved', lastSavedAt: saved.updatedAt });
        } catch {
          appearanceSyncStore.set({ status: 'error' });
        }
      })();
    }, SAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [key, canEdit, organization]);

  return null;
}
