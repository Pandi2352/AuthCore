/**
 * Account activity events and verification types as people read them. Shared by My profile
 * (my activity) and Activity & sign-ins (everyone's).
 */

const EVENT_LABEL: Record<string, string> = {
  LOGIN: 'Logged in',
  LOGIN_FAILED: 'Sign-in failed',
  LOGOUT: 'Logged out',
  LOGOUT_ALL: 'Logged out everywhere',
  PASSWORD_CHANGED: 'Password changed',
  PASSWORD_RESET: 'Password reset',
  PASSWORD_SET_BY_ADMIN: 'Password set by an admin',
  PASSWORD_CHANGE_REQUIRED: 'New password required',
  EMAIL_CHANGED: 'Email changed',
  PROFILE_UPDATED: 'Profile updated',
  ACCOUNT_DEACTIVATED: 'Account deactivated',
  ACCOUNT_DELETION_REQUESTED: 'Account deletion requested',
  ACCOUNT_RECOVERED: 'Account recovered',
  STATUS_CHANGED: 'Status changed',
  SESSIONS_REVOKED: 'Other devices signed out',
  SESSION_REVOKED: 'Device signed out',
  DATA_EXPORTED: 'Data downloaded',
  NEW_DEVICE_LOGIN: 'Signed in on a new device',
  ACCOUNT_LOCKED: 'Account locked',
};

const VERIFICATION_LABEL: Record<string, string> = {
  PASSWORD: 'Password',
  EMAIL_CODE: 'Email code',
  EMAIL_LINK: 'Email link',
  ADMIN: 'By an admin',
};

/** "SOME_VALUE" → "Some value". */
const humanize = (value: string) =>
  value.charAt(0) + value.slice(1).toLowerCase().replaceAll('_', ' ');

/** "LOGIN" → "Logged in" (unknown events are humanized). */
export const formatActivityEvent = (event: string): string => EVENT_LABEL[event] ?? humanize(event);

/** "EMAIL_CODE" → "Email code"; NONE → null (show "N/A"). */
export const formatVerificationType = (type: string): string | null =>
  type === 'NONE' ? null : (VERIFICATION_LABEL[type] ?? humanize(type));
