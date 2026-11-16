import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'requiredPermissions';

/**
 * The caller needs ALL of these permission keys (resolved from their groups →
 * roles → permissions). Users with the ADMIN role pass every check.
 * Checked by the global auth guard; 403 FORBIDDEN otherwise.
 *   @RequirePermissions('ROLE_CREATE')
 */
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
