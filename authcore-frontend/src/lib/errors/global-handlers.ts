import { isChunkLoadError, reloadOnceForChunkError } from './chunk-reload';
import { reportError } from './report-error';

let installed = false;

/**
 * Last-resort listeners (call once in main.tsx):
 * - `vite:preloadError` (a lazy chunk / its CSS failed after a deploy) → reload once
 * - uncaught errors and unhandled promise rejections → reportError
 * Errors React catches (boundaries, route errorElement) are reported where they are caught.
 */
export function installGlobalErrorHandlers(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  window.addEventListener('vite:preloadError', (event) => {
    if (reloadOnceForChunkError()) event.preventDefault();
  });

  window.addEventListener('error', (event) => {
    // Resource loading errors (img, script tags) have no `error` object.
    if (!event.error) return;
    if (isChunkLoadError(event.error) && reloadOnceForChunkError()) return;
    reportError(event.error, {
      source: 'window.error',
      extra: { file: event.filename, line: event.lineno },
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    if (isChunkLoadError(event.reason) && reloadOnceForChunkError()) return;
    reportError(event.reason, { source: 'unhandledrejection' });
  });
}
