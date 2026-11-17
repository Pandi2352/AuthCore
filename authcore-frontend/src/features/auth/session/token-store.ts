/**
 * The access token, in memory only (never localStorage: an XSS could read it there).
 * After a reload the session comes back through the httpOnly refresh cookie.
 */
let accessToken: string | null = null;
const listeners = new Set<(token: string | null) => void>();

export const tokenStore = {
  get: (): string | null => accessToken,
  set(token: string | null): void {
    if (token === accessToken) return;
    accessToken = token;
    for (const listener of listeners) listener(token);
  },
  clear(): void {
    tokenStore.set(null);
  },
  subscribe(listener: (token: string | null) => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
