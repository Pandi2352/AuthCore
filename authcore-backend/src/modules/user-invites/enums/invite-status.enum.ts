export enum InviteStatus {
  Pending = 'PENDING',
  Accepted = 'ACCEPTED',
  Revoked = 'REVOKED',
  /** A pending invite past its expiry date. */
  Expired = 'EXPIRED',
}
