# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: access\roles.spec.ts >> Roles >> assigns and removes permissions, and warns before losing changes
- Location: tests\access\roles.spec.ts:180:3

# Error details

```
Error: expect(locator).toBeChecked() failed

Locator: getByRole('dialog', { name: /Permissions · PW Role 0MWOOLOA6MIG/ }).getByRole('checkbox', { name: 'View business settings' })
Expected: checked
Timeout: 12000ms
Error: element(s) not found

Call log:
  - Expect "toBeChecked" getByRole('dialog', { name: /Permissions · PW Role 0MWOOLOA6MIG/ }).getByRole('checkbox', { name: 'View business settings' }) with timeout 12000ms
  - waiting for getByRole('dialog', { name: /Permissions · PW Role 0MWOOLOA6MIG/ }).getByRole('checkbox', { name: 'View business settings' })

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
  - paragraph: "4"
  - paragraph: Every role
  - paragraph: Roles in use
  - paragraph: "0"
  - paragraph: Given to at least one group
  - paragraph: Custom roles
  - paragraph: "3"
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
  - paragraph: "8"
  - paragraph: Built-in and custom
  - region "roles table":
    - searchbox "Search roles by name, key or description": PW-0MWOOLOA6MIG
    - button "Clear search"
    - button "Filter by Category": Category
    - button "Refresh the table"
    - region "Active filters":
      - text: "1 active filter Search: “PW-0MWOOLOA6MIG”"
      - 'button "Remove filter Search: “PW-0MWOOLOA6MIG”"'
      - button "Clear all"
    - table "roles, 1 total, page 1 of 1":
      - caption: roles, 1 total, page 1 of 1
      - rowgroup:
        - row "S.No Resize S.No column (64 px, use left / right arrows) Role Resize Role column (204 px, use left / right arrows) Category Resize Category column (150 px, use left / right arrows) Description Resize Description column (480 px, use left / right arrows) Permissions Resize Permissions column (112 px, use left / right arrows) Updated on Resize Updated on column (200 px, use left / right arrows) Action":
          - columnheader "S.No Resize S.No column (64 px, use left / right arrows)":
            - text: S.No
            - button "Resize S.No column (64 px, use left / right arrows)"
          - columnheader "Role Resize Role column (204 px, use left / right arrows)":
            - button "Role"
            - button "Resize Role column (204 px, use left / right arrows)"
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
        - row "1 PW Role 0MWOOLOA6MIG PW-0MWOOLOA6MIG Support Made by a Playwright test 1 Nov 20, 2026, 7:52:35 AM Permissions of PW Role 0MWOOLOA6MIG View PW Role 0MWOOLOA6MIG Edit PW Role 0MWOOLOA6MIG Delete PW Role 0MWOOLOA6MIG":
          - cell "1"
          - cell "PW Role 0MWOOLOA6MIG PW-0MWOOLOA6MIG":
            - text: PW Role 0MWOOLOA6MIG
            - code: PW-0MWOOLOA6MIG
          - cell "Support"
          - cell "Made by a Playwright test"
          - cell "1"
          - cell "Nov 20, 2026, 7:52:35 AM":
            - time: Nov 20, 2026, 7:52:35 AM
          - cell "Permissions of PW Role 0MWOOLOA6MIG View PW Role 0MWOOLOA6MIG Edit PW Role 0MWOOLOA6MIG Delete PW Role 0MWOOLOA6MIG":
            - button "Permissions of PW Role 0MWOOLOA6MIG"
            - button "View PW Role 0MWOOLOA6MIG"
            - button "Edit PW Role 0MWOOLOA6MIG"
            - button "Delete PW Role 0MWOOLOA6MIG"
    - text: 1–1 of 1 Rows per page
    - combobox "Rows per page": "10"
    - navigation "Pagination":
      - button "First page" [disabled]
      - button "Previous page" [disabled]
      - list:
        - listitem:
          - button "Page 1": "1"
      - button "Next page" [disabled]
      - button "Last page" [disabled]
    - paragraph: Showing 1 to 1 of 1 roles
- region "Notifications":
  - list
- dialog "Permissions · PW Role 0MWOOLOA6MIG PW-0MWOOLOA6MIG":
  - heading "Permissions · PW Role 0MWOOLOA6MIG PW-0MWOOLOA6MIG" [level=2]
  - paragraph: See what this role grants and tick more to assign. Members of groups with this role get these permissions.
  - tablist:
    - tab "Assigned 1" [selected]
    - tab "Assign permissions 34"
  - tabpanel "Assigned 1":
    - textbox "Search permissions":
      - /placeholder: Search permissions by name, key or module
    - text: Selected only
    - switch "Selected only"
    - text: 1 of 1 selected
    - button "Clear all"
    - region "Business settings":
      - checkbox "Select every Business settings permission" [checked]
      - button "Business settings 1/1"
  - paragraph: No unsaved changes
  - button "Cancel"
  - button "Save permissions" [disabled]
  - button "Close"
```

# Test source

```ts
  107 |     const categoryName = `PW Category ${uid}`;
  108 |     const roleName = `PW Categorised ${uid}`;
  109 | 
  110 |     await roles.createButton.click();
  111 |     const form = roles.dialog('Create role');
  112 |     await form.getByRole('textbox', { name: /^Role key/ }).fill(`PW-${uid}`);
  113 |     await form.getByRole('textbox', { name: /^Role name/ }).fill(roleName);
  114 |     await form.getByRole('combobox', { name: /^Category/ }).click();
  115 |     await app.page.getByRole('button', { name: 'Add category' }).click();
  116 |     await app.page.getByRole('textbox', { name: 'Add category' }).fill(categoryName);
  117 |     await app.page.getByRole('button', { name: 'Save: Add category' }).click();
  118 | 
  119 |     await expect(roles.toast(`Category “${categoryName}” added`)).toBeVisible();
  120 |     // The new category is chosen at once.
  121 |     await expect(form.getByRole('combobox', { name: /^Category/ })).toContainText(categoryName);
  122 |     await form.getByRole('button', { name: 'Create role' }).click();
  123 |     await expect(roles.toast(`Role “${roleName}” created`)).toBeVisible();
  124 |     const created = await api.get<{ id: string }>(`/roles/key/PW-${uid}`);
  125 |     made.push(created.id);
  126 | 
  127 |     // Close the permissions popup that opens for a new role.
  128 |     await roles.dialog(/Permissions · /).getByRole('button', { name: 'Cancel' }).click();
  129 |     await roles.showOnly(roleName);
  130 |     await expect(roles.row(roleName)).toContainText(categoryName);
  131 | 
  132 |     // It is now in the category filter too.
  133 |     await app.page.getByRole('button', { name: /^Filter by Category/ }).click();
  134 |     await expect(app.page.getByRole('menuitemcheckbox', { name: categoryName })).toBeVisible();
  135 |     await app.page.keyboard.press('Escape');
  136 |   });
  137 | 
  138 |   test('edits a role; its key stays fixed', async ({ api }, testInfo) => {
  139 |     const role = await rolesData.create(api, uniqueId(testInfo.workerIndex));
  140 |     made.push(role.id);
  141 |     const newName = `${role.roleName} renamed`;
  142 |     await roles.showOnly(role.roleKey);
  143 | 
  144 |     await roles.action('Edit', role.roleName).click();
  145 |     const form = roles.dialog('Edit role');
  146 |     await expect(form.getByRole('textbox', { name: /^Role key/ })).toBeDisabled();
  147 |     await expect(form.getByText('Fixed after creation')).toBeVisible();
  148 |     await form.getByRole('textbox', { name: /^Role name/ }).fill(newName);
  149 |     await form.getByRole('textbox', { name: /^Description/ }).fill('Changed by a Playwright test');
  150 |     await form.getByRole('button', { name: 'Save changes' }).click();
  151 | 
  152 |     await expect(roles.toast(`Role “${newName}” saved`)).toBeVisible();
  153 |     await expect(roles.row(role.roleKey)).toContainText(newName);
  154 |     await expect(roles.row(role.roleKey)).toContainText('Changed by a Playwright test');
  155 |     const saved = await rolesData.get(api, role.id);
  156 |     expect(saved.roleName).toBe(newName);
  157 |     expect(saved.roleKey).toBe(role.roleKey);
  158 |   });
  159 | 
  160 |   test('deletes a role only after confirming', async ({ api }, testInfo) => {
  161 |     const role = await rolesData.create(api, uniqueId(testInfo.workerIndex));
  162 |     made.push(role.id);
  163 |     await roles.showOnly(role.roleKey);
  164 | 
  165 |     await roles.action('Delete', role.roleName).click();
  166 |     const confirm = roles.page.getByRole('alertdialog', { name: `Delete role ${role.roleName}?` });
  167 |     await expect(confirm).toBeVisible();
  168 |     await expect(confirm).toContainText('This cannot be undone');
  169 |     await confirm.getByRole('button', { name: 'Cancel' }).click();
  170 |     await expect(confirm).toBeHidden();
  171 |     await expect(roles.row(role.roleKey)).toBeVisible();
  172 | 
  173 |     await roles.action('Delete', role.roleName).click();
  174 |     await confirm.getByRole('button', { name: 'Delete role' }).click();
  175 |     await expect(roles.toast(`Role “${role.roleName}” deleted`)).toBeVisible();
  176 |     await expect(roles.row(role.roleKey)).toBeHidden();
  177 |     await expect(api.get(`/roles/${role.id}`)).rejects.toThrow(/404/);
  178 |   });
  179 | 
  180 |   test('assigns and removes permissions, and warns before losing changes', async ({ api }, testInfo) => {
  181 |     const role = await rolesData.create(api, uniqueId(testInfo.workerIndex));
  182 |     made.push(role.id);
  183 |     await roles.showOnly(role.roleKey);
  184 | 
  185 |     await roles.action('Permissions of', role.roleName).click();
  186 |     const perms = roles.dialog(new RegExp(`Permissions · ${role.roleName}`));
  187 |     await perms.getByRole('tab', { name: /Assign permissions/ }).click();
  188 |     // Search opens the matching module.
  189 |     await perms.getByRole('textbox', { name: 'Search permissions' }).fill('business settings');
  190 |     await perms.getByRole('checkbox', { name: 'View business settings' }).click();
  191 |     await expect(perms.getByText('1 to add · 0 to remove')).toBeVisible();
  192 |     await expect(perms.getByRole('tab', { name: /Assigned/ })).toContainText('1');
  193 | 
  194 |     // Escape with unsaved changes asks first.
  195 |     await roles.page.keyboard.press('Escape');
  196 |     const leave = roles.page.getByRole('alertdialog', { name: 'Close without saving?' });
  197 |     await expect(leave).toBeVisible();
  198 |     await leave.getByRole('button', { name: 'Keep editing' }).click();
  199 |     await expect(perms).toBeVisible();
  200 | 
  201 |     await perms.getByRole('button', { name: 'Save permissions' }).click();
  202 |     await expect(roles.toast(`Permissions for "${role.roleName}" saved`)).toBeVisible();
  203 |     await expect.poll(async () => (await rolesData.get(api, role.id)).permissionCount).toBe(1);
  204 | 
  205 |     // Open again: it is listed under Assigned; untick, then discard the change.
  206 |     await roles.action('Permissions of', role.roleName).click();
> 207 |     await expect(perms.getByRole('checkbox', { name: 'View business settings' })).toBeChecked();
      |                                                                                   ^ Error: expect(locator).toBeChecked() failed
  208 |     await perms.getByRole('checkbox', { name: 'View business settings' }).click();
  209 |     await expect(perms.getByText('0 to add · 1 to remove')).toBeVisible();
  210 |     await perms.getByRole('button', { name: 'Discard' }).click();
  211 |     await expect(perms.getByText('No unsaved changes')).toBeVisible();
  212 | 
  213 |     // Untick and save: removed.
  214 |     await perms.getByRole('checkbox', { name: 'View business settings' }).click();
  215 |     await perms.getByRole('button', { name: 'Save permissions' }).click();
  216 |     await expect(perms).toBeHidden();
  217 |     await expect.poll(async () => (await rolesData.get(api, role.id)).permissionCount).toBe(0);
  218 |   });
  219 | 
  220 |   test('the built-in role’s permissions are read-only', async () => {
  221 |     await roles.showOnly('SUPER_ADMIN');
  222 |     await roles.action('Permissions of', 'Super Administrator').click();
  223 |     const perms = roles.dialog(/Permissions · Super Administrator/);
  224 |     await expect(perms).toBeVisible();
  225 |     await expect(perms.getByRole('tab', { name: /Assign permissions/ })).toHaveCount(0);
  226 |     await expect(perms.getByRole('button', { name: 'Save permissions' })).toHaveCount(0);
  227 |     await perms.getByRole('button', { name: 'Close' }).last().click();
  228 |     await expect(perms).toBeHidden();
  229 |   });
  230 | 
  231 |   test('searches and filters by category', async ({ app, api }, testInfo) => {
  232 |     const uid = uniqueId(testInfo.workerIndex);
  233 |     const support = await rolesData.create(api, `${uid}S`, { roleName: `PW Search ${uid} Support`, category: 'SUPPORT' });
  234 |     const business = await rolesData.create(api, `${uid}B`, { roleName: `PW Search ${uid} Business`, category: 'BUSINESS' });
  235 |     made.push(support.id, business.id);
  236 | 
  237 |     await roles.showOnly(`PW Search ${uid}`);
  238 |     await expect(roles.row(support.roleName)).toBeVisible();
  239 |     await expect(roles.row(business.roleName)).toBeVisible();
  240 | 
  241 |     await app.page.getByRole('button', { name: /^Filter by Category/ }).click();
  242 |     await app.page.getByRole('menuitemcheckbox', { name: 'Business' }).click();
  243 |     await app.page.keyboard.press('Escape');
  244 |     await expect(roles.row(business.roleName)).toBeVisible();
  245 |     await expect(roles.row(support.roleName)).toBeHidden();
  246 | 
  247 |     // By key as well.
  248 |     await roles.search.fill(support.roleKey);
  249 |     await expect(roles.page.getByText(/No roles/).first()).toBeVisible();
  250 |     await app.page.getByRole('button', { name: /^Filter by Category/ }).click();
  251 |     await app.page.getByRole('menuitem', { name: /Clear/ }).click();
  252 |     await expect(roles.row(support.roleName)).toBeVisible();
  253 |   });
  254 | 
  255 |   test('opens a role’s own page', async ({ api }, testInfo) => {
  256 |     const role = await rolesData.create(api, uniqueId(testInfo.workerIndex));
  257 |     made.push(role.id);
  258 |     await roles.showOnly(role.roleKey);
  259 |     await roles.action('View', role.roleName).click();
  260 |     await expect(roles.page).toHaveURL(new RegExp(`/admin/access/roles/${role.id}`));
  261 |     await expect(roles.page.getByRole('heading', { name: role.roleName })).toBeVisible();
  262 |   });
  263 | });
  264 | 
```