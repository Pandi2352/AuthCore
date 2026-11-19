import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';

import { notifyError, notifySuccess } from '@/components/feedback';
import {
  Button,
  IconButton,
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

import { permissionsApi } from '../api/permissions.api';
import type {
  Permission,
  PermissionAction,
  PermissionMetadata,
} from '../types/access-control.types';

interface MetaRow {
  id: string;
  key: string;
  value: string;
  action: PermissionAction;
}

export function PermissionEditorSheet({
  open,
  permission,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  permission: Permission | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        title={permission ? `Edit ${permission.permissionName}` : 'Create permission'}
        description={
          permission
            ? `Modify permission key ${permission.permissionKey}.`
            : 'Register a granular permission with action and module metadata.'
        }
        size="lg"
      >
        {open && (
          <PermissionEditorForm
            key={permission?.id ?? 'new'}
            permission={permission}
            onClose={() => onOpenChange(false)}
            onSaved={onSaved}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function PermissionEditorForm({
  permission,
  onClose,
  onSaved,
}: {
  permission: Permission | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEditing = !!permission;
  const [permissionKey, setPermissionKey] = useState(() => permission?.permissionKey ?? '');
  const [permissionName, setPermissionName] = useState(() => permission?.permissionName ?? '');
  const [description, setDescription] = useState(() => permission?.description ?? '');
  const [isActive, setIsActive] = useState(() =>
    permission ? permission.status === 'ACTIVE' : true,
  );
  const [metadata, setMetadata] = useState<MetaRow[]>(() => {
    if (permission?.metadata && permission.metadata.length > 0) {
      return permission.metadata.map((m, i) => ({
        id: `meta-${i}-${Date.now()}`,
        key: m.key,
        value: m.value,
        action: m.action,
      }));
    }
    return [{ id: `meta-0-${Date.now()}`, key: 'module', value: 'users', action: 'READ' }];
  });
  const [actions, setActions] = useState<Array<{ value: string; label: string }>>([]);

  const [hasTried, setHasTried] = useState(false);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void permissionsApi
      .actions(controller.signal)
      .then(setActions)
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const errors: Record<string, string> = {};
  if (!isEditing) {
    if (!permissionKey.trim()) errors.permissionKey = 'Permission key is required';
    else if (!/^[A-Z][A-Z0-9_]{1,63}$/.test(permissionKey.trim()))
      errors.permissionKey = 'Use uppercase letters, digits and underscores';
  }
  if (!permissionName.trim()) errors.permissionName = 'Permission name is required';

  const shown = { ...(hasTried ? errors : {}), ...serverErrors };
  const problemCount = Object.keys(errors).length;

  const handleAddMeta = () => {
    if (metadata.length >= 20) return;
    setMetadata((prev) => [
      ...prev,
      {
        id: `meta-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        key: '',
        value: '',
        action: 'READ',
      },
    ]);
  };

  const handleRemoveMeta = (id: string) => {
    setMetadata((prev) => prev.filter((m) => m.id !== id));
  };

  const handleUpdateMeta = (id: string, field: 'key' | 'value' | 'action', val: string) => {
    setMetadata((prev) => prev.map((m) => (m.id === id ? { ...m, [field]: val } : m)));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setHasTried(true);
    if (problemCount > 0 || isSaving) return;

    setIsSaving(true);
    try {
      const validMeta: PermissionMetadata[] = metadata
        .filter((m) => m.key.trim() && m.value.trim())
        .map((m) => ({ key: m.key.trim(), value: m.value.trim(), action: m.action }));

      if (isEditing) {
        await permissionsApi.update(permission.id, {
          permissionName: permissionName.trim(),
          description: description.trim() || undefined,
          status: isActive ? 'ACTIVE' : 'INACTIVE',
          metadata: validMeta,
          version: permission.version,
        });
        notifySuccess(`Permission "${permissionName}" updated`);
      } else {
        await permissionsApi.create({
          permissionKey: permissionKey.trim().toUpperCase(),
          permissionName: permissionName.trim(),
          description: description.trim() || undefined,
          status: isActive ? 'ACTIVE' : 'INACTIVE',
          metadata: validMeta,
        });
        notifySuccess(`Permission "${permissionName}" created`);
      }
      onSaved();
      onClose();
    } catch (err) {
      setServerErrors(getFieldErrors(err));
      notifyError(err, `Could not ${isEditing ? 'update' : 'create'} permission`);
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
          aria-label="Permission details"
          className="space-y-4 rounded-md border border-border p-4"
        >
          <h3 className="text-sm font-semibold text-foreground">Permission details</h3>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Permission key"
              required
              disabled={isEditing}
              value={permissionKey}
              placeholder="e.g. REPORT_DOWNLOAD"
              hint={isEditing ? 'Key cannot be modified' : 'Unique system key, uppercase'}
              error={shown.permissionKey}
              onChange={(e) => setPermissionKey(e.target.value.toUpperCase())}
            />

            <Input
              label="Permission name"
              required
              value={permissionName}
              placeholder="e.g. Download reports"
              error={shown.permissionName}
              onChange={(e) => setPermissionName(e.target.value)}
            />
          </div>

          <div className="flex items-center pt-2">
            <Switch
              label="Permission is active"
              hint="Inactive permissions are not evaluated during authorization checks"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
          </div>

          <Textarea
            label="Description"
            rows={2}
            maxLength={250}
            value={description}
            placeholder="What action this permission authorizes..."
            error={shown.description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </section>

        <section
          aria-label="Action & module metadata"
          className="space-y-3 rounded-md border border-border p-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Metadata tags</h3>
              <p className="text-xs text-muted-foreground">
                Attach module, resource, or action descriptors
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              leftIcon={<Plus />}
              disabled={metadata.length >= 20}
              onClick={handleAddMeta}
            >
              Add tag
            </Button>
          </div>

          <div className="space-y-2">
            {metadata.map((item) => (
              <div key={item.id} className="flex items-center gap-2">
                <Input
                  aria-label="Metadata key"
                  size="sm"
                  value={item.key}
                  placeholder="Key (e.g. module)"
                  className="w-1/3"
                  onChange={(e) => handleUpdateMeta(item.id, 'key', e.target.value)}
                />
                <Input
                  aria-label="Metadata value"
                  size="sm"
                  value={item.value}
                  placeholder="Value (e.g. billing)"
                  className="w-1/3"
                  onChange={(e) => handleUpdateMeta(item.id, 'value', e.target.value)}
                />
                <Select
                  aria-label="Metadata action"
                  size="sm"
                  value={item.action}
                  options={actions.map((a) => ({ value: a.value, label: a.label }))}
                  className="w-1/4"
                  onValueChange={(val) => val && handleUpdateMeta(item.id, 'action', val)}
                />
                <IconButton
                  aria-label="Remove tag"
                  icon={<Trash2 />}
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10"
                  onClick={() => handleRemoveMeta(item.id)}
                />
              </div>
            ))}
            {metadata.length === 0 && (
              <p className="py-2 text-center text-xs text-muted-foreground">
                No metadata tags attached.
              </p>
            )}
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
          {isEditing ? 'Save changes' : 'Create permission'}
        </Button>
      </SheetFooter>
    </form>
  );
}
