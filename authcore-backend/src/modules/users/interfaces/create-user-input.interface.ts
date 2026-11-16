import type { UserSource } from '../enums/user-source.enum';
import type { UserStatus } from '../enums/user-status.enum';

/** Data UsersService needs to create a user. Values are already normalized and validated. */
export interface CreateUserInput {
  email: string;
  username?: string;
  firstName: string;
  lastName?: string;
  passwordHash: string;
  /** Starting status, decided by the registration / admin / invite flow. */
  status: UserStatus;
  /** Admin-created and invited accounts are verified by the admin / the invite link. */
  isEmailVerified?: boolean;
  mustChangePassword?: boolean;
  source?: UserSource;
  createdBy?: string;
}
