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
