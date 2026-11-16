# Identity & User Management: status

My account (self-service), user administration and user invites.

Verified by an end-to-end test against MongoDB (92 checks), a regression run of every earlier suite (10 suites), and the Postman collection run (103 requests, 355 assertions).

## Reference endpoints → AuthCore

### Users Invite

| Reference | Feature | AuthCore |
| --- | --- | --- |
| `POST /users/invite/initate` | Invite a person | `POST /user-invites` |
| `POST /users/invite/initate/bulk` | Bulk invite | `POST /user-invites/bulk` (skipped emails reported with a reason) |
| `POST /users/invite/reinitate/{invite_id}` | Resend | `POST /user-invites/:id/resend` (new link, new expiry, cooldown) |
| `POST /users/invite/revoke/{invite_id}` | Revoke | `POST /user-invites/:id/revoke` |
| `GET /users/invite/accept/{invited_verification_id}` | Accept | `POST /user-invites/accept` (POST: it creates an account; token in the body, not the URL) |
| `GET /users/invite/info/public/{invite_ref}` + `/details/` | Public invite info | `POST /user-invites/public/info` (one endpoint; token in the body) |
| `GET /users/invite/list` + `POST /utils/list` | List / filtered list | `GET /user-invites` (status, invitedBy, search, dates, sort, pagination) |
| `POST /users/invite/delete/{invite_id}` | Delete | `DELETE /user-invites/:id` |
| (new) | Invite details | `GET /user-invites/:id` |

### Users Admins

| Reference | Feature | AuthCore |
| --- | --- | --- |
| `POST /admins/users/userinfo` | User info by admin | `GET /admin/users/:id` (+ `GET /admin/users` list / search) |
| `POST /admins/users/create` | Create user by admin | `POST /admin/users` |
| `PUT /admins/userinfo/change/profile/picture` | Profile picture | **Not yet**: needs file storage (local / S3), planned with avatars |
| `POST /admins/users/resetpassword` | Reset password by admin | `POST /admin/users/:id/reset-password` (sends the reset email) |
| `POST /admins/users/force-reset-password` | Force reset (silent) | `POST /admin/users/:id/force-password-reset` |
| (added) | Edit, status, role, unlock, sessions, delete / restore / permanent | `PATCH /admin/users/:id`, `/status`, `/role`, `/unlock`, `/sessions`, `/sessions/revoke`, `DELETE`, `/restore`, `/permanent`, `/deletion-purge/run` |

## Checklist

### My account
- [x] View / update profile (names, username with uniqueness and reserved names)
- [x] Preferences: language, timezone (IANA-validated), notification settings (merged, defaults for old accounts)
- [x] Change email: password confirmation, code to the new address, single-use code, max attempts, resend cooldown, old address notified, new address verified
- [x] Deactivate (password, all sessions revoked, email)
- [x] Delete (scheduled with grace period, recoverable, all sessions revoked, email)
- [x] Account recovery: public, no enumeration, only self-closed accounts, cancels scheduled deletion
- [x] Permanent deletion of personal data (scheduled purge with a distributed lock; audit logs kept)
- [x] The last active ADMIN cannot close their own account
- [ ] Mobile number + verification *(needs an SMS provider)*
- [ ] Avatar *(needs file storage)*

### User administration
- [x] List / search / filter / sort / paginate (incl. deleted, pending deletion)
- [x] User info: sessions, groups, effective permissions, sign-in lock
- [x] Create (policy-checked initial password never emailed, must-change-password, verified email, groups with no-escalation rule, optional welcome email)
- [x] Edit profile and email (old address notified)
- [x] Status: activate / deactivate / suspend / ban with reason and email; sessions revoked; reactivation clears lock and scheduled deletion
- [x] Role ADMIN / USER (ADMIN callers only)
- [x] Reset password (email) and force password change (silent; enforced on every request)
- [x] Unlock, list sessions, sign out everywhere
- [x] Soft delete / restore / permanent delete
- [x] Guard rails: not on yourself, ADMIN targets only for ADMIN callers, last active ADMIN protected
- [x] Permissions: USER_READ / CREATE / UPDATE / DELETE / PASSWORD_MANAGE (+ system role USER_ADMIN)
- [x] Audit log for every action

### Invites
- [x] Single and bulk (up to 100), groups + message, no-escalation rule for groups
- [x] One pending invite per email (unique index); registered emails rejected
- [x] HMAC-stored tokens, never in URLs or logs; resend rotates the token
- [x] Statuses PENDING / ACCEPTED / REVOKED / EXPIRED (expiry computed)
- [x] Public info + accept (password policy, optional username, verified ACTIVE account, groups joined, single use even under parallel requests)
- [x] Resend cooldown, revoke, delete (accepted kept as history)
- [x] Permissions USER_INVITE / USER_READ; audit log
