import { Search, Shield, UserMinus, UserPlus, Users } from 'lucide-react';
import { useEffect, useState } from 'react';

import { ErrorState, LoadingState, notifyError, notifySuccess } from '@/components/feedback';
import {
  Badge,
  Button,
  Checkbox,
  Input,
  Sheet,
  SheetBody,
  SheetContent,
  SheetFooter,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui';
import { usePermissions } from '@/features/auth';
import { apiClient, isAbortError } from '@/lib/api';

import { accessMappingsApi } from '../api/access-mappings.api';
import { rolesApi } from '../api/roles.api';
import type { AccessMapping, Group } from '../types/access-control.types';

type GroupRef = Pick<Group, 'id' | 'groupName'>;

type Tab = 'roles' | 'members';

interface UserHit {
  id: string;
  email: string;
  firstName: string;
  lastName: string | null;
}

const nameOf = (u: { firstName: string; lastName: string | null }) =>
  [u.firstName, u.lastName].filter(Boolean).join(' ');

/** Groups → "Assign": the roles a group has and the people in it. */
export function GroupAssignSheet({
  group,
  open,
  initialTab = 'roles',
  onOpenChange,
  onChanged,
}: {
  group: GroupRef | null;
  open: boolean;
  initialTab?: Tab;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        title={group ? `Assign to ${group.groupName}` : 'Assign'}
        description="Members get every permission of the group's roles."
        size="lg"
      >
        {open && group && (
          <AssignBody
            key={group.id}
            group={group}
            initialTab={initialTab}
            onClose={() => onOpenChange(false)}
            onChanged={onChanged}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function AssignBody({
  group,
  initialTab,
  onClose,
  onChanged,
}: {
  group: GroupRef;
  initialTab: Tab;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { hasPermission } = usePermissions();
  const canAssign = hasPermission('ACCESS_MAPPING_ASSIGN');
  const canRevoke = hasPermission('ACCESS_MAPPING_REVOKE');
  const [tab, setTab] = useState<Tab>(initialTab);

  // ---- roles
  const [roles, setRoles] = useState<Array<{ id: string; label: string; key: string }> | null>(
    null,
  );
  const [initialRoles, setInitialRoles] = useState<Set<string>>(new Set());
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set());
  const [roleFilter, setRoleFilter] = useState('');
  const [isSavingRoles, setIsSavingRoles] = useState(false);

  // ---- members
  const [members, setMembers] = useState<AccessMapping[] | null>(null);
  const [failure, setFailure] = useState<{ attempt: number; error: unknown } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [userQuery, setUserQuery] = useState('');
  const [hits, setHits] = useState<{ query: string; users: UserHit[] } | null>(null);
  const [busyUser, setBusyUser] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const [allRoles, groupRoles, groupUsers] = await Promise.all([
          rolesApi.dropdown(undefined, controller.signal),
          accessMappingsApi.groupMappings(group.id, 'GROUP_ROLE', controller.signal),
          accessMappingsApi.groupMappings(group.id, 'GROUP_USER', controller.signal),
        ]);
        const current = new Set(groupRoles.flatMap((m) => (m.role ? [m.role.id] : [])));
        setRoles(allRoles);
        setInitialRoles(current);
        setSelectedRoles(new Set(current));
        setMembers(groupUsers);
      } catch (error) {
        if (!isAbortError(error)) setFailure({ attempt, error });
      }
    };
    void load();
    return () => controller.abort();
  }, [group.id, attempt]);

  // User search (debounced).
  const query = userQuery.trim();
  useEffect(() => {
    if (query.length < 2) return;
    const controller = new AbortController();
    const run = async () => {
      try {
        const page = await apiClient.getPage<UserHit>('/admin/users', {
          signal: controller.signal,
          query: { search: query, limit: 8, page: 1 },
        });
        setHits({ query, users: page.items });
      } catch (error) {
        if (!isAbortError(error)) setHits({ query, users: [] });
      }
    };
    const timer = window.setTimeout(() => void run(), 300);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const reloadMembers = async () => {
    setMembers(await accessMappingsApi.groupMappings(group.id, 'GROUP_USER'));
  };

  const addMember = async (user: UserHit) => {
    setBusyUser(user.id);
    try {
      await accessMappingsApi.assignGroupUsers({ groupId: group.id, userIds: [user.id] });
      notifySuccess(`${nameOf(user)} added to ${group.groupName}`);
      await reloadMembers();
      onChanged();
    } catch (err) {
      notifyError(err, 'Could not add the member');
    } finally {
      setBusyUser(null);
    }
  };

  const removeMember = async (m: AccessMapping) => {
    if (!m.user) return;
    const id = m.user.id;
    setBusyUser(id);
    try {
      await accessMappingsApi.removeGroupUsers({ groupId: group.id, userIds: [id] });
      notifySuccess(`${m.user ? nameOf(m.user) : 'Member'} removed from ${group.groupName}`);
      await reloadMembers();
      onChanged();
    } catch (err) {
      notifyError(err, 'Could not remove the member');
    } finally {
      setBusyUser(null);
    }
  };

  const addedRoles = [...selectedRoles].filter((id) => !initialRoles.has(id));
  const removedRoles = [...initialRoles].filter((id) => !selectedRoles.has(id));
  const rolesDirty = addedRoles.length > 0 || removedRoles.length > 0;

  const saveRoles = async () => {
    setIsSavingRoles(true);
    try {
      if (addedRoles.length > 0) {
        await accessMappingsApi.assignGroupRoles({ groupId: group.id, roleIds: addedRoles });
      }
      if (removedRoles.length > 0) {
        await accessMappingsApi.removeGroupRoles({ groupId: group.id, roleIds: removedRoles });
      }
      notifySuccess(`Roles for ${group.groupName} saved`, {
        description: [
          addedRoles.length > 0 && `${addedRoles.length} added`,
          removedRoles.length > 0 && `${removedRoles.length} removed`,
        ]
          .filter(Boolean)
          .join(', '),
      });
      setInitialRoles(new Set(selectedRoles));
      onChanged();
    } catch (err) {
      notifyError(err, 'Could not save the roles');
    } finally {
      setIsSavingRoles(false);
    }
  };

  if (!roles || !members) {
    return (
      <SheetBody>
        {failure?.attempt === attempt ? (
          <ErrorState
            error={failure.error}
            title="Could not load the group"
            onRetry={() => setAttempt((n) => n + 1)}
          />
        ) : (
          <LoadingState label="Loading" />
        )}
      </SheetBody>
    );
  }

  const memberIds = new Set(members.flatMap((m) => (m.user ? [m.user.id] : [])));
  const shownRoles = roles.filter(
    (r) =>
      r.label.toLowerCase().includes(roleFilter.toLowerCase()) ||
      r.key.toLowerCase().includes(roleFilter.toLowerCase()),
  );
  const results = hits && hits.query === query && query.length >= 2 ? hits.users : null;

  return (
    <>
      <SheetBody>
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList className="mb-4">
            <TabsTrigger value="roles" className="gap-2">
              <Shield className="size-4" aria-hidden="true" /> Roles
              <Badge size="sm" tone="neutral">
                {selectedRoles.size}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="members" className="gap-2">
              <Users className="size-4" aria-hidden="true" /> Members
              <Badge size="sm" tone="neutral">
                {members.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="roles" className="space-y-3">
            <Input
              size="sm"
              value={roleFilter}
              placeholder="Search roles"
              aria-label="Search roles"
              prefix={<Search className="size-3.5 text-muted-foreground" aria-hidden="true" />}
              onChange={(e) => setRoleFilter(e.target.value)}
            />
            <ul className="divide-y divide-border rounded-md border border-border">
              {shownRoles.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <Checkbox
                    label={r.label}
                    checked={selectedRoles.has(r.id)}
                    disabled={
                      selectedRoles.has(r.id) ? initialRoles.has(r.id) && !canRevoke : !canAssign
                    }
                    onCheckedChange={(checked) =>
                      setSelectedRoles((current) => {
                        const next = new Set(current);
                        if (checked) next.add(r.id);
                        else next.delete(r.id);
                        return next;
                      })
                    }
                  />
                  <code className="shrink-0 font-mono text-[11px] text-muted-foreground">
                    {r.key}
                  </code>
                </li>
              ))}
              {shownRoles.length === 0 && (
                <li className="py-6 text-center text-xs text-muted-foreground">
                  {roles.length === 0
                    ? 'No roles yet — create one under Roles.'
                    : 'No roles match.'}
                </li>
              )}
            </ul>
          </TabsContent>

          <TabsContent value="members" className="space-y-4">
            {canAssign && (
              <div className="space-y-2">
                <Input
                  size="sm"
                  value={userQuery}
                  placeholder="Search people by name or email to add"
                  aria-label="Search people to add"
                  prefix={<Search className="size-3.5 text-muted-foreground" aria-hidden="true" />}
                  onChange={(e) => setUserQuery(e.target.value)}
                />
                {query.length >= 2 && (
                  <ul className="divide-y divide-border rounded-md border border-border">
                    {results === null ? (
                      <li className="px-3 py-2.5 text-xs text-muted-foreground">Searching…</li>
                    ) : results.length === 0 ? (
                      <li className="px-3 py-2.5 text-xs text-muted-foreground">
                        Nobody matches “{query}”.
                      </li>
                    ) : (
                      results.map((u) => (
                        <li key={u.id} className="flex items-center gap-3 px-3 py-2">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm text-foreground">{nameOf(u)}</p>
                            <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                          </div>
                          {memberIds.has(u.id) ? (
                            <Badge size="sm" tone="success">
                              Member
                            </Badge>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              leftIcon={<UserPlus />}
                              isLoading={busyUser === u.id}
                              onClick={() => void addMember(u)}
                            >
                              Add
                            </Button>
                          )}
                        </li>
                      ))
                    )}
                  </ul>
                )}
              </div>
            )}

            <div>
              <h3 className="mb-2 text-sm font-semibold text-foreground">
                In this group{' '}
                <span className="font-normal text-muted-foreground">({members.length})</span>
              </h3>
              <ul className="divide-y divide-border rounded-md border border-border">
                {members.map((m) => (
                  <li key={m.id} className="flex items-center gap-3 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-foreground">
                        {m.user ? nameOf(m.user) : 'Unknown user'}
                      </p>
                      {m.user && (
                        <p className="truncate text-xs text-muted-foreground">{m.user.email}</p>
                      )}
                    </div>
                    {canRevoke && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        leftIcon={<UserMinus />}
                        className="text-danger hover:text-danger"
                        isLoading={busyUser === m.user?.id}
                        onClick={() => void removeMember(m)}
                      >
                        Remove
                      </Button>
                    )}
                  </li>
                ))}
                {members.length === 0 && (
                  <li className="py-6 text-center text-xs text-muted-foreground">
                    Nobody yet{canAssign ? ' — search above to add people.' : '.'}
                  </li>
                )}
              </ul>
            </div>
          </TabsContent>
        </Tabs>
      </SheetBody>
      <SheetFooter>
        <p className="mr-auto text-xs text-muted-foreground" aria-live="polite">
          {tab === 'roles' && rolesDirty
            ? `${addedRoles.length} to add · ${removedRoles.length} to remove`
            : tab === 'members'
              ? 'Member changes are saved right away'
              : ''}
        </p>
        <Button type="button" variant="ghost" onClick={onClose}>
          Close
        </Button>
        {tab === 'roles' && (canAssign || canRevoke) && (
          <Button
            type="button"
            isLoading={isSavingRoles}
            disabled={!rolesDirty}
            onClick={() => void saveRoles()}
          >
            Save roles
          </Button>
        )}
      </SheetFooter>
    </>
  );
}
