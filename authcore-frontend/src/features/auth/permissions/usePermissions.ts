import { useMemo } from 'react';

import { useAuth } from '@/features/auth/session/useAuth';

const NONE: readonly string[] = [];

/**
 * Permission checks for the signed-in user. The returned object and its functions are stable
 * while the user's access doesn't change — safe to use in effect / memo dependencies.
 */
export function usePermissions() {
  const { effectiveAccess, user } = useAuth();

  const isSuperAdmin = effectiveAccess?.isSuperAdmin || user?.role === 'ADMIN' || false;
  const permissions = effectiveAccess?.permissionKeys ?? NONE;
  const roleList = effectiveAccess?.roles;

  return useMemo(() => {
    const roles = roleList?.map((r) => r.roleKey) ?? [];
    const has = (key: string) => isSuperAdmin || permissions.includes(key);
    return {
      isSuperAdmin,
      permissions,
      roles,
      hasPermission: has,
      hasAnyPermission: (keys: readonly string[]) =>
        isSuperAdmin || keys.some((k) => permissions.includes(k)),
      hasAllPermissions: (keys: readonly string[]) =>
        isSuperAdmin || keys.every((k) => permissions.includes(k)),
      hasRole: (roleKey: string) => isSuperAdmin || roles.includes(roleKey),
    };
  }, [isSuperAdmin, permissions, roleList]);
}
