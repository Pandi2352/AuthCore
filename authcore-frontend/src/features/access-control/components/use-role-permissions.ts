import { useEffect, useState } from 'react';

import { notifyError, notifySuccess } from '@/components/feedback';
import { usePermissions } from '@/features/auth';
import { isAbortError } from '@/lib/api';

import { accessMappingsApi } from '../api/access-mappings.api';
import { permissionsApi } from '../api/permissions.api';
import type { Permission, Role } from '../types/access-control.types';

/**
 * Load, edit and save the permissions one role grants (the role permissions popup).
 * Saving sends only what changed.
 */
export function useRolePermissions(role: Pick<Role, 'id' | 'roleName' | 'isSystem'>) {
  const { hasPermission } = usePermissions();
  const canAssign = hasPermission('ACCESS_MAPPING_ASSIGN');
  const canRevoke = hasPermission('ACCESS_MAPPING_REVOKE');
  const readOnly = role.isSystem || (!canAssign && !canRevoke);

  const [permissions, setPermissions] = useState<Permission[] | null>(null);
  const [initial, setInitial] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [failure, setFailure] = useState<{ attempt: number; error: unknown } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const [all, current] = await Promise.all([
          permissionsApi.all(controller.signal),
          accessMappingsApi.rolePermissionIds(role.id, controller.signal),
        ]);
        setPermissions(all.filter((p) => p.status === 'ACTIVE' || current.includes(p.id)));
        setInitial(new Set(current));
        setSelected(new Set(current));
      } catch (error) {
        if (!isAbortError(error)) setFailure({ attempt, error });
      }
    };
    void load();
    return () => controller.abort();
  }, [role.id, attempt]);

  const added = [...selected].filter((id) => !initial.has(id));
  const removed = [...initial].filter((id) => !selected.has(id));
  const isDirty = added.length > 0 || removed.length > 0;
  const blockedReason =
    added.length > 0 && !canAssign
      ? 'You can remove permissions but not add them'
      : removed.length > 0 && !canRevoke
        ? 'You can add permissions but not remove them'
        : null;

  /** true when saved. */
  const save = async (): Promise<boolean> => {
    if (!isDirty || isSaving || readOnly || blockedReason) return false;
    setIsSaving(true);
    try {
      if (added.length > 0) {
        await accessMappingsApi.assignRolePermissions({ roleId: role.id, permissionIds: added });
      }
      if (removed.length > 0) {
        await accessMappingsApi.removeRolePermissions({ roleId: role.id, permissionIds: removed });
      }
      notifySuccess(`Permissions for "${role.roleName}" saved`, {
        description:
          [
            added.length > 0 && `${added.length} added`,
            removed.length > 0 && `${removed.length} removed`,
          ]
            .filter(Boolean)
            .join(', ') + '. Members get the change on their next request.',
      });
      setInitial(new Set(selected));
      return true;
    } catch (err) {
      notifyError(err, 'Could not save the permissions');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  return {
    permissions,
    /** What the role grants right now (saved). */
    initial,
    selected,
    setSelected,
    reset: () => setSelected(new Set(initial)),
    added,
    removed,
    isDirty,
    isSaving,
    save,
    readOnly,
    canAssign,
    canRevoke,
    blockedReason,
    failure: failure?.attempt === attempt ? failure.error : null,
    retry: () => setAttempt((n) => n + 1),
  };
}
