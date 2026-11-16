# User Schema, Profile and Admin User Panel: Checklist

Custom user variables ("Schemas"), the personal-details form, the admin user page (header cards, reset password, groups & roles, recent activity) and the password generator.

## Schema: custom user variables (`/api/v1/user-schema`)

- [x] Variable list as a tree (groups such as `address` with children) or flat; search by name / label
- [x] Row actions: details (`GET /attributes/:id`), add child (`POST` with `parentId`), edit (`PATCH`), delete (`DELETE`)
- [x] Create Variable (FIELD): name (snake_case, unique among siblings), label, description, data type
- [x] Data types: TEXT, TEXTAREA, EMAIL, MOBILE, NUMBER, BOOLEAN, DATE, DATETIME, URL, DROPDOWN, MULTI_SELECT
- [x] Dropdown / multi-select options (unique values, max 200)
- [x] Limits: minLength / maxLength (text-like), min / max (NUMBER)
- [x] Create Variable (GROUP): Field Group Type OBJECT or LIST; one level of nesting
- [x] Scopes (OpenID Connect: openid, profile, email, phone, address; custom e.g. `hr:read`) and locales
- [x] isEnabled, isRequired, isInternal, isUsername, isPassword, isUnique, isMatchEnabled + matchWith
- [x] includeInToken (claim `attrs` in the access token, max 2 KB), includeInSearchFilter (`GET /admin/users?attr[name]=value`)
- [x] Mutability: READ_WRITE, READ_ONLY, IMMUTABLE, WRITE_ONLY; Returned: ALWAYS, DEFAULT, REQUEST, NEVER
- [x] Consistency rules (e.g. username needs TEXT / EMAIL / MOBILE / NUMBER; password can't be in the token or unique); all problems in one 400
- [x] Duplicate name → 409; optimistic `version` → 409 on concurrent edits
- [x] System variables seeded (OpenID Connect standard claims incl. `address` group); cannot be deleted; structure / security flags fixed
- [x] Delete removes the value from every user; non-empty groups can't be deleted
- [x] Dropdown values for the form (`GET /user-schema/options`); profile form definition for any user (`GET /user-schema/form`)
- [x] Permissions `USER_SCHEMA_READ` / `USER_SCHEMA_MANAGE` (in `USER_ADMIN`); audit log `entityType=USER_ATTRIBUTE`

## My profile / edit profile

- [x] `GET /users/me`: profile + custom variable values + `missingRequired`; `?include=` for returned=REQUEST variables
- [x] `PATCH /users/me/attributes`: designation, employee id, secondary mail, given / family / middle / nick name, profile, picture, website, gender, birth date, zone, locale, phone (+91…), address
- [x] Validation by type, options, limits, required, unique (case-insensitive), match; internal and read-only blocked for the user; immutable set once
- [x] Groups merge field by field; `null` / `""` clears
- [x] Core claims map to built-in fields (given_name → firstName, family_name → lastName, preferred_username → username); email and password keep their own flows
- [x] Password-type variables Argon2-hashed and never returned; confirm fields never stored
- [x] Sign in with a custom `isUsername` variable (e.g. employee id)
- [x] `GET /users/me/activity`: recent activity
- [x] Profile image upload *(`POST /users/me/avatar`: stored in the local upload folder, public URL in `picture`)*
- [x] Photos re-encoded: auto-rotated, location / camera metadata removed, avatar cropped to a square, large images shrunk
- [x] Virus scanning of uploads (ClamAV; fail-closed by default)
- [ ] Phone verification / SMS *(needs an SMS provider)*

## Admin user page (`/api/v1/admin/users/:id`)

- [x] Header cards: last activity (`lastActivityAt`), created on, status toggle (`PATCH /status`), email-verified toggle (`PATCH { isEmailVerified }`)
- [x] Personal details: `PATCH /admin/users/:id/attributes` (internal and read-only variables allowed)
- [x] Security: revoke all active tokens (`POST /sessions/revoke`)
- [x] Groups & roles: `GET /access` (group → roles → permissions, mapping ids, end dates, `isExpired`)
- [x] Set Expiry: `PATCH /access-mappings/:id { expiresAt }` (future date or `null`); expired links grant nothing; re-assigning renews
- [x] Remove a membership: `DELETE /access-mappings/:id`
- [x] Reset password panel: `POST /set-password` (new + confirm, policy + history, email notice without the password, reset on next login, sign out everywhere)
- [x] Generate button: `POST /password-policies/generate-password` (meets the policy; crypto-random; no look-alike characters)
- [x] Recent user activities: `GET /activity` (event type, verification type, date / time, device, browser, IP; `?event=` filter)
- [x] List filter by searchable custom variables
- [ ] SMS notification of a new password *(needs an SMS provider)*

## Activity log

- [x] Events: LOGIN, LOGIN_FAILED, LOGOUT, LOGOUT_ALL, PASSWORD_CHANGED, PASSWORD_RESET, PASSWORD_SET_BY_ADMIN, PASSWORD_CHANGE_REQUIRED, EMAIL_CHANGED, PROFILE_UPDATED, ACCOUNT_DEACTIVATED, ACCOUNT_DELETION_REQUESTED, ACCOUNT_RECOVERED, STATUS_CHANGED, SESSIONS_REVOKED
- [x] Retention `USER_ACTIVITY_RETENTION_DAYS` (TTL index); removed with the user on permanent deletion
- [x] Recording never breaks the main action

## Tests

- [x] `profile-test.js`: 13 sections (schema CRUD and rules, personal details, admin edits, search filter, username sign-in and token claims, delete cleanup, generator, set-password, activity, groups & roles with end dates, logs)
- [x] Postman: folder *10. User Schema* and the new requests in *8. Password Policy*, *9. Access Control / 4. Access Mapping*, *11. My Account*, *12. User Administration*
