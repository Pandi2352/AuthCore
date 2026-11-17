import type { ReactNode } from 'react';

export interface CommandItem {
  id: string;
  label: string;
  /** Second line (e.g. the page's section). Also searched. */
  description?: string;
  /** Extra search words (synonyms, old names). */
  keywords?: readonly string[];
  icon?: ReactNode;
  /** Display-only hint, e.g. "Ctrl B". */
  shortcut?: string;
  /** Small label on the right, e.g. "Soon". */
  badge?: string;
  disabled?: boolean;
  onSelect: () => void;
}

export interface CommandGroup {
  id: string;
  heading: string;
  items: readonly CommandItem[];
}

/**
 * Every word of the query must appear in the label, description or keywords.
 * Label matches rank first (prefix > word start > anywhere). Empty query: everything, in order.
 */
export function filterCommandGroups(
  groups: readonly CommandGroup[],
  query: string,
): CommandGroup[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return groups.filter((g) => g.items.length > 0);

  const score = (item: CommandItem): number => {
    const label = item.label.toLowerCase();
    const haystack = [label, item.description ?? '', ...(item.keywords ?? [])]
      .join(' ')
      .toLowerCase();
    if (!words.every((w) => haystack.includes(w))) return -1;
    const first = words[0] ?? '';
    if (label.startsWith(first)) return 3;
    if (label.split(/[\s/-]+/).some((part) => part.startsWith(first))) return 2;
    return label.includes(first) ? 1 : 0;
  };

  return groups
    .map((group) => ({
      ...group,
      items: group.items
        .map((item, index) => ({ item, index, s: score(item) }))
        .filter((x) => x.s >= 0)
        .toSorted((a, b) => b.s - a.s || a.index - b.index)
        .map((x) => x.item),
    }))
    .filter((group) => group.items.length > 0);
}
