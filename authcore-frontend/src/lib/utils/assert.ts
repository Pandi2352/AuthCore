/**
 * Throw when a condition that must hold doesn't (a programming error, not user input).
 * Narrows types: after `invariant(user, 'user required')`, `user` is non-null.
 */
export function invariant(condition: unknown, message: string | (() => string)): asserts condition {
  if (condition) return;
  throw new Error(`Invariant failed: ${typeof message === 'function' ? message() : message}`);
}

/**
 * Exhaustive switch: TypeScript errors at compile time when a union member is not handled,
 * and it throws at run time if an unexpected value slips through (e.g. new API data).
 *
 *   switch (status) {
 *     case 'active': …
 *     case 'suspended': …
 *     default: return assertNever(status);
 *   }
 */
export function assertNever(value: never, message?: string): never {
  throw new Error(message ?? `Unhandled value: ${JSON.stringify(value)}`);
}

/** Non-null / non-undefined filter that narrows: items.filter(isDefined). */
export const isDefined = <T>(value: T | null | undefined): value is T =>
  value !== null && value !== undefined;
