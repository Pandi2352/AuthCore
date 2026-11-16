/*
 * Access control: formats, limits, option lists and the system permissions.
 * Categories and actions are code-level lists: add entries here to extend them.
 */

/** Role / permission keys: stored uppercase, e.g. ORG_ADMIN, USER_CREATE. */
export const KEY_PATTERN = /^[A-Z][A-Z0-9_]*$/;
export const ROLE_KEY_MAX_LENGTH = 50;
export const PERMISSION_KEY_MAX_LENGTH = 80;

/** Group IDs (business code): stored uppercase, e.g. GRP-DEV, DEPT:HR_01. */
export const GROUP_ID_PATTERN = /^[A-Z0-9][A-Z0-9_:-]*$/;
export const GROUP_ID_MAX_LENGTH = 40;
export const GROUP_ID_PREFIX = 'GRP-';

/** Tags: letters, digits, '_', '-', ':' only (checked per tag). Stored lowercase. */
export const TAG_PATTERN = /^[A-Za-z0-9_:-]+$/;
export const MAX_TAGS = 20;
export const MAX_TAG_LENGTH = 30;

/** Permission metadata: [{ key, value, action }]. */
export const METADATA_KEY_PATTERN = /^[A-Za-z][A-Za-z0-9_.-]*$/;
/** Plain values only: no markup, quotes or script characters. */
export const METADATA_VALUE_PATTERN = /^[\p{L}\p{N} _.:/*@#-]+$/u;
export const METADATA_KEY_MAX_LENGTH = 50;
export const METADATA_VALUE_MAX_LENGTH = 200;
export const MAX_METADATA_ITEMS = 20;

export const NAME_MAX_LENGTH = 100;
export const DESCRIPTION_MAX_LENGTH = 500;
/** Deepest allowed group nesting (root = level 0). */
export const MAX_GROUP_DEPTH = 10;
/** Max ids in one bulk assign / remove request. */
export const MAX_BULK_ITEMS = 100;
/** Effective-permission cache per user (cleared on every change on this instance). */
export const ACCESS_CACHE_TTL_MS = 30_000;

export const ACCESS_ADMIN_THROTTLE = { limit: 60, ttl: 60_000 } as const;

export interface OptionDefinition {
  value: string;
  label: string;
}

/** SYSTEM is reserved for seeded roles. */
export const SYSTEM_ROLE_CATEGORY = 'SYSTEM';
export const ROLE_CATEGORIES: readonly OptionDefinition[] = [
  { value: SYSTEM_ROLE_CATEGORY, label: 'System' },
  { value: 'ADMINISTRATION', label: 'Administration' },
  { value: 'MANAGEMENT', label: 'Management' },
  { value: 'OPERATIONS', label: 'Operations' },
  { value: 'SUPPORT', label: 'Support' },
  { value: 'BUSINESS', label: 'Business' },
  { value: 'CUSTOM', label: 'Custom' },
];

export const GROUP_CATEGORIES: readonly OptionDefinition[] = [
  { value: 'ORGANIZATION', label: 'Organization' },
  { value: 'DEPARTMENT', label: 'Department' },
  { value: 'TEAM', label: 'Team' },
  { value: 'PROJECT', label: 'Project' },
  { value: 'LOCATION', label: 'Location' },
  { value: 'CUSTOM', label: 'Custom' },
];

export const PERMISSION_ACTIONS: readonly OptionDefinition[] = [
  { value: 'CREATE', label: 'Create' },
  { value: 'READ', label: 'Read' },
  { value: 'UPDATE', label: 'Update' },
  { value: 'DELETE', label: 'Delete' },
  { value: 'LIST', label: 'List' },
  { value: 'EXPORT', label: 'Export' },
  { value: 'APPROVE', label: 'Approve' },
  { value: 'ASSIGN', label: 'Assign' },
  { value: 'MANAGE', label: 'Manage' },
];

export const ROLE_CATEGORY_VALUES = ROLE_CATEGORIES.map((c) => c.value);
export const ASSIGNABLE_ROLE_CATEGORIES = ROLE_CATEGORY_VALUES.filter(
  (c) => c !== SYSTEM_ROLE_CATEGORY,
);
export const GROUP_CATEGORY_VALUES = GROUP_CATEGORIES.map((c) => c.value);
export const PERMISSION_ACTION_VALUES = PERMISSION_ACTIONS.map((a) => a.value);

/** Permissions that protect the access-control APIs themselves. */
export const ACCESS_PERMISSIONS = {
  RoleCreate: 'ROLE_CREATE',
  RoleRead: 'ROLE_READ',
  RoleUpdate: 'ROLE_UPDATE',
  RoleDelete: 'ROLE_DELETE',
  PermissionCreate: 'PERMISSION_CREATE',
  PermissionRead: 'PERMISSION_READ',
  PermissionUpdate: 'PERMISSION_UPDATE',
  PermissionDelete: 'PERMISSION_DELETE',
  GroupCreate: 'GROUP_CREATE',
  GroupRead: 'GROUP_READ',
  GroupUpdate: 'GROUP_UPDATE',
  GroupDelete: 'GROUP_DELETE',
  MappingRead: 'ACCESS_MAPPING_READ',
  MappingAssign: 'ACCESS_MAPPING_ASSIGN',
  MappingRevoke: 'ACCESS_MAPPING_REVOKE',
  AuditRead: 'ACCESS_AUDIT_READ',
} as const;

const SYSTEM_PERMISSION_DETAILS: Record<
  string,
  [name: string, description: string, resource: string, action: string]
> = {
  ROLE_CREATE: ['Create roles', 'Create new roles', 'role', 'CREATE'],
  ROLE_READ: [
    'View roles',
    'List and view roles, role categories and the role dropdown',
    'role',
    'READ',
  ],
  ROLE_UPDATE: [
    'Edit roles',
    'Edit roles and activate / deactivate them',
    'role',
    'UPDATE',
  ],
  ROLE_DELETE: [
    'Delete roles',
    'Delete roles that are not in use',
    'role',
    'DELETE',
  ],
  PERMISSION_CREATE: [
    'Create permissions',
    'Create new permissions',
    'permission',
    'CREATE',
  ],
  PERMISSION_READ: [
    'View permissions',
    'List and view permissions, actions and the permission dropdown',
    'permission',
    'READ',
  ],
  PERMISSION_UPDATE: [
    'Edit permissions',
    'Edit permissions and their metadata',
    'permission',
    'UPDATE',
  ],
  PERMISSION_DELETE: [
    'Delete permissions',
    'Delete permissions that are not in use',
    'permission',
    'DELETE',
  ],
  GROUP_CREATE: [
    'Create groups',
    'Create groups and sub-groups',
    'group',
    'CREATE',
  ],
  GROUP_READ: [
    'View groups',
    'List and view groups, the hierarchy and group dropdowns',
    'group',
    'READ',
  ],
  GROUP_UPDATE: [
    'Edit groups',
    'Edit groups, move them in the hierarchy, activate / deactivate',
    'group',
    'UPDATE',
  ],
  GROUP_DELETE: ['Delete groups', 'Delete empty groups', 'group', 'DELETE'],
  ACCESS_MAPPING_READ: [
    'View access mappings',
    'View who is in which group, group roles, role permissions and effective access',
    'access-mapping',
    'READ',
  ],
  ACCESS_MAPPING_ASSIGN: [
    'Assign access',
    'Add users to groups, roles to groups and permissions to roles',
    'access-mapping',
    'ASSIGN',
  ],
  ACCESS_MAPPING_REVOKE: [
    'Revoke access',
    'Remove users from groups, roles from groups and permissions from roles',
    'access-mapping',
    'DELETE',
  ],
  ACCESS_AUDIT_READ: [
    'View access audit log',
    'View the history of access-control changes',
    'access-audit',
    'READ',
  ],
};

/** Permissions protecting the password-policy APIs. */
export const PASSWORD_POLICY_PERMISSIONS = {
  Read: 'PASSWORD_POLICY_READ',
  Manage: 'PASSWORD_POLICY_MANAGE',
} as const;

const PASSWORD_POLICY_PERMISSION_DETAILS: typeof SYSTEM_PERMISSION_DETAILS = {
  PASSWORD_POLICY_READ: [
    'View password policy',
    'View the password policy, its change history and the reminder scheduler',
    'password-policy',
    'READ',
  ],
  PASSWORD_POLICY_MANAGE: [
    'Manage password policy',
    'Change the password policy and the reminder scheduler, run the reminder job',
    'password-policy',
    'MANAGE',
  ],
};

function toSystemPermissions(
  module: string,
  details: typeof SYSTEM_PERMISSION_DETAILS,
) {
  return Object.entries(details).map(
    ([permissionKey, [permissionName, description, resource, action]]) => ({
      permissionKey,
      permissionName,
      description,
      metadata: [
        { key: 'module', value: module, action },
        { key: 'resource', value: resource, action },
      ],
    }),
  );
}

/** Permissions protecting user administration and invites. */
export const USER_PERMISSIONS = {
  Read: 'USER_READ',
  Create: 'USER_CREATE',
  Update: 'USER_UPDATE',
  Delete: 'USER_DELETE',
  PasswordManage: 'USER_PASSWORD_MANAGE',
  Invite: 'USER_INVITE',
} as const;

const USER_PERMISSION_DETAILS: typeof SYSTEM_PERMISSION_DETAILS = {
  USER_READ: [
    'View users',
    'List and view users, their sessions, groups and invites',
    'user',
    'READ',
  ],
  USER_CREATE: ['Create users', 'Create user accounts', 'user', 'CREATE'],
  USER_UPDATE: [
    'Edit users',
    'Edit users, change their status, unlock them, sign out their sessions',
    'user',
    'UPDATE',
  ],
  USER_DELETE: [
    'Delete users',
    'Delete, restore and permanently delete users',
    'user',
    'DELETE',
  ],
  USER_PASSWORD_MANAGE: [
    'Manage user passwords',
    'Send password resets and force password changes',
    'user',
    'MANAGE',
  ],
  USER_INVITE: [
    'Invite users',
    'Send, resend, revoke and delete invites',
    'user-invite',
    'CREATE',
  ],
};

/** Permissions over other users' files (owners always manage their own). */
export const FILE_PERMISSIONS = {
  Read: 'FILE_READ',
  Delete: 'FILE_DELETE',
} as const;

const FILE_PERMISSION_DETAILS: typeof SYSTEM_PERMISSION_DETAILS = {
  FILE_READ: [
    "View users' files",
    'List, view and download files uploaded by other users',
    'file',
    'READ',
  ],
  FILE_DELETE: [
    "Delete users' files",
    'Delete files uploaded by other users',
    'file',
    'DELETE',
  ],
};

/** Permissions protecting the user schema (custom user variables). */
export const USER_SCHEMA_PERMISSIONS = {
  Read: 'USER_SCHEMA_READ',
  Manage: 'USER_SCHEMA_MANAGE',
} as const;

const USER_SCHEMA_PERMISSION_DETAILS: typeof SYSTEM_PERMISSION_DETAILS = {
  USER_SCHEMA_READ: [
    'View user schema',
    'View the custom user variables',
    'user-schema',
    'READ',
  ],
  USER_SCHEMA_MANAGE: [
    'Manage user schema',
    'Create, edit and delete custom user variables',
    'user-schema',
    'MANAGE',
  ],
};

export const SYSTEM_PERMISSIONS = [
  ...toSystemPermissions('access-control', SYSTEM_PERMISSION_DETAILS),
  ...toSystemPermissions('password-policy', PASSWORD_POLICY_PERMISSION_DETAILS),
  ...toSystemPermissions('users', USER_PERMISSION_DETAILS),
  ...toSystemPermissions('user-schema', USER_SCHEMA_PERMISSION_DETAILS),
  ...toSystemPermissions('files', FILE_PERMISSION_DETAILS),
];

/** Seeded roles: protected, each holding the listed system permissions. */
export const SYSTEM_ROLES = [
  {
    roleKey: 'ACCESS_CONTROL_ADMIN',
    roleName: 'Access Control Administrator',
    category: SYSTEM_ROLE_CATEGORY,
    description:
      'Manages roles, permissions, groups and access mappings. System role: cannot be edited or deleted.',
    permissionKeys: Object.keys(SYSTEM_PERMISSION_DETAILS),
  },
  {
    roleKey: 'PASSWORD_POLICY_ADMIN',
    roleName: 'Password Policy Administrator',
    category: SYSTEM_ROLE_CATEGORY,
    description:
      'Manages the password policy, expiry and reminder scheduler. System role: cannot be edited or deleted.',
    permissionKeys: Object.keys(PASSWORD_POLICY_PERMISSION_DETAILS),
  },
  {
    roleKey: 'USER_ADMIN',
    roleName: 'User Administrator',
    category: SYSTEM_ROLE_CATEGORY,
    description:
      'Manages user accounts and invites. System role: cannot be edited or deleted.',
    permissionKeys: [
      ...Object.keys(USER_PERMISSION_DETAILS),
      ...Object.keys(USER_SCHEMA_PERMISSION_DETAILS),
      ...Object.keys(FILE_PERMISSION_DETAILS),
    ],
  },
];

/** Actor id recorded for seeded data. */
export const SYSTEM_ACTOR = 'system';
