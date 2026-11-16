import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Only users with one of these roles may call the route (checked by the
 * global auth guard after authentication; 403 FORBIDDEN otherwise):
 *   @Roles(UserRole.Admin)
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
