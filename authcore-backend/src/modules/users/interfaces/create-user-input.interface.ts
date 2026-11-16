import type { UserStatus } from '../enums/user-status.enum';

/** Data UsersService needs to create a user. Values are already normalized and validated. */
export interface CreateUserInput {
  email: string;
  username?: string;
  firstName: string;
  lastName?: string;
  passwordHash: string;
  /** Starting status, decided by the registration flow. */
  status: UserStatus;
}
