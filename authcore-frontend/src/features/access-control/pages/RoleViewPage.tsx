import { CalendarClock, FolderTree, KeyRound, Shield, SquarePen, Tag } from 'lucide-react';
import { useEffect, useState } from 'react';
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
import { permissionsApi } from '../api/permissions.api';
import { rolesApi } from '../api/roles.api';
import { RoleFormDialog } from '../components/RoleFormDialog';
import { RolePermissionPicker } from '../components/RolePermissionPicker';
import { RolePermissionsDialog } from '../components/RolePermissionsDialog';
import type { AccessMapping, Permission, Role } from '../types/access-control.types';

interface Loaded {
  key: string;
  role: Role;
  groups: AccessMapping[];
  permissions: Permission[];
  granted: Set<string>;
  categoryLabel: string;
}

/** Roles → eye icon: everything about one role on one page. */
export function RoleViewPage() {
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
    const [roleId] = key.split('#');
    const load = async () => {
      try {
        const [role, groups, permissions, granted, categories] = await Promise.all([
          rolesApi.get(roleId ?? '', controller.signal),
          accessMappingsApi.list(
            {
              page: 1,
              pageSize: 100,
              search: '',
              sort: [],
              filters: {},
              type: 'GROUP_ROLE',
              roleId,
            },
            controller.signal,
          ),
          permissionsApi.all(controller.signal),
          accessMappingsApi.rolePermissionIds(roleId ?? '', controller.signal),
          rolesApi.categories(controller.signal),
        ]);
        setData({
          key,
          role,
          groups: groups.items,
          permissions: permissions.filter((p) => p.status === 'ACTIVE' || granted.includes(p.id)),
          granted: new Set(granted),
          categoryLabel: categories.find((c) => c.value === role.category)?.label ?? role.category,
        });
      } catch (error) {
        if (!isAbortError(error)) setFailure({ key, error });
      }
    };
    void load();
    return () => controller.abort();
  }, [key]);

  const back = <Link to={paths.admin.roles}>All roles</Link>;
  const current = data?.key === key ? data : data?.key.startsWith(`${id}#`) ? data : null;

  if (!current) {
    return (
      <PageContainer>
        <PageHeader title="Role" back={back} />
        {failure?.key === key ? (
          <ErrorState
            error={failure.error}
            title="Could not load the role"
            onRetry={() => setAttempt((n) => n + 1)}
          />
        ) : (
          <LoadingState label="Loading the role" />
        )}
      </PageContainer>
    );
  }

  const { role } = current;
  const canEdit = hasPermission('ROLE_UPDATE') && !role.isSystem;

  return (
    <PageContainer>
      <PageHeader
        back={back}
        title={role.roleName}
        meta={
          <Badge tone="primary" variant="soft" className="font-mono">
            {role.roleKey}
          </Badge>
        }
        description={role.description || 'No description.'}
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
            <Button size="toolbar" leftIcon={<KeyRound />} onClick={() => setIsAssigning(true)}>
              {role.isSystem ? 'Permissions' : 'Assign permissions'}
            </Button>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          tone="success"
          icon={KeyRound}
          label="Permissions"
          value={current.granted.size}
          hint={`of ${current.permissions.length} available`}
        />
        <StatCard
          tone="warning"
          icon={FolderTree}
          label="Groups using it"
          value={current.groups.length}
          hint="Members get its permissions"
        />
        <StatCard
          tone="violet"
          icon={Tag}
          label="Category"
          value={current.categoryLabel}
          hint={role.isSystem ? 'Built-in role' : 'Custom role'}
        />
        <StatCard
          tone="info"
          icon={CalendarClock}
          label="Last updated"
          value={<DateTime value={role.updatedAt} format="relative" />}
          hint={<DateTime value={role.updatedAt} format="full" />}
        />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <section
          aria-label="Granted permissions"
          className="space-y-3 rounded-md border border-border bg-surface p-card"
        >
          <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <KeyRound className="size-4 text-success" aria-hidden="true" /> Granted permissions
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
          <section
            aria-label="Details"
            className="rounded-md border border-border bg-surface p-card"
          >
            <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-foreground">
              <Shield className="size-4 text-primary" aria-hidden="true" /> Details
            </h2>
            <dl className="space-y-2.5 text-sm">
              {[
                [
                  'Key',
                  <code key="k" className="font-mono text-primary">
                    {role.roleKey}
                  </code>,
                ],
                ['Category', current.categoryLabel],
                ['Type', role.isSystem ? 'Built-in (fixed)' : 'Custom'],
                ['Created', <DateTime key="c" value={role.createdAt} format="full" />],
                ['Updated', <DateTime key="u" value={role.updatedAt} format="full" />],
              ].map(([term, value]) => (
                <div key={String(term)} className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">{term}</dt>
                  <dd className="text-right font-medium text-foreground">{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section
            aria-label="Groups"
            className="rounded-md border border-border bg-surface p-card"
          >
            <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-foreground">
              <FolderTree className="size-4 text-warning" aria-hidden="true" /> Groups using it
            </h2>
            {current.groups.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No group has this role yet. Give it to a group under Groups → Assign.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {current.groups.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center justify-between gap-2 rounded-md bg-muted/60 px-3 py-2 text-sm"
                  >
                    <span className="truncate font-medium text-foreground">
                      {m.group?.groupName ?? 'Unknown group'}
                    </span>
                    {m.group?.groupId && (
                      <code className="shrink-0 font-mono text-xs text-muted-foreground">
                        {m.group.groupId}
                      </code>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>

      <RolePermissionsDialog
        role={isAssigning ? role : null}
        onClose={() => setIsAssigning(false)}
        onSaved={() => setAttempt((n) => n + 1)}
      />
      <RoleFormDialog
        open={isEditing}
        role={role}
        onOpenChange={setIsEditing}
        onSaved={() => setAttempt((n) => n + 1)}
      />
    </PageContainer>
  );
}
