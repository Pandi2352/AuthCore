# AuthCore Frontend — Level 2 Modules (AuthCore Client)

**Level 2: Modules 17–26 — Every AuthCore backend feature in the UI**

Built on the Level 1 starter kit. All endpoints are under `/api/v1` (see the backend Swagger at `/api/docs`). Projects that don't use AuthCore delete `features/auth`, `features/account` and `features/admin-*` and keep Level 1.

- Level 1 (Modules 1–16, starter kit): [level-1-modules.md](./level-1-modules.md)
- Level 3 (Modules 27–34): [level-3-modules.md](./level-3-modules.md)
- Backend scope: [../backend/level-1-modules.md](../backend/level-1-modules.md)

`[~]` = a first version exists in the current code (to be moved into the structure from [folder-structure.md](./folder-structure.md#migration-of-the-current-files) and completed).

---

## 17. Session, Data & Forms Foundation

Session:

- [~] Auth context with login / logout / refresh *(`context/AuthContext.tsx`)*
- [ ] `features/auth/session/`: `AuthProvider`, `useAuth()` → `{ status: 'loading' | 'authenticated' | 'anonymous', user, permissions, login, logout, logoutAll, refreshUser }`
- [~] Access token in memory only; refresh via HttpOnly cookie, one refresh at a time, queued retries *(`lib/api-client.ts`)*
- [ ] Silent session restore on page load (`POST /auth/refresh` → `GET /auth/me` + `GET /access-control/me`), app shows a splash until resolved
- [ ] Proactive refresh shortly before the access token expires (`expiresIn`), paused in background tabs
- [ ] Cross-tab sign-out (`BroadcastChannel`): sign out in one tab signs out all
- [ ] Refresh failure / `AUTH_REFRESH_TOKEN_REUSED` / `AUTH_SESSION_REVOKED` → clear state, one toast, `/login?returnTo=…`
- [ ] `AUTH_PASSWORD_EXPIRED` (403) → forced change-password screen (module 19)

Data:

- [ ] TanStack Query client (`lib/query/query-client.ts`): retry only network / 5xx, never 4xx; `staleTime` defaults; devtools in development
- [ ] Query-key factory per feature; mutations invalidate the right keys
- [ ] Types generated from the backend OpenAPI (`openapi-typescript` → `src/types/api.generated.ts`, `npm run api:types`), or hand-written types checked against it
- [ ] Paginated list helper: `page`, `limit`, `sortBy`, `sortOrder`, filters ↔ URL search params ↔ query keys

Forms:

- [ ] React Hook Form + Zod; `components/form/` (`Form`, `FormField`, `FormActions`)
- [ ] `ApiError.fieldErrors` → `setError(field)`; unknown fields → form-level alert
- [ ] Client rules mirror the backend (email, username pattern, name pattern) without duplicating the password policy: password rules come from `GET /password-policies/requirements`
- [ ] Submit buttons with loading state, double-submit prevention, unsaved-changes prompt on navigation (optional per form)

## 18. Authentication Pages

Rendered in `AuthLayout`; feature flags from `features.config.ts` (`allowRegistration`, `registrationFlow`, `loginIdentifiers`, `enableRememberMe`, `enableSelfRecovery`).

- [~] Login *(email or username + password, remember me)*
  - [ ] `POST /auth/login`; identifier field adapts to `LOGIN_IDENTIFIERS` (email / username / both)
  - [ ] 429 `AUTH_TOO_MANY_FAILED_ATTEMPTS`: countdown from `Retry-After`, "Forgot password" link
  - [ ] Account states: pending approval, email not verified (resend link), suspended / inactive / pending deletion (recovery link)
  - [ ] `isNewDevice` → informational toast ("We emailed you about this new sign-in")
  - [ ] `isPasswordChangeRequired` → forced change flow
  - [ ] `returnTo` honoured (safe relative paths only)
- [~] Register *(flows otp / link / approval / none)*
  - [ ] `POST /auth/register`; next step from `nextStep` (`VERIFY_EMAIL_OTP`, `VERIFY_EMAIL_LINK`, `AWAIT_APPROVAL`, `LOGIN`)
  - [ ] Live password requirements + strength meter (`PasswordRequirements`)
  - [ ] Username availability hint (optional)
- [~] Verify email *(OTP and link)*
  - [ ] `POST /auth/verify-email/otp` (6-box OTP input, paste support), `/auth/verify-email/link` (token from URL), `/auth/verify-email/resend` with cooldown timer
- [~] Forgot / reset password
  - [ ] `POST /auth/forgot-password` (same message for every email), `/auth/verify-reset-token` (code or link token), `/auth/reset-password` (new + confirm, policy rules, generator button)
- [~] Account recovery *(`POST /account/recovery/request`, `/account/recovery/confirm`)*
- [ ] Accept invitation: `POST /user-invites/public/info` (inviter, expiry, email), `POST /user-invites/accept` (names, optional username, password)
- [ ] Sign out: `POST /auth/logout`; "sign out everywhere" `POST /auth/logout-all`
- [ ] Shared: `PasswordInput` (show / hide), `OtpInput`, `PasswordRequirements` (from policy), `PasswordStrength`, "Generate password" (`POST /password-policies/generate-password`, signed-in contexts)

## 19. Guards & Permissions

- [~] Route guards *(`ProtectedRoute`, `GuestRoute`)*
- [ ] `RequireAuth` (→ `/login?returnTo=`), `RequireGuest` (→ home), `RequirePermission` (→ 403) as layout routes
- [ ] Route `handle.permission` checked by `RequirePermission`
- [~] `usePermissions()` + `PermissionGate` *(exist)*
- [ ] `can(permission | permission[], mode: 'any' | 'all')`; ADMIN role passes everything (backend rule)
- [ ] Navigation items with `permission` hidden when missing (sidebar, navbar menus, command menu)
- [ ] Forced password change: only change-password, profile and sign-out reachable while `mustChangePassword` / expired
- [ ] Permissions refreshed after access changes (`GET /access-control/me`), cached per session

## 20. My Account

Under `/account/*` in `AppLayout`.

- [~] Profile *(`GET /users/me`, `PATCH /users/me`)*
  - [ ] Header: avatar, name, email, status, member since, last sign-in
  - [ ] Names and username; email change flow (`POST /users/me/email/change` → code → `/users/me/email/confirm`)
- [ ] Personal details: form **generated from the user schema** (`GET /user-schema/form`): field types TEXT, TEXTAREA, EMAIL, MOBILE, NUMBER, BOOLEAN, DATE, DATETIME, URL, DROPDOWN, MULTI_SELECT; groups (address) as fieldsets; read-only / immutable / required; `PATCH /users/me/attributes`; `missingRequired` banner
- [ ] Avatar: upload with preview (`POST /users/me/avatar`, JPEG / PNG / WebP, size limit), remove (`DELETE /users/me/avatar`); optional client-side crop
- [ ] Preferences: language (en / ta / hi), time zone, notification toggles (product updates, sign-in alerts) — `PATCH /users/me/preferences`
- [ ] Appearance: theme mode / preset / appearance (local, from Level 1 module 3)
- [~] Security *(change password)*: `PATCH /auth/change-password` with policy rules, generator, "other devices signed out" notice
- [~] Sessions *(`GET /auth/sessions`, `DELETE /auth/sessions/:id`, sign out everywhere)*: current device marked, device / browser / IP / last used
- [ ] Known devices: `GET /users/me/devices`, forget `DELETE /users/me/devices/:id`
- [~] Activity *(`GET /users/me/activity`)*: event filter, pagination, device / IP, icons per event
- [ ] My access: groups, roles, permissions (`GET /access-control/me`)
- [ ] Download my data: password prompt → `POST /users/me/export` → file download
- [ ] Danger zone: deactivate (`POST /users/me/deactivate`), delete (`DELETE /users/me`, grace period shown); both confirm with password

## 21. Administration — Users & Invites

Under `/admin/users`, `/admin/invites`; permissions `USER_READ / CREATE / UPDATE / DELETE`, `USER_PASSWORD_MANAGE`, `USER_INVITE`.

- [ ] Users list: `GET /admin/users` — search, status, role, source, verified, pending deletion, deleted (exclude / only / include), created / updated ranges, sort, custom-attribute filters (`attr[name]`), column visibility, pagination in URL
- [ ] Create user: `POST /admin/users` (password + generator, must change, verified, groups, custom attributes, welcome email)
- [ ] User detail (tabs):
  - [ ] Header cards: last activity, created on, status toggle (`PATCH /admin/users/:id/status` + reason + notify), email-verified toggle
  - [ ] Profile and personal details (`PATCH /admin/users/:id`, `PATCH /admin/users/:id/attributes`, internal / read-only fields), avatar (`POST/DELETE /admin/users/:id/avatar`)
  - [ ] Groups & roles: tree `GET /admin/users/:id/access`, add to group, "Set expiry" (`PATCH /access-mappings/:id`), remove
  - [ ] Reset password panel: `POST /admin/users/:id/set-password` (generate, notify, require change, sign out), send reset email (`/reset-password`), force change at next sign-in (`/force-password-reset`)
  - [ ] Security: lock status + locked IP count, unlock (`/unlock`), sessions (`GET /admin/users/:id/sessions`, revoke all)
  - [ ] Activity: `GET /admin/users/:id/activity`
  - [ ] Role: `PATCH /admin/users/:id/role` (ADMIN callers only)
  - [ ] Delete / restore / permanent delete (`DELETE /admin/users/:id`, `/restore`, `/permanent`) with guard-rail messages (last admin, self)
- [ ] Invites: list (status filter) `GET /user-invites`, invite one / bulk (`POST /user-invites`, `/bulk` with per-person language, groups, message), resend, revoke, delete

## 22. Administration — Access Control

Under `/admin/access`; permissions `PERMISSION_*`, `ROLE_*`, `GROUP_*`, `ACCESS_MAPPING_READ / ASSIGN / REVOKE`, `ACCESS_AUDIT_READ`.

- [ ] Permissions: list with search / metadata filters, create / edit / delete (`/permissions`), actions dropdown (`/permissions/actions`), key uniqueness check (`/permissions/exists`)
- [ ] Roles: list, create / edit / delete (`/roles`, `/roles/key/:roleKey`), categories, bulk update (`PATCH /roles/bulk`), "role setup" wizard (role + permissions + groups in one step, `POST /roles/setup`), system roles read-only
- [ ] Groups: tree view (`/groups/tree`) and list (tags any / all), create main group / sub-group, move, tags editor, default-group toggle (`isDefault`), children, permission matrix (`/groups/:id/permission-matrix`)
- [ ] Access mapping: assign / remove permissions → role, roles → group, users → group (with end dates); mapping list; effective access of a user (`/access-mappings/users/:userId/effective-access`)
- [ ] Audit log: `GET /access-control/audit-logs` (entity type / id, action, actor, dates)
- [ ] Dropdown endpoints (`/roles/dropdown`, `/groups/dropdown`, `/permissions/dropdown`) for all pickers (no limit, as the backend returns everything)

## 23. Administration — Security Settings

Permissions `PASSWORD_POLICY_READ / MANAGE`, `USER_SCHEMA_READ / MANAGE`.

- [ ] Password policy editor: `GET/PUT /password-policies` (length, complexity, history, additional rules, validity); live "test a password" (`POST /password-policies/validate`); change history (`/password-policies/history`)
- [ ] Expiry reminder scheduler: `GET/PUT /password-policies/schedulers`, run now
- [ ] User schema (custom variables): tree (`/user-schema/attributes`), create / edit forms (field / group, data type, options, scopes, locales, flags, mutability, returned), delete with impact warning, preview of the generated profile form (`/user-schema/form`), options (`/user-schema/options`)

## 24. Administration — Monitoring

Permissions `USER_READ` (activity), `FILE_DELETE` (maintenance), `USER_DELETE` (purge).

- [ ] Activity search: `GET /admin/activity` (user, email / name, events, success, IP, device, browser, dates, sort) with event-type filter options (`/admin/activity/event-types`)
- [ ] Login history: `GET /admin/activity/login-history` (failed sign-ins by IP preset)
- [ ] Files maintenance: run orphan cleanup (`POST /files/maintenance/orphan-cleanup`, `FILE_DELETE`), show counts
- [ ] Deletion purge: run now (`POST /admin/users/deletion-purge/run`)
- [ ] Health widget for admins: `GET /health/ready` (database, storage, virus scanner)

## 25. Files

- [ ] `FileDropzone` + `useUpload` (progress, cancel, type / size check before upload, purpose)
- [ ] My files: `GET /files` (purpose filter), download (`/files/:id/content`), delete
- [ ] Error mapping: 413 `FILE_TOO_LARGE`, 415 `FILE_TYPE_NOT_ALLOWED`, 422 `FILE_UNREADABLE` / `FILE_INFECTED`, 503 `FILE_SCAN_UNAVAILABLE`, 409 `FILE_LIMIT_REACHED`
- [ ] Avatar URLs (`/files/public/:id`) used directly in `<img>`

## 26. Shell Integration & Verification

- [ ] User menu in the navbar: avatar, name, email, profile / security / sessions links, theme, sign out
- [ ] Sidebar "Account" and "Administration" groups driven by permissions
- [ ] Dashboard home for signed-in users (welcome, security tips: unverified email, password expiry, missing required details)
- [ ] Manual checks per feature: forms (validation + server errors), guards, permission-gated UI, session restore / refresh / cross-tab sign-out
- [ ] Manual verification against the real backend (all flows in `backend/level-1-modules.md` that have a UI)
- [ ] Postman / Swagger parity check: every backend endpoint either used by a screen or listed as "API only"

---

## Sprint plan (build order)

| Sprint | Module | Output |
| --- | --- | --- |
| 17 | 17. Session, data & forms | Session restore, refresh, Query, forms with server errors |
| 18 | 18. Authentication pages | All sign-in / sign-up / recovery flows |
| 19 | 19. Guards & permissions | Protected routes, permission-aware navigation, forced change |
| 20 | 20. My account | Profile, details form, avatar, preferences, security, sessions, devices, activity, export |
| 21 | 21. Users & invites | Admin user management |
| 22 | 22. Access control | Permissions, roles, groups, mappings, audit |
| 23 | 23. Security settings | Password policy, schedulers, user schema |
| 24 | 24–25. Monitoring & files | Activity search, login history, files, maintenance |
| 25 | 26. Integration & verification | User menu, dashboard, manual checks, parity check |
