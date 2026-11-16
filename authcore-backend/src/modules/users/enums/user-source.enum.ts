/** How an account was created. */
export enum UserSource {
  /** POST /auth/register */
  Registration = 'REGISTRATION',
  /** POST /admin/users */
  Admin = 'ADMIN',
  /** Accepted invite */
  Invite = 'INVITE',
}
