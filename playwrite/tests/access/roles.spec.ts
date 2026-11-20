import { uniqueId } from '../support/api';
import { ROUTES } from '../support/constants';
import { expect, test } from '../support/fixtures';
import { rolesData, RolesPage } from '../support/roles';

/**
 * Roles (Administration → Access control → Roles): list, create, validation, categories,
 * edit, delete, permissions, search and filter, built-in role rules.
 * Each test makes its own roles (keys PW-…) and removes them afterwards.
 */
test.describe('Roles', () => {
  let roles: RolesPage;
  const made: string[] = [];
  // Keys of roles created on screen: removed even if the test fails before it learns the id.
  const madeKeys: string[] = [];

  test.beforeEach(async ({ app }) => {
    roles = new RolesPage(app.page);
    await app.open(ROUTES.roles);
    await expect(roles.heading).toBeVisible();
  });

  test.afterEach(async ({ api }) => {
    for (const id of made.splice(0)) await rolesData.remove(api, id);
    for (const key of madeKeys.splice(0)) await rolesData.removeByKey(api, key);
  });

  test('shows the count cards, the built-in role and its locked actions @smoke', async ({ app }) => {
    for (const card of ['Total roles', 'Roles in use', 'Custom roles', 'Built-in roles', 'Permissions available', 'Permissions in use', 'Roles without permissions', 'Categories']) {
      await expect(app.page.getByText(card, { exact: true })).toBeVisible();
    }
    await roles.showOnly('SUPER_ADMIN');
    await expect(roles.row('SUPER_ADMIN')).toContainText('Super Administrator');
    // Built-in: edit and delete are shown but locked, with the reason.
    await expect(roles.action('Edit', 'Super Administrator')).toHaveAttribute('aria-disabled', 'true');
    await expect(roles.action('Edit', 'Super Administrator')).toHaveAccessibleName(/Built-in roles cannot be edited/);
    await expect(roles.action('Delete', 'Super Administrator')).toHaveAccessibleName(/Built-in roles cannot be deleted/);
  });

  test('creates a role with the suggested key, then assigns its permissions', async ({ app, api }, testInfo) => {
    const name = `PW Support Lead ${uniqueId(testInfo.workerIndex)}`;
    const { roleKey: suggested } = await api.get<{ roleKey: string }>('/roles/next-key');

    await roles.createButton.click();
    const form = roles.dialog('Create role');
    await expect(form).toBeVisible();
    // The key is filled in with the next free ROLE number.
    await expect(form.getByRole('textbox', { name: /^Role key/ })).toHaveValue(suggested);
    expect(suggested).toMatch(/^ROLE-\d{2,}$/);

    await form.getByRole('textbox', { name: /^Role name/ }).fill(name);
    await form.getByRole('combobox', { name: /^Category/ }).click();
    await app.page.getByRole('option', { name: 'Support' }).click();
    await form.getByRole('textbox', { name: /^Description/ }).fill('Leads the support desk');
    madeKeys.push(suggested);
    await form.getByRole('button', { name: 'Create role' }).click();

    await expect(roles.toast(`Role “${name}” created`)).toBeVisible();
    const created = await api.get<{ id: string; roleKey: string; category: string }>(`/roles/key/${suggested}`);
    made.push(created.id);
    expect(created.category).toBe('SUPPORT');

    // A new role grants nothing: its permissions popup opens straight away.
    const perms = roles.dialog(new RegExp(`Permissions · ${name}`));
    await expect(perms).toBeVisible();
    await expect(perms.getByText('No permissions yet')).toBeVisible();
    await perms.getByRole('tab', { name: /Assign permissions/ }).click();
    await perms.getByRole('checkbox', { name: 'Select every Business settings permission' }).click();
    await expect(perms.getByText('2 to add · 0 to remove')).toBeVisible();
    await perms.getByRole('button', { name: 'Save permissions' }).click();
    await expect(roles.toast(`Permissions for "${name}" saved`)).toBeVisible();
    await expect(perms).toBeHidden();

    await roles.showOnly(name);
    await expect(roles.row(name)).toContainText(suggested);
    await expect(roles.row(name)).toContainText('Support');
    expect((await rolesData.get(api, created.id)).permissionCount).toBe(2);
  });

  test('checks the form before saving', async ({ api }, testInfo) => {
    const existing = await rolesData.create(api, uniqueId(testInfo.workerIndex));
    made.push(existing.id);

    await roles.createButton.click();
    const form = roles.dialog('Create role');
    const key = form.getByRole('textbox', { name: /^Role key/ });
    // The suggested key arrives a moment later and fills an empty field: wait for it first.
    await expect(key).toHaveValue(/^ROLE-\d+$/);
    await key.fill('');
    await form.getByRole('button', { name: 'Create role' }).click();
    // Field messages are role=alert (announced), which also tells them apart from placeholders.
    const fieldError = (text: string | RegExp) => form.getByRole('alert').filter({ hasText: text });
    await expect(fieldError('Enter a role name')).toBeVisible();
    await expect(fieldError('Enter a role key')).toBeVisible();
    await expect(fieldError('Choose a category')).toBeVisible();
    await expect(form.getByRole('combobox', { name: /^Category/ })).toHaveAttribute('aria-invalid', 'true');

    await key.fill('9-BAD KEY');
    await expect(fieldError(/Use capital letters, digits, _ or -/)).toBeVisible();

    // A key that is taken: the server says so and the popup stays open.
    await key.fill(existing.roleKey);
    await form.getByRole('textbox', { name: /^Role name/ }).fill(`PW Duplicate ${existing.roleKey}`);
    await form.getByRole('combobox', { name: /^Category/ }).click();
    await form.page().getByRole('option', { name: 'Operations' }).click();
    await form.getByRole('button', { name: 'Create role' }).click();
    await expect(form.page().getByRole('alert').filter({ hasText: `Role key ${existing.roleKey} already exists` }).first()).toBeVisible();
    await expect(form).toBeVisible();

    await form.getByRole('button', { name: 'Cancel' }).click();
    await expect(form).toBeHidden();
  });

  test('adds a new category from the category list and uses it', async ({ app, api }, testInfo) => {
    const uid = uniqueId(testInfo.workerIndex);
    const categoryName = `PW Category ${uid}`;
    const roleName = `PW Categorised ${uid}`;

    await roles.createButton.click();
    const form = roles.dialog('Create role');
    await form.getByRole('textbox', { name: /^Role key/ }).fill(`PW-${uid}`);
    await form.getByRole('textbox', { name: /^Role name/ }).fill(roleName);
    await form.getByRole('combobox', { name: /^Category/ }).click();
    await app.page.getByRole('button', { name: 'Add category' }).click();
    await app.page.getByRole('textbox', { name: 'Add category' }).fill(categoryName);
    await app.page.getByRole('button', { name: 'Save: Add category' }).click();

    await expect(roles.toast(`Category “${categoryName}” added`)).toBeVisible();
    // The new category is chosen at once.
    await expect(form.getByRole('combobox', { name: /^Category/ })).toContainText(categoryName);
    madeKeys.push(`PW-${uid}`);
    await form.getByRole('button', { name: 'Create role' }).click();
    await expect(roles.toast(`Role “${roleName}” created`)).toBeVisible();
    const created = await api.get<{ id: string }>(`/roles/key/PW-${uid}`);
    made.push(created.id);

    // Close the permissions popup that opens for a new role.
    await roles.dialog(/Permissions · /).getByRole('button', { name: 'Cancel' }).click();
    await roles.showOnly(roleName);
    await expect(roles.row(roleName)).toContainText(categoryName);

    // It is now in the category filter too.
    await app.page.getByRole('button', { name: /^Filter by Category/ }).click();
    await expect(app.page.getByRole('menuitemcheckbox', { name: categoryName })).toBeVisible();
    await app.page.keyboard.press('Escape');
  });

  test('edits a role; its key stays fixed', async ({ api }, testInfo) => {
    const role = await rolesData.create(api, uniqueId(testInfo.workerIndex));
    made.push(role.id);
    const newName = `${role.roleName} renamed`;
    await roles.showOnly(role.roleKey);

    await roles.action('Edit', role.roleName).click();
    const form = roles.dialog('Edit role');
    await expect(form.getByRole('textbox', { name: /^Role key/ })).toBeDisabled();
    await expect(form.getByText('Fixed after creation')).toBeVisible();
    await form.getByRole('textbox', { name: /^Role name/ }).fill(newName);
    await form.getByRole('textbox', { name: /^Description/ }).fill('Changed by a Playwright test');
    await form.getByRole('button', { name: 'Save changes' }).click();

    await expect(roles.toast(`Role “${newName}” saved`)).toBeVisible();
    await expect(roles.row(role.roleKey)).toContainText(newName);
    await expect(roles.row(role.roleKey)).toContainText('Changed by a Playwright test');
    const saved = await rolesData.get(api, role.id);
    expect(saved.roleName).toBe(newName);
    expect(saved.roleKey).toBe(role.roleKey);
  });

  test('deletes a role only after confirming', async ({ api }, testInfo) => {
    const role = await rolesData.create(api, uniqueId(testInfo.workerIndex));
    made.push(role.id);
    await roles.showOnly(role.roleKey);

    await roles.action('Delete', role.roleName).click();
    const confirm = roles.page.getByRole('alertdialog', { name: `Delete role ${role.roleName}?` });
    await expect(confirm).toBeVisible();
    await expect(confirm).toContainText('This cannot be undone');
    await confirm.getByRole('button', { name: 'Cancel' }).click();
    await expect(confirm).toBeHidden();
    await expect(roles.row(role.roleKey)).toBeVisible();

    await roles.action('Delete', role.roleName).click();
    await confirm.getByRole('button', { name: 'Delete role' }).click();
    await expect(roles.toast(`Role “${role.roleName}” deleted`)).toBeVisible();
    await expect(roles.row(role.roleKey)).toBeHidden();
    await expect(api.get(`/roles/${role.id}`)).rejects.toThrow(/404/);
  });

  test('assigns and removes permissions, and warns before losing changes', async ({ api }, testInfo) => {
    const role = await rolesData.create(api, uniqueId(testInfo.workerIndex));
    made.push(role.id);
    await roles.showOnly(role.roleKey);

    await roles.action('Permissions of', role.roleName).click();
    const perms = roles.dialog(new RegExp(`Permissions · ${role.roleName}`));
    await perms.getByRole('tab', { name: /Assign permissions/ }).click();
    // Search opens the matching module.
    await perms.getByRole('textbox', { name: 'Search permissions' }).fill('business settings');
    await perms.getByRole('checkbox', { name: 'View business settings' }).click();
    await expect(perms.getByText('1 to add · 0 to remove')).toBeVisible();
    await expect(perms.getByRole('tab', { name: /Assigned/ })).toContainText('1');

    // Escape with unsaved changes asks first.
    await roles.page.keyboard.press('Escape');
    const leave = roles.page.getByRole('alertdialog', { name: 'Close without saving?' });
    await expect(leave).toBeVisible();
    await leave.getByRole('button', { name: 'Keep editing' }).click();
    await expect(perms).toBeVisible();

    await perms.getByRole('button', { name: 'Save permissions' }).click();
    await expect(roles.toast(`Permissions for "${role.roleName}" saved`)).toBeVisible();
    await expect.poll(async () => (await rolesData.get(api, role.id)).permissionCount).toBe(1);

    // Open again: it is listed under Assigned (modules start collapsed); untick, then discard.
    await roles.action('Permissions of', role.roleName).click();
    await expect(perms.getByRole('tab', { name: /Assigned/ })).toHaveAttribute('aria-selected', 'true');
    await perms.getByRole('button', { name: /Business settings/ }).click();
    await expect(perms.getByRole('checkbox', { name: 'View business settings' })).toBeChecked();
    await perms.getByRole('checkbox', { name: 'View business settings' }).click();
    await expect(perms.getByText('0 to add · 1 to remove')).toBeVisible();
    await perms.getByRole('button', { name: 'Discard' }).click();
    await expect(perms.getByText('No unsaved changes')).toBeVisible();

    // Untick and save: removed.
    await perms.getByRole('checkbox', { name: 'View business settings' }).click();
    await perms.getByRole('button', { name: 'Save permissions' }).click();
    await expect(perms).toBeHidden();
    await expect.poll(async () => (await rolesData.get(api, role.id)).permissionCount).toBe(0);
  });

  test('the built-in role’s permissions are read-only', async () => {
    await roles.showOnly('SUPER_ADMIN');
    await roles.action('Permissions of', 'Super Administrator').click();
    const perms = roles.dialog(/Permissions · Super Administrator/);
    await expect(perms).toBeVisible();
    await expect(perms.getByRole('tab', { name: /Assign permissions/ })).toHaveCount(0);
    await expect(perms.getByRole('button', { name: 'Save permissions' })).toHaveCount(0);
    await perms.getByRole('button', { name: 'Close' }).last().click();
    await expect(perms).toBeHidden();
  });

  test('searches and filters by category', async ({ app, api }, testInfo) => {
    const uid = uniqueId(testInfo.workerIndex);
    const support = await rolesData.create(api, `${uid}S`, { roleName: `PW Search ${uid} Support`, category: 'SUPPORT' });
    const business = await rolesData.create(api, `${uid}B`, { roleName: `PW Search ${uid} Business`, category: 'BUSINESS' });
    made.push(support.id, business.id);

    await roles.showOnly(`PW Search ${uid}`);
    await expect(roles.row(support.roleName)).toBeVisible();
    await expect(roles.row(business.roleName)).toBeVisible();

    await app.page.getByRole('button', { name: /^Filter by Category/ }).click();
    await app.page.getByRole('menuitemcheckbox', { name: 'Business' }).click();
    await app.page.keyboard.press('Escape');
    await expect(roles.row(business.roleName)).toBeVisible();
    await expect(roles.row(support.roleName)).toBeHidden();

    // By key as well.
    await roles.search.fill(support.roleKey);
    await expect(roles.page.getByText(/No roles/).first()).toBeVisible();
    await app.page.getByRole('button', { name: /^Filter by Category/ }).click();
    await app.page.getByRole('menuitem', { name: /Clear/ }).click();
    await expect(roles.row(support.roleName)).toBeVisible();
  });

  test('opens a role’s own page', async ({ api }, testInfo) => {
    const role = await rolesData.create(api, uniqueId(testInfo.workerIndex));
    made.push(role.id);
    await roles.showOnly(role.roleKey);
    await roles.action('View', role.roleName).click();
    await expect(roles.page).toHaveURL(new RegExp(`/admin/access/roles/${role.id}`));
    await expect(roles.page.getByRole('heading', { name: role.roleName })).toBeVisible();
  });
});
