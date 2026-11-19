import { RotateCcw, ScanEye, SquarePen, UserRoundCog, UserX } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { TableAction } from '@/components/data-table';
import { notifyError, notifySuccess } from '@/components/feedback';
import { paths } from '@/config';

import { adminUsersApi } from '../api/admin-users.api';
import type { AdminUser } from '../types/admin-user.types';
import { fullName } from './user-labels';
import { UserAccessDialog } from './UserAccessDialog';

/**
 * The row icons, same as roles and groups: Access (groups and roles), View (own page),
 * Edit (popup), Suspend / Reactivate (confirmed). One-word tooltips.
 */
export function UserRowActions({
  user,
  canUpdate,
  isMe,
  onEdit,
  onChanged,
}: {
  user: AdminUser;
  canUpdate: boolean;
  /** Your own row: you can't suspend yourself. */
  isMe: boolean;
  onEdit: (user: AdminUser) => void;
  onChanged: () => void;
}) {
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState(false);
  const [isAccessOpen, setIsAccessOpen] = useState(false);
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

  return (
    <span className="flex items-center justify-end gap-1.5">
      {canUpdate && (
        <TableAction
          tone="warning"
          icon={<UserRoundCog />}
          tooltip="Access"
          label={`Groups and roles of ${name}`}
          onClick={() => setIsAccessOpen(true)}
        />
      )}
      <TableAction
        tone="info"
        icon={<ScanEye />}
        tooltip="View"
        label={`View ${name}`}
        onClick={() => void navigate(paths.admin.userDetail(user.id))}
      />
      {canUpdate && (
        <TableAction
          tone="primary"
          icon={<SquarePen />}
          tooltip="Edit"
          label={`Edit ${name}`}
          onClick={() => onEdit(user)}
        />
      )}
      {canUpdate && (
        <TableAction
          tone={isBlocked ? 'success' : 'danger'}
          icon={isBlocked ? <RotateCcw /> : <UserX />}
          tooltip={isBlocked ? 'Reactivate' : 'Suspend'}
          label={`${isBlocked ? 'Reactivate' : 'Suspend'} ${name}`}
          disabledReason={isMe ? 'You cannot suspend yourself' : undefined}
          onClick={() => setConfirm(true)}
        />
      )}
      <ConfirmDialog
        open={confirm}
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
      <UserAccessDialog
        user={user}
        open={isAccessOpen}
        onOpenChange={setIsAccessOpen}
        onChanged={onChanged}
      />
    </span>
  );
}
