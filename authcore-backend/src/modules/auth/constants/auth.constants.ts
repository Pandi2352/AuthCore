import { PROJECT, PROJECT_KEY } from '@config/project';
/**
 * Longest password accepted anywhere (caps the work an attacker can force on
 * the hasher). The configurable password policy decides the actual rules.
 */
export const PASSWORD_MAX_LENGTH = 128;

/** Usernames: 3–30 chars, lowercase letters/digits, '.', '_' or '-' inside. */
export const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9._-]{1,28})[a-z0-9]$/;

/** Usernames nobody can register (impersonation of staff/system). */
export const RESERVED_USERNAMES: ReadonlySet<string> = new Set([
  'admin',
  'administrator',
  'root',
  'system',
  'support',
  'security',
  'help',
  'api',
  'authcore',
  PROJECT.slug,
  PROJECT_KEY,
  'null',
  'undefined',
]);

/** Person names: letters (any language), spaces, apostrophes, hyphens, dots. */
export const PERSON_NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M}' .-]*$/u;

/** Stricter rate limits (per IP) than the global default. */
export const REGISTER_THROTTLE = { limit: 5, ttl: 60_000 } as const;
export const VERIFY_EMAIL_THROTTLE = { limit: 10, ttl: 60_000 } as const;
export const LOGIN_THROTTLE = { limit: 10, ttl: 60_000 } as const;
export const REFRESH_THROTTLE = { limit: 30, ttl: 60_000 } as const;
export const RESEND_VERIFICATION_THROTTLE = { limit: 3, ttl: 60_000 } as const;
export const FORGOT_PASSWORD_THROTTLE = { limit: 3, ttl: 60_000 } as const;
export const VERIFY_RESET_THROTTLE = { limit: 10, ttl: 60_000 } as const;
export const RESET_PASSWORD_THROTTLE = { limit: 5, ttl: 60_000 } as const;
export const CHANGE_PASSWORD_THROTTLE = { limit: 5, ttl: 60_000 } as const;
