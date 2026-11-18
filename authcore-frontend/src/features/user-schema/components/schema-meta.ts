import {
  AlignLeft,
  AtSign,
  Calendar,
  CalendarClock,
  Hash,
  Layers,
  Link2,
  ListChecks,
  Mail,
  Smartphone,
  SquareChevronDown,
  ToggleRight,
  Type,
  type LucideIcon,
} from 'lucide-react';

import type {
  AttributeDataType,
  AttributeGroupType,
  SchemaAttribute,
} from '../types/user-schema.types';

export interface DataTypeMeta {
  label: string;
  hint: string;
  icon: LucideIcon;
}

/** Display order of the data type picker. */
export const DATA_TYPES: Record<AttributeDataType, DataTypeMeta> = {
  TEXT: { label: 'Text', hint: 'A short line, e.g. employee ID', icon: Type },
  TEXTAREA: { label: 'Long text', hint: 'Several lines, e.g. a bio', icon: AlignLeft },
  EMAIL: { label: 'Email', hint: 'A valid email address', icon: Mail },
  MOBILE: { label: 'Mobile', hint: 'International format, +91…', icon: Smartphone },
  NUMBER: { label: 'Number', hint: 'Whole or decimal number', icon: Hash },
  BOOLEAN: { label: 'Yes / No', hint: 'A switch', icon: ToggleRight },
  DATE: { label: 'Date', hint: 'Day, month and year', icon: Calendar },
  DATETIME: { label: 'Date & time', hint: 'A moment in time', icon: CalendarClock },
  URL: { label: 'URL', hint: 'A web address', icon: Link2 },
  DROPDOWN: { label: 'Dropdown list', hint: 'Pick one option', icon: SquareChevronDown },
  MULTI_SELECT: { label: 'Multi-select', hint: 'Pick several options', icon: ListChecks },
};

export const GROUP_TYPES: Record<AttributeGroupType, { label: string; hint: string }> = {
  OBJECT: { label: 'Single', hint: 'One set of values, e.g. a home address' },
  LIST: { label: 'List', hint: 'Several entries, e.g. many addresses (up to 20)' },
};

export const GROUP_ICON = Layers;
export const USERNAME_ICON = AtSign;

/** Data types with a length limit / with options / usable as a sign-in identifier. */
export const LENGTH_TYPES: readonly AttributeDataType[] = [
  'TEXT',
  'TEXTAREA',
  'EMAIL',
  'URL',
  'MOBILE',
];
export const OPTION_TYPES: readonly AttributeDataType[] = ['DROPDOWN', 'MULTI_SELECT'];
export const USERNAME_TYPES: readonly AttributeDataType[] = ['TEXT', 'EMAIL', 'MOBILE', 'NUMBER'];

export const NAME_PATTERN = /^[a-z][a-z0-9_]{1,49}$/;
export const SCOPE_PATTERN = /^[a-z][a-z0-9_:.-]{1,49}$/;

/** "Employee ID" → "employee_id" (the variable name). */
export function toSnakeCase(label: string): string {
  const snake = label
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/^[^a-z]+/, '')
    .slice(0, 50);
  return snake;
}

export function typeLabel(attribute: SchemaAttribute): string {
  if (attribute.kind === 'GROUP') {
    return attribute.groupType === 'LIST' ? 'Group · list' : 'Group';
  }
  return attribute.dataType ? DATA_TYPES[attribute.dataType].label : 'Field';
}

export function typeIcon(attribute: SchemaAttribute): LucideIcon {
  if (attribute.kind === 'GROUP' || !attribute.dataType) return GROUP_ICON;
  return DATA_TYPES[attribute.dataType].icon;
}

export type TypeFilter = 'all' | 'GROUP' | AttributeDataType;
export type SourceFilter = 'all' | 'system' | 'custom';
export type StatusFilter = 'all' | 'enabled' | 'disabled';

export interface SchemaFilters {
  search: string;
  type: TypeFilter;
  source: SourceFilter;
  status: StatusFilter;
}

export const NO_FILTERS: SchemaFilters = { search: '', type: 'all', source: 'all', status: 'all' };

export const hasFilters = (f: SchemaFilters): boolean =>
  f.search.trim() !== '' || f.type !== 'all' || f.source !== 'all' || f.status !== 'all';

function matches(attribute: SchemaAttribute, f: SchemaFilters): boolean {
  const q = f.search.trim().toLowerCase();
  if (
    q &&
    !attribute.name.toLowerCase().includes(q) &&
    !attribute.label.toLowerCase().includes(q) &&
    !attribute.description.toLowerCase().includes(q)
  ) {
    return false;
  }
  if (f.type === 'GROUP' && attribute.kind !== 'GROUP') return false;
  if (f.type !== 'all' && f.type !== 'GROUP' && attribute.dataType !== f.type) return false;
  if (f.source === 'system' && !attribute.isSystem) return false;
  if (f.source === 'custom' && attribute.isSystem) return false;
  if (f.status === 'enabled' && !attribute.isEnabled) return false;
  if (f.status === 'disabled' && attribute.isEnabled) return false;
  return true;
}

export interface SchemaRow {
  attribute: SchemaAttribute;
  /** Children shown under a group (filtered). */
  children: SchemaAttribute[];
  /** All children, for counts and "can delete". */
  childCount: number;
}

const byOrder = (a: SchemaAttribute, b: SchemaAttribute) =>
  a.displayOrder - b.displayOrder || a.label.localeCompare(b.label);

/**
 * Top-level rows with their children. A group stays visible when one of its children
 * matches; a group that matches shows every child.
 */
export function buildRows(all: SchemaAttribute[], f: SchemaFilters): SchemaRow[] {
  const childrenOf = new Map<string, SchemaAttribute[]>();
  for (const a of all) {
    if (a.parentId) childrenOf.set(a.parentId, [...(childrenOf.get(a.parentId) ?? []), a]);
  }
  const rows: SchemaRow[] = [];
  for (const attribute of all.filter((a) => !a.parentId).toSorted(byOrder)) {
    const children = (childrenOf.get(attribute.id) ?? []).toSorted(byOrder);
    const selfMatch = matches(attribute, f);
    const shown =
      selfMatch && attribute.kind === 'GROUP' ? children : children.filter((c) => matches(c, f));
    if (selfMatch || shown.length > 0) {
      rows.push({ attribute, children: shown, childCount: children.length });
    }
  }
  return rows;
}
