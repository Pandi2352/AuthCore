import type { UserResponseDto } from '../dto/user-response.dto';

/**
 * A user plus the password hash, for credential checks only. Never returned
 * by an API or logged.
 */
export interface UserCredentials {
  user: UserResponseDto;
  passwordHash: string;
}

export type LoginLookup = { email: string } | { username: string };
