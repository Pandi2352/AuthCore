import { Copy, MoreHorizontal, Pencil, RotateCcw, Shield, SquarePen, UserX } from 'lucide-react';
import { useState } from 'react';

import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { TableAction } from '@/components/data-table';
import { notifyError, notifySuccess } from '@/components/feedback';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui';

import { adminUsersApi } from '../api/admin-users.api';
import type { AdminUser } from '../types/admin-user.types';
import { fullName } from './user-labels';
import { UserAccessSheet } from './UserAccessSheet';

/** Edit (always visible) + ⋯ menu; status changes are confirmed. */
export function UserRowActions({
  user,
  canUpdate,
  onEdit,
  onChanged,
}: {
  user: AdminUser;
  canUpdate: boolean;
  onEdit: (user: AdminUser) => void;
  onChanged: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const [accessSheetOpen, setAccessSheetOpen] = useState(false);
  const name = fullName(user);
  const isBlocked =
    user.status === 'SUSPENDED' || user.status === 'INACTIVE' || user.status === 'BANNED';

  const changeStatus = async () => {
    try {
      await adminUsersApi.setStatus(user.id, { status: isBlocked ? 'ACTIVE' : 'SUSPENDED' });
      notifySuccess(isBlocked ? `${name} reactivated` : `${name} suspended`, {
        description: isBlocked
          ? 'They can sign in again.'
          : 'They were signed out everywhere and cannot sign in.',
      });
      onChanged();
    } catch (error) {
      notifyError(error, 'Could not change the status');
      throw error;
    }
  };

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(user.email);
      notifySuccess('Email copied');
    } catch (error) {
      notifyError(error, 'Could not copy');
    }
  };

  return (
    <span className="flex items-center justify-end gap-1.5">
      {canUpdate && (
        <TableAction
          tone="primary"
          icon={<SquarePen />}
          label={`Edit ${name}`}
          onClick={() => onEdit(user)}
        />
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <TableAction
            icon={<MoreHorizontal />}
            label={`More actions for ${name}`}
            showTooltip={false}
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48">
          {canUpdate && (
            <DropdownMenuItem icon={<Pencil />} onSelect={() => onEdit(user)}>
              Edit user
            </DropdownMenuItem>
          )}
          {canUpdate && (
            <DropdownMenuItem icon={<Shield />} onSelect={() => setAccessSheetOpen(true)}>
              Access & roles
            </DropdownMenuItem>
          )}
          <DropdownMenuItem icon={<Copy />} onSelect={() => void copyEmail()}>
            Copy email
          </DropdownMenuItem>
          {canUpdate && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                destructive={!isBlocked}
                icon={isBlocked ? <RotateCcw /> : <UserX />}
                onSelect={() => setConfirm(true)}
              >
                {isBlocked ? 'Reactivate' : 'Suspend'}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {confirm && (
        <ConfirmDialog
          open
          onOpenChange={setConfirm}
          title={isBlocked ? `Reactivate ${name}?` : `Suspend ${name}?`}
          description={
            isBlocked
              ? 'They can sign in again right away.'
              : 'They are signed out everywhere and cannot sign in until reactivated.'
          }
          confirmText={isBlocked ? 'Reactivate' : 'Suspend'}
          destructive={!isBlocked}
          onConfirm={changeStatus}
        />
      )}
      <UserAccessSheet
        user={user}
        open={accessSheetOpen}
        onOpenChange={setAccessSheetOpen}
        onChanged={onChanged}
      />
    </span>
  );
}
