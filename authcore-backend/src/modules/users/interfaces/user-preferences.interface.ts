/** A user's own settings. Security emails are always sent, whatever these say. */
export interface UserPreferences {
  /** BCP 47 language tag, e.g. "en" or "en-IN". */
  language: string;
  /** IANA time zone, e.g. "Asia/Kolkata". */
  timezone: string;
  notifications: {
    /** Product news and announcements (optional emails). */
    productUpdates: boolean;
    /** Emails such as "new sign-in" (account-security notices that can be turned off). */
    loginAlerts: boolean;
  };
}

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  language: 'en',
  timezone: 'UTC',
  notifications: { productUpdates: false, loginAlerts: true },
};
