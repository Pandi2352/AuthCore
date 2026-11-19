import { useEffect, useState, type FormEvent } from 'react';

import { notifyError, notifySuccess } from '@/components/feedback';
import {
  Button,
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
import type { Group } from '../types/access-control.types';

export function GroupEditorSheet({
  open,
  group,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  group: Group | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        title={group ? `Edit ${group.groupName}` : 'Create group'}
        description={
          group
            ? `Update group settings for ${group.groupId}.`
            : 'Create a security group, department, or team to bundle roles and permissions.'
        }
        size="lg"
      >
        {open && (
          <GroupEditorForm
            key={group?.id ?? 'new'}
            group={group}
            onClose={() => onOpenChange(false)}
            onSaved={onSaved}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function GroupEditorForm({
  group,
  onClose,
  onSaved,
}: {
  group: Group | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEditing = !!group;
  const [groupId, setGroupId] = useState(() => group?.groupId ?? '');
  const [groupName, setGroupName] = useState(() => group?.groupName ?? '');
  const [category, setCategory] = useState(() => group?.category ?? 'DEPARTMENT');
  const [parentGroupId, setParentGroupId] = useState<string | null>(
    () => group?.parentGroupId ?? 'none',
  );
  const [tags, setTags] = useState(() => group?.tags?.join(', ') ?? '');
  const [description, setDescription] = useState(() => group?.description ?? '');
  const [isActive, setIsActive] = useState(() => (group ? group.status === 'ACTIVE' : true));

  const [categories, setCategories] = useState<Array<{ value: string; label: string }>>([]);
  const [parentOptions, setParentOptions] = useState<Array<{ value: string; label: string }>>([]);

  const [hasTried, setHasTried] = useState(false);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    const loadMeta = async () => {
      try {
        const [cats, parents] = await Promise.all([
          groupsApi.categories(controller.signal),
          groupsApi.dropdown({ excludeId: group?.id }, controller.signal),
        ]);
        setCategories(cats);
        setParentOptions([
          { value: 'none', label: 'None (Top-level group)' },
          ...parents.map((p) => ({ value: p.id, label: `${p.label} (${p.key})` })),
        ]);
      } catch (err) {
        notifyError(err, 'Could not load group options');
      }
    };

    void loadMeta();
    return () => controller.abort();
  }, [group?.id]);

  const errors: Record<string, string> = {};
  if (!groupName.trim()) errors.groupName = 'Group name is required';
  if (!category) errors.category = 'Category is required';

  const shown = { ...(hasTried ? errors : {}), ...serverErrors };
  const problemCount = Object.keys(errors).length;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setHasTried(true);
    if (problemCount > 0 || isSaving) return;

    setIsSaving(true);
    try {
      const parsedTags = tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const actualParent = parentGroupId === 'none' ? null : parentGroupId;

      if (isEditing) {
        await groupsApi.update(group.id, {
          groupName: groupName.trim(),
          parentGroupId: actualParent,
          description: description.trim() || undefined,
          tags: parsedTags,
          status: isActive ? 'ACTIVE' : 'INACTIVE',
          version: group.version,
        });
        notifySuccess(`Group "${groupName}" updated`);
      } else {
        await groupsApi.create({
          groupId: groupId.trim().toUpperCase() || undefined,
          groupName: groupName.trim(),
          category,
          parentGroupId: actualParent,
          description: description.trim() || undefined,
          tags: parsedTags,
          status: isActive ? 'ACTIVE' : 'INACTIVE',
        });
        notifySuccess(`Group "${groupName}" created`);
      }
      onSaved();
      onClose();
    } catch (err) {
      setServerErrors(getFieldErrors(err));
      notifyError(err, `Could not ${isEditing ? 'update' : 'create'} group`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form
      noValidate
      onSubmit={(e) => void handleSubmit(e)}
      className="flex min-h-0 flex-1 flex-col"
    >
      <SheetBody className="space-y-5">
        <section
          aria-label="Group details"
          className="space-y-4 rounded-md border border-border p-4"
        >
          <h3 className="text-sm font-semibold text-foreground">Group information</h3>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Group ID (Code)"
              disabled={isEditing}
              value={groupId}
              placeholder="e.g. GRP-ENG (optional, auto-generated)"
              hint={isEditing ? 'ID is fixed' : 'Uppercase letters, numbers and hyphens'}
              error={shown.groupId}
              onChange={(e) => setGroupId(e.target.value.toUpperCase())}
            />

            <Input
              label="Group name"
              required
              value={groupName}
              placeholder="e.g. Core Engineering"
              error={shown.groupName}
              onChange={(e) => setGroupName(e.target.value)}
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

            <Select
              label="Parent group"
              value={parentGroupId ?? 'none'}
              options={parentOptions}
              hint="Create hierarchical sub-groups"
              onValueChange={(val) => setParentGroupId(val)}
            />
          </div>

          <Input
            label="Tags"
            value={tags}
            placeholder="e.g. engineering, platform, security (comma separated)"
            error={shown.tags}
            onChange={(e) => setTags(e.target.value)}
          />

          <Textarea
            label="Description"
            rows={2}
            maxLength={250}
            value={description}
            placeholder="Purpose of this group and its team responsibilities..."
            error={shown.description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <div className="flex items-center pt-2">
            <Switch
              label="Group is active"
              hint="Inactive groups do not grant inherited roles to members"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
          </div>
        </section>
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
          {isEditing ? 'Save changes' : 'Create group'}
        </Button>
      </SheetFooter>
    </form>
  );
}
