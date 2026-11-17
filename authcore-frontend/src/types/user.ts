export type UserStatus =
  | 'ACTIVE'
  | 'INACTIVE'
  | 'PENDING_VERIFICATION'
  | 'PENDING_APPROVAL'
  | 'SUSPENDED'
  | 'BANNED'
  | 'REJECTED';

export type UserRole = 'USER' | 'ADMIN';

export type UserSource = 'REGISTRATION' | 'INVITATION' | 'ADMIN' | 'SYSTEM' | 'OAUTH';

export interface NotificationPreferences {
  productUpdates: boolean;
  loginAlerts: boolean;
}

export interface UserPreferences {
  language: string;
  timezone: string;
  notifications: NotificationPreferences;
}

export interface User {
  id: string;
  email: string;
  username: string | null;
  firstName: string;
  lastName: string | null;
  status: UserStatus;
  role: UserRole;
  isEmailVerified: boolean;
  emailVerifiedAt: string | null;
  passwordChangedAt: string;
  mustChangePassword: boolean;
  preferences: UserPreferences;
  source: UserSource;
  deletionScheduledAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfileDetails extends User {
  attributes?: Record<string, unknown>;
  missingRequired?: string[];
}
