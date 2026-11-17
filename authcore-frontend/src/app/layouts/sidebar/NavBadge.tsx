import { Badge } from '@/components/ui';
import type { NavBadge as NavBadgeConfig } from '@/types/navigation.types';

function CountBadge({
  useCount,
  tone,
}: {
  useCount: () => number | undefined;
  tone?: NavBadgeConfig['tone'];
}) {
  // useCount is fixed per navigation item (static config), so hook order never changes.
  // oxlint-disable-next-line react/hooks
  const count = useCount();
  if (!count) return null;
  return (
    <Badge size="sm" tone={tone ?? 'primary'} aria-label={`${count} new`}>
      {count > 99 ? '99+' : count}
    </Badge>
  );
}

/** Static text badge or a live count from a hook (hidden at 0). */
export function NavBadge({ badge }: { badge: NavBadgeConfig }) {
  if ('useCount' in badge) return <CountBadge useCount={badge.useCount} tone={badge.tone} />;
  return (
    <Badge size="sm" tone={badge.tone ?? 'neutral'}>
      {badge.text}
    </Badge>
  );
}
