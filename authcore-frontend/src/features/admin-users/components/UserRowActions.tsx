import { Copy, MoreHorizontal, Pencil, RotateCcw, UserX } from 'lucide-react';
import { useState } from 'react';

import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { notifyError, notifySuccess } from '@/components/feedback';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  IconButton,
} from '@/components/ui';

import { adminUsersApi } from '../api/admin-users.api';
import type { AdminUser } from '../types/admin-user.types';
import { fullName } from './user-labels';

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
    <span className="flex items-center justify-end gap-1">
      {canUpdate && (
        <IconButton
          aria-label={`Edit ${name}`}
          icon={<Pencil />}
          variant="outline"
          size="sm"
          className="size-7! pointer-coarse:size-11!"
          onClick={() => onEdit(user)}
        />
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <IconButton
            aria-label={`More actions for ${name}`}
            icon={<MoreHorizontal />}
            variant="ghost"
            size="sm"
            showTooltip={false}
            // size-7!: tailwind-merge does not see size-control-sm as a size class.
            className="size-7! pointer-coarse:size-11!"
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48">
          {canUpdate && (
            <DropdownMenuItem icon={<Pencil />} onSelect={() => onEdit(user)}>
              Edit user
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
    </span>
  );
}
