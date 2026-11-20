# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: access\roles.spec.ts >> Roles >> checks the form before saving
- Location: tests\access\roles.spec.ts:76:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('dialog', { name: 'Create role' }).getByRole('alert').filter({ hasText: 'Enter a role key' })
Expected: visible
Timeout: 12000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('dialog', { name: 'Create role' }).getByRole('alert').filter({ hasText: 'Enter a role key' }) with timeout 12000ms
  - waiting for getByRole('dialog', { name: 'Create role' }).getByRole('alert').filter({ hasText: 'Enter a role key' })

```

```yaml
- link "Skip to main content":
  - /url: "#main-content"
- complementary "Sidebar":
  - link "AuthCore home":
    - /url: /dashboard
    - img "AuthCore"
  - navigation "Main":
    - group:
      - list:
        - listitem:
          - link "Dashboard":
            - /url: /dashboard
    - group "Administration":
      - paragraph: Administration
      - list:
        - listitem:
          - button "Users"
          - list "Users":
            - listitem:
              - link "Search users":
                - /url: /admin/users
            - listitem:
              - link "Invite users":
                - /url: /admin/invites
            - listitem:
              - link "Create user":
                - /url: /admin/users/new
            - listitem:
              - link "Bulk user operations":
                - /url: /admin/users/bulk
        - listitem:
          - button "Access control" [expanded]
          - list "Access control":
            - listitem:
              - link "Roles":
                - /url: /admin/access/roles
            - listitem:
              - link "Groups":
                - /url: /admin/access/groups
            - listitem:
              - link "Audit log":
                - /url: /admin/access/audit-log
        - listitem:
          - button "Settings"
          - list "Settings":
            - listitem:
              - link "Appearance":
                - /url: /settings/appearance
            - listitem:
              - link "Business settings":
                - /url: /settings/business
            - listitem:
              - link "File storage":
                - /url: /settings/storage
        - listitem:
          - button "Security settings"
          - list "Security settings":
            - listitem:
              - link "Password policy":
                - /url: /admin/security/password-policy
            - listitem:
              - link "Schemas":
                - /url: /admin/security/schemas
        - listitem:
          - link "Activity & sign-ins":
            - /url: /admin/monitoring/activity
  - 'link "My profile: Playwright Admin"':
    - /url: /profile
    - img "Playwright Admin": PA
    - text: My profile Playwright Admin
- banner:
  - button "Collapse sidebar (Ctrl B)" [expanded]
  - navigation "Breadcrumb":
    - list:
      - listitem: Administration
      - listitem: Access control
      - listitem: Roles
  - button "Search…"
  - button "Full screen"
  - button "Notifications"
  - 'button "Theme: System (switch to Light)"'
  - button "Account menu for Playwright Admin":
    - img "Playwright Admin": PA
    - text: Playwright Admin
- main:
  - heading "Roles" [level=1]
  - paragraph: Create a role, then use the key icon to choose its permissions. Give roles to groups under Groups.
  - button "Create role"
  - paragraph: Total roles
  - paragraph: "3"
  - paragraph: Every role
  - paragraph: Roles in use
  - paragraph: "0"
  - paragraph: Given to at least one group
  - paragraph: Custom roles
  - paragraph: "2"
  - paragraph: Created by admins
  - paragraph: Built-in roles
  - paragraph: "1"
  - paragraph: Fixed, cannot be changed
  - paragraph: Permissions available
  - paragraph: "34"
  - paragraph: That roles can grant
  - paragraph: Permissions in use
  - paragraph: "34"
  - paragraph: Granted by at least one role
  - paragraph: Roles without permissions
  - paragraph: "2"
  - paragraph: Grant nothing yet
  - paragraph: Categories
  - paragraph: "10"
  - paragraph: Built-in and custom
  - region "roles table":
    - searchbox "Search roles by name, key or description"
    - button "Filter by Category": Category
    - button "Refresh the table"
    - table "roles, 3 total, page 1 of 1":
      - caption: roles, 3 total, page 1 of 1
      - rowgroup:
        - row "S.No Resize S.No column (64 px, use left / right arrows) Role Resize Role column (250 px, use left / right arrows) Category Resize Category column (150 px, use left / right arrows) Description Resize Description column (480 px, use left / right arrows) Permissions Resize Permissions column (112 px, use left / right arrows) Updated on Resize Updated on column (200 px, use left / right arrows) Action":
          - columnheader "S.No Resize S.No column (64 px, use left / right arrows)":
            - text: S.No
            - button "Resize S.No column (64 px, use left / right arrows)"
          - columnheader "Role Resize Role column (250 px, use left / right arrows)":
            - button "Role"
            - button "Resize Role column (250 px, use left / right arrows)"
          - columnheader "Category Resize Category column (150 px, use left / right arrows)":
            - button "Category"
            - button "Resize Category column (150 px, use left / right arrows)"
          - columnheader "Description Resize Description column (480 px, use left / right arrows)":
            - text: Description
            - button "Resize Description column (480 px, use left / right arrows)"
          - columnheader "Permissions Resize Permissions column (112 px, use left / right arrows)":
            - text: Permissions
            - button "Resize Permissions column (112 px, use left / right arrows)"
          - columnheader "Updated on Resize Updated on column (200 px, use left / right arrows)":
            - button "Updated on"
            - button "Resize Updated on column (200 px, use left / right arrows)"
          - columnheader "Action"
      - rowgroup:
        - 'row "1 Super Administrator SUPER_ADMIN System Default role with every permission. Built in: cannot be edited or deleted. 34 Nov 20, 2026, 7:55:51 AM Permissions of Super Administrator View Super Administrator Edit Super Administrator (Built-in roles cannot be edited) Delete Super Administrator (Built-in roles cannot be deleted)"':
          - cell "1"
          - cell "Super Administrator SUPER_ADMIN":
            - text: Super Administrator
            - code: SUPER_ADMIN
          - cell "System"
          - 'cell "Default role with every permission. Built in: cannot be edited or deleted."'
          - cell "34"
          - cell "Nov 20, 2026, 7:55:51 AM":
            - time: Nov 20, 2026, 7:55:51 AM
          - cell "Permissions of Super Administrator View Super Administrator Edit Super Administrator (Built-in roles cannot be edited) Delete Super Administrator (Built-in roles cannot be deleted)":
            - button "Permissions of Super Administrator"
            - button "View Super Administrator"
            - button "Edit Super Administrator (Built-in roles cannot be edited)" [disabled]
            - button "Delete Super Administrator (Built-in roles cannot be deleted)" [disabled]
        - row "2 PW Support Lead 1MWOOLL1XI2N ROLE-01 Support Leads the support desk 0 Nov 20, 2026, 7:52:33 AM Permissions of PW Support Lead 1MWOOLL1XI2N View PW Support Lead 1MWOOLL1XI2N Edit PW Support Lead 1MWOOLL1XI2N Delete PW Support Lead 1MWOOLL1XI2N":
          - cell "2"
          - cell "PW Support Lead 1MWOOLL1XI2N ROLE-01":
            - text: PW Support Lead 1MWOOLL1XI2N
            - code: ROLE-01
          - cell "Support"
          - cell "Leads the support desk"
          - cell "0"
          - cell "Nov 20, 2026, 7:52:33 AM":
            - time: Nov 20, 2026, 7:52:33 AM
          - cell "Permissions of PW Support Lead 1MWOOLL1XI2N View PW Support Lead 1MWOOLL1XI2N Edit PW Support Lead 1MWOOLL1XI2N Delete PW Support Lead 1MWOOLL1XI2N":
            - button "Permissions of PW Support Lead 1MWOOLL1XI2N"
            - button "View PW Support Lead 1MWOOLL1XI2N"
            - button "Edit PW Support Lead 1MWOOLL1XI2N"
            - button "Delete PW Support Lead 1MWOOLL1XI2N"
        - row "3 PW Categorised 3MWOOLIEYKQX PW-3MWOOLIEYKQX PW Category 3MWOOLIEYKQX — 0 Nov 20, 2026, 7:52:30 AM Permissions of PW Categorised 3MWOOLIEYKQX View PW Categorised 3MWOOLIEYKQX Edit PW Categorised 3MWOOLIEYKQX Delete PW Categorised 3MWOOLIEYKQX":
          - cell "3"
          - cell "PW Categorised 3MWOOLIEYKQX PW-3MWOOLIEYKQX":
            - text: PW Categorised 3MWOOLIEYKQX
            - code: PW-3MWOOLIEYKQX
          - cell "PW Category 3MWOOLIEYKQX"
          - cell "—"
          - cell "0"
          - cell "Nov 20, 2026, 7:52:30 AM":
            - time: Nov 20, 2026, 7:52:30 AM
          - cell "Permissions of PW Categorised 3MWOOLIEYKQX View PW Categorised 3MWOOLIEYKQX Edit PW Categorised 3MWOOLIEYKQX Delete PW Categorised 3MWOOLIEYKQX":
            - button "Permissions of PW Categorised 3MWOOLIEYKQX"
            - button "View PW Categorised 3MWOOLIEYKQX"
            - button "Edit PW Categorised 3MWOOLIEYKQX"
            - button "Delete PW Categorised 3MWOOLIEYKQX"
    - text: 1–3 of 3 Rows per page
    - combobox "Rows per page": "10"
    - navigation "Pagination":
      - button "First page" [disabled]
      - button "Previous page" [disabled]
      - list:
        - listitem:
          - button "Page 1": "1"
      - button "Next page" [disabled]
      - button "Last page" [disabled]
    - paragraph: Showing 1 to 3 of 3 roles
- region "Notifications":
  - list
- dialog "Create role":
  - heading "Create role" [level=2]
  - paragraph: Name the role, then choose its permissions on the next page.
  - text: Role name (required)
  - textbox "Role name (required)" [invalid]:
    - /placeholder: Enter a role name, e.g. Support Manager
  - alert: Enter a role name
  - text: Role key (required)
  - textbox "Role key (required)":
    - /placeholder: Enter a key, e.g. ROLE-01
    - text: ROLE-03
  - paragraph: "Suggested: the next free ROLE number — change it if you like"
  - text: Category (required)
  - combobox "Category (required)" [invalid]: Choose a category
  - alert: Choose a category
  - text: Description
  - textbox "Description":
    - /placeholder: Describe what people with this role do (optional)
  - button "Cancel"
  - button "Create role"
  - button "Close"
```

# Test source

```ts
  1   | import { uniqueId } from '../support/api';
  2   | import { ROUTES } from '../support/constants';
  3   | import { expect, test } from '../support/fixtures';
  4   | import { rolesData, RolesPage } from '../support/roles';
  5   | 
  6   | /**
  7   |  * Roles (Administration → Access control → Roles): list, create, validation, categories,
  8   |  * edit, delete, permissions, search and filter, built-in role rules.
  9   |  * Each test makes its own roles (keys PW-…) and removes them afterwards.
  10  |  */
  11  | test.describe('Roles', () => {
  12  |   let roles: RolesPage;
  13  |   const made: string[] = [];
  14  | 
  15  |   test.beforeEach(async ({ app }) => {
  16  |     roles = new RolesPage(app.page);
  17  |     await app.open(ROUTES.roles);
  18  |     await expect(roles.heading).toBeVisible();
  19  |   });
  20  | 
  21  |   test.afterEach(async ({ api }) => {
  22  |     for (const id of made.splice(0)) await rolesData.remove(api, id);
  23  |   });
  24  | 
  25  |   test('shows the count cards, the built-in role and its locked actions @smoke', async ({ app }) => {
  26  |     for (const card of ['Total roles', 'Roles in use', 'Custom roles', 'Built-in roles', 'Permissions available', 'Permissions in use', 'Roles without permissions', 'Categories']) {
  27  |       await expect(app.page.getByText(card, { exact: true })).toBeVisible();
  28  |     }
  29  |     await roles.showOnly('SUPER_ADMIN');
  30  |     await expect(roles.row('SUPER_ADMIN')).toContainText('Super Administrator');
  31  |     // Built-in: edit and delete are shown but locked, with the reason.
  32  |     await expect(roles.action('Edit', 'Super Administrator')).toHaveAttribute('aria-disabled', 'true');
  33  |     await expect(roles.action('Edit', 'Super Administrator')).toHaveAccessibleName(/Built-in roles cannot be edited/);
  34  |     await expect(roles.action('Delete', 'Super Administrator')).toHaveAccessibleName(/Built-in roles cannot be deleted/);
  35  |   });
  36  | 
  37  |   test('creates a role with the suggested key, then assigns its permissions', async ({ app, api }, testInfo) => {
  38  |     const name = `PW Support Lead ${uniqueId(testInfo.workerIndex)}`;
  39  |     const { roleKey: suggested } = await api.get<{ roleKey: string }>('/roles/next-key');
  40  | 
  41  |     await roles.createButton.click();
  42  |     const form = roles.dialog('Create role');
  43  |     await expect(form).toBeVisible();
  44  |     // The key is filled in with the next free ROLE number.
  45  |     await expect(form.getByRole('textbox', { name: /^Role key/ })).toHaveValue(suggested);
  46  |     expect(suggested).toMatch(/^ROLE-\d{2,}$/);
  47  | 
  48  |     await form.getByRole('textbox', { name: /^Role name/ }).fill(name);
  49  |     await form.getByRole('combobox', { name: /^Category/ }).click();
  50  |     await app.page.getByRole('option', { name: 'Support' }).click();
  51  |     await form.getByRole('textbox', { name: /^Description/ }).fill('Leads the support desk');
  52  |     await form.getByRole('button', { name: 'Create role' }).click();
  53  | 
  54  |     await expect(roles.toast(`Role “${name}” created`)).toBeVisible();
  55  |     const created = await api.get<{ id: string; roleKey: string; category: string }>(`/roles/key/${suggested}`);
  56  |     made.push(created.id);
  57  |     expect(created.category).toBe('SUPPORT');
  58  | 
  59  |     // A new role grants nothing: its permissions popup opens straight away.
  60  |     const perms = roles.dialog(new RegExp(`Permissions · ${name}`));
  61  |     await expect(perms).toBeVisible();
  62  |     await expect(perms.getByText('No permissions yet')).toBeVisible();
  63  |     await perms.getByRole('tab', { name: /Assign permissions/ }).click();
  64  |     await perms.getByRole('checkbox', { name: 'Select every Business settings permission' }).click();
  65  |     await expect(perms.getByText('2 to add · 0 to remove')).toBeVisible();
  66  |     await perms.getByRole('button', { name: 'Save permissions' }).click();
  67  |     await expect(roles.toast(`Permissions for "${name}" saved`)).toBeVisible();
  68  |     await expect(perms).toBeHidden();
  69  | 
  70  |     await roles.showOnly(name);
  71  |     await expect(roles.row(name)).toContainText(suggested);
  72  |     await expect(roles.row(name)).toContainText('Support');
  73  |     expect((await rolesData.get(api, created.id)).permissionCount).toBe(2);
  74  |   });
  75  | 
  76  |   test('checks the form before saving', async ({ api }, testInfo) => {
  77  |     const existing = await rolesData.create(api, uniqueId(testInfo.workerIndex));
  78  |     made.push(existing.id);
  79  | 
  80  |     await roles.createButton.click();
  81  |     const form = roles.dialog('Create role');
  82  |     const key = form.getByRole('textbox', { name: /^Role key/ });
  83  |     await key.fill('');
  84  |     await form.getByRole('button', { name: 'Create role' }).click();
  85  |     // Field messages are role=alert (announced), which also tells them apart from placeholders.
  86  |     const fieldError = (text: string | RegExp) => form.getByRole('alert').filter({ hasText: text });
  87  |     await expect(fieldError('Enter a role name')).toBeVisible();
> 88  |     await expect(fieldError('Enter a role key')).toBeVisible();
      |                                                  ^ Error: expect(locator).toBeVisible() failed
  89  |     await expect(fieldError('Choose a category')).toBeVisible();
  90  |     await expect(form.getByRole('combobox', { name: /^Category/ })).toHaveAttribute('aria-invalid', 'true');
  91  | 
  92  |     await key.fill('9-BAD KEY');
  93  |     await expect(fieldError(/Use capital letters, digits, _ or -/)).toBeVisible();
  94  | 
  95  |     // A key that is taken: the server says so and the popup stays open.
  96  |     await key.fill(existing.roleKey);
  97  |     await form.getByRole('textbox', { name: /^Role name/ }).fill(`PW Duplicate ${existing.roleKey}`);
  98  |     await form.getByRole('combobox', { name: /^Category/ }).click();
  99  |     await form.page().getByRole('option', { name: 'Operations' }).click();
  100 |     await form.getByRole('button', { name: 'Create role' }).click();
  101 |     await expect(form.page().getByRole('alert').filter({ hasText: `Role key ${existing.roleKey} already exists` }).first()).toBeVisible();
  102 |     await expect(form).toBeVisible();
  103 | 
  104 |     await form.getByRole('button', { name: 'Cancel' }).click();
  105 |     await expect(form).toBeHidden();
  106 |   });
  107 | 
  108 |   test('adds a new category from the category list and uses it', async ({ app, api }, testInfo) => {
  109 |     const uid = uniqueId(testInfo.workerIndex);
  110 |     const categoryName = `PW Category ${uid}`;
  111 |     const roleName = `PW Categorised ${uid}`;
  112 | 
  113 |     await roles.createButton.click();
  114 |     const form = roles.dialog('Create role');
  115 |     await form.getByRole('textbox', { name: /^Role key/ }).fill(`PW-${uid}`);
  116 |     await form.getByRole('textbox', { name: /^Role name/ }).fill(roleName);
  117 |     await form.getByRole('combobox', { name: /^Category/ }).click();
  118 |     await app.page.getByRole('button', { name: 'Add category' }).click();
  119 |     await app.page.getByRole('textbox', { name: 'Add category' }).fill(categoryName);
  120 |     await app.page.getByRole('button', { name: 'Save: Add category' }).click();
  121 | 
  122 |     await expect(roles.toast(`Category “${categoryName}” added`)).toBeVisible();
  123 |     // The new category is chosen at once.
  124 |     await expect(form.getByRole('combobox', { name: /^Category/ })).toContainText(categoryName);
  125 |     await form.getByRole('button', { name: 'Create role' }).click();
  126 |     await expect(roles.toast(`Role “${roleName}” created`)).toBeVisible();
  127 |     const created = await api.get<{ id: string }>(`/roles/key/PW-${uid}`);
  128 |     made.push(created.id);
  129 | 
  130 |     // Close the permissions popup that opens for a new role.
  131 |     await roles.dialog(/Permissions · /).getByRole('button', { name: 'Cancel' }).click();
  132 |     await roles.showOnly(roleName);
  133 |     await expect(roles.row(roleName)).toContainText(categoryName);
  134 | 
  135 |     // It is now in the category filter too.
  136 |     await app.page.getByRole('button', { name: /^Filter by Category/ }).click();
  137 |     await expect(app.page.getByRole('menuitemcheckbox', { name: categoryName })).toBeVisible();
  138 |     await app.page.keyboard.press('Escape');
  139 |   });
  140 | 
  141 |   test('edits a role; its key stays fixed', async ({ api }, testInfo) => {
  142 |     const role = await rolesData.create(api, uniqueId(testInfo.workerIndex));
  143 |     made.push(role.id);
  144 |     const newName = `${role.roleName} renamed`;
  145 |     await roles.showOnly(role.roleKey);
  146 | 
  147 |     await roles.action('Edit', role.roleName).click();
  148 |     const form = roles.dialog('Edit role');
  149 |     await expect(form.getByRole('textbox', { name: /^Role key/ })).toBeDisabled();
  150 |     await expect(form.getByText('Fixed after creation')).toBeVisible();
  151 |     await form.getByRole('textbox', { name: /^Role name/ }).fill(newName);
  152 |     await form.getByRole('textbox', { name: /^Description/ }).fill('Changed by a Playwright test');
  153 |     await form.getByRole('button', { name: 'Save changes' }).click();
  154 | 
  155 |     await expect(roles.toast(`Role “${newName}” saved`)).toBeVisible();
  156 |     await expect(roles.row(role.roleKey)).toContainText(newName);
  157 |     await expect(roles.row(role.roleKey)).toContainText('Changed by a Playwright test');
  158 |     const saved = await rolesData.get(api, role.id);
  159 |     expect(saved.roleName).toBe(newName);
  160 |     expect(saved.roleKey).toBe(role.roleKey);
  161 |   });
  162 | 
  163 |   test('deletes a role only after confirming', async ({ api }, testInfo) => {
  164 |     const role = await rolesData.create(api, uniqueId(testInfo.workerIndex));
  165 |     made.push(role.id);
  166 |     await roles.showOnly(role.roleKey);
  167 | 
  168 |     await roles.action('Delete', role.roleName).click();
  169 |     const confirm = roles.page.getByRole('alertdialog', { name: `Delete role ${role.roleName}?` });
  170 |     await expect(confirm).toBeVisible();
  171 |     await expect(confirm).toContainText('This cannot be undone');
  172 |     await confirm.getByRole('button', { name: 'Cancel' }).click();
  173 |     await expect(confirm).toBeHidden();
  174 |     await expect(roles.row(role.roleKey)).toBeVisible();
  175 | 
  176 |     await roles.action('Delete', role.roleName).click();
  177 |     await confirm.getByRole('button', { name: 'Delete role' }).click();
  178 |     await expect(roles.toast(`Role “${role.roleName}” deleted`)).toBeVisible();
  179 |     await expect(roles.row(role.roleKey)).toBeHidden();
  180 |     await expect(api.get(`/roles/${role.id}`)).rejects.toThrow(/404/);
  181 |   });
  182 | 
  183 |   test('assigns and removes permissions, and warns before losing changes', async ({ api }, testInfo) => {
  184 |     const role = await rolesData.create(api, uniqueId(testInfo.workerIndex));
  185 |     made.push(role.id);
  186 |     await roles.showOnly(role.roleKey);
  187 | 
  188 |     await roles.action('Permissions of', role.roleName).click();
```