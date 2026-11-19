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

import { groupsApi } from '../api/groups.api';
import type { Group, GroupCategory } from '../types/access-control.types';

/** Same format as role keys: GRP-01. */
const ID_PATTERN = /^[A-Z][A-Z0-9_-]{1,39}$/;
const TOP_LEVEL = '__top__';

/**
 * Create or edit a group in a centered popup: name, group ID (next GRP-NN by default),
 * category (pick one or add a new one), parent group and description. Roles and members
 * are added afterwards.
 */
export function GroupFormDialog({
  open,
  group,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  /** null = create. */
  group: Group | null;
  onOpenChange: (open: boolean) => void;
  /** After saving; `created` is set for a new group. */
  onSaved: (saved: Group, created: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={group ? 'Edit group' : 'Create group'}
        description={
          group
            ? 'Change the name, category, parent or description.'
            : 'Name the group, then add its roles and members.'
        }
        size="lg"
      >
        {open && (
          <GroupForm
            key={group?.id ?? 'new'}
            group={group}
            onClose={() => onOpenChange(false)}
            onSaved={onSaved}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function GroupForm({
  group,
  onClose,
  onSaved,
}: {
  group: Group | null;
  onClose: () => void;
  onSaved: (saved: Group, created: boolean) => void;
}) {
  const isEditing = group !== null;
  const [groupName, setGroupName] = useState(group?.groupName ?? '');
  const [groupId, setGroupId] = useState(group?.groupId ?? '');
  const [category, setCategory] = useState(group?.category ?? '');
  const [parentId, setParentId] = useState(group?.parentGroupId ?? TOP_LEVEL);
  const [description, setDescription] = useState(group?.description ?? '');
  const [categories, setCategories] = useState<GroupCategory[]>([]);
  const [parents, setParents] = useState<Array<{ value: string; label: string }>>([]);
  const [hasTried, setHasTried] = useState(false);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const editingId = group?.id;

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const [cats, options, next] = await Promise.all([
          groupsApi.categories(controller.signal),
          // Editing: the group itself and its sub-groups can't become its parent.
          groupsApi.dropdown({ excludeId: editingId }, controller.signal),
          editingId ? null : groupsApi.nextId(controller.signal),
        ]);
        setCategories(cats);
        setParents(options.map((o) => ({ value: o.id, label: `${o.label} · ${o.key}` })));
        // Default ID for a new group: the next GRP-NN (unless typed already).
        if (next) setGroupId((current) => current || next.groupId);
      } catch (error) {
        if (!isAbortError(error)) notifyError(error, 'Could not load the group options');
      }
    };
    void load();
    return () => controller.abort();
  }, [editingId]);

  const errors: Record<string, string> = {};
  if (!groupName.trim()) errors.groupName = 'Enter a group name';
  if (!isEditing) {
    if (!groupId.trim()) errors.groupId = 'Enter a group ID';
    else if (!ID_PATTERN.test(groupId.trim()))
      errors.groupId = 'Use capital letters, digits, _ or -, starting with a letter (e.g. GRP-01)';
  }
  if (!category) errors.category = 'Choose a category';
  const shown = { ...(hasTried ? errors : {}), ...serverErrors };

  const categoryOptions = categories.map((c) => ({
    value: c.value,
    label: c.label,
    description: c.isCustom ? 'Added by an admin' : undefined,
  }));
  const parentOptions = [{ value: TOP_LEVEL, label: 'None (top-level group)' }, ...parents];

  /** "+ Add category" in the list: create it, then it gets selected. */
  const addCategory = async (label: string): Promise<string | { error: string }> => {
    try {
      const created = await groupsApi.createCategory(label);
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
    const parentGroupId = parentId === TOP_LEVEL ? null : parentId;
    try {
      if (isEditing) {
        const saved = await groupsApi.update(group.id, {
          groupName: groupName.trim(),
          category,
          parentGroupId,
          description: description.trim(),
          version: group.version,
        });
        notifySuccess(`Group “${saved.groupName}” saved`);
        onSaved(saved, false);
      } else {
        const saved = await groupsApi.create({
          groupId: groupId.trim().toUpperCase(),
          groupName: groupName.trim(),
          category,
          parentGroupId,
          description: description.trim() || undefined,
        });
        notifySuccess(`Group “${saved.groupName}” created`, {
          description: 'Now add its roles and members.',
        });
        onSaved(saved, true);
      }
      onClose();
    } catch (err) {
      setServerErrors(getFieldErrors(err));
      notifyError(err, isEditing ? 'Could not save the group' : 'Could not create the group');
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
            label="Group name"
            required
            maxLength={100}
            value={groupName}
            placeholder="Enter a group name, e.g. Support Team"
            error={shown.groupName}
            onChange={(e) => {
              setGroupName(e.target.value);
              if (serverErrors.groupName) setServerErrors({});
            }}
          />
          <Input
            label="Group ID"
            required
            disabled={isEditing}
            maxLength={40}
            value={groupId}
            placeholder="Enter an ID, e.g. GRP-01"
            hint={
              isEditing
                ? 'Fixed after creation'
                : 'Suggested: the next free GRP number — change it if you like'
            }
            error={shown.groupId}
            className="font-mono"
            onChange={(e) => {
              setGroupId(e.target.value.toUpperCase());
              if (serverErrors.groupId) setServerErrors({});
            }}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Category"
            required
            value={category || null}
            placeholder="Choose a category"
            options={categoryOptions}
            error={shown.category}
            onValueChange={(value) => value && setCategory(value)}
            creatable={{
              label: 'Add category',
              placeholder: 'Enter a category name',
              onCreate: addCategory,
            }}
          />
          <Select
            label="Parent group"
            value={parentId}
            options={parentOptions}
            error={shown.parentGroupId}
            onValueChange={(value) => setParentId(value ?? TOP_LEVEL)}
          />
        </div>
        <Textarea
          label="Description"
          rows={5}
          maxLength={250}
          value={description}
          placeholder="Describe who belongs in this group (optional)"
          error={shown.description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" isLoading={isSaving} leftIcon={isEditing ? undefined : <Plus />}>
          {isEditing ? 'Save changes' : 'Create group'}
        </Button>
      </DialogFooter>
    </form>
  );
}
