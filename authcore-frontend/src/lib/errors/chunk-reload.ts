import { sessionFlag } from '../storage';

/**
 * After a new deployment the old lazy-loaded chunks are gone: an open tab fails to load the
 * next page. The fix is a full reload — once. If the reload doesn't help (real outage), the
 * error page shows instead of reloading forever.
 */
const FLAG = 'chunk-reload-at';
const WINDOW_MS = 60_000;

/** A failed dynamic import / preload (Vite, Chrome, Firefox, Safari wording). */
export function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error.name === 'ChunkLoadError' ||
    /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS|Loading (CSS )?chunk [\w-]+ failed/i.test(
      error.message,
    )
  );
}

/**
 * Reload the page for a chunk error, unless that already happened in the last minute.
 * Returns true when a reload was started (render nothing / a spinner then).
 */
export function reloadOnceForChunkError(): boolean {
  const last = Number(sessionFlag.get(FLAG) ?? 0);
  if (Date.now() - last < WINDOW_MS) return false;
  sessionFlag.set(FLAG, String(Date.now()));
  window.location.reload();
  return true;
}

/** Call once the app has loaded pages again (clears the guard for the next deploy). */
export function clearChunkReloadGuard(): void {
  sessionFlag.remove(FLAG);
}
