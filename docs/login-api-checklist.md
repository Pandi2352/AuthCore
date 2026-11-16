# Login API: production checklist status

**`POST /api/v1/auth/login`**: sign in with **email + password** or **username + password** (no social providers).

Legend: `[x]` done and verified · `[ ]` → *deferred to the API named* (login already stores what that API needs).

Verified by an end-to-end test against MongoDB (11 groups, all passing) plus a regression run of the registration-flow suite.

---

## 1. Request design

```json
{ "email": "jane.doe@example.com", "password": "Str0ng!Passw0rd", "rememberMe": true }
{ "username": "janedoe",           "password": "Str0ng!Passw0rd" }
```

- [x] Login DTO (`modules/auth/dto/login.dto.ts`)
- [x] Email or username required (exactly one; both → 400)
- [x] Email format validated
- [x] Email / username normalized (trim + lowercase)
- [x] Password must be a string
- [x] Empty password rejected
- [x] Body size limit (global 100 KB) + password max 128 chars (caps hashing work)
- [x] Unexpected properties rejected (`role`, `status`, ... → 400)
- [x] Password never trimmed or modified (verified with leading/trailing spaces)
- [x] Optional `rememberMe`
- [x] Identifier strategy configurable: `LOGIN_IDENTIFIERS=email | username | email,username`

## 2. Find and validate user

- [x] Lookup by normalized email or username
- [x] User not found → same 401 as a wrong password
- [x] Soft-deleted accounts (`deletedAt`) treated as not found
- [x] Account status checked (only `ACTIVE` signs in)
- [x] Suspended → 403 `AUTH_ACCOUNT_SUSPENDED`
- [x] Locked (too many failures) → 429 `AUTH_TOO_MANY_FAILED_ATTEMPTS`
- [x] Disabled: `INACTIVE` → 403 `AUTH_ACCOUNT_INACTIVE`; `BANNED` / `REJECTED` → 403 `AUTH_ACCOUNT_DISABLED`
- [x] Email verification policy enforced
- [x] Pending admin approval → 403 `AUTH_ACCOUNT_PENDING_APPROVAL`
- [x] Nothing about status / role / verification is taken from the request

## 3. Password verification

- [x] Hash loaded only for login (`select: false` + `findCredentials`)
- [x] Argon2id verify (`PasswordService`)
- [x] Never decrypted, logged or returned (checked in responses and logs)
- [x] Generic `401 AUTH_INVALID_CREDENTIALS` "Invalid credentials" for every credential failure
- [x] Malformed / missing hash → treated as a wrong password (no 500)
- [x] Timing: dummy Argon2 verify when the user doesn't exist (measured: ~33 ms vs ~41 ms)
- [x] Hash upgraded on login when Argon2 settings were raised

## 4. Account state rules

| Account state | Response |
| --- | --- |
| `ACTIVE` + verified (or verification off) | 200 |
| `ACTIVE` + unverified, verification on | 403 `AUTH_EMAIL_NOT_VERIFIED` (resend + verify works, stays `ACTIVE`) |
| `PENDING_VERIFICATION` | 403 `AUTH_EMAIL_NOT_VERIFIED` |
| `PENDING_APPROVAL` | 403 `AUTH_ACCOUNT_PENDING_APPROVAL` |
| `SUSPENDED` | 403 `AUTH_ACCOUNT_SUSPENDED` |
| `INACTIVE` | 403 `AUTH_ACCOUNT_INACTIVE` |
| `BANNED`, `REJECTED` | 403 `AUTH_ACCOUNT_DISABLED` |
| Locked | 429 `AUTH_TOO_MANY_FAILED_ATTEMPTS` + `Retry-After` |
| Deleted / unknown / wrong password | 401 `AUTH_INVALID_CREDENTIALS` |

- [x] Status-specific 403s are returned **only after a correct password** (a wrong password always gets 401), so statuses can't be probed
- [x] Account status, verification status and sign-in eligibility kept separate
- [ ] Phone verification policy → *with mobile verification (Identity module)*

## 5. Attempt protection

- [x] Per-IP rate limit: 10 / minute (`429 TOO_MANY_REQUESTS`)
- [x] Per-account counter (email and username share it)
- [x] Unknown identifiers counted and locked identically (hashed in DB): a lock reveals nothing
- [x] `LOGIN_MAX_FAILED_ATTEMPTS` (5) within `LOGIN_FAILED_ATTEMPTS_WINDOW_MINUTES` (15) → lock `LOGIN_LOCKOUT_MINUTES` (15)
- [x] Always temporary; after the lock the full attempt count is available again
- [x] Success resets the counter
- [x] Lock checked before password verification (no hashing work while locked)
- [ ] CAPTCHA / extra verification after suspicious activity → *Security module (CAPTCHA integration)*

## 6. JWT access token

- [x] HS256, secret `JWT_ACCESS_SECRET` (32+ chars, must differ from other secrets)
- [x] Algorithm pinned for sign **and** verify (`none`, HS512 rejected: tested)
- [x] 15 min (`JWT_ACCESS_TTL_SECONDS`), clock skew tolerance 5 s
- [x] Claims: `sub` (user UUID), `sid` (session), `jti` (UUID), `typ: "access"`, `iss`, `aud`, `iat`, `exp`
- [x] No personal data, no password
- [x] `AccessTokenService.verify()`: signature, algorithm, expiry, issuer, audience, `typ` (tampering, wrong secret, expired, wrong audience: rejected)
- [ ] Role claim → *RBAC module*
- [ ] Guard that accepts only verified tokens on protected routes → *`/me` API*
- [ ] Asymmetric keys (RS256 / ES256) + JWKS → *Level 2, Advanced Token & Cryptography*

## 7. Refresh token and sessions

- [x] 256-bit random refresh token; only its SHA-256 stored
- [x] Linked to a session with a token family id
- [x] 7 days, 30 with `rememberMe` (configurable)
- [x] Multiple devices; session limit `MAX_SESSIONS_PER_USER` (oldest revoked, reason `session_limit`)
- [x] Separate from the access token
- [ ] New token on every refresh, old one invalidated → *Refresh Token API*
- [ ] Reuse detection → revoke the whole family → *Refresh Token API*
- [ ] Logout / session revocation → *Logout APIs*

## 8. Device and session tracking

- [x] Session id (UUID v7, `sid` claim)
- [x] Device type, browser, OS, device name (e.g. "Chrome 131 on Windows 10", "Safari 18 on iOS 18.1") via `bowser` (MIT)
- [x] IP address (real client IP with `TRUST_PROXY_HOPS`)
- [x] Login time (`createdAt`), `lastUsedAt`, `expiresAt` (TTL cleanup), `revokedAt` / `revokedReason`
- [x] Concurrent sessions
- [ ] View / revoke one / revoke all sessions → *Session Management API*

## 9. Response

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": { "id": "01a1…", "email": "jane.doe@example.com", "username": "janedoe", "firstName": "Jane", "lastName": "Doe", "status": "ACTIVE", "isEmailVerified": true, "...": "..." },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "tokenType": "Bearer",
    "expiresIn": 900
  }
}
```

- [x] HTTP 200, `Cache-Control: no-store`
- [x] Sanitized user (no hash, no session internals)
- [x] Refresh token as cookie `authcore_refresh`: `HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth` (not readable by JavaScript, only sent to auth routes)
- [x] Browser-session cookie without `rememberMe`, persistent (30 days) with it
- [x] Mobile: `REFRESH_TOKEN_DELIVERY=body` (or `both`) returns `refreshToken` + `refreshTokenExpiresAt` in JSON; store in Keychain / Keystore
- [ ] Role in `user` → *RBAC module*

## 10. Error handling

| Scenario | Status |
| --- | --- |
| Success | 200 |
| Missing / invalid fields | 400 `VALIDATION_FAILED` |
| Invalid credentials | 401 `AUTH_INVALID_CREDENTIALS` |
| Not verified / pending approval / suspended / inactive / disabled | 403 (codes above) |
| Locked | 429 `AUTH_TOO_MANY_FAILED_ATTEMPTS` + `Retry-After` |
| Too many requests from one IP | 429 `TOO_MANY_REQUESTS` |
| Database unavailable | 503 |
| Unexpected error | 500 (generic) |

- [x] Centralized (global exception filter); standard envelope; no stack traces or DB errors

## 11. Logging and monitoring

- [x] `Login succeeded` (userId, sessionId, method, isPersistent, ipAddress, requestId)
- [x] `Login failed: invalid credentials` (userId or null, isKnownUser, method, ipAddress)
- [x] `Login locked after too many failed attempts` / `Login refused: locked ...`
- [x] `Login refused: account cannot sign in` (userId, status, code)
- [x] `Oldest sessions signed out (session limit)`, `Password hash upgraded`
- [x] Request id on every entry; user agent in the access log
- [x] No passwords, tokens or emails in logs (verified)
- [ ] Alerts → *monitoring setup*. Suggested: many `Login failed` for one `userId`, many lockouts per hour, many failures from one `ipAddress`

## 12. Swagger

- [x] Summary, description (identifiers, cookie behavior, every error code)
- [x] Request DTO with examples; success response; 400 / 401 / 403 / 429 / 500 documented

## 13–14. Testing

Automated tests are not part of this project for now (manual testing). The end-to-end check script covered:

- Valid login (email, username, any case / whitespace), remember me, multiple devices
- Wrong password, unknown email / username, malformed hash, empty / missing / extra fields
- Every account status (incl. deleted, ACTIVE + unverified)
- Lockout (known and unknown accounts), counter reset, shared email/username counter, per-IP limit
- JWT claims, algorithm, expiry, tampering, `none`, algorithm switch, wrong secret / audience
- Session stored with refresh-token hash, device, IP, expiry; session limit
- Config variants: email-only identifiers, body delivery, Argon2 upgrade
- Timing (unknown vs wrong password), no leakage in responses or logs

Refresh-token replay and concurrent refresh tests belong to the Refresh Token API.

## Configuration

| Variable | Default |
| --- | --- |
| `LOGIN_IDENTIFIERS` | `email,username` |
| `LOGIN_MAX_FAILED_ATTEMPTS` | `5` |
| `LOGIN_FAILED_ATTEMPTS_WINDOW_MINUTES` | `15` |
| `LOGIN_LOCKOUT_MINUTES` | `15` |
| `MAX_SESSIONS_PER_USER` | `10` |
| `JWT_ACCESS_SECRET` | **required** |
| `JWT_ACCESS_TTL_SECONDS` | `900` |
| `JWT_ISSUER` / `JWT_AUDIENCE` | `authcore` / `authcore-api` |
| `REFRESH_TOKEN_TTL_DAYS` / `REFRESH_TOKEN_REMEMBER_ME_TTL_DAYS` | `7` / `30` |
| `REFRESH_TOKEN_DELIVERY` | `cookie` (`body`, `both`) |
| `REFRESH_COOKIE_NAME` | `authcore_refresh` |
| `REFRESH_COOKIE_SAMESITE` | `strict` |
| `REFRESH_COOKIE_SECURE` | `true` (must be `true` in production and with `SameSite=None`) |
| `REFRESH_COOKIE_DOMAIN` | unset |

## Code

| File | Role |
| --- | --- |
| `modules/auth/auth.controller.ts` | Route, throttle, cookie |
| `modules/auth/auth.service.ts` | Login flow |
| `modules/auth/services/login-security.service.ts` + `schemas/login-attempt.schema.ts` | Failed attempts and lockout |
| `modules/auth/services/access-token.service.ts` | JWT issue / verify |
| `modules/auth/services/refresh-token-cookie.service.ts` | Cookie / body delivery |
| `modules/sessions/` | Session schema, creation, session limit, device parsing |
| `modules/users/users.service.ts` | `findCredentials`, `recordLogin`, `updatePasswordHash` |
| `shared/password.service.ts` | Argon2id verify, dummy verify, rehash check |
