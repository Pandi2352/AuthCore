export type RecordStatus = 'ACTIVE' | 'INACTIVE';

export type GroupCategory = 'DEPARTMENT' | 'TEAM' | 'PROJECT' | 'SECURITY' | 'CUSTOM';

export type PermissionAction =
  'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'MANAGE' | 'EXECUTE' | 'ASSIGN' | 'REVOKE' | 'APPROVE';

export type MappingType = 'GROUP_USER' | 'GROUP_ROLE' | 'ROLE_PERMISSION';

export interface PermissionMetadata {
  key: string;
  value: string;
  action: string;
}

export interface Permission {
  id: string;
  permissionKey: string;
  permissionName: string;
  description: string;
  status: RecordStatus;
  isSystem: boolean;
  version: number;
  roleCount?: number;
  metadata: PermissionMetadata[];
  createdAt: string;
  updatedAt: string;
}

export interface PermissionListItem extends Permission {
  rowNumber?: number;
}

export interface CreatePermissionInput {
  permissionKey: string;
  permissionName: string;
  description?: string;
  status?: RecordStatus;
  metadata?: PermissionMetadata[];
}

export interface UpdatePermissionInput {
  permissionName?: string;
  description?: string;
  status?: RecordStatus;
  metadata?: PermissionMetadata[];
  version?: number;
}

export interface Role {
  id: string;
  roleKey: string;
  roleName: string;
  category: string;
  description: string;
  isSystem: boolean;
  version: number;
  permissionCount?: number;
  groupCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface RoleListItem extends Role {
  rowNumber?: number;
}

export interface CreateRoleInput {
  roleKey: string;
  roleName: string;
  category: string;
  description?: string;
}

export interface UpdateRoleInput {
  roleName?: string;
  category?: string;
  description?: string;
  version?: number;
}

export interface RoleSetupInput extends CreateRoleInput {
  groupIds?: string[];
  permissionIds?: string[];
  replaceAssignments?: boolean;
}

export interface RoleSetupResult {
  role: Role;
  isCreated: boolean;
  groupsAssigned: number;
  groupsRemoved: number;
  permissionsAssigned: number;
  permissionsRemoved: number;
}

export interface Group {
  id: string;
  groupId: string;
  groupName: string;
  category: string;
  description: string;
  status: RecordStatus;
  level: 'ROOT' | 'CHILD';
  parentGroupId: string | null;
  parentGroup?: { id: string; groupId: string; groupName: string } | null;
  tags: string[];
  memberCount?: number;
  roleCount?: number;
  childCount?: number;
  path?: Array<{ id: string; groupId: string; groupName: string }>;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface GroupListItem extends Group {
  rowNumber?: number;
}

export interface CreateGroupInput {
  category: string;
  parentGroupId?: string | null;
  groupId?: string;
  groupName: string;
  description?: string;
  tags?: string[] | string;
  status?: RecordStatus;
}

export interface UpdateGroupInput {
  parentGroupId?: string | null;
  groupName?: string;
  description?: string;
  tags?: string[] | string;
  status?: RecordStatus;
  version?: number;
}

export interface GroupTreeNode {
  id: string;
  groupId: string;
  groupName: string;
  category: string;
  status: RecordStatus;
  level: 'ROOT' | 'CHILD';
  memberCount?: number;
  roleCount?: number;
  children: GroupTreeNode[];
}

export interface PermissionMatrixRole {
  id: string;
  roleKey: string;
  roleName: string;
  isInherited: boolean;
}

export interface PermissionMatrixItem {
  id: string;
  permissionKey: string;
  permissionName: string;
  grantedByRoleIds: string[];
}

export interface PermissionMatrixGridItem {
  module: string;
  action: string;
  isGranted: boolean;
}

export interface PermissionMatrix {
  groupId: string;
  groupName: string;
  roles: PermissionMatrixRole[];
  permissions: PermissionMatrixItem[];
  grid: PermissionMatrixGridItem[];
}

export interface AccessMapping {
  id: string;
  type: MappingType;
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string | null;
  } | null;
  group?: {
    id: string;
    groupId: string;
    groupName: string;
  } | null;
  role?: {
    id: string;
    roleKey: string;
    roleName: string;
  } | null;
  permission?: {
    id: string;
    permissionKey: string;
    permissionName: string;
  } | null;
  expiresAt: string | null;
  isExpired: boolean;
  assignedAt: string;
  assignedBy: string;
}

export interface AccessMappingListItem extends AccessMapping {
  rowNumber?: number;
}

export interface AssignResult {
  assignedCount: number;
  alreadyAssignedIds: string[];
}

export interface RemoveResult {
  removedCount: number;
  notAssignedIds: string[];
}

export interface EffectiveAccess {
  userId: string;
  isSuperAdmin: boolean;
  groups: Array<{ id: string; groupId: string; groupName: string }>;
  roles: Array<{ id: string; roleKey: string; roleName: string }>;
  permissions: Array<{ id: string; permissionKey: string; permissionName: string }>;
}

export interface AuditEntry {
  id: string;
  entity: 'ROLE' | 'PERMISSION' | 'GROUP' | 'ACCESS_MAPPING';
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'ASSIGN' | 'REVOKE';
  entityId: string;
  actorId: string;
  actorEmail?: string;
  ipAddress?: string;
  changes: Record<string, { before: unknown; after: unknown }>;
  timestamp: string;
}

export interface AccessTreeGroup {
  id: string;
  groupId: string;
  groupName: string;
  mappingId: string;
  expiresAt: string | null;
  isExpired: boolean;
  roles: Array<{
    id: string;
    roleKey: string;
    roleName: string;
    mappingId: string;
    expiresAt: string | null;
    isExpired: boolean;
    permissions: Array<{
      id: string;
      permissionKey: string;
      permissionName: string;
      mappingId: string;
      expiresAt: string | null;
      isExpired: boolean;
    }>;
  }>;
}

/** GET /roles/categories item. */
export interface RoleCategory {
  value: string;
  label: string;
  /** SYSTEM: only built-in roles use it. */
  isReserved: boolean;
  /** Added by an admin. */
  isCustom: boolean;
}

/** GET /roles/stats */
export interface RoleStats {
  totalRoles: number;
  /** Given to at least one group. */
  rolesInUse: number;
  customRoles: number;
  systemRoles: number;
  totalPermissions: number;
  permissionsInUse: number;
  rolesWithoutPermissions: number;
  categories: number;
}
