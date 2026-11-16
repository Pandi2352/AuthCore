export enum AccountCodePurpose {
  /** Confirms a new email address. */
  EmailChange = 'EMAIL_CHANGE',
  /** Reactivates a self-deactivated account / cancels a scheduled deletion. */
  AccountRecovery = 'ACCOUNT_RECOVERY',
}
