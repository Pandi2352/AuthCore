import { Eye, MoreHorizontal, RotateCcw, Trash2, UserX } from 'lucide-react';
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

/** Always-visible ⋯ menu per row (never hover-only); delete is confirmed. */
export function UserRowActions({
  user,
  onOpen,
  onChanged,
}: {
  user: AdminUser;
  onOpen: (user: AdminUser) => void;
  onChanged: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const name = fullName(user);
  const suspended = user.status === 'suspended';

  const setStatus = async () => {
    try {
      await adminUsersApi.setStatus(
        { mode: 'ids', ids: [user.id] },
        suspended ? 'active' : 'suspended',
      );
      notifySuccess(suspended ? `${name} reactivated` : `${name} suspended`);
      onChanged();
    } catch (error) {
      notifyError(error, 'Could not change the status');
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <IconButton
            aria-label={`Actions for ${name}`}
            icon={<MoreHorizontal />}
            variant="ghost"
            size="sm"
            // size-7!: tailwind-merge does not see size-control-sm as a size class.
            className="size-7! pointer-coarse:size-11!"
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48">
          <DropdownMenuItem icon={<Eye />} onSelect={() => onOpen(user)}>
            View details
          </DropdownMenuItem>
          <DropdownMenuItem
            icon={suspended ? <RotateCcw /> : <UserX />}
            onSelect={() => void setStatus()}
          >
            {suspended ? 'Reactivate' : 'Suspend'}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem destructive icon={<Trash2 />} onSelect={() => setConfirmDelete(true)}>
            Delete user
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {confirmDelete && (
        <ConfirmDialog
          open
          onOpenChange={setConfirmDelete}
          title={`Delete ${name}?`}
          description="The account and its data are removed permanently. This cannot be undone."
          confirmText="Delete user"
          destructive
          onConfirm={async () => {
            await adminUsersApi.remove({ mode: 'ids', ids: [user.id] });
            notifySuccess(`${name} deleted`);
            setConfirmDelete(false);
            onChanged();
          }}
        />
      )}
    </>
  );
}
