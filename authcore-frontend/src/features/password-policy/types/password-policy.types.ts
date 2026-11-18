/** The rules of one password policy (same shape as the backend's PasswordPolicyRules). */
export interface PasswordPolicyRules {
  policyName: string;
  characterLength: { minimum: number; maximum: number };
  complexity: {
    minimumDigitCount: number;
    minimumSpecialCharacterCount: number;
    /** At least one lowercase and one uppercase letter. */
    requireUpperAndLowerCase: boolean;
    minimumUppercaseCount: number;
    minimumLowercaseCount: number;
  };
  passwordHistory: { preventReuse: boolean; historyCount: number };
  additionalRules: {
    blockCommonPasswords: boolean;
    blockCompromisedPasswords: boolean;
    preventPersonalInfoInPassword: boolean;
    allowWhitespace: boolean;
    /** 0 = no limit. */
    maximumRepeatedCharacters: number;
    /** 0 = no limit. */
    minimumPasswordAgeHours: number;
  };
  passwordValidity: {
    enabled: boolean;
    validityDays: number;
    notificationDaysBeforeExpiry: number[];
    gracePeriodDays: number;
    forceChangeOnExpiry: boolean;
  };
}

export interface PasswordPolicy extends PasswordPolicyRules {
  /** null while the built-in default is in force (nothing saved yet). */
  id: string | null;
  /** The built-in default (never saved). */
  isDefault: boolean;
  /** The policy in force: exactly one is active. */
  isActive: boolean;
  version: number;
  updatedBy: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

/** Limits no policy can go beyond (the backend's PASSWORD_HARD_LIMITS). */
export const POLICY_LIMITS = {
  minLength: 8,
  maxLength: 128,
  maxCharacterClassCount: 10,
  maxHistoryCount: 24,
  maxValidityDays: 365,
  maxGracePeriodDays: 30,
  maxNotificationDays: 5,
  maxRepeatedCharacters: 10,
  maxMinimumAgeHours: 720,
  maxNameLength: 100,
} as const;
