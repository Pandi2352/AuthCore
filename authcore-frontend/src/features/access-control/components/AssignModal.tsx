import { useEffect, useState, type FormEvent } from 'react';

import { notifyError, notifySuccess } from '@/components/feedback';
import {
  Button,
  Checkbox,
  Input,
  Select,
  Sheet,
  SheetBody,
  SheetContent,
  SheetFooter,
} from '@/components/ui';
import { apiClient } from '@/lib/api';

import { accessMappingsApi } from '../api/access-mappings.api';
import { groupsApi } from '../api/groups.api';
import { permissionsApi } from '../api/permissions.api';
import { rolesApi } from '../api/roles.api';
import type { MappingType } from '../types/access-control.types';

export function AssignModal({
  open,
  defaultType = 'GROUP_USER',
  defaultGroupId,
  defaultRoleId,
  onOpenChange,
  onAssigned,
}: {
  open: boolean;
  defaultType?: MappingType;
  defaultGroupId?: string;
  defaultRoleId?: string;
  onOpenChange: (open: boolean) => void;
  onAssigned: () => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        title="Create Access Assignment"
        description="Grant memberships, assign roles to groups, or bind permissions to roles."
        size="md"
      >
        {open ? (
          <AssignForm
            key={`${defaultType}:${defaultGroupId ?? ''}:${defaultRoleId ?? ''}`}
            defaultType={defaultType}
            defaultGroupId={defaultGroupId}
            defaultRoleId={defaultRoleId}
            onClose={() => onOpenChange(false)}
            onAssigned={onAssigned}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function AssignForm({
  defaultType,
  defaultGroupId,
  defaultRoleId,
  onClose,
  onAssigned,
}: {
  defaultType: MappingType;
  defaultGroupId?: string;
  defaultRoleId?: string;
  onClose: () => void;
  onAssigned: () => void;
}) {
  const [mappingType, setMappingType] = useState<MappingType>(defaultType);

  // Target selectors
  const [selectedGroupId, setSelectedGroupId] = useState<string>(defaultGroupId ?? '');
  const [selectedRoleId, setSelectedRoleId] = useState<string>(defaultRoleId ?? '');

  // Dropdown options
  const [groupOptions, setGroupOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [roleOptions, setRoleOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [permissionOptions, setPermissionOptions] = useState<
    Array<{ value: string; label: string; action?: string }>
  >([]);

  // Entities to assign
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<string[]>([]);

  // User search
  const [userSearch, setUserSearch] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<
    Array<{ id: string; email: string; name: string }>
  >([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);

  // Search filters for lists
  const [filterQuery, setFilterQuery] = useState('');

  // Expiration
  const [expiresAt, setExpiresAt] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    void groupsApi
      .dropdown(undefined, controller.signal)
      .then((items) => setGroupOptions(items.map((g) => ({ value: g.id, label: g.label }))))
      .catch(() => {});

    void rolesApi
      .dropdown(undefined, controller.signal)
      .then((items) => setRoleOptions(items.map((r) => ({ value: r.id, label: r.label }))))
      .catch(() => {});

    void permissionsApi
      .dropdown(undefined, controller.signal)
      .then((items) => setPermissionOptions(items.map((p) => ({ value: p.id, label: p.label }))))
      .catch(() => {});

    return () => controller.abort();
  }, []);

  // Search users when typing in user search
  useEffect(() => {
    if (mappingType !== 'GROUP_USER') return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setIsSearchingUsers(true);
      try {
        const page = await apiClient.getPage<{
          id: string;
          email: string;
          firstName: string;
          lastName: string | null;
        }>('/admin/users', {
          signal: controller.signal,
          query: {
            page: 1,
            limit: 15,
            search: userSearch.trim() || undefined,
          },
        });
        setUserSearchResults(
          page.items.map((u) => ({
            id: u.id,
            email: u.email,
            name: `${u.firstName} ${u.lastName ?? ''}`.trim(),
          })),
        );
      } catch {
        // search failure handled silently
      } finally {
        setIsSearchingUsers(false);
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [mappingType, userSearch]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const expDate = expiresAt ? new Date(expiresAt).toISOString() : undefined;

      if (mappingType === 'GROUP_USER') {
        if (!selectedGroupId) {
          notifyError(new Error('Please select a target group'));
          setIsSubmitting(false);
          return;
        }
        if (selectedUserIds.length === 0) {
          notifyError(new Error('Please select at least one user'));
          setIsSubmitting(false);
          return;
        }
        const res = await accessMappingsApi.assignGroupUsers({
          groupId: selectedGroupId,
          userIds: selectedUserIds,
          expiresAt: expDate,
        });
        notifySuccess(
          `Assigned ${res.assignedCount} user${res.assignedCount === 1 ? '' : 's'} to group`,
        );
      } else if (mappingType === 'GROUP_ROLE') {
        if (!selectedGroupId) {
          notifyError(new Error('Please select a target group'));
          setIsSubmitting(false);
          return;
        }
        if (selectedRoleIds.length === 0) {
          notifyError(new Error('Please select at least one role'));
          setIsSubmitting(false);
          return;
        }
        const res = await accessMappingsApi.assignGroupRoles({
          groupId: selectedGroupId,
          roleIds: selectedRoleIds,
          expiresAt: expDate,
        });
        notifySuccess(
          `Assigned ${res.assignedCount} role${res.assignedCount === 1 ? '' : 's'} to group`,
        );
      } else if (mappingType === 'ROLE_PERMISSION') {
        if (!selectedRoleId) {
          notifyError(new Error('Please select a target role'));
          setIsSubmitting(false);
          return;
        }
        if (selectedPermissionIds.length === 0) {
          notifyError(new Error('Please select at least one permission'));
          setIsSubmitting(false);
          return;
        }
        const res = await accessMappingsApi.assignRolePermissions({
          roleId: selectedRoleId,
          permissionIds: selectedPermissionIds,
          expiresAt: expDate,
        });
        notifySuccess(
          `Assigned ${res.assignedCount} permission${res.assignedCount === 1 ? '' : 's'} to role`,
        );
      }

      onAssigned();
      onClose();
    } catch (err) {
      notifyError(err, 'Failed to save assignment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredRoles = roleOptions.filter((r) =>
    r.label.toLowerCase().includes(filterQuery.toLowerCase()),
  );

  const filteredPermissions = permissionOptions.filter((p) =>
    p.label.toLowerCase().includes(filterQuery.toLowerCase()),
  );

  return (
    <form onSubmit={handleSubmit} className="flex h-full flex-col">
      <SheetBody className="space-y-6">
        <Select
          label="Assignment Type"
          required
          value={mappingType}
          options={[
            { value: 'GROUP_USER', label: 'User to Group (Membership)' },
            { value: 'GROUP_ROLE', label: 'Role to Group (Group Authority)' },
            { value: 'ROLE_PERMISSION', label: 'Permission to Role (Role Scope)' },
          ]}
          onValueChange={(val) => val && setMappingType(val as MappingType)}
        />

        {/* Target Selection */}
        {mappingType === 'GROUP_USER' && (
          <Select
            label="Target Group"
            required
            placeholder="Choose a group..."
            value={selectedGroupId}
            options={groupOptions}
            onValueChange={(val) => val && setSelectedGroupId(val)}
          />
        )}

        {mappingType === 'GROUP_ROLE' && (
          <Select
            label="Target Group"
            required
            placeholder="Choose a group..."
            value={selectedGroupId}
            options={groupOptions}
            onValueChange={(val) => val && setSelectedGroupId(val)}
          />
        )}

        {mappingType === 'ROLE_PERMISSION' && (
          <Select
            label="Target Role"
            required
            placeholder="Choose a role..."
            value={selectedRoleId}
            options={roleOptions}
            onValueChange={(val) => val && setSelectedRoleId(val)}
          />
        )}

        {/* Entity Selectors */}
        {mappingType === 'GROUP_USER' && (
          <section className="space-y-3 rounded-md border border-border p-4">
            <h3 className="text-sm font-semibold text-foreground">
              Select Users ({selectedUserIds.length} selected)
            </h3>
            <Input
              size="sm"
              value={userSearch}
              placeholder="Search user by name or email..."
              onChange={(e) => setUserSearch(e.target.value)}
            />

            <div className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
              {isSearchingUsers ? (
                <p className="py-2 text-center text-xs text-muted-foreground">Searching users...</p>
              ) : userSearchResults.length === 0 ? (
                <p className="py-2 text-center text-xs text-muted-foreground">
                  {userSearch ? 'No matching users found' : 'Type to search users'}
                </p>
              ) : (
                userSearchResults.map((u) => {
                  const checked = selectedUserIds.includes(u.id);
                  return (
                    <label
                      key={u.id}
                      htmlFor={`assign-user-${u.id}`}
                      className="flex cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-xs hover:bg-muted/40"
                    >
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">{u.name || u.email}</span>
                        <span className="text-2xs text-muted-foreground">{u.email}</span>
                      </div>
                      <Checkbox
                        id={`assign-user-${u.id}`}
                        checked={checked}
                        onCheckedChange={(c) => {
                          setSelectedUserIds((prev) =>
                            c ? [...prev, u.id] : prev.filter((id) => id !== u.id),
                          );
                        }}
                      />
                    </label>
                  );
                })
              )}
            </div>
          </section>
        )}

        {mappingType === 'GROUP_ROLE' && (
          <section className="space-y-3 rounded-md border border-border p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">
                Assign Roles ({selectedRoleIds.length})
              </h3>
            </div>
            <Input
              size="sm"
              value={filterQuery}
              placeholder="Filter roles..."
              onChange={(e) => setFilterQuery(e.target.value)}
            />
            <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
              {filteredRoles.map((role) => {
                const checked = selectedRoleIds.includes(role.value);
                return (
                  <label
                    key={role.value}
                    htmlFor={`assign-role-${role.value}`}
                    className="flex cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-xs hover:bg-muted/40"
                  >
                    <span className="font-medium text-foreground">{role.label}</span>
                    <Checkbox
                      id={`assign-role-${role.value}`}
                      checked={checked}
                      onCheckedChange={(c) => {
                        setSelectedRoleIds((prev) =>
                          c ? [...prev, role.value] : prev.filter((id) => id !== role.value),
                        );
                      }}
                    />
                  </label>
                );
              })}
            </div>
          </section>
        )}

        {mappingType === 'ROLE_PERMISSION' && (
          <section className="space-y-3 rounded-md border border-border p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">
                Grant Permissions ({selectedPermissionIds.length})
              </h3>
            </div>
            <Input
              size="sm"
              value={filterQuery}
              placeholder="Filter permissions..."
              onChange={(e) => setFilterQuery(e.target.value)}
            />
            <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
              {filteredPermissions.map((perm) => {
                const checked = selectedPermissionIds.includes(perm.value);
                return (
                  <label
                    key={perm.value}
                    htmlFor={`assign-perm-${perm.value}`}
                    className="flex cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-xs hover:bg-muted/40"
                  >
                    <span className="font-medium text-foreground">{perm.label}</span>
                    <Checkbox
                      id={`assign-perm-${perm.value}`}
                      checked={checked}
                      onCheckedChange={(c) => {
                        setSelectedPermissionIds((prev) =>
                          c ? [...prev, perm.value] : prev.filter((id) => id !== perm.value),
                        );
                      }}
                    />
                  </label>
                );
              })}
            </div>
          </section>
        )}

        {/* Optional Expiration */}
        <div className="space-y-1">
          <label htmlFor="assign-expires-at" className="text-xs font-medium text-foreground">
            Expires at (Optional)
          </label>
          <Input
            id="assign-expires-at"
            type="datetime-local"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
          />
          <p className="text-2xs text-muted-foreground">
            Leave empty for a permanent assignment. Set a date/time for temporary access.
          </p>
        </div>
      </SheetBody>

      <SheetFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" isLoading={isSubmitting}>
          Create assignment
        </Button>
      </SheetFooter>
    </form>
  );
}
