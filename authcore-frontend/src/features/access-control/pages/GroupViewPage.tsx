import {
  FolderTree,
  KeyRound,
  Shield,
  SquarePen,
  UserRoundPlus,
  Users,
  UsersRound,
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

import { accessMappingsApi } from '../api/access-mappings.api';
import { groupsApi } from '../api/groups.api';
import { permissionsApi } from '../api/permissions.api';
import { GroupAssignDialog } from '../components/GroupAssignDialog';
import { GroupFormDialog } from '../components/GroupFormDialog';
import { RolePermissionPicker } from '../components/RolePermissionPicker';
import type {
  AccessMapping,
  Group,
  Permission,
  PermissionMatrix,
} from '../types/access-control.types';

interface Loaded {
  key: string;
  group: Group;
  matrix: PermissionMatrix;
  permissions: Permission[];
  granted: Set<string>;
  members: AccessMapping[];
  children: Group[];
  categoryLabel: string;
}

const nameOf = (u: { firstName: string; lastName: string | null }) =>
  [u.firstName, u.lastName].filter(Boolean).join(' ');

/** A titled white card in the right column. */
function SideCard({
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

/** Groups → eye icon: everything about one group on one page. */
export function GroupViewPage() {
  const id = useRequiredParam('id');
  const { hasPermission } = usePermissions();
  const [attempt, setAttempt] = useState(0);
  const [data, setData] = useState<Loaded | null>(null);
  const [failure, setFailure] = useState<{ key: string; error: unknown } | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const key = `${id}#${attempt}`;

  useEffect(() => {
    const controller = new AbortController();
    const [groupId = ''] = key.split('#');
    const load = async () => {
      try {
        const [group, matrix, permissions, members, children, categories] = await Promise.all([
          groupsApi.get(groupId, controller.signal),
          groupsApi.permissionMatrix(groupId, undefined, controller.signal),
          permissionsApi.all(controller.signal),
          accessMappingsApi.groupMappings(groupId, 'GROUP_USER', controller.signal),
          groupsApi.children(groupId, undefined, controller.signal),
          groupsApi.categories(controller.signal),
        ]);
        const granted = new Set(matrix.permissions.map((p) => p.id));
        setData({
          key,
          group,
          matrix,
          permissions: permissions.filter((p) => p.status === 'ACTIVE' || granted.has(p.id)),
          granted,
          members,
          children,
          categoryLabel:
            categories.find((c) => c.value === group.category)?.label ?? group.category,
        });
      } catch (error) {
        if (!isAbortError(error)) setFailure({ key, error });
      }
    };
    void load();
    return () => controller.abort();
  }, [key]);

  const back = <Link to={paths.admin.groups}>All groups</Link>;
  // While reloading the same group, keep showing the previous data.
  const current = data?.key.startsWith(`${id}#`) ? data : null;

  if (!current) {
    return (
      <PageContainer>
        <PageHeader title="Group" back={back} />
        {failure?.key === key ? (
          <ErrorState
            error={failure.error}
            title="Could not load the group"
            onRetry={() => setAttempt((n) => n + 1)}
          />
        ) : (
          <LoadingState label="Loading the group" />
        )}
      </PageContainer>
    );
  }

  const { group, matrix } = current;
  const reload = () => setAttempt((n) => n + 1);
  const canEdit = hasPermission('GROUP_UPDATE');
  const canAssign =
    hasPermission('ACCESS_MAPPING_ASSIGN') || hasPermission('ACCESS_MAPPING_REVOKE');
  const parentPath = group.path?.length ? group.path.map((p) => p.groupName).join(' › ') : null;

  return (
    <PageContainer>
      <PageHeader
        back={back}
        title={group.groupName}
        meta={
          <Badge tone="primary" variant="soft" className="font-mono">
            {group.groupId}
          </Badge>
        }
        description={group.description || 'No description.'}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {canEdit && (
              <Button
                variant="outline"
                size="toolbar"
                leftIcon={<SquarePen />}
                onClick={() => setIsEditing(true)}
              >
                Edit
              </Button>
            )}
            {canAssign && (
              <Button
                size="toolbar"
                leftIcon={<UserRoundPlus />}
                onClick={() => setIsAssigning(true)}
              >
                Assign roles & members
              </Button>
            )}
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          tone="warning"
          pattern="waves"
          icon={Users}
          label="Members"
          value={current.members.length}
          hint="People in this group"
        />
        <StatCard
          tone="success"
          pattern="rings"
          icon={Shield}
          label="Roles"
          value={matrix.roles.length}
          hint={`${matrix.roles.filter((r) => r.isInherited).length} inherited from parents`}
        />
        <StatCard
          tone="cyan"
          pattern="dots"
          icon={KeyRound}
          label="Permissions"
          value={current.granted.size}
          hint="Through its roles"
        />
        <StatCard
          tone="violet"
          pattern="grid"
          icon={FolderTree}
          label="Sub-groups"
          value={current.children.length}
          hint={`Level ${group.level + 1}${group.level === 0 ? ' (top level)' : ''}`}
        />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <section
          aria-label="Permissions through its roles"
          className="space-y-3 rounded-md border border-border bg-surface p-card"
        >
          <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <KeyRound className="size-4 text-success" aria-hidden="true" /> Permissions through its
            roles
          </h2>
          <RolePermissionPicker
            permissions={current.permissions}
            selected={current.granted}
            onChange={() => {}}
            readOnly
            defaultSelectedOnly
          />
        </section>

        <aside className="space-y-6">
          <SideCard
            icon={<FolderTree className="size-4 text-primary" aria-hidden="true" />}
            title="Details"
          >
            <dl className="space-y-2.5 text-sm">
              {(
                [
                  [
                    'ID',
                    <code key="k" className="font-mono text-primary">
                      {group.groupId}
                    </code>,
                  ],
                  ['Category', current.categoryLabel],
                  ['Parent', parentPath ?? 'None (top level)'],
                  ['New users join', group.isDefault ? 'Yes (default group)' : 'No'],
                  [
                    'Created',
                    group.createdAt ? (
                      <DateTime key="c" value={group.createdAt} format="full" />
                    ) : (
                      '—'
                    ),
                  ],
                  ['Updated', <DateTime key="u" value={group.updatedAt} format="full" />],
                ] as Array<[string, ReactNode]>
              ).map(([term, value]) => (
                <div key={term} className="flex justify-between gap-3">
                  <dt className="shrink-0 text-muted-foreground">{term}</dt>
                  <dd className="text-right font-medium text-foreground">{value}</dd>
                </div>
              ))}
            </dl>
          </SideCard>

          <SideCard
            icon={<Shield className="size-4 text-success" aria-hidden="true" />}
            title="Roles"
            count={matrix.roles.length}
          >
            {matrix.roles.length === 0 ? (
              <p className="text-sm text-muted-foreground">No roles yet. Use Assign to add some.</p>
            ) : (
              <ul className="space-y-1.5">
                {matrix.roles.map((r) => (
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
                    {r.isInherited ? (
                      <Badge size="sm" tone="info">
                        Inherited
                      </Badge>
                    ) : (
                      <code className="shrink-0 font-mono text-xs text-primary">{r.roleKey}</code>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </SideCard>

          <SideCard
            icon={<UsersRound className="size-4 text-warning" aria-hidden="true" />}
            title="Members"
            count={current.members.length}
          >
            {current.members.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nobody yet. Use Assign to add people.</p>
            ) : (
              <ul className="max-h-72 space-y-1.5 overflow-y-auto">
                {current.members.map((m) => (
                  <li key={m.id} className="rounded-md bg-muted/60 px-3 py-2 text-sm">
                    <span className="block truncate font-medium text-foreground">
                      {m.user ? nameOf(m.user) : 'Unknown user'}
                    </span>
                    {m.user && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {m.user.email}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </SideCard>

          <SideCard
            icon={<FolderTree className="size-4 text-nav-violet" aria-hidden="true" />}
            title="Sub-groups"
            count={current.children.length}
          >
            {current.children.length === 0 ? (
              <p className="text-sm text-muted-foreground">No sub-groups.</p>
            ) : (
              <ul className="space-y-1.5">
                {current.children.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center justify-between gap-2 rounded-md bg-muted/60 px-3 py-2 text-sm"
                  >
                    <Link
                      to={paths.admin.groupDetail(c.id)}
                      className="min-w-0 truncate font-medium text-foreground hover:text-primary hover:underline"
                    >
                      {c.groupName}
                    </Link>
                    <code className="shrink-0 font-mono text-xs text-muted-foreground">
                      {c.groupId}
                    </code>
                  </li>
                ))}
              </ul>
            )}
          </SideCard>
        </aside>
      </div>

      <GroupAssignDialog
        group={isAssigning ? group : null}
        onClose={() => setIsAssigning(false)}
        onChanged={reload}
      />
      <GroupFormDialog
        open={isEditing}
        group={group}
        onOpenChange={setIsEditing}
        onSaved={reload}
      />
    </PageContainer>
  );
}
