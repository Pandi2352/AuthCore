import type { ReactNode } from 'react';

export interface SelectOption {
  value: string;
  label: string;
  /** Second line under the label. */
  description?: string;
  icon?: ReactNode;
  disabled?: boolean;
}

export interface SelectOptionGroup {
  label: string;
  options: SelectOption[];
}

export type SelectItems = Array<SelectOption | SelectOptionGroup>;

const isGroup = (item: SelectOption | SelectOptionGroup): item is SelectOptionGroup =>
  'options' in item;

/** Options in display order (groups flattened) with their group label. */
export function flattenOptions(items: SelectItems): Array<SelectOption & { group?: string }> {
  return items.flatMap((item) =>
    isGroup(item) ? item.options.map((o) => ({ ...o, group: item.label })) : [item],
  );
}

export const optionId = (listId: string, index: number) => `${listId}-option-${index}`;
