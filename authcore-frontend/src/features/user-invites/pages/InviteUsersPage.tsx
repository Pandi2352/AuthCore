import {
  Ban,
  CalendarClock,
  Clock,
  MailCheck,
  MailPlus,
  Mails,
  Percent,
  TimerOff,
  UserCheck,
} from 'lucide-react';
import { memo, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { StatCard } from '@/components/common/StatCard';
import { notifyError } from '@/components/feedback';
import { PageContainer, PageHeader } from '@/components/page';
import { Badge, Button, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui';
import { usePermissions } from '@/features/auth';
import { isAbortError } from '@/lib/api';

import { invitesApi } from '../api/invites.api';
import { InviteDialog } from '../components/InviteDialog';
import {
  AcceptedInvitesTable,
  OpenInvitesTable,
  RegisteredUsersTable,
  type OpenStatus,
} from '../components/InviteTables';
import type { InviteStats } from '../types/invite.types';

type Tab = 'pending' | 'accepted' | 'registered';
const isTab = (value: string | null): value is Tab =>
  value === 'pending' || value === 'accepted' || value === 'registered';

/** The eight counts (same light cards as roles and groups); most of them open their list. */
const InviteStatCards = memo(function InviteStatCards({
  stats: s,
  tab,
  status,
  onPick,
}: {
  stats: InviteStats | null;
  tab: Tab;
  status: OpenStatus;
  onPick: (tab: Tab, status?: OpenStatus) => void;
}) {
  const isOpen = (value: OpenStatus) => tab === 'pending' && status === value;
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        tone="primary"
        pattern="rings"
        icon={Mails}
        label="Total invites"
        value={s?.total ?? null}
        hint="Every invite sent"
      />
      <StatCard
        tone="warning"
        pattern="waves"
        icon={Clock}
        label="Waiting to accept"
        value={s?.pending ?? null}
        hint="Link still valid"
        selected={isOpen('PENDING')}
        onClick={() => onPick('pending', 'PENDING')}
      />
      <StatCard
        tone="success"
        pattern="bars"
        icon={MailCheck}
        label="Accepted"
        value={s?.accepted ?? null}
        hint="Account created from the link"
        selected={tab === 'accepted'}
        onClick={() => onPick('accepted')}
      />
      <StatCard
        tone="danger"
        pattern="stripes"
        icon={TimerOff}
        label="Expired"
        value={s?.expired ?? null}
        hint="Link ran out — reinvite them"
        selected={isOpen('EXPIRED')}
        onClick={() => onPick('pending', 'EXPIRED')}
      />
      <StatCard
        tone="violet"
        pattern="grid"
        icon={Ban}
        label="Revoked"
        value={s?.revoked ?? null}
        hint="Cancelled by an admin"
        selected={isOpen('REVOKED')}
        onClick={() => onPick('pending', 'REVOKED')}
      />
      <StatCard
        tone="cyan"
        pattern="dots"
        icon={UserCheck}
        label="Self sign-ups"
        value={s?.registered ?? null}
        hint="Joined on the sign-up page"
        selected={tab === 'registered'}
        onClick={() => onPick('registered')}
      />
      <StatCard
        tone="info"
        pattern="sparkles"
        icon={CalendarClock}
        label="Sent this week"
        value={s?.sentLast7Days ?? null}
        hint="In the last 7 days"
      />
      <StatCard
        tone="success"
        pattern="bubbles"
        icon={Percent}
        label="Acceptance rate"
        value={s ? (s.acceptanceRate === null ? '—' : `${s.acceptanceRate}%`) : null}
        hint="Accepted of all answered invites"
      />
    </div>
  );
});

/** Users → Invite users: send invites, follow them up, see who joined. */
export function InviteUsersPage() {
  const { hasPermission } = usePermissions();
  const canInvite = hasPermission('USER_INVITE');
  // A link may open a tab (?tab=registered); after that the tab is local state (no navigation).
  const [params] = useSearchParams();
  const [tab, setTab] = useState<Tab>(() => {
    const value = params.get('tab');
    return isTab(value) ? value : 'pending';
  });
  const [openStatus, setOpenStatus] = useState<OpenStatus>('PENDING');
  const [stats, setStats] = useState<{ key: number; value: InviteStats } | null>(null);
  const [statsKey, setStatsKey] = useState(0);
  /** Bumped after sending invites: the tables reload too. */
  const [reloadKey, setReloadKey] = useState(0);
  const [dialog, setDialog] = useState({ open: false, key: 0 });

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        setStats({ key: statsKey, value: await invitesApi.stats(controller.signal) });
      } catch (error) {
        if (!isAbortError(error)) notifyError(error, 'Could not load the invite counts');
      }
    };
    void load();
    return () => controller.abort();
  }, [statsKey]);

  const reloadCounts = useCallback(() => setStatsKey((n) => n + 1), []);
  const reloadAll = useCallback(() => {
    setStatsKey((n) => n + 1);
    setReloadKey((n) => n + 1);
  }, []);
  const pick = useCallback((next: Tab, status?: OpenStatus) => {
    setTab(next);
    if (status) setOpenStatus(status);
  }, []);

  const s = stats?.value ?? null;
  const tabs: Array<{ value: Tab; label: string; icon: typeof Clock; count: number | null }> = [
    { value: 'pending', label: 'Pending users', icon: Clock, count: s?.pending ?? null },
    { value: 'accepted', label: 'Accepted users', icon: MailCheck, count: s?.accepted ?? null },
    {
      value: 'registered',
      label: 'Registered users',
      icon: UserCheck,
      count: s?.registered ?? null,
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Invite users"
        description="Invite people by email, follow up on waiting invites and see who has joined."
        actions={
          canInvite && (
            <Button
              size="toolbar"
              leftIcon={<MailPlus />}
              onClick={() => setDialog((d) => ({ open: true, key: d.key + 1 }))}
            >
              Invite people
            </Button>
          )
        }
      />

      {/* Memoized: paging / searching a table does not redraw the cards. */}
      <InviteStatCards stats={s} tab={tab} status={openStatus} onPick={pick} />

      <Tabs value={tab} onValueChange={(value) => isTab(value) && setTab(value)}>
        <TabsList>
          {tabs.map(({ value, label, icon: Icon, count }) => (
            <TabsTrigger key={value} value={value}>
              <Icon className="size-4" aria-hidden="true" />
              {label}
              {count !== null && (
                <Badge size="sm" tone="neutral" className="tabular-nums">
                  {count}
                </Badge>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="pending" className="pt-4">
          {tab === 'pending' && (
            <OpenInvitesTable
              canManage={canInvite}
              status={openStatus}
              reloadKey={reloadKey}
              onChanged={reloadCounts}
              onRefresh={reloadCounts}
            />
          )}
        </TabsContent>
        <TabsContent value="accepted" className="pt-4">
          {tab === 'accepted' && (
            <AcceptedInvitesTable reloadKey={reloadKey} onRefresh={reloadCounts} />
          )}
        </TabsContent>
        <TabsContent value="registered" className="pt-4">
          {tab === 'registered' && (
            <RegisteredUsersTable reloadKey={reloadKey} onRefresh={reloadCounts} />
          )}
        </TabsContent>
      </Tabs>

      <InviteDialog
        key={dialog.key}
        open={dialog.open}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
        onInvited={reloadAll}
      />
    </PageContainer>
  );
}
