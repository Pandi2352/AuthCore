import type { FormAttribute } from '@/components/attributes';

export interface Session {
  id: string;
  deviceName: string;
  deviceType: string;
  browser: string;
  os: string;
  ipAddress: string;
  lastIpAddress: string;
  signedInAt: string;
  lastUsedAt: string;
  expiresAt: string;
  isPersistent: boolean;
  isCurrent: boolean;
}

export interface KnownDevice {
  id: string;
  deviceName: string;
  deviceType: string;
  browser: string;
  os: string;
  firstSeenAt: string;
  lastSeenAt: string;
  lastIpAddress: string;
}

/** GET /users/me/activity item. */
export interface UserActivityEntry {
  id: string;
  event: string;
  /** How the user proved it was them: PASSWORD, EMAIL_CODE, EMAIL_LINK, ADMIN or NONE. */
  verificationType: string;
  isSuccess: boolean;
  /** When it happened. */
  occurredAt: string;
  deviceType: string | null;
  os: string | null;
  browser: string | null;
  ipAddress: string | null;
  actorId: string | null;
  details: Record<string, unknown> | null;
}

/** GET /user-schema/form item: a profile field, plus where built-in values live. */
export type ProfileFormAttribute = FormAttribute & {
  /** Built-in user field it maps to (email, firstName …): edited elsewhere on the profile. */
  coreField: string | null;
  isPassword: boolean;
  children?: ProfileFormAttribute[];
};
