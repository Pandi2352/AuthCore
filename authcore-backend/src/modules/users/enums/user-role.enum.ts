/**
 * Minimal roles until the RBAC module: ADMIN may manage AuthCore settings
 * (password policy, schedulers). Granted with `npm run users:role`.
 */
export enum UserRole {
  User = 'USER',
  Admin = 'ADMIN',
}
