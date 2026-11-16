import type { PasswordPolicyRules } from '../interfaces/password-policy-rules.interface';

/**
 * Hard limits no policy can go beyond. The maximum length caps the work an
 * attacker can force on the Argon2 hasher; DTOs reject longer input before
 * the policy is even read.
 */
export const PASSWORD_HARD_LIMITS = {
  minLength: 8,
  maxLength: 128,
  maxCharacterClassCount: 10,
  maxHistoryCount: 24,
  maxValidityDays: 365,
  maxGracePeriodDays: 30,
  maxNotificationDays: 5,
  maxRepeatedCharacters: 10,
  maxMinimumAgeHours: 720,
} as const;

/**
 * Built-in policy, used until an admin saves one. Passwords like "Test@123":
 * 8+ characters with an uppercase letter, a lowercase letter, a digit and a
 * special character.
 */
export const DEFAULT_PASSWORD_POLICY: PasswordPolicyRules = {
  policyName: 'default',
  characterLength: { minimum: 8, maximum: 64 },
  complexity: {
    minimumDigitCount: 1,
    minimumSpecialCharacterCount: 1,
    requireUpperAndLowerCase: true,
    minimumUppercaseCount: 0,
    minimumLowercaseCount: 0,
  },
  passwordHistory: { preventReuse: true, historyCount: 5 },
  additionalRules: {
    blockCommonPasswords: true,
    blockCompromisedPasswords: false,
    preventPersonalInfoInPassword: true,
    allowWhitespace: false,
    maximumRepeatedCharacters: 0,
    minimumPasswordAgeHours: 0,
  },
  passwordValidity: {
    enabled: false,
    validityDays: 90,
    notificationDaysBeforeExpiry: [14, 7, 3],
    gracePeriodDays: 0,
    forceChangeOnExpiry: true,
  },
};

/** The single global policy document (one policy until multi-tenancy). */
export const GLOBAL_POLICY_KEY = 'global';

/** Instances re-read the policy at most this often (updates apply without a restart). */
export const POLICY_CACHE_TTL_MS = 15_000;

/** Parts of the user's details shorter than this are not checked. */
export const PERSONAL_INFO_MIN_LENGTH = 4;

/** Special characters: anything that is not a letter, digit or whitespace. */
export const SPECIAL_CHARACTER = /[^\p{L}\p{N}\s]/gu;

export const POLICY_UPDATE_THROTTLE = { limit: 10, ttl: 60_000 } as const;
export const VALIDATE_PASSWORD_THROTTLE = { limit: 30, ttl: 60_000 } as const;
