import { Badge, type BadgeProps } from '@/components/ui';
import type { BadgeTone } from '@/types/config.types';

/** Common status words → tone. Extend per call with `tones`. */
const DEFAULT_TONES: Record<string, BadgeTone> = {
  active: 'success',
  enabled: 'success',
  verified: 'success',
  success: 'success',
  completed: 'success',
  approved: 'success',
  current: 'success',
  pending: 'warning',
  pending_verification: 'warning',
  pending_approval: 'warning',
  expiring: 'warning',
  invited: 'info',
  draft: 'neutral',
  inactive: 'neutral',
  disabled: 'neutral',
  deactivated: 'neutral',
  archived: 'neutral',
  expired: 'neutral',
  suspended: 'danger',
  locked: 'danger',
  blocked: 'danger',
  failed: 'danger',
  rejected: 'danger',
  deleted: 'danger',
};

/** "PENDING_VERIFICATION" → "Pending verification". */
const humanize = (status: string) => {
  const text = status.replace(/[_-]+/g, ' ').trim().toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
};

export interface StatusBadgeProps extends Omit<BadgeProps, 'tone' | 'children'> {
  status: string | null | undefined;
  /** Extra / overriding status → tone pairs (keys are matched case-insensitively). */
  tones?: Record<string, BadgeTone>;
  /** Custom text (default: the status, humanized). */
  label?: string;
}

/** Any status string as a badge: the meaning is in the text, the color only supports it. */
export function StatusBadge({ status, tones, label, dot = true, ...props }: StatusBadgeProps) {
  if (!status) return null;
  const key = status.toLowerCase();
  const tone = tones?.[key] ?? tones?.[status] ?? DEFAULT_TONES[key] ?? 'neutral';
  return (
    <Badge tone={tone} dot={dot} {...props}>
      {label ?? humanize(status)}
    </Badge>
  );
}
