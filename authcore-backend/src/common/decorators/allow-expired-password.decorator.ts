import { SetMetadata } from '@nestjs/common';

export const ALLOW_EXPIRED_PASSWORD_KEY = 'allowExpiredPassword';

/**
 * The route stays usable when the user's password has expired and must be
 * changed (change-password, /me, logout). Every other protected route then
 * answers 403 AUTH_PASSWORD_EXPIRED.
 */
export const AllowExpiredPassword = () =>
  SetMetadata(ALLOW_EXPIRED_PASSWORD_KEY, true);
