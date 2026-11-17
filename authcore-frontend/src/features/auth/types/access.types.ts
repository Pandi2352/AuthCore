export interface MappingGroup {
  id: string;
  groupName: string;
  category?: string;
}

export interface MappingRole {
  id: string;
  roleKey: string;
  roleName: string;
  category?: string;
}

export interface PermissionMetadata {
  key: string;
  value: string;
  action: string;
}

export interface EffectivePermission {
  id: string;
  permissionKey: string;
  permissionName: string;
  metadata?: PermissionMetadata[];
}

export interface EffectiveAccess {
  userId: string;
  isSuperAdmin: boolean;
  groups: MappingGroup[];
  roles: MappingRole[];
  permissions: EffectivePermission[];
  permissionKeys: string[];
}
