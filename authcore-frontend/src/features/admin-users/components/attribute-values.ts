import type { FormAttribute } from '../types/create-user.types';

/** Form state of custom variables: text inputs keep strings, booleans, string[] for multi-select. */
export type FieldValue = string | boolean | string[];
export type GroupValue = Record<string, FieldValue>;
export type AttributeValues = Record<string, FieldValue | GroupValue | GroupValue[]>;

const EMAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;
const MOBILE = /^\+[1-9]\d{6,14}$/;
const URL_PATTERN = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;

function emptyField(attribute: FormAttribute): FieldValue {
  if (attribute.dataType === 'BOOLEAN') return false;
  if (attribute.dataType === 'MULTI_SELECT') return [];
  return '';
}

export function emptyGroupEntry(group: FormAttribute): GroupValue {
  return Object.fromEntries((group.children ?? []).map((c) => [c.name, emptyField(c)]));
}

export function emptyValues(attributes: FormAttribute[]): AttributeValues {
  return Object.fromEntries(
    attributes.map((a) => [
      a.name,
      a.kind === 'GROUP' ? (a.groupType === 'LIST' ? [] : emptyGroupEntry(a)) : emptyField(a),
    ]),
  );
}

const isBlank = (value: FieldValue | undefined) =>
  value === undefined || value === '' || (Array.isArray(value) && value.length === 0);

/** One field's problem, or null. */
function fieldProblem(attribute: FormAttribute, value: FieldValue | undefined): string | null {
  if (attribute.dataType === 'BOOLEAN') return null;
  if (isBlank(value)) return attribute.isRequired ? `Enter ${lowerFirst(attribute.label)}` : null;
  if (Array.isArray(value)) return null;
  const text = String(value).trim();
  switch (attribute.dataType) {
    case 'EMAIL':
      if (!EMAIL.test(text)) return 'Enter a valid email address';
      break;
    case 'MOBILE':
      if (!MOBILE.test(text)) return 'Use the international format, e.g. +919876543210';
      break;
    case 'URL':
      if (!URL_PATTERN.test(text)) return 'Enter a full web address starting with https://';
      break;
    case 'NUMBER': {
      const n = Number(text);
      if (!Number.isFinite(n)) return 'Enter a number';
      if (attribute.min !== null && n < attribute.min) return `Use ${attribute.min} or more`;
      if (attribute.max !== null && n > attribute.max) return `Use ${attribute.max} or less`;
      return null;
    }
    default:
      break;
  }
  if (attribute.minLength !== null && text.length < attribute.minLength)
    return `Use at least ${attribute.minLength} characters`;
  if (attribute.maxLength !== null && text.length > attribute.maxLength)
    return `Use at most ${attribute.maxLength} characters`;
  return null;
}

/** Problems by path, matching the API's error fields ("attributes.address.locality"). */
export function validateAttributes(
  attributes: FormAttribute[],
  values: AttributeValues,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const a of attributes) {
    const path = `attributes.${a.name}`;
    if (a.kind === 'FIELD') {
      const problem = fieldProblem(a, values[a.name] as FieldValue | undefined);
      if (problem) errors[path] = problem;
      continue;
    }
    const entries =
      a.groupType === 'LIST'
        ? ((values[a.name] as GroupValue[] | undefined) ?? [])
        : [(values[a.name] as GroupValue | undefined) ?? {}];
    if (a.groupType === 'LIST' && a.isRequired && entries.length === 0)
      errors[path] = `Add at least one ${lowerFirst(a.label)}`;
    entries.forEach((entry, index) => {
      // An untouched optional single group is not validated.
      const isUsed = Object.values(entry).some((v) => v !== false && !isBlank(v));
      if (a.groupType !== 'LIST' && !a.isRequired && !isUsed) return;
      for (const child of a.children ?? []) {
        const problem = fieldProblem(child, entry[child.name]);
        if (problem)
          errors[
            a.groupType === 'LIST' ? `${path}.${index}.${child.name}` : `${path}.${child.name}`
          ] = problem;
      }
    });
  }
  return errors;
}

function toApiValue(attribute: FormAttribute, value: FieldValue | undefined): unknown {
  if (attribute.dataType === 'BOOLEAN') return value === true;
  if (isBlank(value)) return undefined;
  if (Array.isArray(value)) return value;
  const text = String(value).trim();
  if (attribute.dataType === 'NUMBER') return Number(text);
  if (attribute.dataType === 'DATETIME') return new Date(text).toISOString();
  return text;
}

function groupToApi(group: FormAttribute, entry: GroupValue): Record<string, unknown> | undefined {
  const result: Record<string, unknown> = {};
  for (const child of group.children ?? []) {
    const value = toApiValue(child, entry[child.name]);
    if (value !== undefined && !(child.dataType === 'BOOLEAN' && value === false)) {
      result[child.name] = value;
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

/** The "attributes" body of POST /admin/users (empty values left out). */
export function toAttributesPayload(
  attributes: FormAttribute[],
  values: AttributeValues,
): Record<string, unknown> | undefined {
  const payload: Record<string, unknown> = {};
  for (const a of attributes) {
    if (a.kind === 'FIELD') {
      const value = toApiValue(a, values[a.name] as FieldValue | undefined);
      // An untouched Yes / No stays unset (not stored as "No").
      if (value !== undefined && value !== false) payload[a.name] = value;
    } else if (a.groupType === 'LIST') {
      const list = ((values[a.name] as GroupValue[] | undefined) ?? [])
        .map((entry) => groupToApi(a, entry))
        .filter((entry) => entry !== undefined);
      if (list.length > 0) payload[a.name] = list;
    } else {
      const entry = groupToApi(a, (values[a.name] as GroupValue | undefined) ?? {});
      if (entry) payload[a.name] = entry;
    }
  }
  return Object.keys(payload).length > 0 ? payload : undefined;
}

/** Variables a form shows, counted (groups count their children). */
export const countFields = (attributes: FormAttribute[]): number =>
  attributes.reduce((n, a) => n + (a.kind === 'GROUP' ? (a.children?.length ?? 0) : 1), 0);

/** "Employee ID" → "employee ID" (keeps acronyms readable in "Enter …" texts). */
export const lowerFirst = (label: string): string => label.charAt(0).toLowerCase() + label.slice(1);
