import {
  AtSign,
  CalendarDays,
  Camera,
  CheckCircle2,
  Circle,
  Clock3,
  Download,
  History,
  KeyRound,
  Laptop,
  LogIn,
  LogOut,
  Mail,
  MonitorSmartphone,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  SquarePen,
  Trash2,
  UserRound,
  XCircle,
} from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

import type { FormAttribute } from '@/components/attributes';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { DateTime } from '@/components/common/DateTime';
import { StatCard } from '@/components/common/StatCard';
import { TableAction } from '@/components/data-table';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  notifyError,
  notifySuccess,
} from '@/components/feedback';
import { PageContainer } from '@/components/page';
import { Alert, Avatar, Badge, Button, Progress, Select, Switch } from '@/components/ui';
import { isFeatureEnabled, paths } from '@/config';
import { useAuth, type UserProfileDetails } from '@/features/auth';
import { isAbortError } from '@/lib/api';
import { formatActivityEvent, formatDateTime, formatVerificationType } from '@/lib/format';
import { cn } from '@/lib/utils';

import { accountApi } from '../api/account.api';
import {
  AccountActionDialog,
  ChangeEmailDialog,
  ChangePasswordDialog,
} from '../components/AccountDialogs';
import { EditProfileDialog } from '../components/EditProfileDialog';
import { reloadMyAvatar, useMyAvatar } from '../components/my-avatar';
import {
  completionPercent,
  completionSteps,
  editableAttributes,
} from '../components/profile-completion';
import type {
  KnownDevice,
  ProfileFormAttribute,
  Session,
  UserActivityEntry,
} from '../types/account.types';

const EVENT_FILTERS = [
  { value: '', label: 'All events' },
  { value: 'LOGIN', label: 'Sign in' },
  { value: 'LOGIN_FAILED', label: 'Failed sign in' },
  { value: 'LOGOUT', label: 'Sign out' },
  { value: 'PASSWORD_CHANGED', label: 'Password changed' },
  { value: 'NEW_DEVICE_LOGIN', label: 'New device sign in' },
];
const ACTIVITY_PREVIEW = 10;

const humanize = (value: string) =>
  value.charAt(0) + value.slice(1).toLowerCase().replaceAll('_', ' ');

/** Years / months since a date ("2 yrs", "5 mos", "12 days"). */
function tenure(since: string): string {
  const days = Math.max(0, Math.floor((Date.now() - new Date(since).getTime()) / 86_400_000));
  if (days >= 365) return `${(days / 365).toFixed(1).replace(/\.0$/, '')} yrs`;
  if (days >= 30) return `${Math.floor(days / 30)} mos`;
  return `${days} ${days === 1 ? 'day' : 'days'}`;
}

/** A stored profile value as text (option labels, Yes / No, dates). */
function showValue(attribute: FormAttribute, raw: unknown): string {
  if (raw === undefined || raw === null || raw === '') return '—';
  const label = (value: unknown) =>
    attribute.options.find((o) => o.value === value)?.label ?? String(value);
  if (attribute.kind === 'GROUP') {
    const entries = (Array.isArray(raw) ? raw : [raw]).filter(
      (e): e is Record<string, unknown> => typeof e === 'object' && e !== null,
    );
    const parts = entries.map((entry) =>
      (attribute.children ?? [])
        .map((c) => entry[c.name])
        .filter((v) => v !== undefined && v !== null && v !== '')
        .join(', '),
    );
    return parts.filter(Boolean).join(' · ') || '—';
  }
  switch (attribute.dataType) {
    case 'BOOLEAN':
      return raw === true ? 'Yes' : 'No';
    case 'MULTI_SELECT':
      return Array.isArray(raw) && raw.length > 0 ? raw.map(label).join(', ') : '—';
    case 'DROPDOWN':
      return label(raw);
    case 'DATE':
    case 'DATETIME':
      return typeof raw === 'string' ? formatDateTime(raw) : String(raw);
    default:
      return String(raw);
  }
}

/** Delete my photo (initials show instead). */
const removePhoto = async () => {
  try {
    await accountApi.deleteAvatar();
    reloadMyAvatar();
    notifySuccess('Profile photo removed');
  } catch (err) {
    notifyError(err, 'Could not remove the photo');
    throw err;
  }
};

/** A white card with a colored icon tile in its title (same look across the profile). */
function Card({
  id,
  icon,
  tone,
  title,
  action,
  children,
}: {
  id?: string;
  icon: ReactNode;
  tone: 'primary' | 'success' | 'warning' | 'info' | 'danger' | 'violet';
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const tile = {
    primary: 'bg-primary-soft text-primary-soft-foreground',
    success: 'bg-success-soft text-success-soft-foreground',
    warning: 'bg-warning-soft text-warning-soft-foreground',
    info: 'bg-info-soft text-info-soft-foreground',
    danger: 'bg-danger-soft text-danger-soft-foreground',
    violet: 'bg-nav-violet/10 text-nav-violet',
  }[tone];
  return (
    <section
      id={id}
      aria-label={title}
      className="scroll-mt-24 rounded-md border border-border bg-surface p-card"
    >
      <header className="mb-4 flex items-center gap-2.5">
        <span
          className={cn(
            'flex size-8 shrink-0 items-center justify-center rounded-md [&_svg]:size-4',
            tile,
          )}
        >
          {icon}
        </span>
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {action && <div className="ml-auto flex items-center gap-2">{action}</div>}
      </header>
      {children}
    </section>
  );
}

/** Term on the left, value on the right. */
function Row({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 text-sm">
      <dt className="text-muted-foreground">{term}</dt>
      <dd className="min-w-0 text-right font-medium text-foreground">{children}</dd>
    </div>
  );
}

interface Loaded {
  key: number;
  profile: UserProfileDetails;
  form: ProfileFormAttribute[];
}

/**
 * My profile: one page for everything about my account — header with photo and completion,
 * personal details (edit), contact, security, sessions and recent activity. The old
 * /security, /sessions and /activity links open this page at that section.
 */
export function MyProfilePage() {
  const location = useLocation();
  const { user, updateUser, logoutAll } = useAuth();
  const avatar = useMyAvatar(user?.id);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const showSessions = isFeatureEnabled('account.sessionsPage');
  const showActivity = isFeatureEnabled('account.activityPage');

  const [attempt, setAttempt] = useState(0);
  const [data, setData] = useState<Loaded | null>(null);
  const [failure, setFailure] = useState<{ key: number; error: unknown } | null>(null);
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [devices, setDevices] = useState<KnownDevice[] | null>(null);
  const [activity, setActivity] = useState<{ filter: string; items: UserActivityEntry[] } | null>(
    null,
  );
  const [activityFilter, setActivityFilter] = useState('');
  const [showAllActivity, setShowAllActivity] = useState(false);
  const [uploadPercent, setUploadPercent] = useState<number | null>(null);
  const [isSavingAlerts, setIsSavingAlerts] = useState(false);
  const [dialog, setDialog] = useState<
    'edit' | 'password' | 'email' | 'export' | 'deactivate' | null
  >(null);

  // Opened from the "new password required" redirect: show why and open the form.
  const reason = (location.state as { message?: string } | null)?.message ?? null;
  const mustChange = user?.mustChangePassword === true;
  const [askedForPassword, setAskedForPassword] = useState(false);
  if (mustChange && !askedForPassword) {
    setAskedForPassword(true);
    setDialog('password');
  }

  // Profile + form (reloaded after edits).
  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const [profile, form] = await Promise.all([
          accountApi.getProfile(controller.signal),
          accountApi.getProfileForm(controller.signal),
        ]);
        setData({ key: attempt, profile, form });
      } catch (error) {
        if (!isAbortError(error)) setFailure({ key: attempt, error });
      }
    };
    void load();
    return () => controller.abort();
  }, [attempt]);

  // Sessions and devices.
  useEffect(() => {
    if (!showSessions) return;
    const controller = new AbortController();
    const load = async () => {
      const [s, d] = await Promise.allSettled([
        accountApi.getSessions(controller.signal),
        accountApi.getDevices(controller.signal),
      ]);
      if (controller.signal.aborted) return;
      setSessions(s.status === 'fulfilled' ? s.value : []);
      setDevices(d.status === 'fulfilled' ? d.value : []);
    };
    void load();
    return () => controller.abort();
  }, [showSessions]);

  // Activity (per filter).
  useEffect(() => {
    if (!showActivity) return;
    const controller = new AbortController();
    const load = async () => {
      try {
        const items = await accountApi.getActivity(activityFilter || undefined, controller.signal);
        setActivity({ filter: activityFilter, items });
      } catch (error) {
        if (!isAbortError(error)) setActivity({ filter: activityFilter, items: [] });
      }
    };
    void load();
    return () => controller.abort();
  }, [activityFilter, showActivity]);

  // /security, /sessions, /activity: scroll to that part once the page is there.
  const section =
    location.pathname === paths.account.security
      ? 'security'
      : location.pathname === paths.account.sessions
        ? 'sessions'
        : location.pathname === paths.account.activity
          ? 'activity'
          : null;
  const isReady = data !== null;
  useEffect(() => {
    if (!section || !isReady) return;
    document.getElementById(section)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [section, isReady]);

  if (!data) {
    return (
      <PageContainer>
        {failure?.key === attempt ? (
          <ErrorState
            error={failure.error}
            title="Could not load your profile"
            onRetry={() => setAttempt((n) => n + 1)}
          />
        ) : (
          <LoadingState label="Loading your profile" />
        )}
      </PageContainer>
    );
  }

  const { profile, form } = data;
  const name = [profile.firstName, profile.lastName].filter(Boolean).join(' ');
  const steps = completionSteps(profile, form, Boolean(avatar));
  const percent = completionPercent(steps);
  const todo = steps.filter((s) => !s.isDone);
  const details = editableAttributes(form);
  const loginAlerts = (user ?? profile).preferences.notifications.loginAlerts;
  const passwordChangedAt = (user ?? profile).passwordChangedAt;
  const signIns = activity?.items.filter((a) => a.event === 'LOGIN' && a.isSuccess).length ?? null;
  const shownActivity = activity
    ? showAllActivity
      ? activity.items
      : activity.items.slice(0, ACTIVITY_PREVIEW)
    : [];

  const changePhoto = async (file: File) => {
    setUploadPercent(0);
    try {
      await accountApi.uploadAvatar(file, { onProgress: (p) => setUploadPercent(p.percent) });
      reloadMyAvatar();
      notifySuccess('Profile photo updated');
    } catch (err) {
      notifyError(err, 'Could not upload the photo');
    } finally {
      setUploadPercent(null);
    }
  };
  const setLoginAlerts = async (on: boolean) => {
    setIsSavingAlerts(true);
    try {
      const preferences = await accountApi.updatePreferences({
        notifications: { ...profile.preferences.notifications, loginAlerts: on },
      });
      updateUser({ preferences });
      setData((d) => (d ? { ...d, profile: { ...d.profile, preferences } } : d));
      notifySuccess(on ? 'Sign-in alerts on' : 'Sign-in alerts off');
    } catch (err) {
      notifyError(err, 'Could not change sign-in alerts');
    } finally {
      setIsSavingAlerts(false);
    }
  };

  const revokeSession = async (session: Session) => {
    try {
      const res = await accountApi.revokeSession(session.id);
      if (res.isCurrentSession) {
        window.location.href = paths.auth.login;
        return;
      }
      setSessions((current) => current?.filter((s) => s.id !== session.id) ?? null);
      notifySuccess('Device signed out');
    } catch (err) {
      notifyError(err, 'Could not sign out the device');
      throw err;
    }
  };
  const signOutOthers = async () => {
    try {
      await logoutAll(true);
      setSessions((current) => current?.filter((s) => s.isCurrent) ?? null);
      notifySuccess('All other devices were signed out');
    } catch (err) {
      notifyError(err, 'Could not sign out the other devices');
      throw err;
    }
  };

  return (
    <PageContainer>
      {/* ---------------------------------------------------------------- header */}
      <section
        aria-label="Profile"
        className="overflow-hidden rounded-md border border-border bg-surface"
      >
        <div className="relative h-32 bg-linear-to-r from-primary via-nav-violet to-nav-cyan sm:h-36">
          <svg
            aria-hidden="true"
            className="absolute inset-0 h-full w-full text-primary-foreground opacity-15"
          >
            <defs>
              <pattern
                id="profile-banner-dots"
                width="18"
                height="18"
                patternUnits="userSpaceOnUse"
              >
                <circle cx="2" cy="2" r="1.5" fill="currentColor" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#profile-banner-dots)" />
          </svg>
          <div className="absolute top-3 right-3 flex gap-2">
            <Button
              size="toolbar"
              variant="outline"
              leftIcon={<SquarePen />}
              className="bg-surface"
              onClick={() => setDialog('edit')}
            >
              Edit profile
            </Button>
          </div>
        </div>

        <div className="px-card pb-card">
          <div className="-mt-12 flex flex-col gap-4 sm:-mt-14 sm:flex-row sm:items-end">
            <div className="relative w-fit">
              <Avatar
                src={avatar}
                name={name}
                size="xl"
                className="size-24! border-4 border-surface text-2xl shadow-card sm:size-28!"
              />
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (file) void changePhoto(file);
                }}
              />
              <span className="absolute -right-1 bottom-1 flex gap-1">
                <TableAction
                  tone="primary"
                  icon={<Camera />}
                  tooltip={avatar ? 'Change photo' : 'Add photo'}
                  label={avatar ? 'Change your profile photo' : 'Add a profile photo'}
                  disabledReason={uploadPercent !== null ? 'Uploading…' : undefined}
                  onClick={() => fileRef.current?.click()}
                />
                {avatar && (
                  <ConfirmDialog
                    trigger={
                      <TableAction
                        tone="danger"
                        icon={<Trash2 />}
                        tooltip="Remove photo"
                        label="Remove your profile photo"
                      />
                    }
                    title="Remove your profile photo?"
                    description="Your initials are shown instead."
                    confirmText="Remove"
                    destructive
                    onConfirm={removePhoto}
                  />
                )}
              </span>
            </div>
            <div className="min-w-0 flex-1 pb-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold text-foreground">{name}</h1>
                <Badge tone={profile.status === 'ACTIVE' ? 'success' : 'warning'}>
                  {humanize(profile.status)}
                </Badge>
                {profile.role === 'ADMIN' && <Badge tone="primary">Administrator</Badge>}
              </div>
              <p className="truncate text-sm text-muted-foreground">{profile.email}</p>
            </div>
          </div>
          {uploadPercent !== null && (
            <Progress
              value={uploadPercent}
              label="Uploading profile photo"
              showValue
              size="sm"
              className="mt-3 max-w-xs"
            />
          )}

          <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 border-b border-border pb-4 text-xs text-muted-foreground">
            {profile.username && (
              <li className="flex items-center gap-1.5">
                <AtSign className="size-3.5" aria-hidden="true" />
                {profile.username}
              </li>
            )}
            <li className="flex items-center gap-1.5">
              <CalendarDays className="size-3.5" aria-hidden="true" />
              Joined <DateTime value={profile.createdAt} format="date" />
            </li>
            <li className="flex items-center gap-1.5">
              <LogIn className="size-3.5" aria-hidden="true" />
              Last sign-in{' '}
              {profile.lastLoginAt ? (
                <DateTime value={profile.lastLoginAt} format="relative" />
              ) : (
                'never'
              )}
            </li>
            <li className="flex items-center gap-1.5">
              <Mail className="size-3.5" aria-hidden="true" />
              {profile.isEmailVerified ? 'Email verified' : 'Email not verified'}
            </li>
          </ul>

          {/* Completion bar + what's left */}
          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] lg:items-center">
            <div>
              <div className="mb-1.5 flex items-baseline justify-between">
                <span className="text-sm font-semibold text-foreground">Profile completion</span>
                <span
                  className={cn(
                    'text-lg font-bold tabular-nums',
                    percent === 100 ? 'text-success' : 'text-primary',
                  )}
                >
                  {percent}%
                </span>
              </div>
              <Progress
                value={percent}
                tone={percent === 100 ? 'success' : percent >= 60 ? 'primary' : 'warning'}
                size="lg"
                label="Profile completion"
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                {percent === 100
                  ? 'Your profile is complete.'
                  : `${steps.length - todo.length} of ${steps.length} done`}
              </p>
            </div>
            {todo.length > 0 && (
              <ul className="flex flex-wrap gap-1.5" aria-label="Still to do">
                {todo.slice(0, 6).map((step) => (
                  <li key={step.id}>
                    <button
                      type="button"
                      onClick={() =>
                        step.id === 'photo'
                          ? fileRef.current?.click()
                          : step.id === 'email'
                            ? setDialog('email')
                            : setDialog('edit')
                      }
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-warning/40 bg-warning-soft/50 px-2.5 py-1 text-xs font-medium text-warning-soft-foreground hover:bg-warning-soft focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      <Circle className="size-3" aria-hidden="true" />
                      {step.label}
                    </button>
                  </li>
                ))}
                {todo.length > 6 && (
                  <li className="self-center text-xs text-muted-foreground">
                    +{todo.length - 6} more
                  </li>
                )}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- counts */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          tone="success"
          pattern="waves"
          icon={LogIn}
          label="Sign-ins"
          value={showActivity ? signIns : '—'}
          hint="In your recent activity"
        />
        <StatCard
          tone="info"
          pattern="grid"
          icon={MonitorSmartphone}
          label="Active sessions"
          value={showSessions ? (sessions?.length ?? null) : '—'}
          hint="Devices signed in now"
        />
        <StatCard
          tone="violet"
          pattern="sparkles"
          icon={Laptop}
          label="Known devices"
          value={showSessions ? (devices?.length ?? null) : '—'}
          hint="Used to sign in before"
        />
        <StatCard
          tone="warning"
          pattern="rings"
          icon={Clock3}
          label="Member for"
          value={tenure(profile.createdAt)}
          hint={<DateTime value={profile.createdAt} format="date" />}
        />
      </div>

      {(reason ?? mustChange) && (
        <Alert
          variant="warning"
          title="New password required"
          message={reason ?? 'Choose a new password to continue using the app.'}
          action={
            <Button size="sm" leftIcon={<KeyRound />} onClick={() => setDialog('password')}>
              Change password
            </Button>
          }
        />
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <div className="min-w-0 space-y-6">
          {/* ---------------------------------------------------------------- personal */}
          <Card
            icon={<UserRound />}
            tone="primary"
            title="Personal information"
            action={
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<SquarePen />}
                onClick={() => setDialog('edit')}
              >
                Edit
              </Button>
            }
          >
            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              {[
                ['First name', profile.firstName],
                ['Last name', profile.lastName ?? '—'],
                ['Username', profile.username ? `@${profile.username}` : '—'],
                ['Email', profile.email],
                ...details.map((a) => [a.label, showValue(a, profile.attributes?.[a.name])]),
              ].map(([term, value]) => (
                <div key={term} className="min-w-0">
                  <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    {term}
                  </dt>
                  <dd
                    className={cn(
                      'mt-1 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm break-words',
                      value === '—' ? 'text-muted-foreground' : 'text-foreground',
                    )}
                  >
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </Card>
          {/* ---------------------------------------------------------------- sessions */}
          {showSessions && (
            <Card
              id="sessions"
              icon={<MonitorSmartphone />}
              tone="warning"
              title="Active sessions"
              action={
                sessions && (
                  <Badge size="sm" tone="neutral" className="tabular-nums">
                    {sessions.length}
                  </Badge>
                )
              }
            >
              {sessions === null ? (
                <LoadingState label="Loading sessions" />
              ) : sessions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active sessions.</p>
              ) : (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {sessions.map((s) => {
                    const device = s.deviceName || `${s.browser} on ${s.os}`;
                    return (
                      <li
                        key={s.id}
                        className={cn(
                          'flex items-center gap-3 rounded-md border px-3 py-2.5',
                          s.isCurrent ? 'border-success/40 bg-success-soft/30' : 'border-border',
                        )}
                      >
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground [&_svg]:size-4">
                          {s.deviceType === 'mobile' ? (
                            <Smartphone aria-hidden="true" />
                          ) : (
                            <Laptop aria-hidden="true" />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-foreground">
                            {device}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {s.isCurrent ? (
                              'This device'
                            ) : (
                              <DateTime value={s.lastUsedAt} format="relative" />
                            )}
                            {' · IP '}
                            {s.lastIpAddress || s.ipAddress}
                          </span>
                        </span>
                        <ConfirmDialog
                          trigger={
                            <TableAction
                              tone="danger"
                              icon={<LogOut />}
                              tooltip={s.isCurrent ? 'Sign out here' : 'Sign out'}
                              label={`Sign out ${device}`}
                            />
                          }
                          title={s.isCurrent ? 'Sign out of this device?' : 'Sign out this device?'}
                          description={
                            s.isCurrent
                              ? 'You are signed out here and taken to the sign-in page.'
                              : `${device} is signed out right away.`
                          }
                          confirmText="Sign out"
                          destructive
                          onConfirm={() => revokeSession(s)}
                        />
                      </li>
                    );
                  })}
                </ul>
              )}
              {sessions && sessions.length > 1 && (
                <ConfirmDialog
                  trigger={
                    <Button
                      variant="outline"
                      className="mt-3 w-full sm:w-auto"
                      leftIcon={<LogOut />}
                    >
                      Sign out all other devices
                    </Button>
                  }
                  title="Sign out all other devices?"
                  description="Every other browser and device has to sign in again. This one stays signed in."
                  confirmText="Sign out others"
                  destructive
                  onConfirm={signOutOthers}
                />
              )}
            </Card>
          )}
        </div>

        <aside className="min-w-0 space-y-6">
          {/* ---------------------------------------------------------------- contact */}
          <Card icon={<Mail />} tone="violet" title="Contact">
            <dl className="divide-y divide-border">
              <Row term="Email">
                <span className="break-all">{profile.email}</span>
              </Row>
              <Row term="Verified">
                <Badge size="sm" tone={profile.isEmailVerified ? 'success' : 'warning'}>
                  {profile.isEmailVerified ? 'Verified' : 'Not verified'}
                </Badge>
              </Row>
            </dl>
            <Button
              variant="outline"
              className="mt-3 w-full"
              leftIcon={<Mail />}
              onClick={() => setDialog('email')}
            >
              Change email
            </Button>
          </Card>

          {/* ---------------------------------------------------------------- security */}
          <Card id="security" icon={<ShieldCheck />} tone="success" title="Security">
            <dl className="divide-y divide-border">
              <Row term="Password last changed">
                <DateTime value={passwordChangedAt} format="relative" />
              </Row>
              <Row term="Sign-in alerts">
                <Switch
                  size="sm"
                  checked={loginAlerts}
                  disabled={isSavingAlerts}
                  aria-label="Email me about sign-ins from new devices"
                  onCheckedChange={(on) => void setLoginAlerts(on)}
                />
              </Row>
              <Row term="Account role">
                <Badge size="sm" tone={profile.role === 'ADMIN' ? 'primary' : 'neutral'}>
                  {profile.role === 'ADMIN' ? 'Administrator' : 'User'}
                </Badge>
              </Row>
            </dl>
            <Button
              variant="outline"
              className="mt-3 w-full"
              leftIcon={<KeyRound />}
              onClick={() => setDialog('password')}
            >
              Change password
            </Button>
          </Card>

          {/* ---------------------------------------------------------------- account */}
          <Card icon={<ShieldAlert />} tone="danger" title="Your data & account">
            <div className="space-y-2">
              <Button
                variant="outline"
                className="w-full"
                leftIcon={<Download />}
                onClick={() => setDialog('export')}
              >
                Download my data
              </Button>
              <Button
                variant="outline"
                className="w-full border-danger/40 text-danger hover:bg-danger-soft"
                leftIcon={<ShieldAlert />}
                onClick={() => setDialog('deactivate')}
              >
                Deactivate account
              </Button>
            </div>
          </Card>
        </aside>
      </div>

      {/* ---------------------------------------------------------------- activity */}
      {showActivity && (
        <Card
          id="activity"
          icon={<History />}
          tone="info"
          title="Recent user activities"
          action={
            <div className="w-48">
              <Select
                aria-label="Filter activity"
                size="toolbar"
                value={activityFilter}
                options={EVENT_FILTERS}
                onValueChange={(value) => {
                  setActivityFilter(value ?? '');
                  setShowAllActivity(false);
                }}
              />
            </div>
          }
        >
          {activity?.filter !== activityFilter ? (
            <LoadingState variant="table" label="Loading activity" />
          ) : activity.items.length === 0 ? (
            <EmptyState
              size="compact"
              icon={<History />}
              title="No activity yet"
              description={
                activityFilter
                  ? 'Nothing matches this filter. Try “All events”.'
                  : 'Sign-ins and security changes appear here.'
              }
            />
          ) : (
            <>
              <div className="scrollbar-slim overflow-x-auto overflow-y-hidden rounded-md border border-border">
                <table className="w-full min-w-[52rem] border-collapse text-sm">
                  <caption className="sr-only">Recent user activities</caption>
                  <thead>
                    <tr>
                      {[
                        'Event type',
                        'Verification type',
                        'Event date',
                        'Event time',
                        'Device',
                        'Browser',
                        'IP',
                      ].map((header) => (
                        <th
                          key={header}
                          scope="col"
                          className="border-b border-border bg-muted px-3 py-2.5 text-left text-xs font-semibold tracking-wide whitespace-nowrap text-muted-foreground uppercase"
                        >
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {shownActivity.map((item) => (
                      <tr
                        key={item.id}
                        className="transition-colors even:bg-muted/60 hover:bg-accent/50"
                      >
                        <td className="border-b border-border px-3 py-2.5">
                          <span className="flex items-center gap-2">
                            {item.isSuccess ? (
                              <CheckCircle2
                                className="size-4 shrink-0 text-success"
                                aria-label="Succeeded"
                              />
                            ) : (
                              <XCircle
                                className="size-4 shrink-0 text-danger"
                                aria-label="Failed"
                              />
                            )}
                            <span className="font-medium text-foreground">
                              {formatActivityEvent(item.event)}
                            </span>
                          </span>
                        </td>
                        <td className="border-b border-border px-3 py-2.5 whitespace-nowrap">
                          {item.verificationType === 'NONE' ? (
                            <span className="text-muted-foreground">N/A</span>
                          ) : (
                            <Badge size="sm" tone="info" variant="outline">
                              {formatVerificationType(item.verificationType)}
                            </Badge>
                          )}
                        </td>
                        <td className="border-b border-border px-3 py-2.5 whitespace-nowrap text-foreground">
                          <DateTime value={item.occurredAt} format="date" />
                        </td>
                        <td className="border-b border-border px-3 py-2.5 whitespace-nowrap text-foreground">
                          <DateTime value={item.occurredAt} format="time" />
                        </td>
                        <td className="border-b border-border px-3 py-2.5 whitespace-nowrap text-foreground">
                          {item.os ?? <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="border-b border-border px-3 py-2.5 whitespace-nowrap text-foreground">
                          {item.browser ?? <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="border-b border-border px-3 py-2.5 font-mono text-xs whitespace-nowrap text-primary">
                          {item.ipAddress ?? <span className="text-muted-foreground">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {activity.items.length > ACTIVITY_PREVIEW && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-3"
                  onClick={() => setShowAllActivity((v) => !v)}
                >
                  {showAllActivity ? 'Show less' : `Show all (${activity.items.length})`}
                </Button>
              )}
            </>
          )}
        </Card>
      )}

      <EditProfileDialog
        open={dialog === 'edit'}
        profile={profile}
        form={form}
        onOpenChange={(open) => !open && setDialog(null)}
        onSaved={() => setAttempt((n) => n + 1)}
      />
      <ChangePasswordDialog
        open={dialog === 'password'}
        reason={reason}
        onOpenChange={(open) => !open && setDialog(null)}
      />
      <ChangeEmailDialog
        open={dialog === 'email'}
        onOpenChange={(open) => {
          if (!open) {
            setDialog(null);
            setAttempt((n) => n + 1);
          }
        }}
      />
      <AccountActionDialog
        action="export"
        open={dialog === 'export'}
        onOpenChange={(open) => !open && setDialog(null)}
      />
      <AccountActionDialog
        action="deactivate"
        open={dialog === 'deactivate'}
        onOpenChange={(open) => !open && setDialog(null)}
      />
    </PageContainer>
  );
}
