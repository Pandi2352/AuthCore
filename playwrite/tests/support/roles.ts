import { expect, type Locator, type Page } from '@playwright/test';

import type { AdminApi } from './api';

/** A role as the API returns it (the fields tests use). */
export interface ApiRole {
  id: string;
  roleKey: string;
  roleName: string;
  category: string;
  description?: string;
  isSystem: boolean;
  permissionCount?: number;
}

interface ApiPermission {
  id: string;
  permissionKey: string;
  permissionName: string;
}

/** Test data helpers (API): quick setup and clean-up around what a test checks on screen. */
export const rolesData = {
  create: (api: AdminApi, uid: string, overrides: Partial<Pick<ApiRole, 'roleName' | 'category' | 'description'>> = {}) =>
    api.post<ApiRole>('/roles', {
      roleKey: `PW-${uid}`,
      roleName: overrides.roleName ?? `PW Role ${uid}`,
      category: overrides.category ?? 'SUPPORT',
      description: overrides.description ?? 'Made by a Playwright test',
    }),

  get: (api: AdminApi, id: string) => api.get<ApiRole>(`/roles/${id}`),

  /** Deletes quietly (already gone is fine). */
  remove: async (api: AdminApi, id: string | undefined) => {
    if (id) await api.delete(`/roles/${id}`).catch(() => undefined);
  },

  /** Deletes every role whose key starts with PW-<uid> (for roles a test made on screen). */
  removeByKey: async (api: AdminApi, roleKey: string) => {
    const role = await api.get<ApiRole>(`/roles/key/${encodeURIComponent(roleKey)}`).catch(() => null);
    if (role) await rolesData.remove(api, role.id);
  },

  permissions: async (api: AdminApi) => {
    const page = await api.get<{ items: ApiPermission[] } | ApiPermission[]>('/permissions?page=1&limit=200');
    return Array.isArray(page) ? page : page.items;
  },

  grant: async (api: AdminApi, roleId: string, permissionKeys: string[]) => {
    const all = await rolesData.permissions(api);
    const ids = all.filter((p) => permissionKeys.includes(p.permissionKey)).map((p) => p.id);
    expect(ids, `permissions ${permissionKeys.join(', ')}`).toHaveLength(permissionKeys.length);
    await api.post('/access-mappings/role-permissions', { roleId, permissionIds: ids });
  },
};

/** The Roles screen (Administration → Access control → Roles). */
export class RolesPage {
  readonly heading: Locator;
  readonly createButton: Locator;
  readonly search: Locator;
  readonly refreshButton: Locator;

  constructor(readonly page: Page) {
    this.heading = page.getByRole('heading', { name: 'Roles', exact: true });
    this.createButton = page.getByRole('button', { name: 'Create role' });
    this.search = page.getByPlaceholder('Search roles by name, key or description');
    this.refreshButton = page.getByRole('button', { name: 'Refresh the table' });
  }

  /** The table row of a role (matched by its name or key). */
  row(text: string): Locator {
    return this.page.getByRole('row').filter({ hasText: text });
  }

  /** A row action: Permissions / View / Edit / Delete. */
  action(kind: 'Permissions of' | 'View' | 'Edit' | 'Delete', roleName: string): Locator {
    return this.page.getByRole('button', { name: new RegExp(`^${kind} ${escapeRegex(roleName)}( \\(|$)`) });
  }

  dialog(title: string | RegExp): Locator {
    return this.page.getByRole('dialog', { name: title });
  }

  toast(text: string | RegExp): Locator {
    return this.page.getByRole('status').filter({ hasText: text });
  }

  /** Reload the table (after data was changed through the API) and narrow it to `text`. */
  async showOnly(text: string): Promise<void> {
    await this.search.fill(text);
    await this.refreshButton.click();
    await expect(this.row(text).first()).toBeVisible();
  }
}

export const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
