import type { UserResponseDto } from '../dto/user-response.dto';
import type { User } from '../schemas/user.schema';

/**
 * Maps a stored user to its public shape. Fields are listed explicitly, so a
 * new schema field (or the password hash) never leaks into responses.
 */
export function toUserResponse(user: User): UserResponseDto {
  return {
    id: user._id,
    email: user.email,
    username: user.username ?? null,
    firstName: user.firstName,
    lastName: user.lastName ?? null,
    status: user.status,
    isEmailVerified: user.isEmailVerified,
    emailVerifiedAt: user.emailVerifiedAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
