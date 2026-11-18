import { useSyncExternalStore } from 'react';

import type { emojiIcons as EmojiIconMap } from '@/config/emoji-icons';

/**
 * The Fluent Emoji icons (src/config/emoji-icons.ts) load on demand in their own chunk: only
 * people who pick the "Emoji" icon style download them. One shared load; until it arrives
 * (or if it fails, e.g. offline) callers show the classic icon.
 */
let cache: typeof EmojiIconMap | null = null;
let isLoading = false;
const listeners = new Set<() => void>();

async function fetchIcons(): Promise<void> {
  try {
    cache = (await import('@/config/emoji-icons')).emojiIcons;
    for (const listener of listeners) listener();
  } catch {
    isLoading = false; // try again next time
  }
}

export function useEmojiIcons(enabled: boolean): typeof EmojiIconMap | null {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      if (enabled && !cache && !isLoading) {
        isLoading = true;
        void fetchIcons();
      }
      return () => listeners.delete(onChange);
    },
    () => (enabled ? cache : null),
    () => null,
  );
}
