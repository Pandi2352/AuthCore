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
  Switch,
  Textarea,
} from '@/components/ui';
import { getFieldErrors } from '@/lib/api';

import { groupsApi } from '../api/groups.api';
import { permissionsApi } from '../api/permissions.api';
import { rolesApi } from '../api/roles.api';
import type { Role, RoleSetupInput } from '../types/access-control.types';

export function RoleEditorSheet({
  open,
  role,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  role: Role | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        title={role ? `Edit ${role.roleName}` : 'Create new role'}
        description={
          role
            ? `Update properties for role ${role.roleKey}.`
            : 'Define a custom role with permissions and assign it to groups.'
        }
        size="lg"
      >
        {open && (
          <RoleEditorForm
            key={role?.id ?? 'new'}
            role={role}
            onClose={() => onOpenChange(false)}
            onSaved={onSaved}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function RoleEditorForm({
  role,
  onClose,
  onSaved,
}: {
  role: Role | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEditing = !!role;
  const [roleKey, setRoleKey] = useState(() => role?.roleKey ?? '');
  const [roleName, setRoleName] = useState(() => role?.roleName ?? '');
  const [category, setCategory] = useState(() => role?.category ?? 'CUSTOM');
  const [description, setDescription] = useState(() => role?.description ?? '');
  const [isActive, setIsActive] = useState(() => (role ? role.status === 'ACTIVE' : true));
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);

  const [categories, setCategories] = useState<Array<{ value: string; label: string }>>([]);
  const [allPermissions, setAllPermissions] = useState<
    Array<{ id: string; label: string; key: string }>
  >([]);
  const [allGroups, setAllGroups] = useState<Array<{ id: string; label: string; key: string }>>([]);

  const [filterPerm, setFilterPerm] = useState('');
  const [filterGroup, setFilterGroup] = useState('');

  const [hasTried, setHasTried] = useState(false);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    const loadMeta = async () => {
      try {
        const [cats, perms, grps] = await Promise.all([
          rolesApi.categories(controller.signal),
          permissionsApi.dropdown(undefined, controller.signal),
          groupsApi.dropdown(undefined, controller.signal),
        ]);
        setCategories(cats.filter((c) => !c.isReserved || isEditing));
        setAllPermissions(perms);
        setAllGroups(grps);
      } catch (err) {
        notifyError(err, 'Could not load role options');
      }
    };

    void loadMeta();
    return () => controller.abort();
  }, [isEditing]);

  const errors: Record<string, string> = {};
  if (!isEditing) {
    if (!roleKey.trim()) errors.roleKey = 'Role key is required';
    else if (!/^[A-Z][A-Z0-9_]{1,63}$/.test(roleKey.trim()))
      errors.roleKey = 'Use letters, digits and underscores (starts with a letter)';
  }
  if (!roleName.trim()) errors.roleName = 'Role name is required';
  if (!category) errors.category = 'Category is required';

  const shown = { ...(hasTried ? errors : {}), ...serverErrors };
  const problemCount = Object.keys(errors).length;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setHasTried(true);
    if (problemCount > 0 || isSaving) return;

    setIsSaving(true);
    try {
      if (isEditing) {
        await rolesApi.update(role.id, {
          roleName: roleName.trim(),
          description: description.trim() || undefined,
          status: isActive ? 'ACTIVE' : 'INACTIVE',
          version: role.version,
        });
        notifySuccess(`Role "${roleName}" updated`);
      } else {
        const payload: RoleSetupInput = {
          roleKey: roleKey.trim().toUpperCase(),
          roleName: roleName.trim(),
          category,
          description: description.trim() || undefined,
          status: isActive ? 'ACTIVE' : 'INACTIVE',
          permissionIds: selectedPermissions.length > 0 ? selectedPermissions : undefined,
          groupIds: selectedGroups.length > 0 ? selectedGroups : undefined,
        };
        await rolesApi.setup(payload);
        notifySuccess(`Role "${roleName}" created`);
      }
      onSaved();
      onClose();
    } catch (err) {
      setServerErrors(getFieldErrors(err));
      notifyError(err, `Could not ${isEditing ? 'update' : 'create'} role`);
    } finally {
      setIsSaving(false);
    }
  };

  const filteredPermissions = allPermissions.filter(
    (p) =>
      p.label.toLowerCase().includes(filterPerm.toLowerCase()) ||
      p.key.toLowerCase().includes(filterPerm.toLowerCase()),
  );

  const filteredGroups = allGroups.filter(
    (g) =>
      g.label.toLowerCase().includes(filterGroup.toLowerCase()) ||
      g.key.toLowerCase().includes(filterGroup.toLowerCase()),
  );

  return (
    <form
      noValidate
      onSubmit={(e) => void handleSubmit(e)}
      className="flex min-h-0 flex-1 flex-col"
    >
      <SheetBody className="space-y-5">
        <section
          aria-label="Role details"
          className="space-y-4 rounded-md border border-border p-4"
        >
          <h3 className="text-sm font-semibold text-foreground">Role details</h3>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Role key"
              required
              disabled={isEditing}
              value={roleKey}
              placeholder="e.g. BILLING_ADMIN"
              hint={isEditing ? 'Key cannot be modified' : 'Unique identifier, uppercase'}
              error={shown.roleKey}
              onChange={(e) => setRoleKey(e.target.value.toUpperCase())}
            />

            <Input
              label="Role name"
              required
              value={roleName}
              placeholder="e.g. Billing Administrator"
              error={shown.roleName}
              onChange={(e) => setRoleName(e.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Category"
              required
              disabled={isEditing}
              value={category}
              options={categories.map((c) => ({ value: c.value, label: c.label }))}
              error={shown.category}
              onValueChange={(val) => val && setCategory(val)}
            />

            <div className="flex items-center pt-6">
              <Switch
                label="Role is active"
                hint="Inactive roles cannot be assigned or used"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
            </div>
          </div>

          <Textarea
            label="Description"
            rows={2}
            maxLength={250}
            value={description}
            placeholder="Briefly describe what this role is responsible for..."
            error={shown.description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </section>

        {!isEditing && (
          <>
            <section
              aria-label="Initial permissions"
              className="space-y-3 rounded-md border border-border p-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    Initial permissions ({selectedPermissions.length})
                  </h3>
                  <p className="text-2xs text-muted-foreground">
                    Choose permissions to bundle into this new role.
                  </p>
                </div>
                {selectedPermissions.length > 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() => setSelectedPermissions([])}
                  >
                    Clear all
                  </Button>
                )}
              </div>

              <Input
                placeholder="Filter permissions..."
                value={filterPerm}
                onChange={(e) => setFilterPerm(e.target.value)}
              />

              <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border border-border p-2">
                {filteredPermissions.map((perm) => (
                  <div key={perm.id} className="flex items-center justify-between py-1 text-xs">
                    <Checkbox
                      checked={selectedPermissions.includes(perm.id)}
                      label={perm.label}
                      onCheckedChange={(checked) =>
                        setSelectedPermissions((prev) =>
                          checked ? [...prev, perm.id] : prev.filter((id) => id !== perm.id),
                        )
                      }
                    />
                    <code className="text-2xs text-muted-foreground">{perm.key}</code>
                  </div>
                ))}
                {filteredPermissions.length === 0 && (
                  <p className="py-2 text-center text-xs text-muted-foreground">
                    No permissions match.
                  </p>
                )}
              </div>
            </section>

            <section
              aria-label="Assign to groups"
              className="space-y-3 rounded-md border border-border p-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    Assign to groups ({selectedGroups.length})
                  </h3>
                  <p className="text-2xs text-muted-foreground">
                    Grant this role immediately to existing permission groups.
                  </p>
                </div>
                {selectedGroups.length > 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() => setSelectedGroups([])}
                  >
                    Clear all
                  </Button>
                )}
              </div>

              <Input
                placeholder="Filter groups..."
                value={filterGroup}
                onChange={(e) => setFilterGroup(e.target.value)}
              />

              <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border border-border p-2">
                {filteredGroups.map((grp) => (
                  <div key={grp.id} className="flex items-center justify-between py-1 text-xs">
                    <Checkbox
                      checked={selectedGroups.includes(grp.id)}
                      label={grp.label}
                      onCheckedChange={(checked) =>
                        setSelectedGroups((prev) =>
                          checked ? [...prev, grp.id] : prev.filter((id) => id !== grp.id),
                        )
                      }
                    />
                    <code className="text-2xs text-muted-foreground">{grp.key}</code>
                  </div>
                ))}
                {filteredGroups.length === 0 && (
                  <p className="py-2 text-center text-xs text-muted-foreground">No groups match.</p>
                )}
              </div>
            </section>
          </>
        )}
      </SheetBody>

      <SheetFooter>
        <p className="mr-auto text-xs text-muted-foreground">
          {hasTried && problemCount > 0
            ? `${problemCount} ${problemCount === 1 ? 'field needs' : 'fields need'} attention`
            : ''}
        </p>
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" isLoading={isSaving}>
          {isEditing ? 'Save changes' : 'Create role'}
        </Button>
      </SheetFooter>
    </form>
  );
}
