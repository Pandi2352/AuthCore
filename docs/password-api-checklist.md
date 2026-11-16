# Forgot / Reset / Change Password: API checklist status

| API | Method | Endpoint | Auth |
| --- | --- | --- | --- |
| Forgot Password | POST | `/api/v1/auth/forgot-password` | public |
| Verify Reset OTP / Token | POST | `/api/v1/auth/verify-reset-token` | public |
| Reset Password | POST | `/api/v1/auth/reset-password` | public |
| Change Password | PATCH | `/api/v1/auth/change-password` | Bearer |

Legend: `[x]` done and verified · notes in *italics* explain how.

Verified by an end-to-end test against MongoDB (8 groups, 64 checks, OTP and link methods), a regression run of every earlier suite, and the Postman collection run.

---

## 1. Forgot Password: `POST /auth/forgot-password`

- [x] Accept email address
- [x] Validate email format *(400 VALIDATION_FAILED)*
- [x] Check user existence
- [x] Prevent email enumeration *(identical response for existing / unknown emails; lookup and email run in the background, so timing is identical too)*
- [x] Check account status *(only ACTIVE, PENDING_VERIFICATION, PENDING_APPROVAL get an email; suspended / banned / rejected / deactivated / deleted get none, same response)*
- [x] Generate secure random reset token / OTP *(`crypto.randomInt` 6-digit code, or 256-bit `randomBytes` link token; `PASSWORD_RESET_METHOD=otp|link`)*
- [x] Hash reset token before storing *(HMAC-SHA256 with `VERIFICATION_TOKEN_SECRET`)*
- [x] Token expiration *(`PASSWORD_RESET_TTL_MINUTES`, default 15)*
- [x] Invalidate previous unused reset tokens *(one reset per user, unique index; a new request replaces the code and any reset token)*
- [x] Send reset link / OTP by email
- [x] Rate limiting *(3 requests / minute / IP)*
- [x] Resend cooldown *(`PASSWORD_RESET_RESEND_COOLDOWN_SECONDS`, default 60, per account)*
- [x] Store request timestamp and expiry *(`lastSentAt`, `expiresAt`, `createdAt`)*
- [x] Log password reset request *(userId and IP only; unknown emails logged without the address)*

## 2. Verify Reset OTP / Token: `POST /auth/verify-reset-token`

- [x] Accept email + OTP, or the link token
- [x] Validate payload *(6-digit code, 43-char token, valid email)*
- [x] Check token existence
- [x] Verify token hash *(constant-time comparison)*
- [x] Check expiration
- [x] Check already used *(the code is cleared once verified)*
- [x] Track invalid attempts
- [x] Invalidate after max failed attempts *(`PASSWORD_RESET_MAX_ATTEMPTS`, default 5 → AUTH_RESET_ATTEMPTS_EXCEEDED; reset deleted)*
- [x] Short-lived reset authorization token *(`resetToken`, single use, `PASSWORD_RESET_AUTH_TTL_MINUTES` default 10; issued atomically, so two parallel verifies can't both succeed)*

## 3. Reset Password: `POST /auth/reset-password`

- [x] Accept reset authorization token, new password, confirm password
- [x] Validate password strength *(same policy as registration)*
- [x] Password and confirm match *(`@Match` validator)*
- [x] Check against previous passwords *(current + last `PASSWORD_HISTORY_SIZE`, default 5 → AUTH_PASSWORD_REUSED)*
- [x] Must not contain email name, username or names
- [x] Verify reset token and its expiration *(AUTH_INVALID_RESET_TOKEN)*
- [x] Hash with Argon2id
- [x] Update password *(conditional on the old hash: a concurrent change makes the reset fail instead of overwriting)*
- [x] Mark reset token as used *(atomic `findOneAndDelete`; two parallel resets: exactly one succeeds)*
- [x] Invalidate outstanding reset tokens
- [x] Revoke all sessions / refresh tokens *(reason `password_reset`)*
- [x] Send password changed confirmation email
- [x] Success response *("Password reset. Sign in with your new password.")*
- [x] Also: clears the sign-in lockout; a rejected new password keeps the token valid for a retry; the account status is checked again (banned meanwhile → 403)

## 4. Change Password: `PATCH /auth/change-password`

- [x] Require authentication (global JWT guard)
- [x] Accept current, new and confirm password
- [x] Validate payload *(unknown fields rejected)*
- [x] Verify current password *(AUTH_INVALID_CURRENT_PASSWORD; counts toward the sign-in lockout → 429 after 5)*
- [x] New and confirm match
- [x] Password strength
- [x] Prevent reuse of current password
- [x] Password history *(last `PASSWORD_HISTORY_SIZE`; history capped)*
- [x] Hash new password
- [x] Update password *(atomic, conditional on the current hash)*
- [x] Revoke other active sessions *(reason `password_changed`)*
- [x] Decide on current session *(policy: **current device stays signed in**, `isCurrentSessionKept: true`)*
- [x] Send password changed email
- [x] Log password change *(and failed attempts)*
- [x] Also: cancels any pending password reset

## 5. Security & Database

- [x] Only hashed reset tokens stored
- [x] No plain-text passwords stored (Argon2id; history stores hashes, never returned by any API)
- [x] Cryptographically secure random tokens
- [x] Atomic DB updates for token consumption
- [x] Token reuse prevented
- [x] Brute force prevented *(attempt limit, IP throttles, lockout on change)*
- [x] IP-based and account-based limits *(IP throttles; per-account cooldown and attempt limit)*
- [x] No sensitive data in logs *(verified: no codes, tokens or passwords in log output)*
- [x] HTTPS *(enforced at deployment / reverse proxy; HSTS via helmet)*
- [x] MongoDB indexes *(`userId` unique, `codeHash`, `authorizationHash`)*
- [x] TTL cleanup *(`expiresAt` TTL index on `password_resets`)*
- [x] Concurrent reset requests handled *(one record per user, atomic exchange and consumption)*
- [x] Generic error responses where appropriate
- [x] Audit logs *(requested, verified, reset, changed, failed attempts)*

## Configuration

`PASSWORD_RESET_METHOD`, `PASSWORD_RESET_URL`, `PASSWORD_RESET_TTL_MINUTES`, `PASSWORD_RESET_MAX_ATTEMPTS`, `PASSWORD_RESET_RESEND_COOLDOWN_SECONDS`, `PASSWORD_RESET_AUTH_TTL_MINUTES`, `PASSWORD_HISTORY_SIZE`. See the backend README.

## Not in this sprint

- Password expiration policy, breached-password check (HIBP), admin "force password reset": later modules.
