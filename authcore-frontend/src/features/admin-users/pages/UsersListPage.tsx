import { Download, MailPlus, Trash2, Users, UserX } from 'lucide-react';
import { useCallback, useState } from 'react';

import {
  DataTable,
  useServerTable,
  type BulkAction,
  type DataTableColumn,
  type DataTableFilter,
} from '@/components/data-table';
import { notifySuccess } from '@/components/feedback';
import { PageContainer, PageHeader } from '@/components/page';
import { Button, Sheet, SheetBody, SheetContent } from '@/components/ui';
import { useAuth } from '@/features/auth';

import { adminUsersApi } from '../api/admin-users.api';
import { fullName, ROLE_LABEL, STATUS_LABEL } from '../components/user-labels';
import { DateCell, NumberCell, RoleCell, StatusCell, UserNameCell } from '../components/UserCells';
import { UserRowActions } from '../components/UserRowActions';
import type { AdminUser } from '../types/admin-user.types';

const FILTERS: DataTableFilter[] = [
  {
    id: 'status',
    label: 'Status',
    options: Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label })),
  },
  {
    id: 'role',
    label: 'Role',
    options: Object.entries(ROLE_LABEL).map(([value, label]) => ({ value, label })),
  },
];

const COLUMNS: DataTableColumn<AdminUser>[] = [
  {
    id: 'name',
    header: 'Name',
    sortable: true,
    width: 240,
    mobile: 'title',
    cell: (u) => <UserNameCell user={u} />,
  },
  {
    id: 'email',
    header: 'Email',
    sortable: true,
    width: 260,
    mobile: 'subtitle',
    cell: (u) => u.email,
  },
  { id: 'role', header: 'Role', sortable: true, width: 120, cell: (u) => <RoleCell user={u} /> },
  {
    id: 'status',
    header: 'Status',
    sortable: true,
    width: 160,
    cell: (u) => <StatusCell user={u} />,
  },
  {
    id: 'sessions',
    header: 'Sessions',
    sortable: true,
    numeric: true,
    width: 110,
    cell: (u) => <NumberCell value={u.sessions} />,
  },
  {
    id: 'signIns',
    header: 'Sign-ins',
    sortable: true,
    numeric: true,
    width: 110,
    defaultHidden: true,
    cell: (u) => <NumberCell value={u.signIns} />,
  },
  {
    id: 'lastActiveAt',
    header: 'Last active',
    sortable: true,
    width: 150,
    cell: (u) => <DateCell value={u.lastActiveAt} />,
  },
  {
    id: 'createdAt',
    header: 'Created',
    sortable: true,
    width: 150,
    cell: (u) => <DateCell value={u.createdAt} />,
  },
];

const getRowId = (u: AdminUser) => u.id;
const countOf = (n: number) => `${n} ${n === 1 ? 'user' : 'users'}`;

/** Administration → Users: the reference implementation of the shared DataTable (mock data). */
export function UsersListPage() {
  const { user } = useAuth();
  const [openUser, setOpenUser] = useState<AdminUser | null>(null);
  const table = useServerTable({
    fetchPage: adminUsersApi.list,
    getRowId,
    filters: FILTERS,
    defaultSort: [{ id: 'createdAt', desc: true }],
    defaultPageSize: 25,
    itemsLabel: 'users',
  });

  const bulkActions: BulkAction[] = [
    {
      id: 'export',
      label: 'Export',
      icon: <Download />,
      run: (target) => {
        const count = target.mode === 'ids' ? target.ids.length : target.count;
        notifySuccess(`Export of ${countOf(count)} started`, {
          description: 'Mock: the file download arrives when the API is wired.',
        });
      },
    },
    {
      id: 'suspend',
      label: 'Suspend',
      icon: <UserX />,
      confirm: {
        title: `Suspend ${countOf(table.selectedCount)}?`,
        description: 'They are signed out everywhere and cannot sign in until reactivated.',
        confirmText: 'Suspend',
      },
      run: async (target) => {
        const n = await adminUsersApi.setStatus(target, 'suspended');
        notifySuccess(`${countOf(n)} suspended`);
        table.refresh();
      },
    },
    {
      id: 'delete',
      label: 'Delete',
      icon: <Trash2 />,
      destructive: true,
      confirm: {
        title: `Delete ${countOf(table.selectedCount)}?`,
        description: 'Accounts and their data are removed permanently. This cannot be undone.',
        confirmText: 'Delete',
      },
      run: async (target) => {
        const n = await adminUsersApi.remove(target);
        notifySuccess(`${countOf(n)} deleted`);
        table.refresh();
      },
    },
  ];

  const { refresh } = table;
  const renderRowActions = useCallback(
    (u: AdminUser) => <UserRowActions user={u} onOpen={setOpenUser} onChanged={refresh} />,
    [refresh],
  );

  const inviteButton = (
    <Button
      leftIcon={<MailPlus />}
      onClick={() => notifySuccess('Invitations arrive with module 21')}
    >
      Invite user
    </Button>
  );

  return (
    <PageContainer>
      <PageHeader
        title="Users"
        description="Everyone who can sign in: search, filter, sort and manage accounts."
        actions={inviteButton}
      />
      <DataTable
        table={table}
        columns={COLUMNS}
        layoutKey={`admin-users:${user?.id ?? 'anonymous'}`}
        itemName={{ singular: 'user', plural: 'users' }}
        rowLabel={fullName}
        onRowOpen={setOpenUser}
        rowActions={renderRowActions}
        bulkActions={bulkActions}
        searchPlaceholder="Search by name or email"
        emptyState={{
          icon: <Users />,
          title: 'No users yet',
          description: 'Invite your team to get started — they appear here once invited.',
          action: inviteButton,
        }}
      />

      <Sheet open={openUser !== null} onOpenChange={(open) => !open && setOpenUser(null)}>
        {openUser && (
          <SheetContent title={fullName(openUser)} description={openUser.email} size="md">
            <SheetBody>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Role</dt>
                  <dd className="mt-1">
                    <RoleCell user={openUser} />
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Status</dt>
                  <dd className="mt-1">
                    <StatusCell user={openUser} />
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Active sessions</dt>
                  <dd className="mt-1 tabular-nums">{openUser.sessions}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Sign-ins</dt>
                  <dd className="mt-1 tabular-nums">{openUser.signIns}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Last active</dt>
                  <dd className="mt-1">
                    <DateCell value={openUser.lastActiveAt} />
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Created</dt>
                  <dd className="mt-1">
                    <DateCell value={openUser.createdAt} />
                  </dd>
                </div>
              </dl>
            </SheetBody>
          </SheetContent>
        )}
      </Sheet>
    </PageContainer>
  );
}
