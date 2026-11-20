export type RecordStatus = 'ACTIVE' | 'INACTIVE';

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

export interface GroupRef {
  id: string;
  groupId: string;
  groupName: string;
}

/** GET /groups (list item) and GET /groups/:id (details add parent, path, roles …). */
export interface Group {
  id: string;
  groupId: string;
  groupName: string;
  category: string;
  description: string;
  /** 0 = top-level group, 1 = inside a group, … */
  level: number;
  parentGroupId: string | null;
  parentGroupName: string | null;
  tags: string[];
  /** New users join it automatically. */
  isDefault: boolean;
  memberCount?: number;
  roleCount?: number;
  // details only
  childCount?: number;
  parent?: GroupRef | null;
  path?: GroupRef[];
  roles?: Array<{ id: string; roleKey: string; roleName: string }>;
  version?: number;
  createdAt?: string;
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
}

export interface UpdateGroupInput {
  parentGroupId?: string | null;
  groupName?: string;
  category?: string;
  description?: string;
  version?: number;
}

export interface GroupTreeNode {
  id: string;
  groupId: string;
  groupName: string;
  category: string;
  level: number;
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

export type AuditEntityType =
  'ROLE' | 'PERMISSION' | 'GROUP' | 'ACCESS_MAPPING' | 'USER' | 'INVITE' | 'USER_ATTRIBUTE';
export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'ASSIGN' | 'REVOKE';

/** GET /access-control/audit-logs item (same fields as the API). */
export interface AuditEntry {
  id: string;
  entityType: AuditEntityType;
  entityId: string;
  action: AuditAction;
  /** User id of who made it, or "system". */
  changedBy: string;
  changedByName: string | null;
  changedByEmail: string | null;
  /** What changed, in words ("Support Team → Helpdesk Agent"). */
  entityLabel: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
}

/** GET /access-control/audit-logs/stats */
export interface AuditStats {
  total: number;
  last24Hours: number;
  created: number;
  updated: number;
  deleted: number;
  assigned: number;
  revoked: number;
  /** Different people who made changes. */
  people: number;
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

/** GET /groups/categories item (same shape as role categories). */
export type GroupCategory = RoleCategory;

/** GET /groups/stats */
export interface GroupStats {
  totalGroups: number;
  topLevelGroups: number;
  subGroups: number;
  /** Different users in at least one group. */
  members: number;
  groupsWithRoles: number;
  groupsWithoutMembers: number;
  defaultGroups: number;
  categories: number;
}
