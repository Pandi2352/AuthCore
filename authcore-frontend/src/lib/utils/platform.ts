/** Apple keyboards use ⌘ where others use Ctrl. */
export const isMacPlatform = (): boolean =>
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);

/** Label for the primary modifier key: "⌘" or "Ctrl". */
export const modKeyLabel = (): string => (isMacPlatform() ? '⌘' : 'Ctrl');

/** True for Ctrl+<key> (Windows / Linux) or ⌘+<key> (macOS), without Alt / Shift. */
export function isModShortcut(event: KeyboardEvent, key: string): boolean {
  return (
    event.key.toLowerCase() === key &&
    (event.ctrlKey || event.metaKey) &&
    !event.altKey &&
    !event.shiftKey
  );
}
