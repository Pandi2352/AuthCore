import { Plus, Shield, ShieldCheck, Trash2, Users } from 'lucide-react';
import { useEffect, useState } from 'react';

import { ErrorState, LoadingState, notifyError, notifySuccess } from '@/components/feedback';
import { Badge, Button, IconButton, Select, Sheet, SheetBody, SheetContent } from '@/components/ui';

import { adminUsersApi } from '../api/admin-users.api';
import type { AdminUser } from '../types/admin-user.types';
import { fullName } from './user-labels';

export function UserAccessSheet({
  user,
  open,
  onOpenChange,
  onChanged,
}: {
  user: AdminUser | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}) {
  const [reloadKey, setReloadKey] = useState(0);

  if (!user) return null;
  const name = fullName(user);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        title={`Access & Roles · ${name}`}
        description="Inspect security authority, group memberships, and effective permissions."
        size="md"
      >
        {open ? (
          <UserAccessSheetContent
            key={`${user.id}:${reloadKey}`}
            user={user}
            onReload={() => setReloadKey((k) => k + 1)}
            onChanged={onChanged}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function UserAccessSheetContent({
  user,
  onReload,
  onChanged,
}: {
  user: AdminUser;
  onReload: () => void;
  onChanged: () => void;
}) {
  const [role, setRole] = useState<'ADMIN' | 'USER'>('USER');
  const [isChangingRole, setIsChangingRole] = useState(false);

  // Group mappings
  const [groupMappings, setGroupMappings] = useState<
    Array<{ id: string; groupId: string; groupName: string; isExpired: boolean }>
  >([]);
  const [availableGroups, setAvailableGroups] = useState<Array<{ value: string; label: string }>>(
    [],
  );
  const [selectedAddGroupId, setSelectedAddGroupId] = useState('');
  const [isAddingGroup, setIsAddingGroup] = useState(false);

  // Effective access
  const [effectiveData, setEffectiveData] = useState<{
    isAdmin: boolean;
    groups: Array<{ id: string; groupId: string; groupName: string }>;
    roles: Array<{ id: string; roleKey: string; roleName: string }>;
    permissions: string[];
  } | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<unknown | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    const run = async () => {
      try {
        const [mappingsPage, groupsList, access] = await Promise.all([
          adminUsersApi.userGroupMappings(user.id, controller.signal),
          adminUsersApi.groups(controller.signal),
          adminUsersApi.effectiveAccess(user.id, controller.signal),
        ]);

        if (cancelled) return;

        setGroupMappings(
          mappingsPage.items.map((m) => ({
            id: m.id,
            groupId: m.group?.id ?? '',
            groupName: m.group?.groupName ?? 'Unknown Group',
            isExpired: m.isExpired,
          })),
        );
        setAvailableGroups(
          groupsList.map((g) => ({
            value: g.id,
            label: g.label,
          })),
        );
        setEffectiveData(access);
        setRole(access.isAdmin ? 'ADMIN' : 'USER');
      } catch (err) {
        if (!cancelled && !controller.signal.aborted) {
          setError(err);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [user.id]);

  const handleRoleChange = async (newRole: 'ADMIN' | 'USER') => {
    if (newRole === role) return;
    setIsChangingRole(true);
    try {
      await adminUsersApi.setRole(user.id, newRole);
      setRole(newRole);
      notifySuccess(`User authority updated to ${newRole}`);
      onReload();
      onChanged();
    } catch (err) {
      notifyError(err, 'Failed to change user authority');
    } finally {
      setIsChangingRole(false);
    }
  };

  const handleAddGroup = async () => {
    if (!selectedAddGroupId) return;
    setIsAddingGroup(true);
    try {
      await adminUsersApi.assignUserToGroup(user.id, selectedAddGroupId);
      notifySuccess('User assigned to group');
      setSelectedAddGroupId('');
      onReload();
      onChanged();
    } catch (err) {
      notifyError(err, 'Failed to assign user to group');
    } finally {
      setIsAddingGroup(false);
    }
  };

  const handleRemoveGroup = async (mappingId: string) => {
    try {
      await adminUsersApi.removeGroupMapping(mappingId);
      notifySuccess('Group membership removed');
      onReload();
      onChanged();
    } catch (err) {
      notifyError(err, 'Failed to remove group membership');
    }
  };

  return (
    <SheetBody className="space-y-6">
      {isLoading ? (
        <LoadingState label="Loading security profile..." />
      ) : error ? (
        <ErrorState error={error} title="Failed to load access info" onRetry={onReload} />
      ) : (
        <>
          {/* Identity & Core Authority */}
          <section className="space-y-3 rounded-md border border-border bg-surface p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="size-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Core Authority</h3>
              </div>
              <Badge size="sm" tone={role === 'ADMIN' ? 'primary' : 'neutral'}>
                {role}
              </Badge>
            </div>

            <Select
              label="Administrative Authority"
              value={role}
              disabled={isChangingRole}
              options={[
                { value: 'USER', label: 'Standard User (Scoped by group permissions)' },
                { value: 'ADMIN', label: 'Super Administrator (Full unrestricted access)' },
              ]}
              onValueChange={(val) => val && void handleRoleChange(val as 'ADMIN' | 'USER')}
            />
            <p className="text-2xs text-muted-foreground">
              Super administrators automatically bypass all granular permission checks across every
              system API.
            </p>
          </section>

          {/* Group Memberships */}
          <section className="space-y-3 rounded-md border border-border bg-surface p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="size-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">
                  Group Memberships ({groupMappings.length})
                </h3>
              </div>
            </div>

            {groupMappings.length === 0 ? (
              <p className="py-2 text-xs text-muted-foreground">
                This user does not belong to any permission groups yet.
              </p>
            ) : (
              <div className="space-y-2">
                {groupMappings.map((gm) => (
                  <div
                    key={gm.id}
                    className="flex items-center justify-between rounded-md border border-border/70 bg-muted/20 px-3 py-2 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{gm.groupName}</span>
                      {gm.isExpired && (
                        <Badge size="sm" tone="danger">
                          Expired
                        </Badge>
                      )}
                    </div>
                    <IconButton
                      aria-label={`Remove from ${gm.groupName}`}
                      icon={<Trash2 />}
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10 size-6!"
                      onClick={() => void handleRemoveGroup(gm.id)}
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              <div className="flex-1">
                <Select
                  placeholder="Add to group..."
                  value={selectedAddGroupId}
                  options={availableGroups.filter(
                    (g) => !groupMappings.some((m) => m.groupId === g.value),
                  )}
                  onValueChange={(val) => setSelectedAddGroupId(val ?? '')}
                />
              </div>
              <Button
                size="sm"
                variant="outline"
                leftIcon={<Plus />}
                disabled={!selectedAddGroupId || isAddingGroup}
                isLoading={isAddingGroup}
                onClick={() => void handleAddGroup()}
              >
                Add
              </Button>
            </div>
          </section>

          {/* Effective Resolution */}
          <section className="space-y-3 rounded-md border border-border bg-surface p-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-success" />
              <h3 className="text-sm font-semibold text-foreground">
                Effective Permissions Resolution
              </h3>
            </div>

            {effectiveData?.isAdmin ? (
              <div className="rounded-md bg-primary/10 p-3 text-xs font-medium text-primary">
                User is a Super Administrator. Granted wildcard access (*) to all platform
                resources.
              </div>
            ) : (
              <div className="space-y-2">
                <div>
                  <p className="pb-1 text-xs font-medium text-foreground">
                    Inherited Roles ({effectiveData?.roles.length ?? 0}):
                  </p>
                  {effectiveData?.roles.length === 0 ? (
                    <p className="text-2xs text-muted-foreground">No roles assigned via groups.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {effectiveData?.roles.map((r) => (
                        <Badge key={r.id} size="sm" tone="primary">
                          {r.roleName}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-2">
                  <p className="pb-1 text-xs font-medium text-foreground">
                    Active Permission Keys ({effectiveData?.permissions.length ?? 0}):
                  </p>
                  {effectiveData?.permissions.length === 0 ? (
                    <p className="text-2xs text-muted-foreground">No permissions granted.</p>
                  ) : (
                    <div className="flex max-h-40 flex-wrap gap-1 overflow-y-auto rounded-md border border-border/50 p-2">
                      {effectiveData?.permissions.map((p) => (
                        <code
                          key={p}
                          className="text-2xs rounded-md bg-muted/40 px-1 py-0.5 text-foreground"
                        >
                          {p}
                        </code>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        </>
      )}
    </SheetBody>
  );
}
