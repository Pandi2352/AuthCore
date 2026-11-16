/**
 * Password rules for registration (and later: password change / reset).
 * Max length caps the work an attacker can force on the password hasher.
 * Becomes configurable per tenant in the Configuration & Policy module.
 */
export const PASSWORD_POLICY = {
  minLength: 8,
  maxLength: 128,
  minLowercase: 1,
  minUppercase: 1,
  minNumbers: 1,
  minSymbols: 1,
} as const;

/** Parts of the user's own details (email name, username, names) shorter than this are not checked. */
export const PASSWORD_PERSONAL_INFO_MIN_LENGTH = 4;

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
