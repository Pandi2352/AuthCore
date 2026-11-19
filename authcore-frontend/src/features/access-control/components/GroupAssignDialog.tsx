import {
  Save,
  Search,
  Shield,
  Undo2,
  UserMinus,
  UserPlus,
  UserRoundPlus,
  Users,
} from 'lucide-react';
import { useEffect, useState } from 'react';

import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { ErrorState, LoadingState, notifyError, notifySuccess } from '@/components/feedback';
import {
  Badge,
  Button,
  Checkbox,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  Input,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui';
import { usePermissions } from '@/features/auth';
import { apiClient, isAbortError } from '@/lib/api';
import { cn } from '@/lib/utils';

import { accessMappingsApi } from '../api/access-mappings.api';
import { rolesApi } from '../api/roles.api';
import type { AccessMapping, GroupRef } from '../types/access-control.types';

type Tab = 'roles' | 'members';

/** Both tabs: same fixed height, scrolling inside (the popup itself never grows). */
const PANEL = 'mt-4 h-[min(28rem,52dvh)] overflow-y-auto pr-1';

interface UserHit {
  id: string;
  email: string;
  firstName: string;
  lastName: string | null;
}

const nameOf = (u: { firstName: string; lastName: string | null }) =>
  [u.firstName, u.lastName].filter(Boolean).join(' ');

/**
 * Groups → Assign: a centered popup with two tabs: the roles the group gives (saved
 * together) and the people in it (added / removed right away).
 */
export function GroupAssignDialog({
  group,
  initialTab = 'roles',
  onClose,
  onChanged,
}: {
  /** null = closed. */
  group: Pick<GroupRef, 'id' | 'groupName' | 'groupId'> | null;
  initialTab?: Tab;
  onClose: () => void;
  onChanged?: () => void;
}) {
  // Mounted only while open, so each group loads fresh.
  return group ? (
    <AssignContent
      key={group.id}
      group={group}
      initialTab={initialTab}
      onClose={onClose}
      onChanged={onChanged}
    />
  ) : null;
}

function AssignContent({
  group,
  initialTab,
  onClose,
  onChanged,
}: {
  group: Pick<GroupRef, 'id' | 'groupName' | 'groupId'>;
  initialTab: Tab;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const { hasPermission } = usePermissions();
  const canAssign = hasPermission('ACCESS_MAPPING_ASSIGN');
  const canRevoke = hasPermission('ACCESS_MAPPING_REVOKE');
  const [tab, setTab] = useState<Tab>(initialTab);
  const [confirmClose, setConfirmClose] = useState(false);

  // ---- roles (saved together)
  const [roles, setRoles] = useState<Array<{ id: string; label: string; key: string }> | null>(
    null,
  );
  const [initialRoles, setInitialRoles] = useState<Set<string>>(new Set());
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set());
  const [roleFilter, setRoleFilter] = useState('');
  const [isSavingRoles, setIsSavingRoles] = useState(false);

  // ---- members (saved right away)
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

  // People search (debounced).
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

  const addedRoles = [...selectedRoles].filter((id) => !initialRoles.has(id));
  const removedRoles = [...initialRoles].filter((id) => !selectedRoles.has(id));
  const rolesDirty = addedRoles.length > 0 || removedRoles.length > 0;
  const canEditRoles = canAssign || canRevoke;

  const requestClose = () => (rolesDirty ? setConfirmClose(true) : onClose());

  const saveRoles = async () => {
    setIsSavingRoles(true);
    try {
      if (addedRoles.length > 0) {
        await accessMappingsApi.assignGroupRoles({ groupId: group.id, roleIds: addedRoles });
      }
      if (removedRoles.length > 0) {
        await accessMappingsApi.removeGroupRoles({ groupId: group.id, roleIds: removedRoles });
      }
      notifySuccess(`Roles for “${group.groupName}” saved`, {
        description:
          [
            addedRoles.length > 0 && `${addedRoles.length} added`,
            removedRoles.length > 0 && `${removedRoles.length} removed`,
          ]
            .filter(Boolean)
            .join(', ') + '. Members get the change on their next request.',
      });
      setInitialRoles(new Set(selectedRoles));
      onChanged?.();
    } catch (err) {
      notifyError(err, 'Could not save the roles');
    } finally {
      setIsSavingRoles(false);
    }
  };

  const reloadMembers = async () => {
    setMembers(await accessMappingsApi.groupMappings(group.id, 'GROUP_USER'));
  };
  const addMember = async (user: UserHit) => {
    setBusyUser(user.id);
    try {
      await accessMappingsApi.assignGroupUsers({ groupId: group.id, userIds: [user.id] });
      notifySuccess(`${nameOf(user)} added to “${group.groupName}”`);
      await reloadMembers();
      onChanged?.();
    } catch (err) {
      notifyError(err, 'Could not add the member');
    } finally {
      setBusyUser(null);
    }
  };
  const removeMember = async (m: AccessMapping) => {
    if (!m.user) return;
    const user = m.user;
    setBusyUser(user.id);
    try {
      await accessMappingsApi.removeGroupUsers({ groupId: group.id, userIds: [user.id] });
      notifySuccess(`${nameOf(user)} removed from “${group.groupName}”`);
      await reloadMembers();
      onChanged?.();
    } catch (err) {
      notifyError(err, 'Could not remove the member');
    } finally {
      setBusyUser(null);
    }
  };

  const filter = roleFilter.trim().toLowerCase();
  const shownRoles = (roles ?? []).filter(
    (r) =>
      !filter || r.label.toLowerCase().includes(filter) || r.key.toLowerCase().includes(filter),
  );
  const memberIds = new Set((members ?? []).flatMap((m) => (m.user ? [m.user.id] : [])));
  const results = hits && hits.query === query && query.length >= 2 ? hits.users : null;

  return (
    // Escape, backdrop and × all go through the unsaved-changes check.
    <Dialog open onOpenChange={(open) => !open && requestClose()}>
      <DialogContent
        size="xl"
        title={
          <span className="flex flex-wrap items-center gap-2">
            <UserRoundPlus className="size-5 text-warning" aria-hidden="true" />
            Assign · {group.groupName}
            <Badge tone="primary" variant="soft" size="sm" className="font-mono">
              {group.groupId}
            </Badge>
          </span>
        }
        description="Give the group roles and add people to it. Members get every permission of the group's roles."
      >
        <DialogBody>
          {!roles || !members ? (
            failure?.attempt === attempt ? (
              <ErrorState
                error={failure.error}
                title="Could not load the group"
                onRetry={() => setAttempt((n) => n + 1)}
              />
            ) : (
              <LoadingState label="Loading" />
            )
          ) : (
            <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
              <TabsList>
                <TabsTrigger value="roles">
                  <Shield className="size-4" aria-hidden="true" />
                  Roles
                  <Badge size="sm" tone="success" className="tabular-nums">
                    {selectedRoles.size}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="members">
                  <Users className="size-4" aria-hidden="true" />
                  Members
                  <Badge size="sm" tone="warning" className="tabular-nums">
                    {members.length}
                  </Badge>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="roles" className={cn(PANEL, 'space-y-3')}>
                <Input
                  size="sm"
                  value={roleFilter}
                  placeholder="Search roles by name or key"
                  aria-label="Search roles"
                  prefix={<Search className="size-3.5 text-muted-foreground" aria-hidden="true" />}
                  onChange={(e) => setRoleFilter(e.target.value)}
                />
                <ul className="grid gap-2 sm:grid-cols-2">
                  {shownRoles.map((r) => {
                    const isOn = selectedRoles.has(r.id);
                    return (
                      <li
                        key={r.id}
                        className={cn(
                          'flex items-center gap-3 rounded-md border px-3 py-2.5 transition-colors',
                          isOn
                            ? 'border-success/50 bg-success-soft/40'
                            : 'border-border bg-surface',
                        )}
                      >
                        <Checkbox
                          aria-label={r.label}
                          checked={isOn}
                          disabled={
                            !canEditRoles ||
                            (isOn ? initialRoles.has(r.id) && !canRevoke : !canAssign)
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
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-foreground">
                            {r.label}
                          </span>
                          <code className="block truncate font-mono text-xs text-primary">
                            {r.key}
                          </code>
                        </span>
                      </li>
                    );
                  })}
                </ul>
                {shownRoles.length === 0 && (
                  <p className="rounded-md border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
                    {roles.length === 0
                      ? 'No roles yet — create one under Roles.'
                      : 'No roles match.'}
                  </p>
                )}
              </TabsContent>

              <TabsContent value="members" className={cn(PANEL, 'space-y-4')}>
                {canAssign && (
                  <div className="space-y-2">
                    <Input
                      size="sm"
                      value={userQuery}
                      placeholder="Search people by name or email to add"
                      aria-label="Search people to add"
                      prefix={
                        <Search className="size-3.5 text-muted-foreground" aria-hidden="true" />
                      }
                      onChange={(e) => setUserQuery(e.target.value)}
                    />
                    {query.length >= 2 && (
                      <ul className="divide-y divide-border rounded-md border border-primary/30">
                        {results === null ? (
                          <li className="px-3 py-2.5 text-xs text-muted-foreground">Searching…</li>
                        ) : results.length === 0 ? (
                          <li className="px-3 py-2.5 text-xs text-muted-foreground">
                            Nobody matches “{query}”.
                          </li>
                        ) : (
                          results.map((u) => (
                            <li key={u.id} className="flex items-center gap-3 px-3 py-2">
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm text-foreground">
                                  {nameOf(u)}
                                </span>
                                <span className="block truncate text-xs text-muted-foreground">
                                  {u.email}
                                </span>
                              </span>
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
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-foreground">
                            {m.user ? nameOf(m.user) : 'Unknown user'}
                          </span>
                          {m.user && (
                            <span className="block truncate text-xs text-muted-foreground">
                              {m.user.email}
                            </span>
                          )}
                        </span>
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
          )}
        </DialogBody>
        <DialogFooter className="flex-wrap items-center">
          <p className="mr-auto text-xs text-muted-foreground" aria-live="polite">
            {tab === 'members'
              ? 'Member changes are saved right away'
              : rolesDirty
                ? `${addedRoles.length} to add · ${removedRoles.length} to remove`
                : 'No unsaved changes'}
          </p>
          {tab === 'roles' && rolesDirty ? (
            <Button
              variant="ghost"
              leftIcon={<Undo2 />}
              disabled={isSavingRoles}
              onClick={() => setSelectedRoles(new Set(initialRoles))}
            >
              Discard
            </Button>
          ) : (
            <Button variant="ghost" onClick={requestClose}>
              Close
            </Button>
          )}
          {tab === 'roles' && canEditRoles && (
            <Button
              leftIcon={<Save />}
              isLoading={isSavingRoles}
              disabled={!rolesDirty}
              onClick={() => void saveRoles()}
            >
              Save roles
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
      <ConfirmDialog
        open={confirmClose}
        onOpenChange={setConfirmClose}
        title="Close without saving?"
        description="The role changes for this group will be lost."
        confirmText="Close"
        cancelText="Keep editing"
        destructive
        onConfirm={onClose}
      />
    </Dialog>
  );
}
