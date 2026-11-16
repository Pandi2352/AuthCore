/** What happened on an account (shown in "recent user activities"). */
export enum ActivityEvent {
  Login = 'LOGIN',
  LoginFailed = 'LOGIN_FAILED',
  Logout = 'LOGOUT',
  LogoutAll = 'LOGOUT_ALL',
  PasswordChanged = 'PASSWORD_CHANGED',
  PasswordReset = 'PASSWORD_RESET',
  PasswordSetByAdmin = 'PASSWORD_SET_BY_ADMIN',
  PasswordChangeRequired = 'PASSWORD_CHANGE_REQUIRED',
  EmailChanged = 'EMAIL_CHANGED',
  ProfileUpdated = 'PROFILE_UPDATED',
  AccountDeactivated = 'ACCOUNT_DEACTIVATED',
  AccountDeletionRequested = 'ACCOUNT_DELETION_REQUESTED',
  AccountRecovered = 'ACCOUNT_RECOVERED',
  StatusChanged = 'STATUS_CHANGED',
  SessionsRevoked = 'SESSIONS_REVOKED',
}

/** How the user proved who they were for the event. */
export enum VerificationType {
  Password = 'PASSWORD',
  EmailCode = 'EMAIL_CODE',
  EmailLink = 'EMAIL_LINK',
  Admin = 'ADMIN',
  None = 'NONE',
}
