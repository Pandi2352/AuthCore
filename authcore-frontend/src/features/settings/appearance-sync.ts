/**
 * Sync state of the signed-in user's appearance, shared by AppearanceSync (app) and the
 * Appearance page (toggle + status chip). Plain store: no React context needed.
 */
export interface AppearanceSyncState {
  /** Signed in and the server answered: syncing is possible. */
  isAvailable: boolean;
  syncEnabled: boolean;
  status: 'idle' | 'saving' | 'saved' | 'error';
  lastSyncedAt: string | null;
}

let state: AppearanceSyncState = {
  isAvailable: false,
  syncEnabled: true,
  status: 'idle',
  lastSyncedAt: null,
};
const listeners = new Set<() => void>();

export const appearanceSyncStore = {
  get: (): AppearanceSyncState => state,
  set(changes: Partial<AppearanceSyncState>): void {
    const next = { ...state, ...changes };
    if (JSON.stringify(next) === JSON.stringify(state)) return;
    state = next;
    for (const listener of listeners) listener();
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

/** Mode, preset and options of a theme as the API stores them. */
export function themeValues(theme: { mode: string; preset: string; appearance: object }): {
  mode: string;
  preset: string;
  appearance: Record<string, string>;
} {
  return {
    mode: theme.mode,
    preset: theme.preset,
    appearance: Object.fromEntries(
      Object.entries(theme.appearance).filter(([, v]) => typeof v === 'string'),
    ) as Record<string, string>,
  };
}
