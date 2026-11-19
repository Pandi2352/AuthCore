import { KeyRound, ListChecks, Save, ShieldCheck, Undo2 } from 'lucide-react';
import { useMemo, useState } from 'react';

import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EmptyState, ErrorState, LoadingState } from '@/components/feedback';
import {
  Badge,
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui';

import type { Role } from '../types/access-control.types';
import { RolePermissionPicker } from './RolePermissionPicker';
import { RolePermissionsNotice } from './RolePermissionsNotice';
import { useRolePermissions } from './use-role-permissions';

/** Both tabs: same fixed height, scrolling inside (the popup itself never grows). */
const PANEL = 'mt-4 h-[min(28rem,52dvh)] overflow-y-auto pr-1';

type RoleRef = Pick<Role, 'id' | 'roleName' | 'roleKey' | 'isSystem'>;

/**
 * Roles → key icon: a centered popup with two tabs: what the role grants now ("Assigned")
 * and every permission to tick ("Assign permissions"). Saving sends only the changes.
 */
export function RolePermissionsDialog({
  role,
  onClose,
  onSaved,
}: {
  /** null = closed. */
  role: RoleRef | null;
  onClose: () => void;
  onSaved?: () => void;
}) {
  // Mounted only while open, so each role loads fresh.
  return role ? (
    <PermissionsContent key={role.id} role={role} onClose={onClose} onSaved={onSaved} />
  ) : null;
}

function PermissionsContent({
  role,
  onClose,
  onSaved,
}: {
  role: RoleRef;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const p = useRolePermissions(role);
  const [tab, setTab] = useState('assigned');
  const [confirmClose, setConfirmClose] = useState(false);

  // "Assigned" keeps showing what was granted (so an untick can be undone) plus new ticks.
  const assigned = useMemo(
    () => p.permissions?.filter((perm) => p.initial.has(perm.id) || p.selected.has(perm.id)) ?? [],
    [p.permissions, p.initial, p.selected],
  );

  const requestClose = () => (p.isDirty ? setConfirmClose(true) : onClose());
  const save = async () => {
    if (await p.save()) {
      onSaved?.();
      onClose();
    }
  };

  return (
    // Escape, backdrop and × all go through the unsaved-changes check.
    <Dialog open onOpenChange={(open) => !open && requestClose()}>
      <DialogContent
        size="xl"
        title={
          <span className="flex flex-wrap items-center gap-2">
            <KeyRound className="size-5 text-success" aria-hidden="true" />
            Permissions · {role.roleName}
            <Badge tone="primary" variant="soft" size="sm" className="font-mono">
              {role.roleKey}
            </Badge>
          </span>
        }
        description="See what this role grants and tick more to assign. Members of groups with this role get these permissions."
      >
        <DialogBody className="space-y-4">
          <RolePermissionsNotice isSystem={role.isSystem} readOnly={p.readOnly} />
          {p.permissions ? (
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList>
                <TabsTrigger value="assigned">
                  <ShieldCheck className="size-4" aria-hidden="true" />
                  Assigned
                  <Badge size="sm" tone="success" className="tabular-nums">
                    {p.selected.size}
                  </Badge>
                </TabsTrigger>
                {!p.readOnly && (
                  <TabsTrigger value="assign">
                    <ListChecks className="size-4" aria-hidden="true" />
                    Assign permissions
                    <Badge size="sm" tone="neutral" className="tabular-nums">
                      {p.permissions.length}
                    </Badge>
                  </TabsTrigger>
                )}
              </TabsList>
              <TabsContent value="assigned" className={PANEL}>
                {assigned.length === 0 ? (
                  <EmptyState
                    icon={<ShieldCheck />}
                    title="No permissions yet"
                    description="This role grants nothing. Assign permissions to give its groups access."
                    action={
                      !p.readOnly && (
                        <Button leftIcon={<ListChecks />} onClick={() => setTab('assign')}>
                          Assign permissions
                        </Button>
                      )
                    }
                  />
                ) : (
                  <RolePermissionPicker
                    permissions={assigned}
                    selected={p.selected}
                    onChange={p.setSelected}
                    readOnly={p.readOnly}
                  />
                )}
              </TabsContent>
              {!p.readOnly && (
                <TabsContent value="assign" className={PANEL}>
                  <RolePermissionPicker
                    permissions={p.permissions}
                    selected={p.selected}
                    onChange={p.setSelected}
                  />
                </TabsContent>
              )}
            </Tabs>
          ) : p.failure ? (
            <ErrorState
              error={p.failure}
              title="Could not load the permissions"
              onRetry={p.retry}
            />
          ) : (
            <LoadingState label="Loading permissions" />
          )}
        </DialogBody>
        <DialogFooter className="flex-wrap items-center">
          <p className="mr-auto text-xs text-muted-foreground" aria-live="polite">
            {p.readOnly
              ? `${p.selected.size} permissions granted`
              : (p.blockedReason ??
                (p.isDirty
                  ? `${p.added.length} to add · ${p.removed.length} to remove`
                  : 'No unsaved changes'))}
          </p>
          {p.readOnly ? (
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          ) : (
            <>
              {p.isDirty ? (
                <Button
                  variant="ghost"
                  leftIcon={<Undo2 />}
                  disabled={p.isSaving}
                  onClick={p.reset}
                >
                  Discard
                </Button>
              ) : (
                <Button variant="ghost" onClick={requestClose}>
                  Cancel
                </Button>
              )}
              <Button
                leftIcon={<Save />}
                isLoading={p.isSaving}
                disabled={!p.isDirty || p.blockedReason !== null}
                onClick={() => void save()}
              >
                Save permissions
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
      <ConfirmDialog
        open={confirmClose}
        onOpenChange={setConfirmClose}
        title="Close without saving?"
        description="The permission changes for this role will be lost."
        confirmText="Close"
        cancelText="Keep editing"
        destructive
        onConfirm={onClose}
      />
    </Dialog>
  );
}
