import type { BulkSkipReason, Invite, InviteStatus } from '../types/invite.types';

export const SKIP_REASON: Record<BulkSkipReason, string> = {
  ALREADY_REGISTERED: 'already has an account',
  ALREADY_INVITED: 'already has a pending invite',
  DUPLICATE_IN_REQUEST: 'listed twice',
};

export const STATUS_META: Record<
  InviteStatus,
  { label: string; tone: 'warning' | 'success' | 'neutral' | 'danger' }
> = {
  PENDING: { label: 'Pending', tone: 'warning' },
  ACCEPTED: { label: 'Accepted', tone: 'success' },
  REVOKED: { label: 'Revoked', tone: 'neutral' },
  EXPIRED: { label: 'Expired', tone: 'danger' },
};

export function personName(person: {
  firstName: string | null;
  lastName: string | null;
}): string | null {
  const name = [person.firstName, person.lastName].filter(Boolean).join(' ').trim();
  return name || null;
}

export function initials(person: {
  email: string;
  firstName: string | null;
  lastName: string | null;
}): string {
  const name = personName(person);
  if (name) {
    const parts = name.split(/\s+/);
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
  }
  return person.email.slice(0, 2).toUpperCase();
}

/** Resend works for pending and expired invites; revoke for pending; delete for anything not accepted. */
export const canResend = (invite: Invite) =>
  invite.status === 'PENDING' || invite.status === 'EXPIRED';
export const canRevoke = (invite: Invite) => invite.status === 'PENDING';
export const canDelete = (invite: Invite) => invite.status !== 'ACCEPTED';
