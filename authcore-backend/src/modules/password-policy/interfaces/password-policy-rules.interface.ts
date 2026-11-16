/** The configurable password rules (stored in `password_policies`). */
export interface PasswordPolicyRules {
  policyName: string;
  characterLength: {
    minimum: number;
    maximum: number;
  };
  complexity: {
    minimumDigitCount: number;
    minimumSpecialCharacterCount: number;
    /** At least one lowercase and one uppercase letter. */
    requireUpperAndLowerCase: boolean;
    /** Raise above 1 for stricter policies (0 = only what requireUpperAndLowerCase asks). */
    minimumUppercaseCount: number;
    minimumLowercaseCount: number;
  };
  passwordHistory: {
    preventReuse: boolean;
    /** Previous passwords checked in addition to the current one. */
    historyCount: number;
  };
  additionalRules: {
    blockCommonPasswords: boolean;
    /** Checks Have I Been Pwned (k-anonymity: only 5 hash characters leave the server). */
    blockCompromisedPasswords: boolean;
    /** Email name, username, first and last name must not appear in the password. */
    preventPersonalInfoInPassword: boolean;
    allowWhitespace: boolean;
    /** Longest run of the same character, e.g. 3 rejects "aaaa" (0 = no limit). */
    maximumRepeatedCharacters: number;
    /** Minimum time between password changes by the user (0 = no limit). */
    minimumPasswordAgeHours: number;
  };
  passwordValidity: {
    enabled: boolean;
    validityDays: number;
    notificationDaysBeforeExpiry: number[];
    /** Days after expiry during which sign-in still works without a change. */
    gracePeriodDays: number;
    /** After expiry (+ grace): only change-password / me / logout are allowed. */
    forceChangeOnExpiry: boolean;
  };
}

/** Personal details a password must not contain. */
export interface PasswordOwnerInfo {
  email?: string | null;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}

/** One failed rule. */
export interface PasswordViolation {
  rule: string;
  message: string;
}

/** Expiry state of a user's password under the current policy. */
export interface PasswordExpiryStatus {
  /** null when password validity is disabled. */
  expiresAt: Date | null;
  isExpired: boolean;
  /** Expired, grace period over and forceChangeOnExpiry on. */
  isChangeRequired: boolean;
}
