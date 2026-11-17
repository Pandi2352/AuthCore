import { BarChart3, Bell, FolderKanban, House, Search, Settings, Users } from 'lucide-react';

import { useTheme } from '@/app/theme';
import { Badge, Button } from '@/components/ui';
import { cn } from '@/lib/utils';

import { SettingCard } from './AppearanceParts';

const NAV = [
  { label: 'Dashboard', icon: House, active: true },
  { label: 'Analytics', icon: BarChart3 },
  { label: 'Team', icon: Users },
  { label: 'Projects', icon: FolderKanban },
  { label: 'Settings', icon: Settings },
];
const KPIS = [
  { label: 'Revenue', value: '$24.8k', delta: '+12%', up: true },
  { label: 'Active users', value: '1,284', delta: '+4%', up: true },
  { label: 'Conversion', value: '3.6%', delta: '−0.8%', up: false },
];
const ROWS = [
  { page: 'Landing page', status: 'Live', tone: 'success', views: '2,340' },
  { page: 'Onboarding', status: 'Review', tone: 'warning', views: '980' },
  { page: 'Pricing', status: 'Draft', tone: 'neutral', views: '412' },
] as const;

/** A small sample app drawn with the live theme tokens (decorative: inert, hidden from AT). */
export function LivePreview() {
  const { appearance } = useTheme();
  return (
    <SettingCard
      title="Live preview"
      description="Your choices, applied to a sample app."
      badge="Sample data"
    >
      <div
        aria-hidden="true"
        inert
        className="overflow-hidden rounded-md border border-border bg-background text-[13px] text-foreground select-none"
      >
        <div className="flex h-11 items-center gap-2 border-b border-navbar-border bg-navbar px-3 text-navbar-foreground">
          <span className="flex size-6 items-center justify-center rounded-md bg-primary text-xs font-black text-primary-foreground">
            A
          </span>
          <span className="font-semibold">Your app</span>
          {appearance.navbarSearch === 'on' && (
            <span className="ml-3 flex h-7 flex-1 items-center gap-1.5 rounded-md border border-field bg-muted px-2 text-muted-foreground">
              <Search className="size-3.5" /> Search
            </span>
          )}
          <span className="ml-auto flex items-center gap-2">
            <Bell className="size-4 text-muted-foreground" />
            <span className="flex size-6 items-center justify-center rounded-full bg-primary-soft text-[11px] font-semibold text-primary-soft-foreground">
              A
            </span>
          </span>
        </div>
        <div className={cn('flex', appearance.sidebarPosition === 'right' && 'flex-row-reverse')}>
          <div
            className={cn(
              'w-28 shrink-0 space-y-0.5 bg-sidebar p-2',
              appearance.sidebarPosition === 'right' ? 'border-l' : 'border-r',
              'border-sidebar-border',
            )}
          >
            {NAV.map(({ label, icon: Icon, active }) => (
              <div
                key={label}
                className={cn(
                  'flex items-center gap-2 rounded-md px-2 py-1.5',
                  active
                    ? 'bg-sidebar-active font-medium text-sidebar-active-foreground'
                    : 'text-sidebar-foreground',
                )}
              >
                <Icon className="size-3.5" /> {label}
              </div>
            ))}
          </div>
          <div className="min-w-0 flex-1 space-y-3 p-3">
            <div>
              {appearance.breadcrumbs === 'on' && (
                <p className="text-[11px] text-muted-foreground">
                  Home / Dashboard / <span className="text-primary">Overview</span>
                </p>
              )}
              <div className="mt-0.5 flex items-center justify-between gap-2">
                <span className="text-base font-semibold">Overview</span>
                <Button size="sm" className="h-7! px-2.5! text-xs! whitespace-nowrap">
                  New report
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {KPIS.map((k) => (
                <div
                  key={k.label}
                  className="rounded-md border border-border bg-surface p-2 shadow-card"
                >
                  <p className="truncate text-[11px] text-muted-foreground">{k.label}</p>
                  <p className="text-base font-semibold">{k.value}</p>
                  <p
                    className={cn('text-[11px] font-medium', k.up ? 'text-success' : 'text-danger')}
                  >
                    {k.delta}
                  </p>
                </div>
              ))}
            </div>
            <div className="space-y-2 rounded-md border border-border bg-surface p-2.5 shadow-card">
              <p className="text-[11px] text-muted-foreground">Components</p>
              <div className="flex flex-wrap gap-1.5">
                <Button size="sm" className="h-7! px-2.5! text-xs! whitespace-nowrap">
                  Primary
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7! px-2.5! text-xs! whitespace-nowrap"
                >
                  Secondary
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7! px-2.5! text-xs! whitespace-nowrap"
                >
                  Ghost
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="flex h-7 min-w-24 flex-1 items-center rounded-md border border-primary bg-surface px-2 whitespace-nowrap">
                  Focused input
                </span>
                <Badge size="sm" tone="success">
                  Success
                </Badge>
                <Badge size="sm" tone="warning">
                  Warning
                </Badge>
                <Badge size="sm" tone="danger">
                  Error
                </Badge>
              </div>
            </div>
            <table className="w-full overflow-hidden rounded-md border border-border bg-surface text-left">
              <thead className="bg-muted text-[11px] text-muted-foreground">
                <tr>
                  <th className="px-2 py-1.5 font-medium">Page</th>
                  <th className="px-2 py-1.5 font-medium">Status</th>
                  <th className="px-2 py-1.5 text-right font-medium">Views</th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map((r) => (
                  <tr key={r.page} className="border-t border-border">
                    <td className="px-2 py-1.5 font-medium">{r.page}</td>
                    <td className="px-2 py-1.5">
                      <Badge size="sm" tone={r.tone}>
                        {r.status}
                      </Badge>
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{r.views}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </SettingCard>
  );
}
