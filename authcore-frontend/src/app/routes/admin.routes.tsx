import type { RouteObject } from 'react-router-dom';

import { paths, routePatterns } from '@/config';

import { lazyPage, type RouteHandle } from './route-handle';

/**
 * Administration area. Real pages are added here as the admin modules are built (Level 2);
 * until then every admin menu item shows a "not built yet" page (planned.routes.tsx).
 */
const PASSWORD_POLICY_CRUMBS = [
  { label: 'Administration' },
  { label: 'Security settings' },
  { label: 'Password policy', href: paths.admin.passwordPolicy },
];

export const adminRoutes: RouteObject[] = [
  {
    path: paths.admin.userCreate,
    handle: {
      title: 'Create user',
      breadcrumb: [{ label: 'Administration' }, { label: 'Users' }, { label: 'Create user' }],
      featureFlag: 'admin.enabled',
      permission: 'USER_CREATE',
    } satisfies RouteHandle,
    lazy: lazyPage(() => import('@/features/admin-users/pages/CreateUserPage'), 'CreateUserPage'),
  },
  {
    path: paths.admin.invites,
    handle: {
      title: 'Invite users',
      breadcrumb: [{ label: 'Administration' }, { label: 'Users' }, { label: 'Invite users' }],
      featureFlag: 'auth.enableInvites',
      permission: 'USER_READ',
    } satisfies RouteHandle,
    lazy: lazyPage(
      () => import('@/features/user-invites/pages/InviteUsersPage'),
      'InviteUsersPage',
    ),
  },
  {
    path: paths.admin.userSchema,
    handle: {
      title: 'Schemas',
      breadcrumb: [
        { label: 'Administration' },
        { label: 'Security settings' },
        { label: 'Schemas' },
      ],
      featureFlag: 'admin.enabled',
      permission: 'USER_SCHEMA_READ',
    } satisfies RouteHandle,
    lazy: lazyPage(() => import('@/features/user-schema/pages/SchemasPage'), 'SchemasPage'),
  },
  {
    path: paths.admin.passwordPolicy,
    handle: {
      title: 'Password policy',
      breadcrumb: [
        { label: 'Administration' },
        { label: 'Security settings' },
        { label: 'Password policy' },
      ],
      featureFlag: 'admin.enabled',
      permission: 'PASSWORD_POLICY_READ',
    } satisfies RouteHandle,
    lazy: lazyPage(
      () => import('@/features/password-policy/pages/PasswordPoliciesPage'),
      'PasswordPoliciesPage',
    ),
  },
  {
    path: paths.admin.passwordPolicyNew,
    handle: {
      title: 'New password policy',
      breadcrumb: [...PASSWORD_POLICY_CRUMBS, { label: 'New policy' }],
      featureFlag: 'admin.enabled',
      permission: 'PASSWORD_POLICY_MANAGE',
    } satisfies RouteHandle,
    lazy: lazyPage(
      () => import('@/features/password-policy/pages/PasswordPolicyEditorPage'),
      'PasswordPolicyEditorPage',
    ),
  },
  {
    path: routePatterns.adminPasswordPolicyEdit,
    handle: {
      title: 'Edit password policy',
      breadcrumb: [...PASSWORD_POLICY_CRUMBS, { label: 'Policy' }],
      featureFlag: 'admin.enabled',
      permission: 'PASSWORD_POLICY_READ',
    } satisfies RouteHandle,
    lazy: lazyPage(
      () => import('@/features/password-policy/pages/PasswordPolicyEditorPage'),
      'PasswordPolicyEditorPage',
    ),
  },
  {
    path: paths.admin.root,
    handle: {
      title: 'Administration',
      breadcrumb: 'Administration',
      featureFlag: 'admin.enabled',
      navGroupId: 'admin',
      description: 'Users, access control, security settings and sign-in activity.',
    } satisfies RouteHandle,
    lazy: lazyPage(() => import('@/pages/PlannedModulePage'), 'PlannedModulePage'),
  },
  {
    path: paths.admin.users,
    handle: {
      title: 'Search users',
      breadcrumb: [{ label: 'Administration' }, { label: 'Users' }, { label: 'Search users' }],
      featureFlag: 'admin.enabled',
      permission: 'USER_READ',
    } satisfies RouteHandle,
    lazy: lazyPage(() => import('@/features/admin-users/pages/UsersListPage'), 'UsersListPage'),
  },
];
