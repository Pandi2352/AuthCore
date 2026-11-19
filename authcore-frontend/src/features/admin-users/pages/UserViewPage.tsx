import {
  Fingerprint,
  FolderTree,
  IdCard,
  KeyRound,
  MonitorSmartphone,
  Shield,
  SquarePen,
  UserRoundCog,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { DateTime } from '@/components/common/DateTime';
import { StatCard } from '@/components/common/StatCard';
import { ErrorState, LoadingState } from '@/components/feedback';
import { PageContainer, PageHeader } from '@/components/page';
import { Badge, Button } from '@/components/ui';
import { paths } from '@/config';
import { usePermissions } from '@/features/auth';
import { useRequiredParam } from '@/hooks';
import { isAbortError } from '@/lib/api';
import { formatDateTime } from '@/lib/format';

import { adminUsersApi } from '../api/admin-users.api';
import { createUserApi } from '../api/create-user.api';
import { EditUserDialog } from '../components/EditUserDialog';
import { fullName, ROLE_LABEL, STATUS_LABEL, STATUS_TONE } from '../components/user-labels';
import { UserAccessDialog } from '../components/UserAccessDialog';
import type { AdminUserDetails } from '../types/admin-user.types';
import type { FormAttribute } from '../types/create-user.types';

type Access = Awaited<ReturnType<typeof adminUsersApi.effectiveAccess>>;

interface Loaded {
  key: string;
  user: AdminUserDetails;
  attributes: FormAttribute[];
  /** null: you may not see this user's access. */
  access: Access | null;
}

const SOURCE_LABEL: Record<AdminUserDetails['source'], string> = {
  REGISTRATION: 'Sign-up page',
  INVITE: 'Invite',
  ADMIN: 'Created by admin',
  SYSTEM: 'System',
};

/** A stored profile value as text (option labels, Yes / No, dates). */
function showValue(attribute: FormAttribute, raw: unknown): string {
  if (raw === undefined || raw === null || raw === '') return '—';
  const label = (value: unknown) =>
    attribute.options.find((o) => o.value === value)?.label ?? String(value);
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
      return typeof raw === 'object' ? JSON.stringify(raw) : String(raw);
  }
}

/** Term / value rows. */
function Rows({ rows }: { rows: Array<[string, ReactNode]> }) {
  return (
    <dl className="space-y-2.5 text-sm">
      {rows.map(([term, value]) => (
        <div key={term} className="flex justify-between gap-3">
          <dt className="shrink-0 text-muted-foreground">{term}</dt>
          <dd className="min-w-0 text-right font-medium break-words text-foreground">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A titled white card. */
function Card({
  icon,
  title,
  count,
  children,
}: {
  icon: ReactNode;
  title: string;
  count?: number;
  children: ReactNode;
}) {
  return (
    <section aria-label={title} className="rounded-md border border-border bg-surface p-card">
      <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-foreground">
        {icon} {title}
        {count !== undefined && (
          <Badge size="sm" tone="neutral" className="ml-auto tabular-nums">
            {count}
          </Badge>
        )}
      </h2>
      {children}
    </section>
  );
}

/** Users → eye icon: everything about one user on one page. */
export function UserViewPage() {
  const id = useRequiredParam('id');
  const { hasPermission } = usePermissions();
  const canUpdate = hasPermission('USER_UPDATE');
  const [attempt, setAttempt] = useState(0);
  const [data, setData] = useState<Loaded | null>(null);
  const [failure, setFailure] = useState<{ key: string; error: unknown } | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isAccessOpen, setIsAccessOpen] = useState(false);
  const key = `${id}#${attempt}`;

  useEffect(() => {
    const controller = new AbortController();
    const [userId = ''] = key.split('#');
    const load = async () => {
      try {
        const [user, config, access] = await Promise.all([
          adminUsersApi.get(userId, controller.signal),
          createUserApi.config(controller.signal),
          // Needs access-mapping read rights: without them the page still shows the rest.
          adminUsersApi.effectiveAccess(userId, controller.signal).catch((error: unknown) => {
            if (isAbortError(error)) throw error;
            return null;
          }),
        ]);
        setData({ key, user, attributes: config.attributes, access });
      } catch (error) {
        if (!isAbortError(error)) setFailure({ key, error });
      }
    };
    void load();
    return () => controller.abort();
  }, [key]);

  const back = <Link to={paths.admin.users}>All users</Link>;
  // While reloading the same user, keep showing the previous data.
  const current = data?.key.startsWith(`${id}#`) ? data : null;

  if (!current) {
    return (
      <PageContainer>
        <PageHeader title="User" back={back} />
        {failure?.key === key ? (
          <ErrorState
            error={failure.error}
            title="Could not load the user"
            onRetry={() => setAttempt((n) => n + 1)}
          />
        ) : (
          <LoadingState label="Loading the user" />
        )}
      </PageContainer>
    );
  }

  const { user, access } = current;
  const name = fullName(user);
  const reload = () => setAttempt((n) => n + 1);
  const fields = current.attributes.filter((a) => a.kind === 'FIELD');
  const groups = current.attributes.filter((a) => a.kind === 'GROUP');

  return (
    <PageContainer>
      <PageHeader
        back={back}
        title={name}
        meta={
          <span className="flex flex-wrap items-center gap-1.5">
            <Badge tone={user.role === 'ADMIN' ? 'primary' : 'neutral'} variant="soft">
              {ROLE_LABEL[user.role]}
            </Badge>
            <Badge tone={STATUS_TONE[user.status]}>{STATUS_LABEL[user.status]}</Badge>
          </span>
        }
        description={user.email}
        actions={
          canUpdate && (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="toolbar"
                leftIcon={<SquarePen />}
                onClick={() => setIsEditing(true)}
              >
                Edit
              </Button>
              <Button
                size="toolbar"
                leftIcon={<UserRoundCog />}
                onClick={() => setIsAccessOpen(true)}
              >
                Groups & roles
              </Button>
            </div>
          )
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          tone="warning"
          pattern="waves"
          icon={FolderTree}
          label="Groups"
          value={access ? access.groups.length : user.groups.length}
          hint="Groups they are in"
        />
        <StatCard
          tone="success"
          pattern="rings"
          icon={Shield}
          label="Roles"
          value={access ? access.roles.length : '—'}
          hint="Through their groups"
        />
        <StatCard
          tone="cyan"
          pattern="dots"
          icon={KeyRound}
          label="Permissions"
          value={access ? (access.isAdmin ? 'All' : access.permissions.length) : '—'}
          hint={access?.isAdmin ? 'Admins pass every check' : 'What they can do'}
        />
        <StatCard
          tone="violet"
          pattern="grid"
          icon={MonitorSmartphone}
          label="Active sessions"
          value={user.activeSessionCount}
          hint={user.isLocked ? 'Account locked (failed sign-ins)' : 'Signed-in devices'}
        />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="space-y-6">
          <Card
            icon={<IdCard className="size-4 text-primary" aria-hidden="true" />}
            title="Profile details"
          >
            {current.attributes.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No custom profile fields yet (add them under Schemas).
              </p>
            ) : (
              <div className="space-y-5">
                {fields.length > 0 && (
                  <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                    {fields.map((a) => (
                      <div key={a.id} className="min-w-0">
                        <dt className="text-xs text-muted-foreground">{a.label}</dt>
                        <dd className="text-sm font-medium break-words text-foreground">
                          {showValue(a, user.attributes[a.name])}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
                {groups.map((g) => {
                  const stored = user.attributes[g.name];
                  const entries = (
                    g.groupType === 'LIST' ? (Array.isArray(stored) ? stored : []) : [stored]
                  ).filter(
                    (e): e is Record<string, unknown> => typeof e === 'object' && e !== null,
                  );
                  return (
                    <div key={g.id} className="rounded-md border border-border p-3">
                      <h3 className="mb-2 text-sm font-semibold text-foreground">
                        {g.label}
                        {g.groupType === 'LIST' && (
                          <span className="font-normal text-muted-foreground">
                            {' '}
                            ({entries.length})
                          </span>
                        )}
                      </h3>
                      {entries.length === 0 ? (
                        <p className="text-sm text-muted-foreground">—</p>
                      ) : (
                        <div className="space-y-2">
                          {entries.map((entry, i) => (
                            <dl
                              // Entries have no id of their own; their order is stable.
                              // oxlint-disable-next-line react/no-array-index-key
                              key={i}
                              className="grid gap-x-6 gap-y-2 rounded-md bg-muted/60 p-2.5 sm:grid-cols-2"
                            >
                              {(g.children ?? []).map((c) => (
                                <div key={c.id} className="min-w-0">
                                  <dt className="text-xs text-muted-foreground">{c.label}</dt>
                                  <dd className="text-sm font-medium break-words text-foreground">
                                    {showValue(c, entry[c.name])}
                                  </dd>
                                </div>
                              ))}
                            </dl>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card
            icon={<KeyRound className="size-4 text-success" aria-hidden="true" />}
            title="Permissions"
            count={access && !access.isAdmin ? access.permissions.length : undefined}
          >
            {!access ? (
              <p className="text-sm text-muted-foreground">
                You can't see this user's access (needs the access read permission).
              </p>
            ) : access.isAdmin ? (
              <p className="text-sm text-muted-foreground">
                Admins pass every permission check, whatever their groups give.
              </p>
            ) : access.permissions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                None yet. Add them to a group that has roles.
              </p>
            ) : (
              <ul className="flex flex-wrap gap-1.5">
                {access.permissions.toSorted().map((p) => (
                  <li key={p}>
                    <Badge size="sm" tone="success" variant="outline" className="font-mono">
                      {p}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <aside className="space-y-6">
          <Card
            icon={<Fingerprint className="size-4 text-primary" aria-hidden="true" />}
            title="Account"
          >
            <Rows
              rows={[
                ['Username', user.username ? `@${user.username}` : '—'],
                ['Email verified', user.isEmailVerified ? 'Yes' : 'No'],
                ['Joined via', SOURCE_LABEL[user.source]],
                ['Must change password', user.mustChangePassword ? 'Yes' : 'No'],
                [
                  'Last sign-in',
                  user.lastLoginAt ? <DateTime value={user.lastLoginAt} format="full" /> : 'Never',
                ],
                ['Created', <DateTime key="c" value={user.createdAt} format="full" />],
                ['Updated', <DateTime key="u" value={user.updatedAt} format="full" />],
                ...(user.statusReason
                  ? ([['Status reason', user.statusReason]] as Array<[string, ReactNode]>)
                  : []),
              ]}
            />
          </Card>

          <Card
            icon={<FolderTree className="size-4 text-warning" aria-hidden="true" />}
            title="Groups"
            count={access ? access.groups.length : user.groups.length}
          >
            {(access?.groups ?? user.groups).length === 0 ? (
              <p className="text-sm text-muted-foreground">Not in any group.</p>
            ) : (
              <ul className="space-y-1.5">
                {access
                  ? access.groups.map((g) => (
                      <li
                        key={g.id}
                        className="flex items-center justify-between gap-2 rounded-md bg-muted/60 px-3 py-2 text-sm"
                      >
                        <Link
                          to={paths.admin.groupDetail(g.id)}
                          className="min-w-0 truncate font-medium text-foreground hover:text-primary hover:underline"
                        >
                          {g.groupName}
                        </Link>
                        <code className="shrink-0 font-mono text-xs text-muted-foreground">
                          {g.groupId}
                        </code>
                      </li>
                    ))
                  : user.groups.map((g) => (
                      <li
                        key={g.id}
                        className="rounded-md bg-muted/60 px-3 py-2 text-sm font-medium text-foreground"
                      >
                        {g.name}
                      </li>
                    ))}
              </ul>
            )}
          </Card>

          {access && (
            <Card
              icon={<Shield className="size-4 text-success" aria-hidden="true" />}
              title="Roles"
              count={access.roles.length}
            >
              {access.roles.length === 0 ? (
                <p className="text-sm text-muted-foreground">No roles through their groups.</p>
              ) : (
                <ul className="space-y-1.5">
                  {access.roles.map((r) => (
                    <li
                      key={r.id}
                      className="flex items-center justify-between gap-2 rounded-md bg-muted/60 px-3 py-2 text-sm"
                    >
                      <Link
                        to={paths.admin.roleDetail(r.id)}
                        className="min-w-0 truncate font-medium text-foreground hover:text-primary hover:underline"
                      >
                        {r.roleName}
                      </Link>
                      <code className="shrink-0 font-mono text-xs text-primary">{r.roleKey}</code>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </aside>
      </div>

      <EditUserDialog
        userId={isEditing ? user.id : null}
        open={isEditing}
        onOpenChange={setIsEditing}
        onSaved={reload}
      />
      <UserAccessDialog
        user={user}
        open={isAccessOpen}
        onOpenChange={setIsAccessOpen}
        onChanged={reload}
      />
    </PageContainer>
  );
}
