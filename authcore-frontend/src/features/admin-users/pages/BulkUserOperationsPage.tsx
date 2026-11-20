import { KeyRound, UserCog, UserPlus } from 'lucide-react';
import { useState } from 'react';

import { EmptyState } from '@/components/feedback';
import { PageContainer, PageHeader } from '@/components/page';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui';
import { usePermissions } from '@/features/auth';

import { BulkOperationPanel } from '../components/BulkOperationPanel';
import type { BulkUserType } from '../types/bulk-users.types';

const TABS: Array<{
  value: BulkUserType;
  label: string;
  icon: typeof UserPlus;
  permission: string;
}> = [
  { value: 'create', label: 'Creation', icon: UserPlus, permission: 'USER_CREATE' },
  { value: 'update', label: 'Updation', icon: UserCog, permission: 'USER_UPDATE' },
  {
    value: 'password',
    label: 'Reset password',
    icon: KeyRound,
    permission: 'USER_PASSWORD_MANAGE',
  },
];

/** Users → Bulk user operations: create, update and reset passwords from CSV / Excel files. */
export function BulkUserOperationsPage() {
  const { hasPermission } = usePermissions();
  const allowed = TABS.filter((t) => hasPermission(t.permission));
  const [tab, setTab] = useState<BulkUserType | null>(allowed[0]?.value ?? null);

  return (
    <PageContainer>
      <PageHeader
        title="Bulk user operations"
        description="Create, update or reset passwords for up to 1,000 users at a time from a CSV or Excel file."
      />
      {allowed.length === 0 || !tab ? (
        <EmptyState
          icon={<UserCog />}
          title="Nothing you can run here"
          description="Bulk operations need the create, update or password permission for users."
        />
      ) : (
        <Tabs value={tab} onValueChange={(value) => setTab(value as BulkUserType)}>
          <TabsList>
            {allowed.map(({ value, label, icon: Icon }) => (
              <TabsTrigger key={value} value={value}>
                <Icon className="size-4" aria-hidden="true" />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
          {allowed.map(({ value }) => (
            <TabsContent key={value} value={value} className="pt-6">
              {tab === value && <BulkOperationPanel type={value} />}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </PageContainer>
  );
}
