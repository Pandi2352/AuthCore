/** Public API of the auth feature: the only feature other features may import. */
export { AuthProvider } from './session/AuthProvider';
export { useAuth } from './session/useAuth';
export type { AuthContextType } from './session/auth-context';
export { usePermissions } from './permissions/usePermissions';
export { PermissionGate } from './permissions/PermissionGate';
export { PasswordRequirements } from './components/PasswordRequirements';
export { authApi } from './api/auth.api';
export type * from './types/user.types';
export type * from './types/auth.types';
export type * from './types/access.types';
