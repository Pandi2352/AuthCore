# AuthCore — Level 1 Modules (MVP)

**Level 1: Modules 1–20 — Complete reusable authentication**

Complete Auth System – Module Blueprint. Complete module checklist for NestJS + MongoDB.

- Level 2 (Modules 21–24): [level-2-modules.md](./level-2-modules.md)
- Level 3 (Modules 25–28): [level-3-modules.md](./level-3-modules.md)

Modules are numbered in build order: Module 1 = Sprint 1. See the [sprint plan](#sprint-plan-build-order) at the bottom of this file.

---

## 1. Common Infrastructure Module

- [ ] Global exception filter
- [ ] Global validation pipe
- [ ] Common response format
- [ ] Common error response format
- [ ] Custom exception classes
- [x] Authentication guards *(global `JwtAuthGuard`, secure by default)*
- [ ] Authorization guards
- [x] Custom decorators *(`@Public()`, `@CurrentUser()`, `@ClientInfoParam()`, `@ResponseMessage()`, ...)*
- [ ] Interceptors
- [ ] Middleware
- [ ] Request ID generation
- [ ] Structured logging (Pino/Winston)
- [ ] Configuration module
- [ ] MongoDB connection module
- [ ] Redis connection module
- [ ] Database indexes
- [ ] TTL indexes
- [ ] Health check endpoints
- [ ] Swagger/OpenAPI documentation
- [ ] API versioning
- [ ] File storage integration

## 2. Identity & User Management Module

- [x] User registration *(`POST /api/v1/auth/register`)*
- [ ] User login identity (email/username/mobile)
- [ ] User profile management
- [x] Get current user profile *(`GET /api/v1/auth/me`)*
- [ ] Update user profile
- [ ] Change email address
- [ ] Change mobile number
- [x] Email verification status
- [ ] Mobile number verification
- [x] Account activation *(email verification and/or admin approval → `ACTIVE`; CLI approve/reject)*
- [ ] Account deactivation
- [ ] Account suspension
- [ ] Account banning
- [ ] Account soft deletion
- [ ] Account permanent deletion
- [ ] Account recovery
- [ ] User avatar management
- [ ] User preferences
- [ ] User status management

## 3. Authentication Module

- [x] Register *(`POST /api/v1/auth/register`)*
- [x] Login *(`POST /api/v1/auth/login`: email or username + password)*
- [ ] Logout
- [ ] Logout from all devices
- [x] JWT access token generation *(HS256, 15 min; `sub`, `sid`, `jti`, `iss`, `aud`)*
- [x] JWT access token validation *(every request: signature, alg, exp, iss, aud, typ + active session + account status)*
- [x] Refresh token generation *(256-bit random, SHA-256 stored; rotation comes with the refresh API)*
- [x] Refresh token rotation *(`POST /api/v1/auth/refresh`: new token every refresh, atomic)*
- [x] Refresh token validation
- [x] Refresh token reuse detection *(rotated-token history; 10 s grace for parallel tabs)*
- [x] Token family management
- [x] Token family revocation *(on reuse; session expiry never extended)*
- [x] Token expiration management
- [x] Token revocation *(revoked session → its access tokens rejected immediately)*
- [x] Authentication guards
- [x] Public route decorator
- [x] Current user decorator
- [ ] Authentication strategy management
- [x] Authentication method tracking *(email / username logged per login)*

## 4. Session & Device Management Module

- [x] Create user session
- [ ] List active sessions
- [ ] Get session details
- [ ] Revoke individual session
- [ ] Revoke all sessions
- [x] Device identification
- [x] Device information tracking
- [x] Browser and OS tracking
- [x] IP address tracking
- [ ] Login location tracking
- [x] Last active tracking *(set on login; updated on refresh later)*
- [x] Session expiration
- [x] Concurrent session management *(`MAX_SESSIONS_PER_USER`, oldest revoked)*
- [ ] New device detection
- [ ] Suspicious session detection

## 5. Email & Notification Module

- [x] Email service integration *(`MailService`: SMTP + development outbox)*
- [x] SMTP configuration
- [ ] Email templates
- [ ] Welcome email
- [x] Email verification email
- [ ] Password reset email
- [ ] Password changed notification
- [ ] New device login alert
- [ ] Suspicious login alert
- [ ] Account locked notification
- [ ] MFA enabled/disabled notification
- [ ] Organization invitation email
- [ ] Email queue integration (BullMQ)
- [ ] Email retry mechanism
- [ ] Email delivery status tracking

## 6. Email Verification Module

- [x] Email verification token generation
- [x] Email verification OTP generation
- [x] Send verification email
- [x] Verify email using token
- [x] Verify email using OTP
- [x] Resend verification email
- [x] OTP expiration *(10 min; links 60 min; TTL index cleanup)*
- [x] OTP attempt limits *(5 attempts, then a new code is required)*
- [x] OTP resend cooldown *(60 s)*
- [x] Verification token invalidation *(single use; a resend replaces the previous code/link)*

## 7. Password Management Module

- [ ] Forgot password
- [ ] Password reset token generation
- [ ] Password reset verification
- [ ] Reset password
- [ ] Change password
- [ ] Current password verification
- [ ] Password history
- [ ] Password reuse prevention
- [x] Password strength validation *(registration policy; reused for change/reset)*
- [ ] Password policy management
- [ ] Password expiration policy (optional)
- [ ] Breached password checking (optional)
- [ ] Revoke existing sessions after password reset
- [ ] Notify user after password change

## 8. Role-Based Access Control (RBAC) Module

- [ ] Create roles
- [ ] Update roles
- [ ] Delete roles
- [ ] List roles
- [ ] Assign roles to users
- [ ] Remove roles from users
- [ ] Multiple roles per user
- [ ] Default role assignment
- [ ] System roles
- [ ] Custom roles
- [ ] Role hierarchy
- [ ] Role-based guards
- [ ] Roles decorator (`@Roles()`)
- [ ] Role validation

## 9. Permission Management Module

- [ ] Create permissions
- [ ] Update permissions
- [ ] Delete permissions
- [ ] List permissions
- [ ] Assign permissions to roles
- [ ] Remove permissions from roles
- [ ] Direct user permissions
- [ ] Permission-based guards
- [ ] Permissions decorator (`@Permissions()`)
- [ ] Permission validation
- [ ] Permission grouping by module
- [ ] Resource-level permissions
- [ ] Ownership-based authorization
- [ ] Policy-based authorization
- [ ] Permission inheritance
- [ ] Dynamic permission evaluation

## 10. Security & Protection Module

- [x] Password hashing (Argon2/bcrypt) *(Argon2id via `@node-rs/argon2`, `PasswordService`)*
- [x] Refresh token hashing
- [ ] Helmet security headers
- [ ] CORS configuration
- [x] CSRF protection *(refresh cookie: SameSite=Strict + Origin/Referer allowlist check)*
- [ ] XSS protection
- [ ] NoSQL injection protection
- [ ] Input sanitization
- [ ] Request validation
- [ ] Request rate limiting
- [x] Login brute-force protection
- [x] Account lockout *(temporary, per account and per unknown identifier)*
- [x] OTP brute-force protection *(attempt limit + per-IP rate limit + HMAC-stored codes)*
- [ ] Password reset abuse protection
- [ ] CAPTCHA integration
- [ ] IP-based restrictions
- [ ] Suspicious login detection
- [ ] Replay attack protection
- [x] Secure cookie management *(HttpOnly, Secure, SameSite=Strict, path `/api/v1/auth`)*
- [ ] Secrets management
- [ ] Security headers configuration
- [ ] Sensitive data masking
- [x] Timing attack protection *(dummy Argon2 verify for unknown users)*

## 11. Audit Logs & Login History Module

- [ ] Successful login logs
- [ ] Failed login logs
- [ ] Logout logs
- [ ] Password change logs
- [ ] Password reset logs
- [ ] Email verification logs
- [ ] MFA activity logs
- [ ] Role modification logs
- [ ] Permission modification logs
- [ ] User activation/deactivation logs
- [ ] Session revocation logs
- [ ] API key activity logs
- [ ] Organization activity logs
- [ ] IP address tracking
- [ ] Device tracking
- [ ] Audit log search and filtering
- [ ] Audit log retention policy

## 12. Admin Management Module

- [ ] Admin login
- [ ] Admin user listing
- [ ] Search and filter users
- [ ] View user details
- [ ] Activate/deactivate users
- [ ] Suspend/ban users
- [ ] Unlock user accounts
- [ ] Assign/remove user roles
- [ ] Manage permissions
- [ ] Revoke user sessions
- [ ] Force password reset
- [ ] Manage organizations
- [ ] View audit logs
- [ ] View login history
- [ ] Security monitoring dashboard

## 13. Multi-Factor Authentication (MFA) Module

- [ ] Enable MFA
- [ ] Disable MFA
- [ ] TOTP authentication
- [ ] Authenticator app integration
- [ ] QR code generation
- [ ] OTP verification
- [ ] Backup recovery codes
- [ ] Backup code regeneration
- [ ] Backup code consumption tracking
- [ ] MFA challenge during login
- [ ] MFA recovery process
- [ ] Email OTP authentication (optional)
- [ ] SMS OTP authentication (optional)
- [ ] MFA enforcement policies

## 14. OAuth & Social Login Module

- [ ] Google authentication
- [ ] GitHub authentication
- [ ] Facebook authentication
- [ ] Microsoft authentication
- [ ] OAuth callback handling
- [ ] OAuth state validation
- [ ] OAuth account linking
- [ ] OAuth account unlinking
- [ ] Multiple social accounts per user
- [ ] Social account synchronization
- [ ] OAuth token management
- [ ] Automatic account linking policies

## 15. Passwordless Authentication Module

- [ ] Magic link generation
- [ ] Magic link email delivery
- [ ] Magic link validation
- [ ] Magic link expiration
- [ ] Single-use magic links
- [ ] Passwordless login
- [ ] Passkey registration
- [ ] Passkey authentication (WebAuthn)
- [ ] Passkey removal
- [ ] Passkey device management

## 16. Multi-Tenancy & Organization Module

- [ ] Organization registration
- [ ] Organization management
- [ ] Organization profile
- [ ] Organization settings
- [ ] Organization invitations
- [ ] Accept/reject invitations
- [ ] Organization membership
- [ ] Organization member management
- [ ] Organization-specific roles
- [ ] Organization-specific permissions
- [ ] Organization switching
- [ ] Tenant identification
- [ ] Tenant isolation
- [ ] Tenant-level access control
- [ ] Tenant-specific configuration
- [ ] Tenant subscription status
- [ ] Tenant deactivation

## 17. API Key Management Module

- [ ] Generate API keys
- [ ] API key validation
- [ ] API key hashing
- [ ] API key expiration
- [ ] API key revocation
- [ ] API key regeneration
- [ ] API key permissions/scopes
- [ ] API key usage tracking
- [ ] API key rate limiting
- [ ] Service-to-service authentication

## 18. Configuration & Policy Management Module

- [x] JWT configuration
- [x] Access token expiry configuration
- [x] Refresh token expiry configuration
- [ ] Password policy configuration
- [ ] MFA policy configuration
- [ ] Session timeout configuration
- [x] Maximum concurrent sessions
- [x] Login attempt limits
- [x] Account lockout duration
- [ ] OTP expiry and retry configuration
- [ ] Email configuration
- [ ] OAuth provider configuration
- [ ] CORS configuration
- [ ] Environment configuration validation
- [ ] Tenant-specific security policies

## 19. Testing & Quality Module

- [ ] Unit testing
- [ ] Integration testing
- [ ] E2E testing
- [ ] Registration tests
- [ ] Login tests
- [ ] JWT validation tests
- [ ] Refresh token rotation tests
- [ ] Refresh token reuse detection tests
- [ ] Session management tests
- [ ] Password reset tests
- [ ] MFA tests
- [ ] OAuth tests
- [ ] RBAC tests
- [ ] Permission guard tests
- [ ] Tenant isolation tests
- [ ] Rate limiting tests
- [ ] Brute-force protection tests
- [ ] Security vulnerability testing
- [ ] Test coverage reporting
- [ ] Dependency vulnerability audit

## 20. DevOps & Deployment Module

- [ ] Dockerfile
- [ ] Docker Compose
- [ ] MongoDB container
- [ ] Redis container
- [ ] Environment-specific configuration
- [ ] Development environment
- [ ] UAT environment
- [ ] Production environment
- [ ] CI/CD pipeline
- [ ] ESLint
- [ ] Prettier
- [ ] Automated testing pipeline
- [ ] Dependency audit pipeline
- [ ] Build pipeline
- [ ] Deployment pipeline
- [ ] Database migration/index management
- [ ] Logging and monitoring
- [ ] Backup and recovery
- [ ] Graceful shutdown
- [ ] Production security configuration

---

## Sprint plan (build order)

Don't attempt all 20 modules at once. Build one module per sprint, in this order, so you understand the security concepts properly. Each module only depends on modules above it.

| Sprint | Module | Priority | Depends on |
| --- | --- | --- | --- |
| 1 | Common Infrastructure | Essential | — |
| 2 | Identity & User Management | Essential | 1 |
| 3 | Authentication (JWT + Refresh Token) | Essential | 1, 2 |
| 4 | Session & Device Management | Essential | 3 |
| 5 | Email & Notification | Essential | 1 |
| 6 | Email Verification | Essential | 2, 5 |
| 7 | Password Management | Essential | 3, 4, 5 |
| 8 | Role-Based Access Control (RBAC) | Essential | 3 |
| 9 | Permission Management | Essential | 8 |
| 10 | Security & Protection | Essential | 3–9 |
| 11 | Audit Logs & Login History | Important | 3–10 |
| 12 | Admin Management | Important | 8, 9, 11 |
| 13 | Multi-Factor Authentication (MFA) | Advanced | 3, 5 |
| 14 | OAuth & Social Login | Advanced | 2, 3 |
| 15 | Passwordless Authentication | Advanced | 3, 5 |
| 16 | Multi-Tenancy & Organization | Advanced | 8, 9 |
| 17 | API Key Management | Advanced | 9 |
| 18 | Configuration & Policy Management | Advanced | All above |
| 19 | Testing & Quality | Throughout + final hardening | All above |
| 20 | DevOps & Deployment | Throughout + production release | All above |

**Milestones**

- **MVP release candidate:** after Sprint 12, the core auth system is usable end to end (Essential + Important).
- **Level 1 complete → production:** after Sprint 20.

**Rules for the sprints**

- **Testing (19) and DevOps (20) run throughout.** Write unit/E2E tests for each module in its own sprint. Set up ESLint, Prettier, Docker Compose (MongoDB + Redis) and environment configuration in Sprint 1. Sprints 19–20 are for full coverage, security testing, the CI/CD pipeline and the production deployment.
- **Configuration (18) starts in Sprint 1.** Environment configuration validation belongs in Sprint 1. Sprint 18 makes the remaining policies (password, MFA, session, OTP, tenant-specific) configurable instead of hardcoded.
- **Multi-Tenancy (16) comes late but should be planned early.** Keep schemas tenant-ready from Sprint 2, for example a reserved organization reference, so adding tenant isolation later doesn't mean rewriting earlier modules.
- **Basic password hashing is part of Sprint 3.** Login can't work without it. Sprint 10 adds the remaining protections: rate limiting, brute-force protection, lockout, Helmet, CSRF and the rest.

Original blueprint phase grouping, for reference:

| Phase | Modules | Priority |
| --- | --- | --- |
| 1 | Identity + Authentication | Essential |
| 2 | JWT + Refresh Token + Sessions | Essential |
| 3 | Email Verification + Password Management | Essential |
| 4 | RBAC + Permissions | Essential |
| 5 | Security & Protection | Essential |
| 6 | Email & Notifications | Essential |
| 7 | Audit Logs + Login History | Important |
| 8 | Admin Management | Important |
| 9 | MFA + Recovery Codes | Advanced |
| 10 | OAuth + Social Login | Advanced |
| 11 | Passwordless + Passkeys | Advanced |
| 12 | Multi-Tenancy + Organizations | Advanced |
| 13 | API Key Management | Advanced |
| 14 | Configuration + Policies | Advanced |
| 15 | Testing + Quality | Throughout |
| 16 | Infrastructure + DevOps | Throughout |

## Important architectural principles

These are particularly important if you want to reuse this authentication system in future projects.

1. **Modular architecture:** Every module should have a clear responsibility and minimal coupling.
2. **Reusable guards:** Authentication, roles and permissions should work across all future applications.
3. **Configurable policies:** Don't hardcode token expiration, password rules, OTP limits or session policies.
4. **Tenant isolation:** Never allow one organization to access another organization's data.
5. **Security by default:** New endpoints should not accidentally become publicly accessible.
6. **Centralized responses:** All APIs should follow one success/error response structure.
7. **Testable architecture:** Every security-critical feature should have automated tests.
8. **No secrets in code:** All secrets and environment-specific values should come from validated configuration.
9. **Auditability:** Security-sensitive operations should be traceable.
10. **Framework independence where practical:** Keep business logic separate from NestJS-specific implementation so it is easier to reuse.

## Key security decision: refresh tokens

For refresh tokens, store only hashes in MongoDB, rotate them atomically, and track token families. If a previously rotated token is reused, revoke the entire family. Use short-lived access tokens and design immediate revocation carefully.

## Recommendation

Treat this as your own standalone project: **AuthCore — a reusable authentication and authorization engine.**

Once completed, you should be able to integrate it into a new NestJS application and configure its modules instead of rebuilding authentication from scratch.
