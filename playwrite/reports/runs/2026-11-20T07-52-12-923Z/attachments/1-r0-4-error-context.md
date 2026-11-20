# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: access\roles.spec.ts >> Roles >> creates a role with the suggested key, then assigns its permissions
- Location: tests\access\roles.spec.ts:37:3

# Error details

```
Error: GET /roles/key/ROLE-01 → 400: Invalid role key
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
                - paragraph [ref=e192]: "4"
                - paragraph [ref=e193]: Every role
              - generic [ref=e200]:
                - paragraph [ref=e201]: Roles in use
                - paragraph [ref=e202]: "0"
                - paragraph [ref=e203]: Given to at least one group
              - generic [ref=e209]:
                - paragraph [ref=e210]: Custom roles
                - paragraph [ref=e211]: "3"
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
                - paragraph [ref=e247]: "3"
                - paragraph [ref=e248]: Grant nothing yet
              - generic [ref=e255]:
                - paragraph [ref=e256]: Categories
                - paragraph [ref=e257]: "8"
                - paragraph [ref=e258]: Built-in and custom
            - region "roles table" [ref=e259]:
              - generic [ref=e260]:
                - searchbox "Search roles by name, key or description" [ref=e267]
                - button "Filter by Category" [ref=e268] [cursor=pointer]:
                  - generic [ref=e269]: Category
                - button "Refresh the table" [ref=e273] [cursor=pointer]
              - table "roles, 4 total, page 1 of 1" [ref=e281]:
                - caption [ref=e282]: roles, 4 total, page 1 of 1
                - rowgroup [ref=e291]:
                  - row [ref=e292]:
                    - columnheader "S.No Resize S.No column (64 px, use left / right arrows)" [ref=e293]:
                      - generic [ref=e294]: S.No
                      - button "Resize S.No column (64 px, use left / right arrows)" [ref=e295]
                    - columnheader "Role Resize Role column (250 px, use left / right arrows)" [ref=e296]:
                      - button "Role" [ref=e297] [cursor=pointer]
                      - button "Resize Role column (250 px, use left / right arrows)" [ref=e302]
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
                    - cell "PW Support Lead 1MWOOLL1XI2N ROLE-01" [ref=e327]:
                      - generic [ref=e328]:
                        - generic [ref=e329]: PW Support Lead 1MWOOLL1XI2N
                        - code [ref=e330]: ROLE-01
                    - cell "Support" [ref=e331]
                    - cell "Leads the support desk" [ref=e333]
                    - cell "0" [ref=e335]
                    - cell [ref=e340]:
                      - time [ref=e341]: Nov 20, 2026, 7:52:33 AM
                    - cell [ref=e342]:
                      - generic [ref=e343]:
                        - button "Permissions of PW Support Lead 1MWOOLL1XI2N" [ref=e344]
                        - button "View PW Support Lead 1MWOOLL1XI2N" [ref=e348]
                        - button "Edit PW Support Lead 1MWOOLL1XI2N" [ref=e356]
                        - button "Delete PW Support Lead 1MWOOLL1XI2N" [ref=e360]
                  - row [ref=e364] [cursor=pointer]:
                    - cell "2" [ref=e365]
                    - cell "PW Role 0MWOOLM0LIOL PW-0MWOOLM0LIOL" [ref=e366]:
                      - generic [ref=e367]:
                        - generic [ref=e368]: PW Role 0MWOOLM0LIOL
                        - code [ref=e369]: PW-0MWOOLM0LIOL
                    - cell "Support" [ref=e370]
                    - cell "Made by a Playwright test" [ref=e372]
                    - cell "0" [ref=e374]
                    - cell [ref=e379]:
                      - time [ref=e380]: Nov 20, 2026, 7:52:32 AM
                    - cell [ref=e381]:
                      - generic [ref=e382]:
                        - button "Permissions of PW Role 0MWOOLM0LIOL" [ref=e383]
                        - button "View PW Role 0MWOOLM0LIOL" [ref=e387]
                        - button "Edit PW Role 0MWOOLM0LIOL" [ref=e395]
                        - button "Delete PW Role 0MWOOLM0LIOL" [ref=e399]
                  - row [ref=e403] [cursor=pointer]:
                    - cell "3" [ref=e404]
                    - cell "PW Categorised 3MWOOLIEYKQX PW-3MWOOLIEYKQX" [ref=e405]:
                      - generic [ref=e406]:
                        - generic [ref=e407]: PW Categorised 3MWOOLIEYKQX
                        - code [ref=e408]: PW-3MWOOLIEYKQX
                    - cell "PW Category 3MWOOLIEYKQX" [ref=e409]
                    - cell "—" [ref=e411]
                    - cell "0" [ref=e412]
                    - cell [ref=e417]:
                      - time [ref=e418]: Nov 20, 2026, 7:52:30 AM
                    - cell [ref=e419]:
                      - generic [ref=e420]:
                        - button "Permissions of PW Categorised 3MWOOLIEYKQX" [ref=e421]
                        - button "View PW Categorised 3MWOOLIEYKQX" [ref=e425]
                        - button "Edit PW Categorised 3MWOOLIEYKQX" [ref=e433]
                        - button "Delete PW Categorised 3MWOOLIEYKQX" [ref=e437]
                  - row [ref=e441] [cursor=pointer]:
                    - cell "4" [ref=e442]
                    - cell "Super Administrator SUPER_ADMIN" [ref=e443]:
                      - generic [ref=e444]:
                        - generic [ref=e445]: Super Administrator
                        - code [ref=e446]: SUPER_ADMIN
                    - cell "System" [ref=e447]
                    - 'cell "Default role with every permission. Built in: cannot be edited or deleted." [ref=e449]'
                    - cell "34" [ref=e451]
                    - cell [ref=e456]:
                      - time [ref=e457]: Nov 20, 2026, 7:38:29 AM
                    - cell [ref=e458]:
                      - generic [ref=e459]:
                        - button "Permissions of Super Administrator" [ref=e460]
                        - button "View Super Administrator" [ref=e464]
                        - button "Edit Super Administrator (Built-in roles cannot be edited)" [disabled] [ref=e472]
                        - button "Delete Super Administrator (Built-in roles cannot be deleted)" [disabled] [ref=e476]
              - generic [ref=e480]:
                - generic [ref=e481]:
                  - generic [ref=e482]: 1–4 of 4
                  - generic [ref=e483]:
                    - generic [ref=e484]: Rows per page
                    - combobox "Rows per page" [ref=e487] [cursor=pointer]:
                      - generic [ref=e488]: "10"
                - navigation "Pagination" [ref=e491]:
                  - button "First page" [disabled]
                  - button "Previous page" [disabled]
                  - list [ref=e492]:
                    - listitem [ref=e493]:
                      - button "Page 1" [ref=e494] [cursor=pointer]: "1"
                  - button "Next page" [disabled]
                  - button "Last page" [disabled]
              - paragraph [ref=e495]: Showing 1 to 4 of 4 roles
  - region "Notifications":
    - list
  - dialog "Permissions · PW Support Lead 1MWOOLL1XI2N ROLE-01" [ref=e497]:
    - generic [ref=e498]:
      - heading "Permissions · PW Support Lead 1MWOOLL1XI2N ROLE-01" [level=2] [ref=e499]:
        - generic [ref=e500]:
          - text: Permissions · PW Support Lead 1MWOOLL1XI2N
          - generic [ref=e504]: ROLE-01
      - paragraph [ref=e505]: See what this role grants and tick more to assign. Members of groups with this role get these permissions.
    - generic [ref=e507]:
      - tablist [ref=e508]:
        - tab "Assigned 0" [selected] [ref=e509] [cursor=pointer]:
          - text: Assigned
          - generic [ref=e513]: "0"
        - tab "Assign permissions 34" [ref=e514] [cursor=pointer]:
          - text: Assign permissions
          - generic [ref=e518]: "34"
      - tabpanel "Assigned 0" [ref=e519]:
        - generic [ref=e520]:
          - paragraph [ref=e525]: No permissions yet
          - paragraph [ref=e526]: This role grants nothing. Assign permissions to give its groups access.
          - button "Assign permissions" [ref=e528] [cursor=pointer]
    - generic [ref=e532]:
      - paragraph [ref=e533]: No unsaved changes
      - button "Cancel" [active] [ref=e534] [cursor=pointer]
      - button "Save permissions" [disabled]
    - button "Close" [ref=e535] [cursor=pointer]
```

# Test source

```ts
  1  | import type { Page } from '@playwright/test';
  2  | 
  3  | /**
  4  |  * Calls the AuthCore API as the signed-in admin, for test setup and clean-up (creating a
  5  |  * role to edit, deleting what a test made), so tests use the screen only for what they test.
  6  |  *
  7  |  * Uses the access token the app itself received (captured from its sign-in / refresh
  8  |  * responses, see fixtures.ts): no extra sign-ins (the backend allows 10 a minute) and the
  9  |  * browser's session is never disturbed.
  10 |  */
  11 | export class AdminApi {
  12 |   constructor(
  13 |     private readonly page: Page,
  14 |     private readonly token: { value: string | null },
  15 |     private readonly reauth: () => Promise<void>,
  16 |   ) {}
  17 | 
  18 |   private url(path: string): string {
  19 |     return new URL(`/api/v1${path}`, this.page.url()).toString();
  20 |   }
  21 | 
  22 |   private async send<T>(method: string, path: string, data?: unknown, retry = true): Promise<T> {
  23 |     if (!this.token.value) await this.reauth();
  24 |     const res = await this.page.request.fetch(this.url(path), {
  25 |       method,
  26 |       data,
  27 |       headers: { authorization: `Bearer ${this.token.value}` },
  28 |       failOnStatusCode: false,
  29 |     });
  30 |     // Access tokens last 15 minutes: let the app refresh it, then try once more.
  31 |     if (res.status() === 401 && retry) {
  32 |       this.token.value = null;
  33 |       await this.reauth();
  34 |       return this.send(method, path, data, false);
  35 |     }
  36 |     const body = (await res.json().catch(() => null)) as { data?: T; message?: string } | null;
  37 |     if (!res.ok()) {
> 38 |       throw new Error(`${method} ${path} → ${res.status()}: ${body?.message ?? 'no message'}`);
     |             ^ Error: GET /roles/key/ROLE-01 → 400: Invalid role key
  39 |     }
  40 |     return (body && 'data' in body ? body.data : body) as T;
  41 |   }
  42 | 
  43 |   get<T>(path: string): Promise<T> {
  44 |     return this.send<T>('GET', path);
  45 |   }
  46 |   post<T>(path: string, data?: unknown): Promise<T> {
  47 |     return this.send<T>('POST', path, data);
  48 |   }
  49 |   patch<T>(path: string, data?: unknown): Promise<T> {
  50 |     return this.send<T>('PATCH', path, data);
  51 |   }
  52 |   delete<T>(path: string): Promise<T> {
  53 |     return this.send<T>('DELETE', path);
  54 |   }
  55 | }
  56 | 
  57 | /** Short unique text for names and keys made by tests (worker + time + random). */
  58 | export function uniqueId(workerIndex: number): string {
  59 |   return `${workerIndex}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`.toUpperCase();
  60 | }
  61 | 
```