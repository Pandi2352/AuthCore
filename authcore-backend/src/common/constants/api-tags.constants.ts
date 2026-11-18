/**
 * Swagger tags = API groups. Use these constants in @ApiTags() so names
 * stay consistent. Add one entry per feature module, in the order it should
 * appear in the docs.
 */
export const API_TAGS = {
  App: { name: 'App', description: 'Application info' },
  Auth: {
    name: 'Auth',
    description: 'Registration and sign-in',
  },
  Password: {
    name: 'Password',
    description: 'Forgot / reset password and change password',
  },
  PasswordPolicy: {
    name: 'Password Policy',
    description:
      'Password rules, expiry and scheduled reminders (admin); requirements and pre-check (public)',
  },
  Roles: { name: 'Roles', description: 'Business roles (access control)' },
  Permissions: {
    name: 'Permissions',
    description: 'Permissions and their metadata (access control)',
  },
  Groups: {
    name: 'Groups',
    description: 'Hierarchical groups: main groups and nested sub-groups, tags',
  },
  AccessMappings: {
    name: 'Access Mapping',
    description:
      'Users ↔ groups, roles ↔ groups, permissions ↔ roles; effective access and audit',
  },
  Account: {
    name: 'My Account',
    description:
      'Profile, preferences, email change, deactivation, deletion and account recovery',
  },
  UserAdmin: {
    name: 'User Administration',
    description:
      'Manage users: list, create, edit, status, password resets, sessions, delete / restore',
  },
  UserInvites: {
    name: 'User Invites',
    description: 'Invite people by email; they accept and create their account',
  },
  BusinessSettings: {
    name: 'Business Settings',
    description:
      'Site name, description, logos and favicon (admin); public branding for every page',
  },
  StorageSettings: {
    name: 'Storage Settings',
    description:
      'File storage providers (local folder, S3, Backblaze B2, Tigris, Supabase, S3-compatible): credentials, test, active provider',
  },
  Uploads: {
    name: 'Uploads',
    description: 'Upload a file to the active storage and get its URL',
  },
  Files: {
    name: 'Files',
    description:
      'Common file uploads: avatars (public) and private documents, stored in a local folder by default',
  },
  UserSchema: {
    name: 'User Schema',
    description:
      'Custom user variables: the fields a user profile has (types, scopes, locales, rules)',
  },
  Sessions: {
    name: 'Sessions',
    description: 'My signed-in devices: list and sign out',
  },
  Health: {
    name: 'Health',
    description: 'Liveness and readiness checks for load balancers',
  },
} as const;

export type ApiTagName = (typeof API_TAGS)[keyof typeof API_TAGS]['name'];
