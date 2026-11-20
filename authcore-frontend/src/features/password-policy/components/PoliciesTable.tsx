import { Copy, Power, ShieldCheck, SquarePen, Trash2 } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { DateTime } from '@/components/common/DateTime';
import {
  DataTable,
  TableAction,
  useServerTable,
  type DataTableColumn,
  type TableQuery,
} from '@/components/data-table';
import { notifyError, notifySuccess } from '@/components/feedback';
import { Badge } from '@/components/ui';
import { paths } from '@/config';

import { passwordPolicyApi } from '../api/password-policy.api';
import type { PasswordPolicy } from '../types/password-policy.types';
import { policyStrength, ruleChips, type StrengthLevel } from './policy-rules';

type Policy = PasswordPolicy & { id: string };
type Row = Policy & { rowNumber: number };

const STRENGTH_TONE: Record<StrengthLevel, 'danger' | 'warning' | 'info' | 'success'> = {
  weak: 'danger',
  fair: 'warning',
  good: 'info',
  strong: 'success',
};

const COLUMNS: DataTableColumn<Row>[] = [
  {
    id: 'rowNumber',
    header: 'S.No',
    width: 64,
    fit: true,
    mobile: 'hidden',
    cell: (r) => <span className="text-muted-foreground tabular-nums">{r.rowNumber}</span>,
  },
  {
    id: 'policyName',
    header: 'Policy',
    width: 300,
    fitText: (r) => [r.policyName, 'Active · in force'],
    wrap: true,
    mobile: 'title',
    cell: (r) => (
      <span className="block min-w-0">
        <span className="block font-medium text-foreground">{r.policyName}</span>
        {r.isActive ? (
          <span className="text-xs font-semibold text-success">Active · in force</span>
        ) : (
          <span className="text-xs text-muted-foreground">Inactive</span>
        )}
      </span>
    ),
  },
  {
    id: 'strength',
    header: 'Strength',
    width: 120,
    fit: true,
    cell: (r) => {
      const strength = policyStrength(r);
      return (
        <Badge size="sm" tone={STRENGTH_TONE[strength.level]} className="tabular-nums">
          {strength.score} · {strength.label}
        </Badge>
      );
    },
  },
  {
    id: 'rules',
    header: 'Key rules',
    width: 460,
    wrap: true,
    cell: (r) => (
      <span className="flex flex-wrap gap-1">
        {ruleChips(r).map((chip) => (
          <Badge key={chip} size="sm" tone="neutral" variant="outline">
            {chip}
          </Badge>
        ))}
      </span>
    ),
  },
  {
    id: 'updatedAt',
    header: 'Updated on',
    width: 200,
    fit: true,
    cell: (r) =>
      r.updatedAt ? (
        <DateTime value={r.updatedAt} format="full" />
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
];

/** Search and page the loaded policies in the browser (there are only a few). */
function localPage(policies: Policy[], query: TableQuery) {
  const q = query.search.trim().toLowerCase();
  const matching = policies.filter((p) => !q || p.policyName.toLowerCase().includes(q));
  const start = (query.page - 1) * query.pageSize;
  const items: Row[] = [];
  for (const [i, policy] of matching.slice(start, start + query.pageSize).entries()) {
    items.push({ ...policy, rowNumber: start + i + 1 });
  }
  return { items, total: matching.length };
}

/** Every saved policy: activate, edit, duplicate or delete (the active one can't be). */
export function PoliciesTable({
  policies,
  canManage,
  onChanged,
}: {
  policies: Policy[];
  canManage: boolean;
  /** After any change: reload the policies. */
  onChanged: () => void;
}) {
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState<{ policy: Policy; action: 'activate' | 'delete' } | null>(
    null,
  );
  const fetchPage = useCallback(
    (query: TableQuery) => Promise.resolve(localPage(policies, query)),
    [policies],
  );
  const table = useServerTable<Row>({
    fetchPage,
    getRowId: (r) => r.id,
    defaultPageSize: 10,
    itemsLabel: 'policies',
  });

  const duplicate = async (policy: Policy) => {
    try {
      const copy = await passwordPolicyApi.duplicate(policy.id);
      notifySuccess(`Created ${copy.policyName}`, {
        description: 'Saved inactive — edit it, then activate it.',
      });
      onChanged();
    } catch (err) {
      notifyError(err, 'Could not duplicate the policy');
    }
  };
  const runConfirmed = async () => {
    if (!confirm) return;
    const { policy, action } = confirm;
    try {
      if (action === 'activate') {
        await passwordPolicyApi.activate(policy.id);
        notifySuccess(`${policy.policyName} is now the active policy`, {
          description: 'Every new or changed password must follow it.',
        });
      } else {
        await passwordPolicyApi.remove(policy.id);
        notifySuccess(`${policy.policyName} deleted`);
      }
      setConfirm(null);
      onChanged();
    } catch (err) {
      notifyError(
        err,
        action === 'activate' ? 'Could not activate the policy' : 'Could not delete the policy',
      );
      throw err;
    }
  };

  const renderActions = (r: Row) => (
    <span className="flex items-center justify-end gap-1.5">
      {canManage && (
        <TableAction
          tone="success"
          icon={<Power />}
          tooltip="Activate"
          label={`Make ${r.policyName} the active policy`}
          disabledReason={r.isActive ? 'Already the active policy' : undefined}
          onClick={() => setConfirm({ policy: r, action: 'activate' })}
        />
      )}
      <TableAction
        tone="primary"
        icon={<SquarePen />}
        tooltip={canManage ? 'Edit' : 'View'}
        label={`${canManage ? 'Edit' : 'View'} ${r.policyName}`}
        onClick={() => void navigate(paths.admin.passwordPolicyEdit(r.id))}
      />
      {canManage && (
        <TableAction
          tone="violet"
          icon={<Copy />}
          tooltip="Duplicate"
          label={`Duplicate ${r.policyName}`}
          onClick={() => void duplicate(r)}
        />
      )}
      {canManage && (
        <TableAction
          tone="danger"
          icon={<Trash2 />}
          tooltip="Delete"
          label={`Delete ${r.policyName}`}
          disabledReason={r.isActive ? 'Activate another policy first' : undefined}
          onClick={() => setConfirm({ policy: r, action: 'delete' })}
        />
      )}
    </span>
  );

  return (
    <>
      <DataTable
        table={table}
        columns={COLUMNS}
        rowActions={renderActions}
        actionsWidth={canManage ? 170 : 80}
        layoutKey="password-policies:v2"
        viewOptions={false}
        onRefresh={onChanged}
        onRowOpen={(r) => void navigate(paths.admin.passwordPolicyEdit(r.id))}
        itemName={{ singular: 'policy', plural: 'policies' }}
        rowLabel={(r) => r.policyName}
        searchPlaceholder="Search policies by name"
        emptyState={{
          icon: <ShieldCheck />,
          title: 'No saved policies yet',
          description:
            'Create a policy to choose your own rules. The first one you activate replaces the built-in default.',
        }}
      />
      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={
          confirm?.action === 'activate'
            ? `Make ${confirm.policy.policyName} the active policy?`
            : `Delete ${confirm?.policy.policyName ?? ''}?`
        }
        description={
          confirm?.action === 'activate'
            ? 'New passwords (sign-up, reset, change) must follow it from now on. Existing passwords keep working; the current active policy is kept, inactive.'
            : 'The policy is removed. This cannot be undone.'
        }
        confirmText={confirm?.action === 'activate' ? 'Make active' : 'Delete'}
        destructive={confirm?.action === 'delete'}
        onConfirm={runConfirmed}
      />
    </>
  );
}
