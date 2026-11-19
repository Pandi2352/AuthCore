import { useEffect, useState } from 'react';

import { DateTime } from '@/components/common/DateTime';
import { ErrorState, LoadingState } from '@/components/feedback';
import { Badge, Sheet, SheetBody, SheetContent } from '@/components/ui';

import { accessMappingsApi } from '../api/access-mappings.api';
import { rolesApi } from '../api/roles.api';
import type { AccessMapping, Role } from '../types/access-control.types';

export function RoleDetailSheet({
  roleId,
  open,
  onOpenChange,
}: {
  roleId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [role, setRole] = useState<Role | null>(null);
  const [mappings, setMappings] = useState<AccessMapping[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<unknown | null>(null);

  useEffect(() => {
    if (!roleId || !open) return;
    const controller = new AbortController();

    const loadData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [r, perms] = await Promise.all([
          rolesApi.get(roleId, controller.signal),
          accessMappingsApi.list(
            {
              page: 1,
              pageSize: 100,
              search: '',
              filters: { roleId: [roleId] },
              sort: [],
            },
            controller.signal,
          ),
        ]);
        setRole(r);
        setMappings(perms.items);
      } catch (err) {
        setError(err);
      } finally {
        setIsLoading(false);
      }
    };

    void loadData();
    return () => controller.abort();
  }, [roleId, open]);

  const assignedPermissions = mappings.filter((m) => m.type === 'ROLE_PERMISSION');
  const assignedGroups = mappings.filter((m) => m.type === 'GROUP_ROLE');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        title={role?.roleName ?? 'Role details'}
        description={
          role
            ? `Key: ${role.roleKey} · Category: ${role.category}`
            : 'Inspect role configuration and assigned access.'
        }
        size="lg"
      >
        <SheetBody className="space-y-5">
          {isLoading ? (
            <LoadingState label="Loading role details" />
          ) : error ? (
            <ErrorState error={error} title="Could not load role" />
          ) : role ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge size="sm" tone={role.status === 'ACTIVE' ? 'success' : 'neutral'}>
                  {role.status}
                </Badge>
                {role.isSystem && (
                  <Badge size="sm" tone="info">
                    SYSTEM ROLE
                  </Badge>
                )}
                <Badge size="sm" tone="primary">
                  {role.category}
                </Badge>
              </div>

              {role.description && (
                <p className="text-sm text-muted-foreground">{role.description}</p>
              )}

              <dl className="grid grid-cols-2 gap-3 rounded-md bg-muted/60 p-3 text-xs sm:grid-cols-4">
                <div>
                  <dt className="text-muted-foreground">Permissions</dt>
                  <dd className="mt-1 font-semibold text-foreground">
                    {role.permissionCount ?? assignedPermissions.length}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Groups</dt>
                  <dd className="mt-1 font-semibold text-foreground">
                    {role.groupCount ?? assignedGroups.length}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Created</dt>
                  <dd className="mt-1 font-medium text-foreground">
                    <DateTime value={role.createdAt} format="date" />
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Updated</dt>
                  <dd className="mt-1 font-medium text-foreground">
                    <DateTime value={role.updatedAt} format="relative" />
                  </dd>
                </div>
              </dl>

              <section
                aria-label="Assigned permissions"
                className="space-y-3 rounded-md border border-border p-4"
              >
                <h3 className="text-sm font-semibold text-foreground">
                  Assigned permissions ({assignedPermissions.length})
                </h3>
                {assignedPermissions.length > 0 ? (
                  <div className="max-h-56 space-y-1.5 overflow-y-auto rounded-md border border-border p-2">
                    {assignedPermissions.map((m) => (
                      <div key={m.id} className="flex items-center justify-between py-1 text-xs">
                        <span className="font-medium text-foreground">
                          {m.permission?.permissionName ?? m.targetId}
                        </span>
                        <code className="text-2xs rounded-md bg-muted px-1.5 py-0.5 font-mono text-muted-foreground">
                          {m.permission?.permissionKey ?? m.targetId}
                        </code>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No permissions assigned directly to this role.
                  </p>
                )}
              </section>

              <section
                aria-label="Groups with this role"
                className="space-y-3 rounded-md border border-border p-4"
              >
                <h3 className="text-sm font-semibold text-foreground">
                  Groups with this role ({assignedGroups.length})
                </h3>
                {assignedGroups.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {assignedGroups.map((m) => (
                      <span
                        key={m.id}
                        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2 py-1 text-xs text-foreground"
                      >
                        <span className="font-medium">{m.group?.groupName ?? m.sourceId}</span>
                        {m.group?.groupId && (
                          <span className="text-2xs text-muted-foreground">
                            ({m.group.groupId})
                          </span>
                        )}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    This role is not yet assigned to any group.
                  </p>
                )}
              </section>
            </>
          ) : null}
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
