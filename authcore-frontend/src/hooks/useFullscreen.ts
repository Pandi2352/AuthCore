import { useCallback, useSyncExternalStore } from 'react';

const subscribe = (onChange: () => void) => {
  document.addEventListener('fullscreenchange', onChange);
  return () => document.removeEventListener('fullscreenchange', onChange);
};
const isFullscreenNow = () => document.fullscreenElement !== null;

/**
 * Browser full screen for the whole app (Fullscreen API). `supported` is false where the
 * browser doesn't allow it (iPhone Safari, some embedded views) — hide the control then.
 * State follows every way of leaving full screen (Esc, F11, the browser's own UI).
 */
export function useFullscreen() {
  const isFullscreen = useSyncExternalStore(subscribe, isFullscreenNow, () => false);
  const supported = typeof document !== 'undefined' && document.fullscreenEnabled === true;

  const toggle = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    } catch {
      // Refused (no user gesture, browser policy): nothing to do, the state stays as it is.
    }
  }, []);

  return { isFullscreen, supported, toggle };
}
