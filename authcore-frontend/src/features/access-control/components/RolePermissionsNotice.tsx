import { Lock } from 'lucide-react';

import { Alert } from '@/components/ui';

/** Why a role's permissions can't be changed (built-in role, or no Assign / Revoke access). */
export function RolePermissionsNotice({
  isSystem,
  readOnly,
}: {
  isSystem: boolean;
  readOnly: boolean;
}) {
  if (isSystem) {
    return (
      <Alert
        variant="info"
        icon={<Lock />}
        title="Built-in role"
        message="Its permissions are fixed. Create a new role to grant a different set."
      />
    );
  }
  if (readOnly) {
    return (
      <Alert
        variant="info"
        title="View only"
        message="Changing a role's permissions needs the Assign / Revoke access permissions."
      />
    );
  }
  return null;
}
