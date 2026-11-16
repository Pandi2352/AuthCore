/** How an account was created. */
export enum UserSource {
  /** POST /auth/register */
  Registration = 'REGISTRATION',
  /** POST /admin/users */
  Admin = 'ADMIN',
  /** Accepted invite */
  Invite = 'INVITE',
  /** First administrator, created at startup from BOOTSTRAP_ADMIN_* */
  System = 'SYSTEM',
}
