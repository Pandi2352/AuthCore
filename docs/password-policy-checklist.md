# Password Policy API: checklist status

Backend only. SSO / social providers are out of scope for now.

Legend: `[x]` done and verified · `[~]` done differently (reason given) · `[ ]` deferred (reason given).

Verified by an end-to-end test against MongoDB (11 groups: roles, public endpoints, enforcement, policy validation and audit, history / minimum age, expiry, scheduler configuration, reminder job, automatic run, logs), a regression run of every earlier suite, and the Postman collection run.

| Method | Endpoint | Auth |
| --- | --- | --- |
| GET | `/api/v1/password-policies` | ADMIN |
| PUT | `/api/v1/password-policies` | ADMIN |
| GET | `/api/v1/password-policies/history` | ADMIN |
| GET | `/api/v1/password-policies/schedulers` | ADMIN |
| PUT | `/api/v1/password-policies/schedulers` | ADMIN |
| POST | `/api/v1/password-policies/schedulers/password-expiry-notification/run` | ADMIN |
| GET | `/api/v1/password-policies/requirements` | public (the "effective policy" for forms) |
| POST | `/api/v1/password-policies/validate` | public, throttled |

**Default policy** (until an admin saves one): 8–64 characters, at least 1 uppercase, 1 lowercase, 1 digit, 1 special character (`Test@123` format); last 5 passwords blocked; common passwords blocked; no personal info; no whitespace; no expiry.

---

## 1. Password policy configuration

- [x] Policy name
- [x] Minimum / maximum length *(8–128 hard limits)*
- [x] Minimum digit count
- [x] Minimum special character count
- [x] Require lower and upper case
- [x] Prevent reuse of previous passwords + history count *(0–24)*
- [ ] Enforce 2FA for SSO password change *(no SSO / 2FA yet: added with those modules)*
- [x] Password validity enabled
- [x] Minimum uppercase / lowercase count *(raise above 1)*
- [x] Minimum password age *(`minimumPasswordAgeHours`)*
- [x] Maximum consecutive identical characters *(`maximumRepeatedCharacters`)*
- [x] Prevent username / email / names in password *(`preventPersonalInfoInPassword`)*
- [x] Block common passwords *(bundled list, `common-passwords.constants.ts`; extend as needed)*
- [x] Block compromised passwords *(Have I Been Pwned, k-anonymity, off by default; skipped if unreachable)*
- [x] Allow / disallow whitespace
- [ ] Custom validation rules *(not needed yet; rules are independent toggles)*
- [x] Rules are independent: any combination can be configured

## 2. Password validity

- [x] Enable / disable expiry
- [x] Validity duration (days)
- [x] Reminder days before expiry *(up to 5 values, each < validityDays)*
- [x] Grace period
- [x] Behaviour on expiry: `forceChangeOnExpiry` → only change-password, `/me` and logout work (403 AUTH_PASSWORD_EXPIRED); off → informational only
- [x] Force change on next login *(login returns `isPasswordChangeRequired: true` + `passwordExpiresAt`)*
- [ ] Exempt service / system accounts *(no service accounts exist yet)*

## 3. Schedulers

**A. Password expiry notification**

- [x] Enable / disable
- [x] Frequency (HOURLY / DAILY / WEEKLY / MONTHLY), execution time, timezone *(IANA, DST-aware; dayOfWeek / dayOfMonth for weekly / monthly)*
- [x] Find users whose password expires soon *(nearest threshold only)*
- [x] Send emails
- [x] No duplicate notifications *(unique record per user + password + threshold)*
- [x] Track notification status *(SENT / FAILED, attempts)*
- [x] Retry failed notifications *(up to 3 attempts on later runs; failed run retried after 15 min)*
- [x] Log execution results *(stored summary + logs)*

**B. Breached password check**

- [~] **Not a scheduled job.** Passwords are stored only as Argon2 hashes, which can't be checked against breach data later (your note says the same). Instead `blockCompromisedPasswords` checks every password when it is set (register, reset, change), without storing anything extra.

## 4. Payloads and responses

- [x] PUT payload as specified (`characterLength`, `complexity`, `passwordHistory`, `additionalRules`, `passwordValidity`) *(`authentication` group left out until SSO / 2FA; `preventUsernameInPassword` is named `preventPersonalInfoInPassword` as it also covers email and names; `allowWhitespace` / `maximumRepeatedCharacters` / `minimumPasswordAgeHours` added to `additionalRules`)*
- [x] GET response with id, groups, createdAt / updatedAt *(plus `isDefault`, `version`, `updatedBy`)*
- [x] PUT returns the saved policy *(full policy instead of only id / name / updatedAt)*
- [x] Scheduler GET with last / next execution and status *(plus last run summary)*
- [x] Error `INVALID_PASSWORD_POLICY` with field details *(in the project's standard error envelope: `code` + `errors[{ field, message }]`)*

## 5. Validation

- [x] Policy name required
- [x] Minimum ≤ maximum
- [x] Minimum length ≥ 8; maximum ≤ 128
- [x] Counts not negative
- [x] Required characters fit in the maximum length
- [x] History count forced to 0 when reuse prevention is off
- [x] Expiry settings ignored while validity is disabled
- [x] Reminder days positive and within the validity period
- [x] Strict booleans
- [x] Unknown fields rejected (no mass assignment)
- [x] Only ADMIN can change settings
- [x] Scheduler: HH:mm 24-hour, valid IANA timezone, known frequency

## 6. Database

- [x] `password_policies` *(single global document; `organizationId` comes with multi-tenancy; `isActive` not needed with one policy; `version`, `createdBy`, `updatedBy`)*
- [x] `password_scheduler_configs` *(one document per job, with lock and execution state)*
- [~] Password history *(kept as hashed `passwordHistory` on the user document instead of a separate collection: always read together with the current hash, capped at 24)*
- [x] `password_policy_audit_logs` *(changedBy, action, old / new values, changed fields, IP, user agent; never passwords or hashes)*
- [x] `password_expiry_notifications` *(dedupe + retry state, TTL cleanup)*

## 7. Enforcement

- [x] Register
- [x] Change password
- [x] Reset password
- [ ] Admin reset / admin password update / first-login change *(those APIs don't exist yet; they will call the same `PasswordValidationService`)*
- [x] One shared service (`PasswordValidationService`): length, digits, special, case, whitespace, repeats, personal info, common, compromised, history, minimum age, expiry
- [x] Hash only after validation; old hash moved into history; history retention from the policy
- [x] Expiry counted from `passwordChangedAt` (updated on every change)
- [x] Sessions: reset signs out all devices, change signs out the others
- [x] All broken rules returned at once

## 8. Security

- [x] ADMIN only for configuration *(minimal role: `role` on the user, `@Roles()`, CLI `npm run users:role`; full RBAC module later)*
- [x] Validated and whitelisted payloads
- [x] Rate limits *(10 / min for admin changes, 30 / min for public validate)*
- [x] Atomic policy updates; concurrent updates each recorded in the audit
- [x] Audit history
- [x] No hashes in responses; no passwords in logs *(verified)*
- [x] Scheduler errors not exposed to clients *(generic summary, details in logs)*
- [x] Distributed lock for scheduler runs *(atomic claim; one instance per run)*
- [x] Configuration changes without restart *(policy cache 15 s; scheduler read every poll)*
- [ ] Organization isolation *(multi-tenancy module)*

## Not in this sprint

- 2FA for SSO password change, service-account exemptions, admin password APIs, multi-tenant policies, full RBAC.
