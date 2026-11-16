/** What the client should show the user after register / verify. */
export enum RegistrationNextStep {
  /** Ask for the code that was emailed. */
  VerifyEmailOtp = 'VERIFY_EMAIL_OTP',
  /** Tell the user to open the link that was emailed. */
  VerifyEmailLink = 'VERIFY_EMAIL_LINK',
  /** Tell the user an administrator will review the account. */
  AwaitApproval = 'AWAIT_APPROVAL',
  /** The account is active: go to sign-in. */
  Login = 'LOGIN',
}
