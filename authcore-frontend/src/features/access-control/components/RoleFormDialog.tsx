import { Plus } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';

import { notifyError, notifySuccess } from '@/components/feedback';
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  Input,
  Select,
  Textarea,
} from '@/components/ui';
import { getErrorMessage, getFieldErrors, isAbortError } from '@/lib/api';

import { rolesApi } from '../api/roles.api';
import type { Role, RoleCategory } from '../types/access-control.types';

const KEY_PATTERN = /^[A-Z][A-Z0-9_-]{1,63}$/;

/**
 * Create or edit a role in a centered popup: name, key (next ROLE-NN by default), category
 * (pick one or add a new one) and description. Permissions are chosen afterwards.
 */
export function RoleFormDialog({
  open,
  role,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  /** null = create. */
  role: Role | null;
  onOpenChange: (open: boolean) => void;
  /** After saving; `created` is set for a new role. */
  onSaved: (saved: Role, created: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={role ? 'Edit role' : 'Create role'}
        description={
          role
            ? 'Change the name, category or description.'
            : 'Name the role, then choose its permissions on the next page.'
        }
        size="lg"
      >
        {open && (
          <RoleForm
            key={role?.id ?? 'new'}
            role={role}
            onClose={() => onOpenChange(false)}
            onSaved={onSaved}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function RoleForm({
  role,
  onClose,
  onSaved,
}: {
  role: Role | null;
  onClose: () => void;
  onSaved: (saved: Role, created: boolean) => void;
}) {
  const isEditing = role !== null;
  const [roleName, setRoleName] = useState(role?.roleName ?? '');
  const [roleKey, setRoleKey] = useState(role?.roleKey ?? '');
  const [category, setCategory] = useState(role?.category ?? '');
  const [description, setDescription] = useState(role?.description ?? '');
  const [categories, setCategories] = useState<RoleCategory[]>([]);
  const [hasTried, setHasTried] = useState(false);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const [cats, next] = await Promise.all([
          rolesApi.categories(controller.signal),
          isEditing ? null : rolesApi.nextKey(controller.signal),
        ]);
        setCategories(cats);
        // Default key for a new role: the next ROLE-NN (unless typed already).
        if (next) setRoleKey((current) => current || next.roleKey);
      } catch (error) {
        if (!isAbortError(error)) notifyError(error, 'Could not load the role options');
      }
    };
    void load();
    return () => controller.abort();
  }, [isEditing]);

  const errors: Record<string, string> = {};
  if (!roleName.trim()) errors.roleName = 'Enter a role name';
  if (!isEditing) {
    if (!roleKey.trim()) errors.roleKey = 'Enter a role key';
    else if (!KEY_PATTERN.test(roleKey.trim()))
      errors.roleKey = 'Use capital letters, digits, _ or -, starting with a letter (e.g. ROLE-01)';
  }
  if (!category) errors.category = 'Choose a category';
  const shown = { ...(hasTried ? errors : {}), ...serverErrors };

  const options = categories
    .filter((c) => !c.isReserved || c.value === role?.category)
    .map((c) => ({
      value: c.value,
      label: c.label,
      description: c.isCustom ? 'Added by an admin' : undefined,
    }));

  /** "+ Add category" in the list: create it, then it gets selected. */
  const addCategory = async (label: string): Promise<string | { error: string }> => {
    try {
      const created = await rolesApi.createCategory(label);
      setCategories((current) =>
        current.some((c) => c.value === created.value) ? current : [...current, created],
      );
      setCategory(created.value);
      notifySuccess(`Category “${created.label}” added`);
      return created.value;
    } catch (err) {
      return { error: getErrorMessage(err, 'Could not add the category') };
    }
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setHasTried(true);
    if (Object.keys(errors).length > 0 || isSaving) return;
    setIsSaving(true);
    try {
      if (isEditing) {
        const saved = await rolesApi.update(role.id, {
          roleName: roleName.trim(),
          category,
          description: description.trim(),
          version: role.version,
        });
        notifySuccess(`Role “${saved.roleName}” saved`);
        onSaved(saved, false);
      } else {
        const saved = await rolesApi.create({
          roleKey: roleKey.trim().toUpperCase(),
          roleName: roleName.trim(),
          category,
          description: description.trim() || undefined,
        });
        notifySuccess(`Role “${saved.roleName}” created`, {
          description: 'Now choose the permissions it grants.',
        });
        onSaved(saved, true);
      }
      onClose();
    } catch (err) {
      setServerErrors(getFieldErrors(err));
      notifyError(err, isEditing ? 'Could not save the role' : 'Could not create the role');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form
      noValidate
      onSubmit={(e) => void save(e)}
      // A column, so the body scrolls inside the popup and the buttons stay visible.
      className="flex min-h-0 flex-1 flex-col"
    >
      {/* Roomy: two fields per row on wider screens, a tall description box. */}
      <DialogBody className="space-y-5 py-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Role name"
            required
            maxLength={100}
            value={roleName}
            placeholder="Enter a role name, e.g. Support Manager"
            error={shown.roleName}
            onChange={(e) => {
              setRoleName(e.target.value);
              if (serverErrors.roleName) setServerErrors({});
            }}
          />
          <Input
            label="Role key"
            required
            disabled={isEditing}
            maxLength={64}
            value={roleKey}
            placeholder="Enter a key, e.g. ROLE-01"
            hint={
              isEditing
                ? 'Fixed after creation'
                : 'Suggested: the next free ROLE number — change it if you like'
            }
            error={shown.roleKey}
            className="font-mono"
            onChange={(e) => {
              setRoleKey(e.target.value.toUpperCase());
              if (serverErrors.roleKey) setServerErrors({});
            }}
          />
        </div>
        <Select
          label="Category"
          required
          value={category || null}
          placeholder="Choose a category"
          options={options}
          error={shown.category}
          onValueChange={(value) => value && setCategory(value)}
          creatable={{
            label: 'Add category',
            placeholder: 'Enter a category name',
            onCreate: addCategory,
          }}
        />
        <Textarea
          label="Description"
          rows={5}
          maxLength={250}
          value={description}
          placeholder="Describe what people with this role do (optional)"
          error={shown.description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" isLoading={isSaving} leftIcon={isEditing ? undefined : <Plus />}>
          {isEditing ? 'Save changes' : 'Create role'}
        </Button>
      </DialogFooter>
    </form>
  );
}
