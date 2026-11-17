import { useAuth } from '@/context/AuthContext';

export function usePermissions() {
  const { effectiveAccess, user } = useAuth();

  const isSuperAdmin = effectiveAccess?.isSuperAdmin || user?.role === 'ADMIN' || false;

  const permissions = effectiveAccess?.permissionKeys || [];
  const roles = effectiveAccess?.roles.map((r) => r.roleKey) || [];

  const hasPermission = (key: string): boolean => {
    if (isSuperAdmin) return true;
    return permissions.includes(key);
  };

  const hasAnyPermission = (keys: string[]): boolean => {
    if (isSuperAdmin) return true;
    return keys.some((k) => permissions.includes(k));
  };

  const hasAllPermissions = (keys: string[]): boolean => {
    if (isSuperAdmin) return true;
    return keys.every((k) => permissions.includes(k));
  };

  const hasRole = (roleKey: string): boolean => {
    if (isSuperAdmin) return true;
    return roles.includes(roleKey);
  };

  return {
    isSuperAdmin,
    permissions,
    roles,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
  };
}
