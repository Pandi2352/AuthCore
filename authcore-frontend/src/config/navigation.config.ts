import type { NavGroup } from '@/types/navigation.types';

import { paths } from './paths';

/**
 * Sidebar navigation: the only place modules and pages are listed.
 * - `featureFlag` hides an item when the flag is off (features.config.ts).
 * - `permission` hides it for users without the permission (Level 2, auth).
 * - `status: 'planned'` shows a "not built yet" page until the module exists.
 * Icons: names from config/icons.ts.
 */
export const navigationConfig: NavGroup[] = [
  {
    id: 'main',
    items: [
      {
        id: 'dashboard',
        title: 'Dashboard',
        path: paths.dashboard,
        icon: 'LayoutDashboard',
        match: 'exact',
      },
    ],
  },
  {
    id: 'account',
    title: 'My account',
    items: [
      { id: 'account-profile', title: 'Profile', path: paths.account.profile, icon: 'UserRound' },
      {
        id: 'account-security',
        title: 'Security',
        path: paths.account.security,
        icon: 'ShieldCheck',
      },
      {
        id: 'account-sessions',
        title: 'Sessions',
        path: paths.account.sessions,
        icon: 'MonitorSmartphone',
        featureFlag: 'account.sessionsPage',
      },
      {
        id: 'account-activity',
        title: 'Activity',
        path: paths.account.activity,
        icon: 'History',
        featureFlag: 'account.activityPage',
      },
    ],
  },
  {
    id: 'admin',
    title: 'Administration',
    featureFlag: 'admin.enabled',
    items: [
      {
        id: 'admin-users',
        title: 'Users',
        icon: 'Users',
        permission: 'USER_READ',
        children: [
          {
            id: 'admin-users-list',
            title: 'Search users',
            icon: 'Search',
            path: paths.admin.users,
          },
          {
            id: 'admin-invites',
            title: 'Invite users',
            icon: 'MailPlus',
            path: paths.admin.invites,
            permission: 'USER_INVITE',
            featureFlag: 'auth.enableInvites',
          },
          {
            id: 'admin-user-create',
            title: 'Create user',
            icon: 'UserPlus',
            path: paths.admin.userCreate,
            permission: 'USER_CREATE',
          },
          {
            id: 'admin-users-bulk',
            title: 'Bulk user operations',
            icon: 'Layers',
            path: paths.admin.usersBulk,
            status: 'planned',
            permission: ['USER_CREATE', 'USER_UPDATE'],
          },
        ],
      },
      {
        id: 'admin-access',
        title: 'Access control',
        icon: 'Shield',
        status: 'planned',
        permission: ['ROLE_READ', 'PERMISSION_READ', 'GROUP_READ'],
        children: [
          {
            id: 'admin-roles',
            title: 'Roles',
            path: paths.admin.roles,
            status: 'planned',
            permission: 'ROLE_READ',
          },
          {
            id: 'admin-permissions',
            title: 'Permissions',
            path: paths.admin.permissions,
            status: 'planned',
            permission: 'PERMISSION_READ',
          },
          {
            id: 'admin-groups',
            title: 'Groups',
            path: paths.admin.groups,
            status: 'planned',
            permission: 'GROUP_READ',
          },
          {
            id: 'admin-audit-log',
            title: 'Audit log',
            path: paths.admin.auditLog,
            status: 'planned',
            permission: 'ACCESS_AUDIT_READ',
          },
        ],
      },
      {
        // Settings menu: new settings pages go in as children. Hidden when none is visible.
        id: 'settings',
        title: 'Settings',
        icon: 'Settings',
        children: [
          {
            id: 'settings-appearance',
            title: 'Appearance',
            path: paths.settings.appearance,
            icon: 'Palette',
            featureFlag: 'ui.themeCustomizer',
            // One look for everyone: only the super admin (APPEARANCE_SETTINGS_MANAGE) sets it.
            permission: 'APPEARANCE_SETTINGS_MANAGE',
          },
          {
            id: 'settings-business',
            title: 'Business settings',
            path: paths.settings.business,
            icon: 'Building2',
            permission: 'BUSINESS_SETTINGS_READ',
          },
          {
            id: 'settings-storage',
            title: 'File storage',
            path: paths.settings.storage,
            icon: 'HardDrive',
            permission: 'STORAGE_SETTINGS_READ',
          },
        ],
      },
      {
        id: 'admin-security',
        title: 'Security settings',
        icon: 'Lock',
        permission: ['PASSWORD_POLICY_READ', 'USER_SCHEMA_READ'],
        children: [
          {
            id: 'admin-password-policy',
            title: 'Password policy',
            path: paths.admin.passwordPolicy,
            permission: 'PASSWORD_POLICY_READ',
          },
          {
            id: 'admin-user-schema',
            title: 'Schemas',
            path: paths.admin.userSchema,
            permission: 'USER_SCHEMA_READ',
          },
        ],
      },
      {
        id: 'admin-activity',
        title: 'Activity & sign-ins',
        path: paths.admin.activity,
        icon: 'Activity',
        status: 'planned',
        permission: 'USER_READ',
      },
    ],
  },
];

/** Footer area of the sidebar (help links …); empty = no footer list. */
export const navigationFooterConfig: NavGroup = {
  id: 'footer',
  items: [],
};
