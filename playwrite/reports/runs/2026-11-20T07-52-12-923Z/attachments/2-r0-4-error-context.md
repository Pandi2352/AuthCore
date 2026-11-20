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

Locator: getByRole('dialog', { name: 'Create role' }).getByText('Choose a category')
Expected: visible
Error: strict mode violation: getByRole('dialog', { name: 'Create role' }).getByText('Choose a category') resolved to 2 elements:
    1) <span class="min-w-0 flex-1 truncate text-muted-foreground">Choose a category</span> aka getByRole('combobox', { name: 'Category (required)' })
    2) <span>Choose a category</span> aka locator('[id="_r_1k_-error"]').getByText('Choose a category')

Call log:
  - Expect "toBeVisible" getByRole('dialog', { name: 'Create role' }).getByText('Choose a category') with timeout 12000ms
  - waiting for getByRole('dialog', { name: 'Create role' }).getByText('Choose a category')

```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e2]:
    - link "Skip to main content" [ref=e3] [cursor=pointer]:
      - /url: "#main-content"
    - generic [ref=e4]:
      - complementary "Sidebar" [ref=e5]:
        - link "AuthCore home" [ref=e7] [cursor=pointer]:
          - /url: /dashboard
          - img "AuthCore" [ref=e8]
        - navigation "Main" [ref=e9]:
          - group [ref=e10]:
            - list [ref=e11]:
              - listitem [ref=e12]:
                - link "Dashboard" [ref=e13] [cursor=pointer]:
                  - /url: /dashboard
          - group "Administration" [ref=e20]:
            - paragraph [ref=e21]: Administration
            - list [ref=e22]:
              - listitem [ref=e23]:
                - button "Users" [ref=e24] [cursor=pointer]
                - list "Users" [ref=e33]:
                  - listitem [aria-hidden] [ref=e34]
                  - listitem [ref=e35]:
                    - link "Search users" [ref=e36] [cursor=pointer]:
                      - /url: /admin/users
                  - listitem [ref=e38]:
                    - link "Invite users" [ref=e39] [cursor=pointer]:
                      - /url: /admin/invites
                  - listitem [ref=e41]:
                    - link "Create user" [ref=e42] [cursor=pointer]:
                      - /url: /admin/users/new
                  - listitem [ref=e44]:
                    - link "Bulk user operations" [ref=e45] [cursor=pointer]:
                      - /url: /admin/users/bulk
                  - listitem [aria-hidden] [ref=e47]
              - listitem [ref=e48]:
                - button "Access control" [expanded] [ref=e49] [cursor=pointer]
                - list "Access control" [ref=e57]:
                  - listitem [aria-hidden] [ref=e58]
                  - listitem [ref=e59]:
                    - link "Roles" [ref=e60] [cursor=pointer]:
                      - /url: /admin/access/roles
                  - listitem [ref=e63]:
                    - link "Groups" [ref=e64] [cursor=pointer]:
                      - /url: /admin/access/groups
                  - listitem [ref=e66]:
                    - link "Audit log" [ref=e67] [cursor=pointer]:
                      - /url: /admin/access/audit-log
                  - listitem [aria-hidden] [ref=e69]
              - listitem [ref=e70]:
                - button "Settings" [ref=e71] [cursor=pointer]
                - list "Settings" [ref=e78]:
                  - listitem [aria-hidden] [ref=e79]
                  - listitem [ref=e80]:
                    - link "Appearance" [ref=e81] [cursor=pointer]:
                      - /url: /settings/appearance
                  - listitem [ref=e83]:
                    - link "Business settings" [ref=e84] [cursor=pointer]:
                      - /url: /settings/business
                  - listitem [ref=e86]:
                    - link "File storage" [ref=e87] [cursor=pointer]:
                      - /url: /settings/storage
                  - listitem [aria-hidden] [ref=e89]
              - listitem [ref=e90]:
                - button "Security settings" [ref=e91] [cursor=pointer]
                - list "Security settings" [ref=e98]:
                  - listitem [aria-hidden] [ref=e99]
                  - listitem [ref=e100]:
                    - link "Password policy" [ref=e101] [cursor=pointer]:
                      - /url: /admin/security/password-policy
                  - listitem [ref=e103]:
                    - link "Schemas" [ref=e104] [cursor=pointer]:
                      - /url: /admin/security/schemas
                  - listitem [aria-hidden] [ref=e106]
              - listitem [ref=e107]:
                - link "Activity & sign-ins" [ref=e108] [cursor=pointer]:
                  - /url: /admin/monitoring/activity
        - 'link "My profile: Playwright Admin" [ref=e113] [cursor=pointer]':
          - /url: /profile
          - img "Playwright Admin" [ref=e116]: PA
          - generic [ref=e117]:
            - generic [ref=e118]: My profile
            - generic [ref=e119]: Playwright Admin
      - generic [ref=e122]:
        - banner [ref=e123]:
          - generic [ref=e124]:
            - button "Collapse sidebar (Ctrl B)" [expanded] [ref=e125] [cursor=pointer]
            - navigation "Breadcrumb" [ref=e127]:
              - list [ref=e128]:
                - listitem [ref=e129]:
                  - generic [ref=e130]: Administration
                - listitem [aria-hidden] [ref=e131]
                - listitem [ref=e134]:
                  - generic [ref=e135]: Access control
                - listitem [aria-hidden] [ref=e136]
                - listitem [ref=e139]:
                  - generic [ref=e140]: Roles
          - button "Search…" [ref=e142] [cursor=pointer]:
            - generic [aria-hidden] [ref=e147]:
              - generic [ref=e148]: Ctrl
              - generic [ref=e149]: K
          - generic [ref=e150]:
            - button "Full screen" [ref=e152] [cursor=pointer]
            - button "Notifications" [ref=e159] [cursor=pointer]
            - 'button "Theme: System (switch to Light)" [ref=e164] [cursor=pointer]'
            - button "Account menu for Playwright Admin" [ref=e168] [cursor=pointer]:
              - img "Playwright Admin" [ref=e171]: PA
              - generic [ref=e172]: Playwright Admin
        - main [ref=e173]:
          - generic [ref=e175]:
            - generic [ref=e177]:
              - generic [ref=e178]:
                - heading "Roles" [level=1] [ref=e180]
                - paragraph [ref=e181]: Create a role, then use the key icon to choose its permissions. Give roles to groups under Groups.
              - button "Create role" [ref=e183] [cursor=pointer]
            - generic [ref=e185]:
              - generic [ref=e190]:
                - paragraph [ref=e191]: Total roles
                - paragraph [ref=e192]: "1"
                - paragraph [ref=e193]: Every role
              - generic [ref=e200]:
                - paragraph [ref=e201]: Roles in use
                - paragraph [ref=e202]: "0"
                - paragraph [ref=e203]: Given to at least one group
              - generic [ref=e209]:
                - paragraph [ref=e210]: Custom roles
                - paragraph [ref=e211]: "0"
                - paragraph [ref=e212]: Created by admins
              - generic [ref=e218]:
                - paragraph [ref=e219]: Built-in roles
                - paragraph [ref=e220]: "1"
                - paragraph [ref=e221]: Fixed, cannot be changed
              - generic [ref=e227]:
                - paragraph [ref=e228]: Permissions available
                - paragraph [ref=e229]: "34"
                - paragraph [ref=e230]: That roles can grant
              - generic [ref=e236]:
                - paragraph [ref=e237]: Permissions in use
                - paragraph [ref=e238]: "34"
                - paragraph [ref=e239]: Granted by at least one role
              - generic [ref=e245]:
                - paragraph [ref=e246]: Roles without permissions
                - paragraph [ref=e247]: "0"
                - paragraph [ref=e248]: Grant nothing yet
              - generic [ref=e255]:
                - paragraph [ref=e256]: Categories
                - paragraph [ref=e257]: "7"
                - paragraph [ref=e258]: Built-in and custom
            - region "roles table" [ref=e259]:
              - generic [ref=e260]:
                - searchbox "Search roles by name, key or description" [ref=e267]
                - button "Filter by Category" [ref=e268] [cursor=pointer]:
                  - generic [ref=e269]: Category
                - button "Refresh the table" [ref=e273] [cursor=pointer]
              - table "roles, 1 total, page 1 of 1" [ref=e281]:
                - caption [ref=e282]: roles, 1 total, page 1 of 1
                - rowgroup [ref=e291]:
                  - row [ref=e292]:
                    - columnheader "S.No Resize S.No column (64 px, use left / right arrows)" [ref=e293]:
                      - generic [ref=e294]: S.No
                      - button "Resize S.No column (64 px, use left / right arrows)" [ref=e295]
                    - columnheader "Role Resize Role column (159 px, use left / right arrows)" [ref=e296]:
                      - button "Role" [ref=e297] [cursor=pointer]
                      - button "Resize Role column (159 px, use left / right arrows)" [ref=e302]
                    - columnheader "Category Resize Category column (150 px, use left / right arrows)" [ref=e303]:
                      - button "Category" [ref=e304] [cursor=pointer]
                      - button "Resize Category column (150 px, use left / right arrows)" [ref=e309]
                    - columnheader "Description Resize Description column (480 px, use left / right arrows)" [ref=e310]:
                      - generic [ref=e311]: Description
                      - button "Resize Description column (480 px, use left / right arrows)" [ref=e312]
                    - columnheader "Permissions Resize Permissions column (112 px, use left / right arrows)" [ref=e313]:
                      - generic [ref=e314]: Permissions
                      - button "Resize Permissions column (112 px, use left / right arrows)" [ref=e315]
                    - columnheader "Updated on Resize Updated on column (200 px, use left / right arrows)" [ref=e316]:
                      - button "Updated on" [ref=e317] [cursor=pointer]
                      - button "Resize Updated on column (200 px, use left / right arrows)" [ref=e322]
                    - columnheader "Action" [ref=e323]
                - rowgroup [ref=e324]:
                  - row [ref=e325] [cursor=pointer]:
                    - cell "1" [ref=e326]
                    - cell "Super Administrator SUPER_ADMIN" [ref=e327]:
                      - generic [ref=e328]:
                        - generic [ref=e329]: Super Administrator
                        - code [ref=e330]: SUPER_ADMIN
                    - cell "System" [ref=e331]
                    - 'cell "Default role with every permission. Built in: cannot be edited or deleted." [ref=e333]'
                    - cell "34" [ref=e335]
                    - cell [ref=e340]:
                      - time [ref=e341]: Nov 20, 2026, 7:38:29 AM
                    - cell [ref=e342]:
                      - generic [ref=e343]:
                        - button "Permissions of Super Administrator" [ref=e344]
                        - button "View Super Administrator" [ref=e348]
                        - button "Edit Super Administrator (Built-in roles cannot be edited)" [disabled] [ref=e356]
                        - button "Delete Super Administrator (Built-in roles cannot be deleted)" [disabled] [ref=e360]
              - generic [ref=e364]:
                - generic [ref=e365]:
                  - generic [ref=e366]: 1–1 of 1
                  - generic [ref=e367]:
                    - generic [ref=e368]: Rows per page
                    - combobox "Rows per page" [ref=e371] [cursor=pointer]:
                      - generic [ref=e372]: "10"
                - navigation "Pagination" [ref=e375]:
                  - button "First page" [disabled]
                  - button "Previous page" [disabled]
                  - list [ref=e376]:
                    - listitem [ref=e377]:
                      - button "Page 1" [ref=e378] [cursor=pointer]: "1"
                  - button "Next page" [disabled]
                  - button "Last page" [disabled]
              - paragraph [ref=e379]: Showing 1 to 1 of 1 roles
  - region "Notifications":
    - list
  - dialog "Create role" [ref=e381]:
    - generic [ref=e382]:
      - heading "Create role" [level=2] [ref=e383]
      - paragraph [ref=e384]: Name the role, then choose its permissions on the next page.
    - generic [ref=e385]:
      - generic [ref=e386]:
        - generic [ref=e387]:
          - generic [ref=e388]:
            - generic [ref=e389] [cursor=pointer]:
              - text: Role name
              - generic [ref=e390]:
                - text: "*"
                - generic [ref=e391]: (required)
            - textbox "Role name (required)" [invalid] [ref=e392]:
              - /placeholder: Enter a role name, e.g. Support Manager
            - alert [ref=e393]:
              - generic [ref=e396]: Enter a role name
          - generic [ref=e397]:
            - generic [ref=e398] [cursor=pointer]:
              - text: Role key
              - generic [ref=e399]:
                - text: "*"
                - generic [ref=e400]: (required)
            - textbox "Role key (required)" [invalid] [ref=e401]:
              - /placeholder: Enter a key, e.g. ROLE-01
            - alert [ref=e402]:
              - generic [ref=e405]: Enter a role key
        - generic [ref=e406]:
          - generic [ref=e407] [cursor=pointer]:
            - text: Category
            - generic [ref=e408]:
              - text: "*"
              - generic [ref=e409]: (required)
          - combobox "Category (required)" [invalid] [ref=e411] [cursor=pointer]:
            - generic [ref=e412]: Choose a category
          - alert [ref=e415]:
            - generic [ref=e418]: Choose a category
        - generic [ref=e419]:
          - generic [ref=e420] [cursor=pointer]: Description
          - textbox "Description" [ref=e422]:
            - /placeholder: Describe what people with this role do (optional)
      - generic [ref=e423]:
        - button "Cancel" [ref=e424] [cursor=pointer]
        - button "Create role" [active] [ref=e425] [cursor=pointer]
    - button "Close" [ref=e427] [cursor=pointer]
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
  85  |     await expect(form.getByText('Enter a role name')).toBeVisible();
  86  |     await expect(form.getByText('Enter a role key')).toBeVisible();
> 87  |     await expect(form.getByText('Choose a category')).toBeVisible();
      |                                                       ^ Error: expect(locator).toBeVisible() failed
  88  | 
  89  |     await key.fill('9-BAD KEY');
  90  |     await expect(form.getByText(/Use capital letters, digits, _ or -/)).toBeVisible();
  91  | 
  92  |     // A key that is taken: the server says so and the popup stays open.
  93  |     await key.fill(existing.roleKey);
  94  |     await form.getByRole('textbox', { name: /^Role name/ }).fill(`PW Duplicate ${existing.roleKey}`);
  95  |     await form.getByRole('combobox', { name: /^Category/ }).click();
  96  |     await form.page().getByRole('option', { name: 'Operations' }).click();
  97  |     await form.getByRole('button', { name: 'Create role' }).click();
  98  |     await expect(form.page().getByRole('alert').filter({ hasText: `Role key ${existing.roleKey} already exists` }).first()).toBeVisible();
  99  |     await expect(form).toBeVisible();
  100 | 
  101 |     await form.getByRole('button', { name: 'Cancel' }).click();
  102 |     await expect(form).toBeHidden();
  103 |   });
  104 | 
  105 |   test('adds a new category from the category list and uses it', async ({ app, api }, testInfo) => {
  106 |     const uid = uniqueId(testInfo.workerIndex);
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
```