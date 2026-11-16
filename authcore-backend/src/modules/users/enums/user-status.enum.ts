/**
 * Account lifecycle status. Only ACTIVE users can sign in.
 *
 *   register ─┬─ email verification on ──► PENDING_VERIFICATION ─┐
 *             ├─ approval only ──────────► PENDING_APPROVAL ◄────┤ (approval on)
 *             └─ direct ─────────────────► ACTIVE ◄──────────────┘ (approval off)
 *   PENDING_APPROVAL ── approve ──► ACTIVE
 *                    └─ reject ───► REJECTED
 */
export enum UserStatus {
  /** Registered; email not verified yet. */
  PendingVerification = 'PENDING_VERIFICATION',
  /** Waiting for an administrator to approve the registration. */
  PendingApproval = 'PENDING_APPROVAL',
  /** Allowed to sign in. */
  Active = 'ACTIVE',
  /** Registration refused by an administrator. */
  Rejected = 'REJECTED',
  /** Deactivated by the user or an admin; can be reactivated. */
  Inactive = 'INACTIVE',
  /** Temporarily blocked by an admin. */
  Suspended = 'SUSPENDED',
  /** Permanently blocked. */
  Banned = 'BANNED',
}
