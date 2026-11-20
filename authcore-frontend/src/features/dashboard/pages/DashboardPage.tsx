import {
  Activity,
  BellRing,
  ChevronRight,
  CircleCheck,
  FileClock,
  History,
  KeyRound,
  Layers,
  LayoutGrid,
  LogIn,
  MailPlus,
  MonitorSmartphone,
  Settings2,
  Shield,
  ShieldX,
  Sparkles,
  UserRound,
  Users,
  UsersRound,
} from 'lucide-react';
import { useEffect, useMemo, useState, type ComponentType } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { DateTime } from '@/components/common/DateTime';
import { SectionCard } from '@/components/common/SectionCard';
import { StatCard, type StatPattern, type StatTone } from '@/components/common/StatCard';
import { StatusBadge } from '@/components/common/StatusBadge';
import { PageContainer } from '@/components/page';
import { Badge, Button } from '@/components/ui';
import { paths } from '@/config';
import { useAuth, usePermissions } from '@/features/auth';
import { isAbortError } from '@/lib/api';
import { formatNumber } from '@/lib/format';

import { dashboardApi, type DashboardArea, type DashboardCounts } from '../api/dashboard.api';

/** Which permission each area needs (the same ones its page needs). */
const AREA_PERMISSION: Record<DashboardArea, string> = {
  users: 'USER_READ',
  invites: 'USER_READ',
  activity: 'USER_READ',
  roles: 'ROLE_READ',
  groups: 'GROUP_READ',
  audit: 'ACCESS_AUDIT_READ',
};

interface OverviewCard {
  area: DashboardArea;
  tone: StatTone;
  pattern: StatPattern;
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: (c: DashboardCounts) => number | null;
  hint: (c: DashboardCounts) => string;
  to: string;
}

const OVERVIEW: OverviewCard[] = [
  {
    area: 'users',
    tone: 'primary',
    pattern: 'rings',
    icon: Users,
    label: 'Users',
    value: (c) => c.users?.total ?? null,
    hint: (c) => (c.users ? `${formatNumber(c.users.active)} active` : 'Every account'),
    to: paths.admin.users,
  },
  {
    area: 'users',
    tone: 'success',
    pattern: 'waves',
    icon: Sparkles,
    label: 'New users',
    value: (c) => c.users?.newLast30Days ?? null,
    hint: () => 'Last 30 days',
    to: paths.admin.users,
  },
  {
    area: 'invites',
    tone: 'warning',
    pattern: 'dots',
    icon: MailPlus,
    label: 'Waiting invites',
    value: (c) => c.invites?.pending ?? null,
    hint: (c) => (c.invites ? `${formatNumber(c.invites.expired)} expired` : 'Not accepted yet'),
    to: paths.admin.invites,
  },
  {
    area: 'roles',
    tone: 'violet',
    pattern: 'sparkles',
    icon: Shield,
    label: 'Roles',
    value: (c) => c.roles?.totalRoles ?? null,
    hint: (c) => (c.roles ? `${formatNumber(c.roles.rolesInUse)} given to groups` : 'Defined'),
    to: paths.admin.roles,
  },
  {
    area: 'groups',
    tone: 'cyan',
    pattern: 'grid',
    icon: Layers,
    label: 'Groups',
    value: (c) => c.groups?.totalGroups ?? null,
    hint: (c) => (c.groups ? `${formatNumber(c.groups.members)} people in them` : 'Defined'),
    to: paths.admin.groups,
  },
  {
    area: 'activity',
    tone: 'info',
    pattern: 'bars',
    icon: LogIn,
    label: 'Sign-ins',
    value: (c) => c.activity?.signIns24h ?? null,
    hint: (c) =>
      c.activity
        ? `${formatNumber(c.activity.activeUsers24h)} people · last 24 hours`
        : 'Last 24 hours',
    to: paths.admin.activity,
  },
  {
    area: 'activity',
    tone: 'danger',
    pattern: 'stripes',
    icon: ShieldX,
    label: 'Failed sign-ins',
    value: (c) => c.activity?.failedSignIns24h ?? null,
    hint: () => 'Last 24 hours',
    to: paths.admin.activity,
  },
  {
    area: 'audit',
    tone: 'primary',
    pattern: 'bubbles',
    icon: History,
    label: 'Access changes',
    value: (c) => c.audit?.last24Hours ?? null,
    hint: () => 'Roles, groups, users · last 24 hours',
    to: paths.admin.auditLog,
  },
];

interface AttentionItem {
  area: DashboardArea;
  label: string;
  count: (c: DashboardCounts) => number;
  to: string;
}

/** Things worth a look, from the same counts (only shown when > 0). */
const ATTENTION: AttentionItem[] = [
  {
    area: 'activity',
    label: 'Failed sign-ins (24 hours)',
    count: (c) => c.activity?.failedSignIns24h ?? 0,
    to: paths.admin.activity,
  },
  {
    area: 'activity',
    label: 'Account lockouts (7 days)',
    count: (c) => c.activity?.lockouts7d ?? 0,
    to: paths.admin.activity,
  },
  {
    area: 'activity',
    label: 'Sign-ins from new devices (7 days)',
    count: (c) => c.activity?.newDevices7d ?? 0,
    to: paths.admin.activity,
  },
  {
    area: 'invites',
    label: 'Expired invites to resend',
    count: (c) => c.invites?.expired ?? 0,
    to: paths.admin.invites,
  },
  {
    area: 'users',
    label: 'Dormant users (no recent sign-in)',
    count: (c) => c.users?.dormant ?? 0,
    to: paths.admin.users,
  },
  {
    area: 'users',
    label: 'Inactive or suspended users',
    count: (c) => c.users?.inactive ?? 0,
    to: paths.admin.users,
  },
  {
    area: 'roles',
    label: 'Roles without permissions',
    count: (c) => c.roles?.rolesWithoutPermissions ?? 0,
    to: paths.admin.roles,
  },
  {
    area: 'groups',
    label: 'Groups without members',
    count: (c) => c.groups?.groupsWithoutMembers ?? 0,
    to: paths.admin.groups,
  },
];

interface QuickLink {
  label: string;
  icon: ComponentType<{ className?: string }>;
  to: string;
  permission?: string;
}

const QUICK_LINKS: QuickLink[] = [
  { label: 'My profile', icon: UserRound, to: paths.account.profile },
  { label: 'Change password', icon: KeyRound, to: paths.account.security },
  { label: 'My sessions', icon: MonitorSmartphone, to: paths.account.sessions },
  { label: 'Search users', icon: Users, to: paths.admin.users, permission: 'USER_READ' },
  { label: 'Invite users', icon: MailPlus, to: paths.admin.invites, permission: 'USER_INVITE' },
  { label: 'Roles', icon: Shield, to: paths.admin.roles, permission: 'ROLE_READ' },
  { label: 'Groups', icon: Layers, to: paths.admin.groups, permission: 'GROUP_READ' },
  {
    label: 'Activity & sign-ins',
    icon: Activity,
    to: paths.admin.activity,
    permission: 'USER_READ',
  },
  {
    label: 'Audit log',
    icon: FileClock,
    to: paths.admin.auditLog,
    permission: 'ACCESS_AUDIT_READ',
  },
  {
    label: 'Password policy',
    icon: KeyRound,
    to: paths.admin.passwordPolicy,
    permission: 'PASSWORD_POLICY_READ',
  },
  {
    label: 'Business settings',
    icon: Settings2,
    to: paths.settings.business,
    permission: 'BUSINESS_SETTINGS_READ',
  },
];

/** Home: welcome, the numbers that matter (with links into each page), and your account. */
export function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isSuperAdmin, roles, permissions, hasPermission } = usePermissions();
  const areas = useMemo(
    () =>
      (Object.keys(AREA_PERMISSION) as DashboardArea[]).filter((a) =>
        hasPermission(AREA_PERMISSION[a]),
      ),
    [hasPermission],
  );
  const areaKey = areas.join(',');
  const [counts, setCounts] = useState<{ key: string; value: DashboardCounts } | null>(null);

  useEffect(() => {
    if (!areaKey) return;
    const controller = new AbortController();
    const load = async () => {
      try {
        const value = await dashboardApi.counts(
          areaKey.split(',') as DashboardArea[],
          controller.signal,
        );
        setCounts({ key: areaKey, value });
      } catch (error) {
        if (!isAbortError(error)) setCounts({ key: areaKey, value: EMPTY });
      }
    };
    void load();
    return () => controller.abort();
  }, [areaKey]);

  const c = counts?.key === areaKey ? counts.value : null;
  const cards = OVERVIEW.filter((card) => areas.includes(card.area));
  const attention = c
    ? ATTENTION.filter((item) => areas.includes(item.area) && item.count(c) > 0)
    : [];
  const links = QUICK_LINKS.filter((l) => !l.permission || hasPermission(l.permission));
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ');

  return (
    <PageContainer>
      {/* Welcome */}
      <section
        aria-label="Welcome"
        className="relative overflow-hidden rounded-md bg-linear-to-r from-primary via-nav-violet to-nav-cyan p-6 text-primary-foreground sm:p-8"
      >
        <svg aria-hidden="true" className="absolute inset-0 h-full w-full opacity-15">
          <defs>
            <pattern id="welcome-dots" width="18" height="18" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1.5" fill="currentColor" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#welcome-dots)" />
        </svg>
        <div className="relative flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
              Welcome back, {user?.firstName}!
              {user?.isEmailVerified && (
                <CircleCheck className="size-6" aria-label="Verified account" />
              )}
            </h1>
            <p className="mt-1 text-sm text-primary-foreground/85">
              {areas.length > 0
                ? 'Here is what is happening across your users and access today.'
                : 'Your account, devices and security in one place.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isSuperAdmin && (
              <Badge className="border-primary-foreground/30 bg-primary-foreground/15 text-primary-foreground">
                Administrator
              </Badge>
            )}
            <Button
              variant="outline"
              size="toolbar"
              leftIcon={<UserRound />}
              className="bg-surface text-foreground"
              asChild
            >
              <Link to={paths.account.profile}>My profile</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Overview: real counts, each opening its page */}
      {cards.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <StatCard
              key={card.label}
              tone={card.tone}
              pattern={card.pattern}
              icon={card.icon}
              label={card.label}
              value={c ? card.value(c) : null}
              hint={c ? card.hint(c) : ' '}
              onClick={() => void navigate(card.to)}
            />
          ))}
        </div>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <div className="min-w-0 space-y-6">
          {areas.length > 0 && (
            <SectionCard
              title="Needs attention"
              description="Worth a look — each opens the page with the details."
              icon={<BellRing aria-hidden="true" />}
              tone="warning"
            >
              {!c ? (
                <p className="text-sm text-muted-foreground">Checking…</p>
              ) : attention.length === 0 ? (
                <p className="flex items-center gap-2 text-sm text-success">
                  <CircleCheck className="size-4" aria-hidden="true" /> All clear — nothing needs a
                  look right now.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {attention.map((item) => (
                    <li key={item.label}>
                      <Link
                        to={item.to}
                        className="flex items-center gap-3 rounded-md px-2 py-2.5 text-sm text-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
                      >
                        <span className="min-w-0 flex-1">{item.label}</span>
                        <Badge size="sm" tone="warning" className="tabular-nums">
                          {formatNumber(item.count(c))}
                        </Badge>
                        <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          )}

          <SectionCard
            title="Quick links"
            description="The pages you can open."
            icon={<LayoutGrid aria-hidden="true" />}
            tone="info"
          >
            <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {links.map(({ label, icon: Icon, to }) => (
                <li key={label}>
                  <Link
                    to={to}
                    className="flex items-center gap-2.5 rounded-md border border-border px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-primary hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <Icon className="size-4 shrink-0 text-primary" />
                    <span className="truncate">{label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>

        <SectionCard title="Your account" icon={<UsersRound aria-hidden="true" />} tone="primary">
          <dl className="divide-y divide-border text-sm">
            {[
              ['Name', name || '—'],
              ['Email', user?.email ?? '—'],
              ['Username', user?.username ? `@${user.username}` : '—'],
              ['Status', <StatusBadge key="s" status={user?.status} />],
              [
                'Member since',
                user?.createdAt ? <DateTime key="d" value={user.createdAt} format="date" /> : '—',
              ],
            ].map(([term, value]) => (
              <div key={String(term)} className="flex items-center justify-between gap-3 py-2">
                <dt className="text-muted-foreground">{term}</dt>
                <dd className="min-w-0 text-right font-medium break-all text-foreground">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
          <div className="mt-3 space-y-2 border-t border-border pt-3">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Roles ({roles.length})
            </p>
            <div className="flex flex-wrap gap-1">
              {roles.length > 0 ? (
                roles.map((r) => (
                  <Badge key={r} size="sm" tone="success" variant="outline">
                    {r}
                  </Badge>
                ))
              ) : (
                <span className="text-xs text-muted-foreground">No roles yet</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {isSuperAdmin
                ? 'Administrator: every permission.'
                : `${permissions.length} permission${permissions.length === 1 ? '' : 's'} through your groups.`}
            </p>
          </div>
        </SectionCard>
      </div>
    </PageContainer>
  );
}

const EMPTY: DashboardCounts = {
  users: null,
  invites: null,
  roles: null,
  groups: null,
  activity: null,
  audit: null,
};
