/*
 * class-transformer @Transform() helpers for DTOs:
 *   @Transform(trimLower) email!: string;
 */

interface TransformInput {
  value: unknown;
}

export const trim = ({ value }: TransformInput): unknown =>
  typeof value === 'string' ? value.trim() : value;

export const trimLower = ({ value }: TransformInput): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

/** Empty optional strings become undefined, so "" is treated as "not given". */
export const trimOrUndefined = ({ value }: TransformInput): unknown => {
  if (typeof value !== 'string') {
    return value;
  }
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
};

export const trimLowerOrUndefined = ({ value }: TransformInput): unknown => {
  const trimmed = trimOrUndefined({ value });
  return typeof trimmed === 'string' ? trimmed.toLowerCase() : trimmed;
};

/** Keys and codes: trimmed and uppercase ("org_admin " → "ORG_ADMIN"). */
export const trimUpper = ({ value }: TransformInput): unknown =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

/** Display names: trimmed, inner whitespace collapsed to one space. */
export const normalizeName = ({ value }: TransformInput): unknown =>
  typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value;

/**
 * Tags from "a, b ,c" or ["a", "b"]: split on commas, trimmed, lowercase,
 * empty entries and duplicates removed. Non-string input is left for the
 * validators to reject.
 */
export const parseTags = ({ value }: TransformInput): unknown => {
  const parts = typeof value === 'string' ? value.split(',') : value;
  if (
    !Array.isArray(parts) ||
    !parts.every((part) => typeof part === 'string')
  ) {
    return value;
  }
  const tags = parts
    .map((tag) => tag.trim().toLowerCase())
    .filter((tag) => tag !== '');
  return [...new Set(tags)];
};
