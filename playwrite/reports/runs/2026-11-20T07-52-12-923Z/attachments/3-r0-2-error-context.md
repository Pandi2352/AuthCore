# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: access\roles.spec.ts >> Roles >> adds a new category from the category list and uses it
- Location: tests\access\roles.spec.ts:105:3

# Error details

```
Error: GET /roles/key/PW-3MWOOLIEYKQX → 400: Invalid role key
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
                - paragraph [ref=e192]: "3"
                - paragraph [ref=e193]: Every role
              - generic [ref=e200]:
                - paragraph [ref=e201]: Roles in use
                - paragraph [ref=e202]: "0"
                - paragraph [ref=e203]: Given to at least one group
              - generic [ref=e209]:
                - paragraph [ref=e210]: Custom roles
                - paragraph [ref=e211]: "2"
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
                - paragraph [ref=e247]: "2"
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
              - table "roles, 3 total, page 1 of 1" [ref=e281]:
                - caption [ref=e282]: roles, 3 total, page 1 of 1
                - rowgroup [ref=e291]:
                  - row [ref=e292]:
                    - columnheader "S.No Resize S.No column (64 px, use left / right arrows)" [ref=e293]:
                      - generic [ref=e294]: S.No
                      - button "Resize S.No column (64 px, use left / right arrows)" [ref=e295]
                    - columnheader "Role Resize Role column (258 px, use left / right arrows)" [ref=e296]:
                      - button "Role" [ref=e297] [cursor=pointer]
                      - button "Resize Role column (258 px, use left / right arrows)" [ref=e302]
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
                    - cell "PW Categorised 3MWOOLIEYKQX PW-3MWOOLIEYKQX" [ref=e327]:
                      - generic [ref=e328]:
                        - generic [ref=e329]: PW Categorised 3MWOOLIEYKQX
                        - code [ref=e330]: PW-3MWOOLIEYKQX
                    - cell "PW Category 3MWOOLIEYKQX" [ref=e331]
                    - cell "—" [ref=e333]
                    - cell "0" [ref=e334]
                    - cell [ref=e339]:
                      - time [ref=e340]: Nov 20, 2026, 7:52:30 AM
                    - cell [ref=e341]:
                      - generic [ref=e342]:
                        - button "Permissions of PW Categorised 3MWOOLIEYKQX" [ref=e343]
                        - button "View PW Categorised 3MWOOLIEYKQX" [ref=e347]
                        - button "Edit PW Categorised 3MWOOLIEYKQX" [ref=e355]
                        - button "Delete PW Categorised 3MWOOLIEYKQX" [ref=e359]
                  - row [ref=e363] [cursor=pointer]:
                    - cell "2" [ref=e364]
                    - cell "PW Role 0MWOOLHTUFJ5 renamed PW-0MWOOLHTUFJ5" [ref=e365]:
                      - generic [ref=e366]:
                        - generic [ref=e367]: PW Role 0MWOOLHTUFJ5 renamed
                        - code [ref=e368]: PW-0MWOOLHTUFJ5
                    - cell "Support" [ref=e369]
                    - cell "Changed by a Playwright test" [ref=e371]
                    - cell "0" [ref=e373]
                    - cell [ref=e378]:
                      - time [ref=e379]: Nov 20, 2026, 7:52:29 AM
                    - cell [ref=e380]:
                      - generic [ref=e381]:
                        - button "Permissions of PW Role 0MWOOLHTUFJ5 renamed" [ref=e382]
                        - button "View PW Role 0MWOOLHTUFJ5 renamed" [ref=e386]
                        - button "Edit PW Role 0MWOOLHTUFJ5 renamed" [ref=e394]
                        - button "Delete PW Role 0MWOOLHTUFJ5 renamed" [ref=e398]
                  - row [ref=e402] [cursor=pointer]:
                    - cell "3" [ref=e403]
                    - cell "Super Administrator SUPER_ADMIN" [ref=e404]:
                      - generic [ref=e405]:
                        - generic [ref=e406]: Super Administrator
                        - code [ref=e407]: SUPER_ADMIN
                    - cell "System" [ref=e408]
                    - 'cell "Default role with every permission. Built in: cannot be edited or deleted." [ref=e410]'
                    - cell "34" [ref=e412]
                    - cell [ref=e417]:
                      - time [ref=e418]: Nov 20, 2026, 7:38:29 AM
                    - cell [ref=e419]:
                      - generic [ref=e420]:
                        - button "Permissions of Super Administrator" [ref=e421]
                        - button "View Super Administrator" [ref=e425]
                        - button "Edit Super Administrator (Built-in roles cannot be edited)" [disabled] [ref=e433]
                        - button "Delete Super Administrator (Built-in roles cannot be deleted)" [disabled] [ref=e437]
              - generic [ref=e441]:
                - generic [ref=e442]:
                  - generic [ref=e443]: 1–3 of 3
                  - generic [ref=e444]:
                    - generic [ref=e445]: Rows per page
                    - combobox "Rows per page" [ref=e448] [cursor=pointer]:
                      - generic [ref=e449]: "10"
                - navigation "Pagination" [ref=e452]:
                  - button "First page" [disabled]
                  - button "Previous page" [disabled]
                  - list [ref=e453]:
                    - listitem [ref=e454]:
                      - button "Page 1" [ref=e455] [cursor=pointer]: "1"
                  - button "Next page" [disabled]
                  - button "Last page" [disabled]
              - paragraph [ref=e456]: Showing 1 to 3 of 3 roles
  - region "Notifications":
    - list:
      - status [ref=e457]:
        - paragraph [ref=e462]: Category “PW Category 3MWOOLIEYKQX” added
        - button "Dismiss notification" [ref=e463] [cursor=pointer]
      - status [ref=e467]:
        - generic [ref=e471]:
          - paragraph [ref=e472]: Role “PW Categorised 3MWOOLIEYKQX” created
          - paragraph [ref=e473]: Now choose the permissions it grants.
        - button "Dismiss notification" [ref=e474] [cursor=pointer]
  - dialog "Permissions · PW Categorised 3MWOOLIEYKQX PW-3MWOOLIEYKQX" [ref=e479]:
    - generic [ref=e480]:
      - heading "Permissions · PW Categorised 3MWOOLIEYKQX PW-3MWOOLIEYKQX" [level=2] [ref=e481]:
        - generic [ref=e482]:
          - text: Permissions · PW Categorised 3MWOOLIEYKQX
          - generic [ref=e486]: PW-3MWOOLIEYKQX
      - paragraph [ref=e487]: See what this role grants and tick more to assign. Members of groups with this role get these permissions.
    - generic [ref=e489]:
      - tablist [ref=e490]:
        - tab "Assigned 0" [selected] [ref=e491] [cursor=pointer]:
          - text: Assigned
          - generic [ref=e495]: "0"
        - tab "Assign permissions 34" [ref=e496] [cursor=pointer]:
          - text: Assign permissions
          - generic [ref=e500]: "34"
      - tabpanel "Assigned 0" [ref=e501]:
        - generic [ref=e502]:
          - paragraph [ref=e507]: No permissions yet
          - paragraph [ref=e508]: This role grants nothing. Assign permissions to give its groups access.
          - button "Assign permissions" [ref=e510] [cursor=pointer]
    - generic [ref=e514]:
      - paragraph [ref=e515]: No unsaved changes
      - button "Cancel" [active] [ref=e516] [cursor=pointer]
      - button "Save permissions" [disabled]
    - button "Close" [ref=e517] [cursor=pointer]
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
     |             ^ Error: GET /roles/key/PW-3MWOOLIEYKQX → 400: Invalid role key
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