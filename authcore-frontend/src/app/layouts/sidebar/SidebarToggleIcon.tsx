import { cn } from '@/lib/utils';

/** Visible length of each line (the full line is 16 units; the rest is the dash gap). */
const LONG = 16;
const MEDIUM = 10;
const SHORT = 5;

const line = (length: number) => ({
  strokeDasharray: `${length} 100`,
  transition: 'stroke-dasharray 300ms ease-out',
});

/**
 * Sidebar toggle icon: three rounded lines — long, medium (muted), short. When the sidebar
 * is collapsed the lengths swap (short, medium, long) with a smooth transition, hinting
 * "open me". Mirrored for a sidebar on the right. Uses currentColor (themes / dark mode).
 * Lengths come from stroke-dasharray, so the round caps stay round while animating.
 */
export function SidebarToggleIcon({
  collapsed,
  side = 'left',
  className,
}: {
  collapsed: boolean;
  side?: 'left' | 'right';
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      aria-hidden="true"
      className={cn('size-5', side === 'right' && '-scale-x-100', className)}
    >
      <line x1="4" y1="6.5" x2="20" y2="6.5" style={line(collapsed ? SHORT : LONG)} />
      <line x1="4" y1="12" x2="20" y2="12" opacity={0.45} style={line(MEDIUM)} />
      <line x1="4" y1="17.5" x2="20" y2="17.5" style={line(collapsed ? LONG : SHORT)} />
    </svg>
  );
}
