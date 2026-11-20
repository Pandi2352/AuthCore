import {
  Activity,
  CheckCircle2,
  KeyRound,
  Laptop,
  Lock,
  LogIn,
  LogOut,
  ScanEye,
  ShieldX,
  UsersRound,
  XCircle,
} from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { DateTime } from '@/components/common/DateTime';
import { StatCard } from '@/components/common/StatCard';
import {
  DataTable,
  TableAction,
  useServerTable,
  type DataTableColumn,
  type DataTableFilter,
} from '@/components/data-table';
import { notifyError } from '@/components/feedback';
import { PageContainer, PageHeader } from '@/components/page';
import { Badge } from '@/components/ui';
import { paths } from '@/config';
import { isAbortError } from '@/lib/api';
import { formatActivityEvent, formatVerificationType } from '@/lib/format';

import { activityApi } from '../api/activity.api';
import type { ActivityEntry, ActivityStats } from '../types/activity.types';

type Row = ActivityEntry & { rowNumber: number };

/** A card's filters: clicking it shows exactly what it counts. */
interface Preset {
  event?: string[];
  result?: string[];
  period?: string[];
}
const PRESETS = {
  signIns: { event: ['LOGIN'], result: ['success'], period: ['24h'] },
  failed: { event: ['LOGIN_FAILED'], period: ['24h'] },
  signOuts: { event: ['LOGOUT', 'LOGOUT_ALL'], period: ['24h'] },
  newDevices: { event: ['NEW_DEVICE_LOGIN'], period: ['7d'] },
  lockouts: { event: ['ACCOUNT_LOCKED'], period: ['7d'] },
  passwords: {
    event: ['PASSWORD_CHANGED', 'PASSWORD_RESET', 'PASSWORD_SET_BY_ADMIN'],
    period: ['7d'],
  },
} satisfies Record<string, Preset>;
type PresetKey = keyof typeof PRESETS;

const nameOf = (u: NonNullable<ActivityEntry['user']>) =>
  [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email;
const muted = (text: string) => <span className="text-muted-foreground">{text}</span>;

const COLUMNS: DataTableColumn<Row>[] = [
  {
    id: 'rowNumber',
    header: 'S.No',
    width: 64,
    fit: true,
    mobile: 'hidden',
    cell: (r) => <span className="text-muted-foreground tabular-nums">{r.rowNumber}</span>,
  },
  {
    // Who: name, email under it.
    id: 'user',
    header: 'User',
    width: 300,
    wrap: true,
    mobile: 'title',
    cell: (r) =>
      r.user ? (
        <span className="block min-w-0">
          <span className="block font-medium text-foreground">{nameOf(r.user)}</span>
          <span className="block text-xs break-all text-primary">{r.user.email}</span>
        </span>
      ) : (
        muted('Deleted user')
      ),
  },
  {
    id: 'event',
    header: 'Event type',
    width: 230,
    fitText: (r) => [formatActivityEvent(r.event)],
    wrap: true,
    cell: (r) => (
      <span className="flex items-center gap-2">
        {r.isSuccess ? (
          <CheckCircle2 className="size-4 shrink-0 text-success" aria-label="Succeeded" />
        ) : (
          <XCircle className="size-4 shrink-0 text-danger" aria-label="Failed" />
        )}
        <span className="font-medium text-foreground">{formatActivityEvent(r.event)}</span>
      </span>
    ),
  },
  {
    id: 'verificationType',
    header: 'Verification',
    width: 130,
    fit: true,
    cell: (r) => {
      const label = formatVerificationType(r.verificationType);
      return label ? (
        <Badge size="sm" tone="info" variant="outline">
          {label}
        </Badge>
      ) : (
        muted('N/A')
      );
    },
  },
  {
    id: 'date',
    header: 'Event date',
    width: 120,
    fit: true,
    cell: (r) => <DateTime value={r.occurredAt} format="date" />,
  },
  {
    id: 'time',
    header: 'Event time',
    width: 110,
    fit: true,
    cell: (r) => <DateTime value={r.occurredAt} format="time" />,
  },
  {
    id: 'device',
    header: 'Device',
    width: 140,
    fitText: (r) => [r.os ?? '—'],
    cell: (r) => (r.os ? <span className="text-foreground">{r.os}</span> : muted('—')),
  },
  {
    id: 'browser',
    header: 'Browser',
    width: 140,
    fitText: (r) => [r.browser ?? '—'],
    cell: (r) => (r.browser ? <span className="text-foreground">{r.browser}</span> : muted('—')),
  },
  {
    id: 'ipAddress',
    header: 'IP',
    width: 140,
    fit: true,
    cell: (r) =>
      r.ipAddress ? (
        <span className="font-mono text-xs text-primary">{r.ipAddress}</span>
      ) : (
        muted('—')
      ),
  },
];

/** The eight counts; most of them show their events when clicked (again = everything). */
const ActivityStatCards = memo(function ActivityStatCards({
  stats: s,
  selected,
  onPick,
}: {
  stats: ActivityStats | null;
  selected: PresetKey | null;
  onPick: (preset: PresetKey | null) => void;
}) {
  const pick = (key: PresetKey) => () => onPick(selected === key ? null : key);
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        tone="success"
        pattern="waves"
        icon={LogIn}
        label="Sign-ins"
        value={s?.signIns24h ?? null}
        hint="Last 24 hours"
        selected={selected === 'signIns'}
        onClick={pick('signIns')}
      />
      <StatCard
        tone="danger"
        pattern="stripes"
        icon={ShieldX}
        label="Failed sign-ins"
        value={s?.failedSignIns24h ?? null}
        hint="Last 24 hours"
        selected={selected === 'failed'}
        onClick={pick('failed')}
      />
      <StatCard
        tone="primary"
        pattern="rings"
        icon={UsersRound}
        label="People signed in"
        value={s?.activeUsers24h ?? null}
        hint="Different users, last 24 hours"
      />
      <StatCard
        tone="info"
        pattern="grid"
        icon={LogOut}
        label="Sign-outs"
        value={s?.signOuts24h ?? null}
        hint="Last 24 hours"
        selected={selected === 'signOuts'}
        onClick={pick('signOuts')}
      />
      <StatCard
        tone="violet"
        pattern="sparkles"
        icon={Laptop}
        label="New devices"
        value={s?.newDevices7d ?? null}
        hint="Sign-ins from a new device, 7 days"
        selected={selected === 'newDevices'}
        onClick={pick('newDevices')}
      />
      <StatCard
        tone="warning"
        pattern="bars"
        icon={Lock}
        label="Account lockouts"
        value={s?.lockouts7d ?? null}
        hint="Too many failed sign-ins, 7 days"
        selected={selected === 'lockouts'}
        onClick={pick('lockouts')}
      />
      <StatCard
        tone="cyan"
        pattern="dots"
        icon={KeyRound}
        label="Password changes"
        value={s?.passwordChanges7d ?? null}
        hint="Changed, reset or set by an admin, 7 days"
        selected={selected === 'passwords'}
        onClick={pick('passwords')}
      />
      <StatCard
        tone="primary"
        pattern="bubbles"
        icon={Activity}
        label="All events"
        value={s?.totalEvents ?? null}
        hint="Kept on record · click to show all"
        selected={selected === null}
        onClick={() => onPick(null)}
      />
    </div>
  );
});

/** Administration → Activity & sign-ins: everyone's sign-ins and account events. */
export function ActivitySignInsPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<{ key: number; value: ActivityStats } | null>(null);
  const [statsKey, setStatsKey] = useState(0);
  const [eventTypes, setEventTypes] = useState<Array<{ value: string; label: string }>>([]);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        setStats({ key: statsKey, value: await activityApi.stats(controller.signal) });
      } catch (error) {
        if (!isAbortError(error)) notifyError(error, 'Could not load the activity counts');
      }
    };
    void load();
    return () => controller.abort();
  }, [statsKey]);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const types = await activityApi.eventTypes(controller.signal);
        setEventTypes(types.map((t) => ({ value: t.value, label: formatActivityEvent(t.value) })));
      } catch {
        // The event filter just has no options.
      }
    };
    void load();
    return () => controller.abort();
  }, []);

  const filters = useMemo<DataTableFilter[]>(
    () => [
      { id: 'event', label: 'Event', options: eventTypes },
      {
        id: 'result',
        label: 'Result',
        options: [
          { value: 'success', label: 'Succeeded' },
          { value: 'failed', label: 'Failed' },
        ],
      },
      {
        id: 'period',
        label: 'Period',
        options: [
          { value: '24h', label: 'Last 24 hours' },
          { value: '7d', label: 'Last 7 days' },
          { value: '30d', label: 'Last 30 days' },
        ],
      },
    ],
    [eventTypes],
  );

  const table = useServerTable<Row>({
    fetchPage: activityApi.list,
    getRowId: (r) => r.id,
    filters,
    defaultPageSize: 15,
    itemsLabel: 'events',
  });
  const { setFilter, query } = table;

  // Which card matches the current filters (exactly).
  const selected = useMemo<PresetKey | null>(() => {
    const current = JSON.stringify({
      event: query.filters.event ?? [],
      result: query.filters.result ?? [],
      period: query.filters.period ?? [],
    });
    const match = (Object.keys(PRESETS) as PresetKey[]).find((key) => {
      const p: Preset = PRESETS[key];
      return (
        JSON.stringify({ event: p.event ?? [], result: p.result ?? [], period: p.period ?? [] }) ===
        current
      );
    });
    return match ?? null;
  }, [query.filters]);

  const pickPreset = useCallback(
    (key: PresetKey | null) => {
      const p: Preset = key ? PRESETS[key] : {};
      setFilter('event', p.event ?? []);
      setFilter('result', p.result ?? []);
      setFilter('period', p.period ?? []);
    },
    [setFilter],
  );

  const openUser = (r: Row) => r.user && void navigate(paths.admin.userDetail(r.user.id));
  const renderActions = (r: Row) => (
    <span className="flex justify-end">
      <TableAction
        tone="info"
        icon={<ScanEye />}
        tooltip="View user"
        label={r.user ? `View ${nameOf(r.user)}` : 'View user'}
        disabledReason={r.user ? undefined : 'The account was deleted'}
        onClick={() => openUser(r)}
      />
    </span>
  );

  return (
    <PageContainer>
      <PageHeader
        title="Activity & sign-ins"
        description="Sign-ins, failed attempts, new devices, lockouts and other account events for every user."
      />

      {/* Memoized: paging / searching the table does not redraw the cards. */}
      <ActivityStatCards stats={stats?.value ?? null} selected={selected} onPick={pickPreset} />

      <DataTable
        table={table}
        columns={COLUMNS}
        rowActions={renderActions}
        actionsWidth={80}
        layoutKey="admin-activity:v1"
        viewOptions={false}
        // Refresh also reloads the count cards.
        onRefresh={() => setStatsKey((n) => n + 1)}
        onRowOpen={openUser}
        itemName={{ singular: 'event', plural: 'events' }}
        rowLabel={(r) =>
          `${formatActivityEvent(r.event)} · ${r.user ? nameOf(r.user) : 'deleted user'}`
        }
        searchPlaceholder="Search by user name or email"
        emptyState={{
          icon: <Activity />,
          title: 'No activity yet',
          description: 'Sign-ins and account changes appear here as they happen.',
        }}
      />
    </PageContainer>
  );
}
