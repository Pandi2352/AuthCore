/** Save status of the application look (AppearanceSync → Appearance page header). */
export interface AppearanceSaveState {
  status: 'idle' | 'saving' | 'saved' | 'error';
  lastSavedAt: string | null;
}

let state: AppearanceSaveState = { status: 'idle', lastSavedAt: null };
const listeners = new Set<() => void>();

export const appearanceSyncStore = {
  get: (): AppearanceSaveState => state,
  set(changes: Partial<AppearanceSaveState>): void {
    const next = { ...state, ...changes };
    if (next.status === state.status && next.lastSavedAt === state.lastSavedAt) return;
    state = next;
    for (const listener of listeners) listener();
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
