import type {
  AdminUserResponseDto,
  UserResponseDto,
} from '../dto/user-response.dto';
import { UserSource } from '../enums/user-source.enum';
import { DEFAULT_USER_PREFERENCES } from '../interfaces/user-preferences.interface';
import type { User } from '../schemas/user.schema';

/**
 * Maps a stored user to its public shape. Fields are listed explicitly, so a
 * new schema field (or the password hash) never leaks into responses.
 * Accounts created before a field existed get its default.
 */
export function toUserResponse(user: User): UserResponseDto {
  // Older documents may lack newer fields.
  const stored = user as Partial<User>;
  const preferences = stored.preferences;
  return {
    id: user._id,
    email: user.email,
    username: user.username ?? null,
    firstName: user.firstName,
    lastName: user.lastName ?? null,
    status: user.status,
    role: user.role,
    isEmailVerified: user.isEmailVerified,
    emailVerifiedAt: user.emailVerifiedAt,
    passwordChangedAt: user.passwordChangedAt,
    mustChangePassword: stored.mustChangePassword ?? false,
    preferences: {
      language: preferences?.language ?? DEFAULT_USER_PREFERENCES.language,
      timezone: preferences?.timezone ?? DEFAULT_USER_PREFERENCES.timezone,
      notifications: {
        ...DEFAULT_USER_PREFERENCES.notifications,
        ...preferences?.notifications,
      },
    },
    source: stored.source ?? UserSource.Registration,
    deletionScheduledAt: user.deletionScheduledAt ?? null,
    lastLoginAt: user.lastLoginAt ?? null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

/** Admin view: the public shape plus status history and soft-delete info. */
export function toAdminUserResponse(user: User): AdminUserResponseDto {
  return Object.assign(toUserResponse(user), {
    statusReason: user.statusReason ?? null,
    statusChangedBy: user.statusChangedBy ?? null,
    statusChangedAt: user.statusChangedAt ?? null,
    createdBy: user.createdBy ?? null,
    deletedAt: user.deletedAt ?? null,
    deletedBy: user.deletedBy ?? null,
  });
}
