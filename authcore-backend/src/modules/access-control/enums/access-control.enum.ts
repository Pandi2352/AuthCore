/** Lifecycle of roles, permissions and groups. Inactive ones grant nothing and can't be newly assigned. */
export enum RecordStatus {
  Active = 'ACTIVE',
  Inactive = 'INACTIVE',
}

/** The three links of User → Group → Role → Permission. */
export enum MappingType {
  GroupUser = 'GROUP_USER',
  GroupRole = 'GROUP_ROLE',
  RolePermission = 'ROLE_PERMISSION',
}

export enum AuditEntity {
  Role = 'ROLE',
  Permission = 'PERMISSION',
  Group = 'GROUP',
  AccessMapping = 'ACCESS_MAPPING',
  User = 'USER',
  Invite = 'INVITE',
}

export enum AuditAction {
  Create = 'CREATE',
  Update = 'UPDATE',
  Delete = 'DELETE',
  Assign = 'ASSIGN',
  Revoke = 'REVOKE',
}

/** Multiple tag filter: every tag must match, or any of them. */
export enum TagMatchMode {
  All = 'ALL',
  Any = 'ANY',
}
