# AuthCore Backend

NestJS API for AuthCore, a reusable authentication and authorization service. This guide covers installing, running and working on the backend. For the project overview see the [root README](../README.md); for every setup decision see the [setup checklist](../docs/backend/project-setup-checklist.md).

## Contents

1. [Installation](#1-installation)
2. [Local development](#2-local-development)
3. [Environment variables](#3-environment-variables)
4. [npm scripts](#4-npm-scripts)
5. [Architecture and folder structure](#5-architecture-and-folder-structure)
6. [Database](#6-database)
7. [Swagger](#7-swagger)
8. [API response standards](#8-api-response-standards)
9. [Security configuration](#9-security-configuration)
10. [Logging and health checks](#10-logging-and-health-checks)
11. [Docker](#11-docker)
12. [Deployment](#12-deployment)

---

## 1. Installation

### Requirements

| Tool | Version | Notes |
| --- | --- | --- |
| Node.js | 20.19.4 | Pinned in `.nvmrc` and `package.json` `engines` |
| npm | 10.8+ | Comes with Node 20 |
| MongoDB | 8.x | Local install, Docker, or a hosted cluster |
| Docker | Optional | Only for building the container image |

With nvm: `nvm use` (reads `.nvmrc`).

### Install

```bash
cd authcore-backend
npm ci                 # exact versions from package-lock.json
cp .env.example .env   # then edit .env
```

Use `npm ci`, not `npm install`, so everyone gets the locked dependency versions. Add or upgrade a package with `npm install <package>@<version>` and commit the updated `package-lock.json`.

## 2. Local development

### Start

1. Start MongoDB (e.g. the Windows service, `mongod`, or `docker run -d -p 27017:27017 mongo:8`).
2. Make sure `.env` has at least `MONGODB_URI` and `CORS_ORIGIN`.
3. Run:

```bash
npm run start:dev
```

The server restarts on file changes. On success the log ends with:

```text
info [Bootstrap] AuthCore API listening on port 3000 (development), prefix /api/v1, log level debug, format pretty
```

| URL | |
| --- | --- |
| http://localhost:3000/api/v1 | API base |
| http://localhost:3000/api/v1/health | Health (database + uptime) |
| http://localhost:3000/api/docs | Swagger UI |

### Development workflow

1. Create the feature module under `src/modules/<name>/` (see [section 5](#5-architecture-and-folder-structure)).
2. Write DTOs for every request; document routes with the Swagger decorators.
3. Run `npm run lint` and `npm run format` while working.
4. **Run `npm run verify` before every commit.** It must pass.
5. Run the end-to-end tests: `npm run test:e2e:build` (separate port and database, see [test/e2e/README.md](test/e2e/README.md)). CI runs both on every push.
6. Test manually through Swagger or Postman (import `/api/docs/openapi.json`).

### Debugging

`npm run start:debug` starts with the Node inspector on port 9229; attach VS Code or Chrome DevTools (`chrome://inspect`).

### Common startup errors

| Message | Fix |
| --- | --- |
| `Config validation error: "MONGODB_URI" is required` | Create `.env` from `.env.example` |
| `"CORS_ORIGIN" must not be "*"` | List explicit origins |
| `"SWAGGER_ENABLED" must be false in production` | Swagger is not allowed in production |
| `MongooseServerSelectionError ... ECONNREFUSED` | MongoDB isn't running or `MONGODB_URI` is wrong |
| `listen EADDRINUSE ... :3000` | Another process uses the port; stop it or change `PORT` |

Every startup failure is logged as `fatal [Bootstrap] Startup failed: ...` and the process exits with code 1.

## 3. Environment variables

All configuration comes from environment variables, validated by Joi at startup (`src/config/validation.ts`). Invalid or missing values stop the app with a list of every problem.

**Where values come from** (first match wins):

1. Real environment variables (always win)
2. `.env.<NODE_ENV>` (e.g. `.env.staging`)
3. `.env`

Only `.env.example` is committed. In staging/production use real environment variables or a secret manager, never files in the image.

**In code**, never read `process.env` (ESLint blocks it outside `src/config`). Inject the typed config:

```ts
constructor(
  @Inject(appConfig.KEY) private readonly app: ConfigType<typeof appConfig>,
) {}
```

Config groups: `appConfig`, `databaseConfig`, `securityConfig`, `lifecycleConfig`, `performanceConfig`, `loggingConfig`, `swaggerConfig` (all in `src/config/configuration.ts`).

### Required

| Variable | Rule | Example |
| --- | --- | --- |
| `MONGODB_URI` | `mongodb://` or `mongodb+srv://` URI | `mongodb://localhost:27017/authcore` |
| `CORS_ORIGIN` | Comma-separated `http(s)` origins; `*` rejected | `http://localhost:5173,https://app.example.com` |

### Application

| Variable | Default | Rule |
| --- | --- | --- |
| `NODE_ENV` | `development` | `development`, `staging`, `production` |
| `PORT` | `3000` | Valid port |
| `API_PREFIX` | `api` | Lowercase path, no version (`v1` is added) |

### Swagger

| Variable | Default | Rule |
| --- | --- | --- |
| `SWAGGER_ENABLED` | `false` | Must be `false` in production |
| `SWAGGER_PATH` | `api/docs` | Lowercase path |

### Security

| Variable | Default | Purpose |
| --- | --- | --- |
| `BODY_LIMIT` | `100kb` | Max JSON / form body (`b`, `kb`, `mb`) |
| `THROTTLE_TTL_MS` | `60000` | Rate-limit window |
| `THROTTLE_LIMIT` | `100` | Requests per window per client IP |
| `REQUEST_TIMEOUT_MS` | `30000` | Max time to receive a full request (min 5000) |
| `TRUST_PROXY_HOPS` | `0` | Number of proxies / load balancers in front of the app |

### Lifecycle

| Variable | Default | Purpose |
| --- | --- | --- |
| `SHUTDOWN_TIMEOUT_MS` | `10000` | Hard limit for graceful shutdown |
| `SHUTDOWN_DRAIN_DELAY_MS` | `0` dev / `5000` others | Readiness fails this long before the server closes |
| `HEALTH_DB_TIMEOUT_MS` | `1500` | MongoDB ping timeout in readiness |

### Registration flow

| Variable | Default | Rule |
| --- | --- | --- |
| `REGISTRATION_EMAIL_VERIFICATION` | `otp` | `none`, `otp`, `link` |
| `REGISTRATION_REQUIRE_APPROVAL` | `false` | Boolean |
| `APP_NAME` | `AuthCore` | Shown in emails |
| `EMAIL_OTP_LENGTH` | `6` | 6–8 |
| `EMAIL_OTP_TTL_MINUTES` | `10` | 1–60 |
| `EMAIL_LINK_TTL_MINUTES` | `60` | 5–1440 |
| `EMAIL_VERIFICATION_MAX_ATTEMPTS` | `5` | 3–10 |
| `EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS` | `60` | 30–3600 |
| `EMAIL_VERIFICATION_URL` | — | Frontend page; **required** when `link` |
| `VERIFICATION_TOKEN_SECRET` | — | **Required**; 32+ random chars (HMAC key for verification and password-reset codes) |

### Login, tokens and sessions

| Variable | Default | Rule |
| --- | --- | --- |
| `LOGIN_IDENTIFIERS` | `email,username` | `email`, `username` or `email,username` |
| `LOGIN_MAX_FAILED_ATTEMPTS` | `5` | 3–20 failures per account **+ IP** → that IP is locked out of the account |
| `LOGIN_MAX_FAILED_ATTEMPTS_PER_ACCOUNT` | `50` | Failures from all IPs together → the whole account locks |
| `FILES_ORPHAN_CLEANUP_INTERVAL_HOURS` · `FILES_ORPHAN_GRACE_MINUTES` | `24` · `60` | Orphan file cleanup (0 = off); files younger than the grace period are never touched |
| `PROJECT_CONFIG_PATH` | `./project.config.json` | Project identity file |
| `IGNORE_ENV_FILE` | `false` | `true`: read environment variables only, never `.env` files (tests, containers) |
| `LOGIN_FAILED_ATTEMPTS_WINDOW_MINUTES` | `15` | 1–1440 |
| `LOGIN_LOCKOUT_MINUTES` | `15` | 1–1440 (always temporary) |
| `MAX_SESSIONS_PER_USER` | `10` | 1–100; oldest session revoked above it |
| `JWT_ACCESS_SECRET` | — | **Required**; 32+ random chars; different from `VERIFICATION_TOKEN_SECRET` |
| `JWT_ACCESS_TTL_SECONDS` | `900` | 60–3600 |
| `JWT_ISSUER` / `JWT_AUDIENCE` | `authcore` / `authcore-api` | |
| `REFRESH_TOKEN_TTL_DAYS` | `7` | 1–90 |
| `REFRESH_TOKEN_REMEMBER_ME_TTL_DAYS` | `30` | 1–365 |
| `REFRESH_TOKEN_REUSE_GRACE_SECONDS` | `10` | 0–60; a just-rotated token still works this long (parallel tabs) |
| `REFRESH_TOKEN_DELIVERY` | `cookie` | `cookie` (browsers), `body` (mobile), `both` |
| `REFRESH_COOKIE_NAME` | `authcore_refresh` | |
| `REFRESH_COOKIE_SAMESITE` | `strict` | `strict`, `lax`, `none` (needs Secure) |
| `REFRESH_COOKIE_SECURE` | `true` | Must be `true` in production |
| `REFRESH_COOKIE_DOMAIN` | unset | Set to share the cookie across subdomains |

### Password reset and change

| Variable | Default | Rule |
| --- | --- | --- |
| `PASSWORD_RESET_METHOD` | `otp` | `otp` (6-digit code by email) or `link` |
| `PASSWORD_RESET_URL` | — | Frontend page; **required** when `link` (`?token=` is appended) |
| `PASSWORD_RESET_TTL_MINUTES` | `15` | 5–60; code / link validity |
| `PASSWORD_RESET_MAX_ATTEMPTS` | `5` | 3–10 wrong codes, then a new code is needed |
| `PASSWORD_RESET_RESEND_COOLDOWN_SECONDS` | `60` | 30–3600; minimum time between reset emails per account |
| `PASSWORD_RESET_AUTH_TTL_MINUTES` | `10` | 1–30; validity of the `resetToken` from verify |

Password rules themselves (length, complexity, history, expiry) are not env vars: they are the **password policy**, managed through the API (see below).

### Scheduled jobs

| Variable | Default | Rule |
| --- | --- | --- |
| `SCHEDULER_ENABLED` | `true` | `false` on instances that must never run jobs |
| `SCHEDULER_POLL_SECONDS` | `30` | 5–300; how often each instance checks for due jobs |

### Access control

| Variable | Default | Rule |
| --- | --- | --- |
| `ACCESS_INHERIT_PARENT_GROUPS` | `false` | `true`: members of a sub-group also get the roles of its parent groups |

### Account self-service and invites

| Variable | Default | Rule |
| --- | --- | --- |
| `ACCOUNT_CODE_TTL_MINUTES` | `15` | 5–60; email-change / recovery code validity |
| `ACCOUNT_CODE_MAX_ATTEMPTS` | `5` | 3–10 |
| `ACCOUNT_CODE_RESEND_COOLDOWN_SECONDS` | `60` | 30–3600 |
| `ACCOUNT_DELETION_GRACE_DAYS` | `14` | 0–90; "delete my account" → permanent purge (0 = next run) |
| `STORAGE_DRIVER` | `local` | Where uploaded files are stored (`local` = a folder; more drivers can be added) |
| `STORAGE_LOCAL_DIR` | `uploads` | Folder for uploads, relative to the project folder or absolute (git-ignored; mount a volume in Docker) |
| `FILES_PUBLIC_BASE_URL` | `http://localhost:3000/api/v1/files/public` | Base of public file URLs (avatars): `<base>/<fileId>` |
| `UPLOAD_MAX_FILE_SIZE_MB` | `10` | Largest upload (1–100) |
| `UPLOAD_AVATAR_MAX_SIZE_MB` | `2` | Largest profile picture |
| `UPLOAD_MAX_FILES_PER_USER` | `200` | Files one user can own (avatars excluded) |
| `IMAGE_AVATAR_SIZE` | `512` | Avatars are cropped to this square (px) |
| `IMAGE_MAX_DIMENSION` | `4096` | Image documents are shrunk to fit (never enlarged) |
| `IMAGE_QUALITY` | `85` | JPEG / WebP quality when re-encoding |
| `IMAGE_MAX_INPUT_PIXELS` | `50000000` | Larger images are rejected before decoding (decompression bombs) |
| `VIRUS_SCAN_ENABLED` | `false` | Scan uploads with ClamAV (set `true` in production) |
| `CLAMAV_HOST` · `CLAMAV_PORT` | `127.0.0.1` · `3310` | clamd TCP address |
| `CLAMAV_TIMEOUT_MS` | `15000` | Per-scan timeout |
| `VIRUS_SCAN_FAIL_CLOSED` | `true` | Scanner unreachable: `true` = reject uploads (503), `false` = accept them unscanned (`SCAN_FAILED`, logged) |
| `JWT_ACCESS_PREVIOUS_SECRETS` | (empty) | Old JWT secrets still accepted during a key rotation (see docs/operations.md) |
| `METRICS_ENABLED` · `METRICS_TOKEN` | `true` · (empty) | Prometheus endpoint `GET /api/v1/metrics` (Bearer token; without one: open in dev, off in production) |
| `MAIL_DEFAULT_LANGUAGE` | `en` | Email language for people without an account (invites); users get theirs (`preferences.language`: en, ta, hi) |
| `BOOTSTRAP_ADMIN_ENABLED` | `true` | Create the first administrator at startup (see "First administrator") |
| `BOOTSTRAP_ADMIN_EMAIL` · `BOOTSTRAP_ADMIN_PASSWORD` | (empty) | Its sign-in; the password must meet the password policy (the sample `Test@123` is refused in production) |
| `BOOTSTRAP_ADMIN_FIRST_NAME` · `BOOTSTRAP_ADMIN_LAST_NAME` | `System` · `Admin` | Its name |
| `BOOTSTRAP_ADMIN_MUST_CHANGE_PASSWORD` | `true` | Must choose a new password at first sign-in |
| `NEW_DEVICE_ALERTS_ENABLED` | `true` | Email users when they sign in from a device (browser + OS) not seen before (users can turn it off: `loginAlerts`) |
| `ACCOUNT_LOCKED_EMAIL_ENABLED` | `true` | Email users when failed sign-ins lock their account |
| `KNOWN_DEVICE_RETENTION_DAYS` | `180` | A device unused this long counts as new again |
| `USER_ACTIVITY_RETENTION_DAYS` | `90` | 1–3650; recent-activity entries (sign-ins, password / email changes …) are removed after this (TTL index) |
| `ACCOUNT_PURGE_INTERVAL_MINUTES` | `60` | 1–1440 |
| `INVITE_ACCEPT_URL` | `http://localhost:5173/accept-invite` | Frontend page for invite links |
| `INVITE_TTL_DAYS` | `7` | 1–30 |
| `INVITE_RESEND_COOLDOWN_SECONDS` | `60` | 30–3600 |

### Mail

| Variable | Default | Rule |
| --- | --- | --- |
| `MAIL_TRANSPORT` | `outbox` (development), `smtp` (others) | `outbox` not allowed in production |
| `MAIL_OUTBOX_DIR` | `mail-outbox` | Development only; git-ignored |
| `MAIL_FROM` | — | **Required** for `smtp`, e.g. `AuthCore <no-reply@example.com>` |
| `SMTP_HOST` | — | **Required** for `smtp` |
| `SMTP_PORT` | `587` | |
| `SMTP_SECURE` | `false` | `true` = TLS on connect (465); `false` = STARTTLS required (587) |
| `SMTP_USER` / `SMTP_PASSWORD` | — | Optional |

### Password hashing (Argon2id)

| Variable | Default | Rule |
| --- | --- | --- |
| `ARGON2_MEMORY_KIB` | `19456` (19 MiB) | Min 19456 (OWASP) |
| `ARGON2_TIME_COST` | `2` | Min 2 |
| `ARGON2_PARALLELISM` | `1` | 1–16 |

### Performance

| Variable | Default | Purpose |
| --- | --- | --- |
| `HANDLER_TIMEOUT_MS` | `15000` | Max route handler time before `408` |
| `COMPRESSION_ENABLED` | `true` | gzip responses |
| `COMPRESSION_THRESHOLD_BYTES` | `1024` | Minimum size to compress |
| `MONGODB_QUERY_TIMEOUT_MS` | `10000` | Default `maxTimeMS` for queries |

### Logging

| Variable | Default | Values |
| --- | --- | --- |
| `LOG_LEVEL` | `debug` dev / `info` others | `fatal`, `error`, `warn`, `info`, `verbose`, `debug` |
| `LOG_FORMAT` | `pretty` dev / `json` others | `pretty`, `json` |
| `LOG_HTTP_REQUESTS` | `true` | Access log on/off |
| `LOG_FILE_ENABLED` | `false` | Also write rotated files |
| `LOG_DIR` | `logs` | File directory |
| `LOG_FILE_MAX_SIZE` | `20m` | Rotate at this size |
| `LOG_FILE_MAX_FILES` | `14d` | Keep this many days / files |

### MongoDB tuning

| Variable | Default | Purpose |
| --- | --- | --- |
| `MONGODB_MAX_POOL_SIZE` | `10` | Max connections in the pool |
| `MONGODB_MIN_POOL_SIZE` | `0` | Min connections kept open |
| `MONGODB_SERVER_SELECTION_TIMEOUT_MS` | `5000` | Time to find a server |
| `MONGODB_CONNECT_TIMEOUT_MS` | `10000` | Time to open a connection |
| `MONGODB_SOCKET_TIMEOUT_MS` | `45000` | Time to wait for a response |
| `MONGODB_RETRY_ATTEMPTS` | `5` | Startup connection retries |
| `MONGODB_RETRY_DELAY_MS` | `3000` | Delay between retries |
| `MONGODB_AUTO_INDEX` | `true` / `false` in production | Build indexes on startup |

## 4. npm scripts

| Script | Purpose |
| --- | --- |
| `start:dev` | Development server, restarts on change |
| `start:debug` | Development server with the debugger on port 9229 |
| `start` | Start without watch |
| `build` | Compile `src/` to `dist/` |
| `start:prod` | Run `dist/main.js` |
| `typecheck` | TypeScript check, no output |
| `lint` | ESLint with auto-fix (includes import sorting) |
| `lint:check` | ESLint, check only |
| `format` | Prettier write |
| `format:check` | Prettier, check only |
| `check:circular` | Fail on circular imports (madge) |
| `verify` | `lint:check` → `format:check` → `typecheck` → `check:circular` → `build` |
| `db:indexes` | Report missing / extra MongoDB indexes (after `build`) |
| `db:indexes:apply` | Create missing indexes; never drops |
| `audit:prod` | Vulnerability scan of production dependencies; fails on high/critical |
| `audit:all` | Vulnerability scan of all dependencies |
| `users:pending` | List registrations waiting for approval (after `build`) |
| `users:approve -- <email>` | Approve a registration |
| `users:reject -- <email> [reason]` | Reject a registration |
| `test:e2e [-- suites]` | End-to-end tests against `dist/` (port 3999, database `authcore_e2e`, never your `.env`) |
| `test:e2e:build` | `build` + all end-to-end suites |
| `project:init -- --name "…" --slug …` | Turn a copy of this backend into a new project (see "Project identity") |

## 5. Architecture and folder structure

```text
src/
├── main.ts                  Bootstrap: middleware order, security, Swagger, shutdown
├── app.module.ts            Root module + global guard, pipe, interceptors, filter
├── config/                  @config/*    Typed config (registerAs) + Joi validation
├── database/                @database/*  Mongoose connection, base schema, plugins, scripts
│   ├── schemas/base.schema.ts
│   ├── plugins/query-timeout.plugin.ts
│   └── scripts/indexes.ts
├── common/                  @common/*    Reusable building blocks, no business logic
│   ├── constants/  context/  decorators/  dto/  enums/  exceptions/
│   ├── filters/  interceptors/  interfaces/  logger/  middleware/
│   └── pipes/  swagger/  utils/
├── shared/                  @shared/*    App-wide services (LifecycleService)
└── modules/                 @modules/*   Feature modules
    └── health/
```

### Layer rules (enforced by `npm run verify`)

| Layer | May import | Must not import |
| --- | --- | --- |
| `modules/` | `common`, `shared`, `config`, `database`, other modules via their exported Nest module | |
| `shared/` | `common`, `config` | `modules` |
| `database/` | `common`, `config`, `mongoose` | `modules` |
| `config/` | `common` | `modules` |
| `common/` | Libraries only | `modules` |

Also enforced: no circular imports; controllers can't use `mongoose`, schemas or `@database/*`; no `new` on injectable classes; `process.env` only in `src/config`.

### Feature module layout

```text
src/modules/<name>/
├── <name>.module.ts
├── <name>.controller.ts     HTTP only: DTO in, call service, return result
├── <name>.service.ts        Business logic + database access
├── dto/                     *.dto.ts      class-validator + Swagger
├── schemas/                 *.schema.ts   extend BaseSchema
├── interfaces/              *.interface.ts
└── constants/               *.constants.ts
```

Generate with `npx nest g module|controller|service modules/<name>` (no spec files are generated).

### Naming

Files and folders: kebab-case with a type suffix (`user-session.service.ts`). Class names must match the file type (`UserSessionService`). Interfaces have no `I` prefix; boolean variables start with `is` / `has` / `can` / ...; enum members are PascalCase. Full rules: [checklist section 7](../docs/backend/project-setup-checklist.md).

### Request pipeline

```text
Request
  → requestIdMiddleware      X-Request-Id + request context
  → accessLogMiddleware      one log line per request
  → shutdownMiddleware       Connection: close during shutdown
  → helmet                   security headers
  → CORS                     origin allowlist
  → compression              gzip (not for no-store responses)
  → body parsers             size limit → bodyParserErrorHandler
  → SecurityMiddleware       allowed methods, no $ / dotted keys
  → ThrottlerGuard           rate limit
  → ValidationPipe           DTO whitelist + validation
  → RequestContextInterceptor → TimeoutInterceptor → ResponseInterceptor
  → Controller → Service
  → AllExceptionsFilter      any error → standard error envelope
```

## 6. Database

### Connection

Set up in `src/database/database.module.ts` with `MongooseModule.forRootAsync`, using `databaseConfig`:

- Connection string from `MONGODB_URI`; never logged (it may contain credentials).
- Pool: `maxPoolSize` 10, `minPoolSize` 0.
- Timeouts: server selection 5s, connect 10s, socket 45s.
- Startup: 5 retries, 3s apart, then the app exits. After that, the driver reconnects automatically.
- `retryWrites: true`; `strictQuery: true` globally.
- Every query and aggregation gets `maxTimeMS` = `MONGODB_QUERY_TIMEOUT_MS` unless it sets its own.
- Connection events are logged: connected, disconnected, reconnected, closed, error.
- Closed on shutdown, after in-flight requests finish.

### Schemas

Every schema extends `BaseSchema` and uses `baseSchemaOptions`:

```ts
@Schema({ ...baseSchemaOptions, collection: 'users' })
export class User extends BaseSchema {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email!: string;

  @Prop({ select: false })
  passwordHash!: string;
}
export const UserSchema = SchemaFactory.createForClass(User);
```

`baseSchemaOptions` gives `createdAt` / `updatedAt` (UTC), rejects unknown fields on save (`strict: 'throw'`), and outputs `id` instead of `_id` / `__v`.

### IDs: UUID v7, never ObjectId

- `BaseSchema` sets `_id` to a **UUID v7 string** on create (`generateUuid()` in `src/common/utils/uuid.util.ts`). v7 ids sort by creation time, which keeps MongoDB index inserts fast.
- References are UUID strings: `@Prop({ type: String, ref: 'User', index: true }) userId!: string;`
- Route params: `@Param('id', ParseIdPipe) id: string` (invalid → `400 INVALID_ID`). DTO fields: `@IsUUID()`.
- UUIDs are identifiers, not secrets. Tokens, reset codes and API keys use `crypto.randomBytes`.

| Helper | Returns |
| --- | --- |
| `generateUuid()` | New UUID v7 |
| `generateRandomUuid()` | New random UUID v4 (when the id must not reveal its creation time) |
| `isValidUuid(value)` / `isUuidV7(value)` | Validation |
| `getUuidV7Date(id)` | Creation time embedded in a v7 id |

### Indexes

- Declare indexes in schemas only.
- Development/staging build them on startup (`MONGODB_AUTO_INDEX`); production does not.
- Production: `npm run db:indexes` (report), then `npm run db:indexes:apply` (create). Nothing is dropped automatically.

### Query rules

Build filters from DTO fields only (never `find(req.body)`); paginate every list (`paginate()`, max 100); select only needed fields; use `.lean()` for reads. Full rules: [checklist sections 8 and 13](../docs/backend/project-setup-checklist.md).

## 7. Swagger

| URL | |
| --- | --- |
| `/api/docs` | Swagger UI |
| `/api/docs/openapi.json` | OpenAPI JSON (Postman, client generators) |
| `/api/docs/openapi.yaml` | OpenAPI YAML |

- Enabled with `SWAGGER_ENABLED=true` (the local `.env` does this). Off by default; startup fails if enabled in production.
- Generated from code: the Swagger CLI plugin documents every `*.dto.ts` from its types and validation rules. Add `@ApiProperty({ example })` for examples.
- Document each route:

```ts
@ApiTags(API_TAGS.Users.name)
@ApiStandardErrors()                                        // 429, 500
@Controller('users')
export class UsersController {
  @Post()
  @ApiOperation({ summary: 'Create a user' })
  @ResponseMessage('User created successfully')
  @ApiWrappedResponse(UserResponseDto, { status: HttpStatus.CREATED })
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, HttpStatus.CONFLICT)
  create(@Body() dto: CreateUserDto) { ... }
}
```

Add a tag per module in `src/common/constants/api-tags.constants.ts`.

## 8. API response standards

Routes: `/api/v1/<resource>` (kebab-case plural nouns). JSON fields are camelCase; dates are ISO 8601 UTC.

**Success** (added by `ResponseInterceptor`; controllers just return data):

```json
{
  "success": true,
  "message": "Request completed successfully",
  "data": {},
  "timestamp": "2026-11-14T10:00:00.000Z",
  "path": "/api/v1/example"
}
```

Lists returned with `paginate(items, page, limit, total)` also get `meta`: `page`, `limit`, `totalItems`, `totalPages`, `hasNextPage`, `hasPreviousPage`. Query: `?page=1&limit=20` (max 100).

**Error** (built by `AllExceptionsFilter` for every exception):

```json
{
  "success": false,
  "message": "Validation failed",
  "code": "VALIDATION_FAILED",
  "errors": [{ "field": "email", "message": "email must be an email" }],
  "statusCode": 400,
  "timestamp": "2026-11-14T10:00:00.000Z",
  "path": "/api/v1/example"
}
```

Clients branch on `code`, never on `message`. Every response has an `X-Request-Id` header.

**Throwing errors in services:**

```ts
throw new AppException(HttpStatus.CONFLICT, ErrorCode.DuplicateResource, 'Email is already registered');
throw new ValidationException([{ field: 'password', message: 'password is too weak' }]);
```

| Status | Used for |
| --- | --- |
| `200` / `201` | Success / created |
| `400` | Invalid input (`VALIDATION_FAILED`, `INVALID_ID`, `BAD_REQUEST`) |
| `401` / `403` | Not authenticated / not allowed |
| `404` | Not found |
| `408` | Handler timeout |
| `409` | Duplicate or conflict |
| `413` | Body too large |
| `429` | Rate limited |
| `500` | Unexpected error (generic message only) |
| `503` | Database unavailable, query timeout, not ready |

Error codes live in `src/common/constants/error-codes.constants.ts`. Full conventions: [checklist section 5](../docs/backend/project-setup-checklist.md).

## 9. Security configuration

| Protection | Setting |
| --- | --- |
| Security headers | helmet defaults (CSP, HSTS, nosniff, frameguard, no `X-Powered-By`) |
| CORS | `CORS_ORIGIN` allowlist only; credentials allowed; `*` rejected |
| Rate limiting | 100 requests / 60s per IP (`THROTTLE_*`); health endpoints exempt |
| Body size | `BODY_LIMIT` 100kb; `413` above |
| Input validation | Global `ValidationPipe`: whitelist, reject unknown fields, transform; values never echoed in errors |
| NoSQL injection | Keys starting with `$` or containing `.` rejected; Express 5 simple query parser; `strictQuery`; filters built from DTO fields |
| Mass assignment | DTO whitelist + schema `strict: 'throw'` |
| HTTP methods | Only GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD (`405` otherwise) |
| Timeouts | Request receive 30s, handler 15s, query 10s |
| Error details | Never in responses (no stacks, no DB messages); duplicate keys show field names only |
| Logs | Secrets redacted (passwords, tokens, keys, cookies, auth headers, JWTs, URI credentials); no bodies or headers logged |
| Compression | Never for `Cache-Control: no-store` responses (BREACH); set `no-store` on routes returning tokens |
| Secrets | Environment variables only; `.env` git- and docker-ignored |
| Dependencies | `npm run audit:prod` |

Behind a load balancer, set `TRUST_PROXY_HOPS` to the number of proxies so rate limiting sees real client IPs. The rate limiter is in-memory; use Redis storage when running more than one instance.

These are the foundation. Authentication, authorization, CSRF (for cookie-based auth) and session security are added with the feature modules.

## 10. Logging and health checks

**Logging** (Winston): pretty colored output in development, one JSON object per line in staging/production. Every entry has `timestamp`, `level`, `context`, `service`, `environment`, and `requestId` during a request.

```ts
private readonly logger = new Logger(UsersService.name);
this.logger.log({ message: 'User created', userId });
```

Log ids, never documents, request bodies or secrets. Search logs by the `X-Request-Id` a client reports.

**Health checks** (never rate limited, `Cache-Control: no-store`):

| Endpoint | Checks | Use for |
| --- | --- | --- |
| `GET /api/v1/health` | Database + not shutting down, plus uptime | Monitoring |
| `GET /api/v1/health/live` | Process answers | Liveness probe |
| `GET /api/v1/health/ready` | Database + not shutting down | Readiness probe / load balancer |

**Graceful shutdown** on SIGTERM/SIGINT: readiness fails → drain delay → server closes after in-flight requests → MongoDB closes; forced exit after `SHUTDOWN_TIMEOUT_MS`.

## 11. Docker

Files: `Dockerfile` and `.dockerignore` in this folder.

```bash
docker build -t authcore-backend .

docker run --rm -p 3000:3000 \
  -e MONGODB_URI="mongodb://host.docker.internal:27017/authcore" \
  -e CORS_ORIGIN="http://localhost:5173" \
  authcore-backend
```

| Image detail | |
| --- | --- |
| Base | `node:20.19.4-alpine3.22` (pinned) |
| Stages | `build` (all deps, compile) → `prod-deps` (production deps only) → `runtime` |
| Contents | `dist/`, production `node_modules`, `package.json`; no source, dev tools, npm, yarn or `.env` |
| User | Non-root `node` (uid 1000); app files read-only, only `/app/logs` writable |
| PID 1 | `tini`, so `docker stop` sends SIGTERM to Node for graceful shutdown |
| Environment | `NODE_ENV=production`, `PORT=3000`; everything else passed at runtime |
| Health check | `GET /api/v1/health/live` every 30s |

- `.dockerignore` is an allowlist: only `src/`, `package*.json`, `tsconfig*.json` and `nest-cli.json` enter the build context, so secrets can't leak into the image.
- `host.docker.internal` reaches MongoDB on your machine (Docker Desktop).
- Production defaults apply in the container: JSON logs, Swagger off (it must stay off), auto-indexing off.
- Stop with a grace period longer than `SHUTDOWN_TIMEOUT_MS`: `docker stop -t 30 <container>`.

## Implemented endpoints

Swagger (`/api/docs`) is the full, always-current reference. Summary:

### Registration flows

Each project picks its flow with two settings:

| `REGISTRATION_EMAIL_VERIFICATION` | `REGISTRATION_REQUIRE_APPROVAL` | Flow | Status after register |
| --- | --- | --- | --- |
| `none` | `false` | **Direct**: Register → Login | `ACTIVE` |
| `otp` | `false` | **Email OTP**: Register → Verify code → Login | `PENDING_VERIFICATION` |
| `link` | `false` | **Email link**: Register → Open link → Login | `PENDING_VERIFICATION` |
| `none` | `true` | **Admin approval**: Register → Pending → Approved → Login | `PENDING_APPROVAL` |
| `otp` / `link` | `true` | Verify email → Pending → Approved → Login | `PENDING_VERIFICATION` |

```text
PENDING_VERIFICATION ──verify──► ACTIVE              (approval off)
                     └─verify──► PENDING_APPROVAL    (approval on)
PENDING_APPROVAL ──approve──► ACTIVE
                 └─reject───► REJECTED
```

Only `ACTIVE` users will be able to sign in. Every response tells the client what to show next with `nextStep`: `VERIFY_EMAIL_OTP`, `VERIFY_EMAIL_LINK`, `AWAIT_APPROVAL` or `LOGIN`.

| Endpoint | Purpose | Rate limit / IP |
| --- | --- | --- |
| `POST /api/v1/auth/register` | Create the account; sends the code / link or the "pending approval" email | 5 / min |
| `POST /api/v1/auth/verify-email/otp` | `{ email, code }` (only when `otp`) | 10 / min |
| `POST /api/v1/auth/verify-email/link` | `{ token }` from the link (only when `link`) | 10 / min |
| `POST /api/v1/auth/verify-email/resend` | `{ email }`: new code / link | 3 / min |

**Email verification rules**

- OTP: 6 digits, valid 10 minutes, 5 wrong attempts then a new code is needed. Link: 256-bit token, valid 60 minutes.
- Single use; a resend replaces the previous code / link; resend at most once per 60 s.
- Only an HMAC-SHA256 of the code / token is stored (`VERIFICATION_TOKEN_SECRET`); expired records are deleted by a TTL index.
- The link points to the frontend (`EMAIL_VERIFICATION_URL?token=...`); the page POSTs the token to `/auth/verify-email/link`. Verification never happens on a GET.
- No account probing: a wrong code and an unknown email give the same error; resend always gives the same response.
- The endpoint for a method that isn't enabled returns `404`.
- If the email can't be sent, the account is still created and `isVerificationEmailSent` is `false`; the user can use resend.

**Admin approval (command line until the Admin module adds HTTP endpoints)**

```bash
npm run build
npm run users:pending                                   # list registrations waiting for approval
npm run users:approve -- jane@example.com               # → ACTIVE, emails the user
npm run users:reject  -- jane@example.com "Reason..."   # → REJECTED, emails the user (with reason)
```

Approve / reject only work on `PENDING_APPROVAL` users; the reviewer (`cli`) and time are stored.

**Emails in development**: with `MAIL_TRANSPORT=outbox`, every email is written to `mail-outbox/` as an `.eml` file (open it in any mail client or text editor) instead of being sent. Production requires `smtp`.

| Error code | Status | When |
| --- | --- | --- |
| `AUTH_INVALID_VERIFICATION_CODE` | 400 | Wrong / expired / used code, or unknown email |
| `AUTH_VERIFICATION_ATTEMPTS_EXCEEDED` | 400 | Too many wrong codes; request a new one |
| `AUTH_INVALID_VERIFICATION_TOKEN` | 400 | Invalid / expired / used link |

### `POST /api/v1/auth/register`

Creates an account. The starting status depends on the flow (see above). No tokens are issued.

| Field | Required | Rules |
| --- | --- | --- |
| `email` | Yes | Valid email, max 254; trimmed and stored lowercase; unique |
| `password` | Yes | 8–128 chars with lowercase, uppercase, number and symbol; must not contain the email name, username or names |
| `firstName` | Yes | 1–50 letters (any language), spaces, `'`, `-`, `.` |
| `lastName` | No | Same as `firstName`; empty string = not given |
| `username` | No | 3–30: lowercase letters, numbers, `.` `_` `-` (not first/last); stored lowercase; unique; reserved names (admin, root, support, ...) refused |

Any other field (e.g. `status`, `isEmailVerified`) is rejected.

| Response | When |
| --- | --- |
| `201` + `{ user, nextStep, isVerificationEmailSent }` (user: `id`, `email`, `username`, `firstName`, `lastName`, `status`, `isEmailVerified`, `emailVerifiedAt`, `createdAt`, `updatedAt`) | Created |
| `400 VALIDATION_FAILED` | Invalid fields (one message per field) |
| `409 DUPLICATE_RESOURCE` | Email or username already registered (field named in `errors`) |
| `429 TOO_MANY_REQUESTS` | More than 5 attempts per minute per IP |

### Implementation

| Module | Contents |
| --- | --- |
| `modules/auth` | `AuthController`, `RegistrationService` (flow logic), DTOs, `RegistrationNextStep`, policy constants |
| `modules/users` | `User` schema, `UsersService` (conditional status transitions), `UserApprovalService`, `scripts/user-approval.ts` |
| `modules/email-verification` | `EmailVerification` schema (TTL), `EmailVerificationService` (issue / verify / consume codes and tokens) |
| `modules/mail` | `MailService` (SMTP / outbox), templates (user input HTML-escaped) |
| `shared/password.service.ts` | Argon2id hash / verify / needsRehash |

The password hash is `select: false` and never mapped into responses. Logs contain user ids only: no emails, codes, tokens or passwords.

### `POST /api/v1/auth/login`

Sign in with **email + password** or **username + password** (`LOGIN_IDENTIFIERS`). Full checklist status: [docs/login-api-checklist.md](../docs/login-api-checklist.md).

```json
{ "email": "jane.doe@example.com", "password": "Str0ng!Passw0rd", "rememberMe": true }
```

`200` → `{ user, accessToken, tokenType: "Bearer", expiresIn: 900 }`, plus the refresh token:

- **Browsers (default)**: cookie `authcore_refresh`, `HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth`. JavaScript can't read it; it is only sent to auth routes. Without `rememberMe` it is a browser-session cookie (7-day session); with it, persistent (30 days).
- **Mobile** (`REFRESH_TOKEN_DELIVERY=body`): `refreshToken` and `refreshTokenExpiresAt` in the JSON. Store in Keychain / Keystore.

Use the access token as `Authorization: Bearer <accessToken>`. Claims: `sub` (user id), `sid` (session id), `jti`, `typ: "access"`, `iss`, `aud`, `iat`, `exp`. HS256 only.

| Response | When |
| --- | --- |
| `401 AUTH_INVALID_CREDENTIALS` | Wrong password, unknown / deleted account (always the same response and timing) |
| `403 AUTH_EMAIL_NOT_VERIFIED` | Email not verified (verify / resend, then sign in) |
| `403 AUTH_ACCOUNT_PENDING_APPROVAL` | Waiting for an administrator |
| `403 AUTH_ACCOUNT_SUSPENDED` / `AUTH_ACCOUNT_INACTIVE` / `AUTH_ACCOUNT_DISABLED` | Account can't sign in |
| `429 AUTH_TOO_MANY_FAILED_ATTEMPTS` | 5 failures from one IP in 15 min → that IP is locked out of the account for 15 min (`Retry-After`); 50 failures from all IPs → the whole account locks. Same for unknown emails |
| `429 TOO_MANY_REQUESTS` | More than 10 requests / minute from one IP |

403 codes are only returned after a correct password, so account statuses can't be probed.

Each login creates a **session** (`sessions` collection): device / browser / OS, IP, refresh-token SHA-256, token family id, `lastUsedAt`, `expiresAt` (TTL). At most `MAX_SESSIONS_PER_USER` active sessions; the oldest is revoked above that.

### `POST /api/v1/auth/refresh`

Exchanges the refresh token for a new access token. Same `200` body as login (`user`, `accessToken`, `tokenType`, `expiresIn`).

| Client | Send | Gets back |
| --- | --- | --- |
| Browser (cookie delivery) | No body; cookie `authcore_refresh` is sent automatically. Must come from an allowed origin (`Origin`, or `Referer`, in `CORS_ORIGIN`) | New access token + a new `authcore_refresh` cookie |
| Mobile (`REFRESH_TOKEN_DELIVERY=body`) | `{ "refreshToken": "..." }` | New access token + new `refreshToken` / `refreshTokenExpiresAt` in JSON |

**Rotation.** Every refresh replaces the refresh token; the old one stops working. The update is atomic, so two requests can't both use the same token. The session's expiry is **not** extended: a 7-day session ends after 7 days however often it is refreshed (30 days with remember me).

**Parallel refreshes.** If several tabs refresh at the same moment, the first rotates; the others (same old token, within `REFRESH_TOKEN_REUSE_GRACE_SECONDS`) get a new access token without rotation, and the browser keeps the new cookie. Mobile apps must not refresh in parallel; keep one refresh in flight.

**Reuse detection.** An already-rotated token presented after the grace window means the token was probably copied. The whole token family (the session) is revoked: `401 AUTH_REFRESH_TOKEN_REUSED`, and the user must sign in again. The last 100 rotated tokens per session are remembered (hashes only).

**Account checks.** The user must still exist and be allowed to sign in (same rules as login). Otherwise the session is revoked and the account's `403` code is returned.

| Response | When | Cookie |
| --- | --- | --- |
| `401 AUTH_INVALID_REFRESH_TOKEN` | Missing, unknown, expired or revoked | Cleared |
| `401 AUTH_REFRESH_TOKEN_REUSED` | Old token reused → session revoked | Cleared |
| `403 AUTH_INVALID_ORIGIN` | Cookie request from an untrusted / missing origin (CSRF) | Kept |
| `403 AUTH_ACCOUNT_*` / `AUTH_EMAIL_NOT_VERIFIED` | Account can no longer sign in → session revoked | Cleared |
| `429 TOO_MANY_REQUESTS` | More than 30 refreshes / minute from one IP | Kept |

Frontend pattern: on any API `401`, call `/auth/refresh` once, then retry the request; if refresh fails, go to sign-in.

### Authentication guard (all routes)

**Secure by default.** A global guard (`JwtAuthGuard`, registered as `APP_GUARD` in `AuthModule`) requires an access token on **every** route. Public routes opt out explicitly:

```ts
@Public()                       // whole controller or one route
@Post('login')
login(...) { ... }

@Get('me')                      // protected: no decorator needed
me(@CurrentUser() auth: AuthContext) {   // { userId, sessionId, tokenId }
  ...
}
```

Currently public: `GET /api/v1`, `/health*`, `register`, `login`, `refresh`, `verify-email/*`. Everything added later is protected unless marked `@Public()`.

On each protected request the guard checks:

1. `Authorization: Bearer <accessToken>` is present
2. The JWT: HS256 only, signature, expiry, issuer, audience, `typ: "access"`
3. The session (`sid`) is still active and belongs to the user: logout or a revoked session takes effect immediately, not after 15 minutes
4. The account can still sign in (same rules as login): a suspended user is locked out immediately

| Response | When |
| --- | --- |
| `401 AUTH_ACCESS_TOKEN_MISSING` | No `Authorization` header |
| `401 AUTH_ACCESS_TOKEN_EXPIRED` | Token expired: call `/auth/refresh`, then retry |
| `401 AUTH_ACCESS_TOKEN_INVALID` | Malformed, tampered, wrong algorithm / audience, not an access token |
| `401 AUTH_SESSION_REVOKED` | Session signed out / revoked, or user deleted: sign in again |
| `403 AUTH_ACCOUNT_*` / `AUTH_EMAIL_NOT_VERIFIED` | Account can no longer sign in |

All 401s include `WWW-Authenticate: Bearer realm="<slug>", error="..."` (slug from project.config.json) (RFC 6750). In Swagger, protected routes show a lock; use **Authorize** with the access token.

### `GET /api/v1/auth/me`

Returns the signed-in user (same fields as the login response's `user`). `Cache-Control: no-store`.

```bash
curl -H "Authorization: Bearer <accessToken>" http://localhost:3000/api/v1/auth/me
```

### `POST /api/v1/auth/logout` and `POST /api/v1/auth/logout-all`

Both require `Authorization: Bearer <accessToken>` (not the cookie, so another site can't sign a user out: no CSRF).

| Endpoint | Body | Effect | Response `data` | Cookie |
| --- | --- | --- | --- | --- |
| `/auth/logout` | none | Revokes **this** session (reason `logout`) | `null` | Cleared |
| `/auth/logout-all` | none or `{ "keepCurrentSession": false }` | Revokes **all** the user's sessions, incl. this one (`logout_all`) | `{ revokedSessionCount, isCurrentSessionKept: false }` | Cleared |
| `/auth/logout-all` | `{ "keepCurrentSession": true }` | Revokes all **other** sessions (`logout_others`); this device stays signed in | `{ revokedSessionCount, isCurrentSessionKept: true }` | Kept |

Revoked sessions take effect immediately: their access tokens get `401 AUTH_SESSION_REVOKED` on the next request (the guard checks the session), and their refresh tokens get `401 AUTH_INVALID_REFRESH_TOKEN`. Only the caller's own sessions can be revoked.

Frontend: if the access token has expired, call `/auth/refresh` and then log out; if refresh fails, the session is already unusable, so just clear the client state.

### Session management: `/api/v1/auth/sessions`

A signed-in user's own devices. All routes require `Authorization: Bearer <accessToken>`.

| Endpoint | Purpose | `data` |
| --- | --- | --- |
| `GET /auth/sessions` | List my active sessions, most recently used first | `SessionResponseDto[]` |
| `GET /auth/sessions/:sessionId` | One of my sessions | `SessionResponseDto` |
| `DELETE /auth/sessions/:sessionId` | Sign out that device | `{ revokedSessionId, isCurrentSession }` |

Each session: `id`, `deviceName` (e.g. "Safari 18 on iOS 18.1"), `deviceType`, `browser`, `os`, `ipAddress` (sign-in), `lastIpAddress` (latest refresh), `signedInAt`, `lastUsedAt`, `expiresAt`, `isPersistent` (remember me), `isCurrent` (this device). Token hashes, token family ids and raw user agents are never returned.

- Another user's session, or a revoked / expired one → `404 Session not found` (not 403, so ids can't be probed). Non-UUID ids → `400 INVALID_ID`.
- Revoking a device: its access and refresh tokens stop working immediately (reason `revoked_by_user`).
- Revoking the current device is the same as logout: reason `logout`, refresh cookie cleared, `isCurrentSession: true`.
- Not paginated: the list is bounded by `MAX_SESSIONS_PER_USER` (≤ 100).

Admin-side session management (any user's sessions) comes with the Admin module.

### Password: forgot, reset and change

```
forgot-password ──email──▶ code / link ──▶ verify-reset-token ──▶ resetToken ──▶ reset-password
change-password (signed in)
```

| Endpoint | Auth | Body | `data` |
| --- | --- | --- | --- |
| `POST /auth/forgot-password` | public | `{ email }` | `null` (always the same response) |
| `POST /auth/verify-reset-token` | public | OTP: `{ email, code }` · link: `{ token }` | `{ resetToken, expiresIn }` |
| `POST /auth/reset-password` | public | `{ resetToken, newPassword, confirmPassword }` | `null` |
| `PATCH /auth/change-password` | Bearer | `{ currentPassword, newPassword, confirmPassword }` | `{ revokedSessionCount, isCurrentSessionKept }` |

**Forgot password**
- Same 200 response, and same timing, whether or not the email is registered: the lookup and the email run in the background.
- No email for suspended, banned, rejected or deactivated accounts, or within `PASSWORD_RESET_RESEND_COOLDOWN_SECONDS` of the previous one.
- One pending reset per account: a new request replaces the previous code / link.

**Codes and tokens**
- 6-digit code (or 256-bit link token), valid `PASSWORD_RESET_TTL_MINUTES`. Only an HMAC is stored (`password_resets` collection, TTL index cleans up).
- `PASSWORD_RESET_MAX_ATTEMPTS` wrong codes delete the reset (`AUTH_RESET_ATTEMPTS_EXCEEDED`).
- A correct code is exchanged atomically for a single-use `resetToken` (`PASSWORD_RESET_AUTH_TTL_MINUTES`); the code stops working.

**New password rules** (reset and change)
- The password policy, the same one as registration (default: Test@123 format).
- `confirmPassword` must equal `newPassword`.
- Must not contain the email name, username, first or last name.
- All rules come from the password policy (below). Reuse: the current password and the last `passwordHistory.historyCount` are rejected (`AUTH_PASSWORD_REUSED`); previous hashes are kept in `passwordHistory` on the user (never returned).
- A rejected password doesn't consume the `resetToken`, so the user can try again.

**After a reset:** all sessions signed out, sign-in lockout cleared, "password was reset" email.

**After a change:** this device stays signed in, all other devices signed out, any pending reset cancelled, "password was changed" email. A wrong `currentPassword` returns `AUTH_INVALID_CURRENT_PASSWORD` and counts toward the sign-in lockout (shared with login, so a stolen access token can't be used to guess it).

**Rate limits per IP:** forgot 3/min, verify 10/min, reset 5/min, change 5/min.


### Password policy: `/api/v1/password-policies`

One policy for the whole service, stored in MongoDB and changed through the API without a restart (every instance picks it up within 15 seconds). Until an admin saves one, the built-in default applies: **8–64 characters, at least one uppercase letter, one lowercase letter, one digit and one special character** (e.g. `Test@123`), last 5 passwords blocked, common passwords blocked, no personal info, no whitespace, no expiry.

| Endpoint | Auth | Purpose |
| --- | --- | --- |
| `GET /password-policies/requirements` | public | Rules for sign-up / reset / change forms (numbers + a ready-to-show list) |
| `POST /password-policies/validate` | public | `{ password, email?, username?, firstName?, lastName? }` → `{ isValid, violations[] }` |
| `GET /password-policies` | PASSWORD_POLICY_READ | The **active** policy (`isDefault: true` while nothing is saved) |
| `PUT /password-policies` | PASSWORD_POLICY_MANAGE | Save the complete active policy (created and activated when none exists; `version` +1, audited) |
| `GET /password-policies/all` | PASSWORD_POLICY_READ | Every saved policy, the active one first (`isActive`) |
| `POST /password-policies` | PASSWORD_POLICY_MANAGE | New policy, saved **inactive** |
| `GET` / `PUT /password-policies/:id` | READ / MANAGE | One policy / save it (editing the active one applies at once) |
| `POST /password-policies/:id/activate` | PASSWORD_POLICY_MANAGE | Make it the one in force (the previous one stays, inactive; audited) |
| `POST /password-policies/:id/duplicate` | PASSWORD_POLICY_MANAGE | Inactive copy named "<name> (copy)" |
| `DELETE /password-policies/:id` | PASSWORD_POLICY_MANAGE | Delete an inactive policy (409 for the active one) |
| `GET /password-policies/history` | PASSWORD_POLICY_READ | Change history: who, when, IP, changed fields, old / new values (paginated) |
| `GET /password-policies/schedulers` | PASSWORD_POLICY_READ | Reminder job schedule + last / next run and status |
| `PUT /password-policies/schedulers` | PASSWORD_POLICY_MANAGE | `{ passwordExpiryNotification: { enabled, frequency, executionTime, timezone, dayOfWeek?, dayOfMonth? } }` |
| `POST /password-policies/schedulers/password-expiry-notification/run` | PASSWORD_POLICY_MANAGE | Run the reminder job now |

**Policy groups** (`PUT` body): `policyName`; `characterLength { minimum, maximum }` (8–128); `complexity { minimumDigitCount, minimumSpecialCharacterCount, requireUpperAndLowerCase, minimumUppercaseCount, minimumLowercaseCount }`; `passwordHistory { preventReuse, historyCount }` (0–24); `additionalRules { blockCommonPasswords, blockCompromisedPasswords, preventPersonalInfoInPassword, allowWhitespace, maximumRepeatedCharacters, minimumPasswordAgeHours }`; `passwordValidity { enabled, validityDays, notificationDaysBeforeExpiry[], gracePeriodDays, forceChangeOnExpiry }`.

- Field errors → `400 VALIDATION_FAILED` (nested paths, e.g. `characterLength.minimum`); contradictions (minimum > maximum, required characters don't fit, reminder days ≥ validity) → `400 INVALID_PASSWORD_POLICY`. Unknown fields are rejected.
- **Enforced in one place** (`PasswordValidationService`) for register, reset and change. All broken rules are returned at once, one `errors[]` entry each.
- `blockCompromisedPasswords` (off by default) checks [Have I Been Pwned](https://haveibeenpwned.com/API/v3#PwnedPasswords) with k-anonymity: only the first 5 characters of the SHA-1 hash leave the server. If the service is unreachable the check is skipped (logged). Stored Argon2 hashes can't be checked later, so there is no "breached password scan" job.
- `minimumPasswordAgeHours` applies to change-password only (not to a forgotten-password reset, and not when the password has expired).

**Password expiry** (`passwordValidity.enabled`): counted from `passwordChangedAt`.
- Login / refresh responses include `passwordExpiresAt` and `isPasswordChangeRequired`.
- After expiry + `gracePeriodDays`, with `forceChangeOnExpiry`, every protected route answers `403 AUTH_PASSWORD_EXPIRED` except `PATCH /auth/change-password`, `GET /auth/me` and logout.
- Turning expiry on applies to existing passwords immediately (passwords older than `validityDays` are expired at once).

**Reminder scheduler**: emails users whose password expires within the reminder days (only the nearest threshold, e.g. 2 days left → the "3 days" email).
- `frequency`: `HOURLY` (at the minute of `executionTime`), `DAILY`, `WEEKLY` (`dayOfWeek` 1 = Monday), `MONTHLY` (`dayOfMonth` 1–28); time zone aware (IANA, DST-safe).
- Every instance polls (`SCHEDULER_POLL_SECONDS`); a due job is claimed with an atomic database lock, so it runs once across replicas. Changes apply without a restart.
- No duplicate emails (unique record per user, password and threshold); failed sends are retried on later runs (3 attempts); a failed run is retried after 15 minutes. Run results are stored (`lastExecutionStatus`, `lastExecutionSummary`).

**Who may manage it:** reading needs `PASSWORD_POLICY_READ`, changing / running the job needs `PASSWORD_POLICY_MANAGE` (the default role `SUPER_ADMIN` has both; or create a role with them and give it to a group). Users with `role: ADMIN` (super admin) pass every check. Grant or remove ADMIN from the command line (takes effect on the user's next request):

```bash
npm run build
npm run users:role -- jane@example.com ADMIN
npm run users:role -- jane@example.com USER
```

### Access control (RBAC): roles, permissions, groups, access mapping

**Model:** User → Group → Role → Permission. A user's permissions are the union over all their groups' roles (active, non-deleted only, no duplicates). With `ACCESS_INHERIT_PARENT_GROUPS=true`, members of a sub-group also get the roles of its parent groups (off by default).

**Who may call what:** every endpoint needs a permission, checked by the global guard with `@RequirePermissions('ROLE_CREATE')`. Users with `role: ADMIN` (from `npm run users:role -- <email> ADMIN`) pass every check, so the service can't be locked out. On startup AuthCore seeds 24 system permissions (`ROLE_*`, `PERMISSION_*`, `GROUP_*`, `ACCESS_MAPPING_READ / ASSIGN / REVOKE`, `ACCESS_AUDIT_READ`, `PASSWORD_POLICY_READ / MANAGE`, `USER_READ / CREATE / UPDATE / DELETE / PASSWORD_MANAGE / INVITE`) and one built-in role, `SUPER_ADMIN`, holding every system permission (new ones are linked on each start). Every other role is created by admins. Built-in roles from older versions are removed on start (soft-deleted and taken off their groups). System entities can't be edited or deleted.

| Area | Endpoints |
| --- | --- |
| Roles | `POST /roles` · `GET /roles` · `GET /roles/dropdown` · `GET / POST /roles/categories` · `GET /roles/next-key` · `GET /roles/stats` · `GET /roles/exists` · `PATCH /roles/bulk` · `POST /roles/setup` · `GET / PATCH / DELETE /roles/key/:roleKey` · `GET / PATCH / DELETE /roles/:id` |
| Permissions | `POST /permissions` · `GET /permissions` · `GET /permissions/dropdown` · `GET /permissions/actions` · `GET /permissions/exists` · `GET / PATCH / DELETE /permissions/:id` |
| Groups | `POST /groups` · `GET /groups` · `GET /groups/dropdown` · `GET / POST /groups/categories` · `GET /groups/next-id` · `GET /groups/stats` · `GET /groups/tree` · `GET /groups/exists` · `GET /groups/code/:groupCode` · `GET / PATCH / DELETE /groups/:id` · `GET /groups/:id/children` · `GET /groups/:id/permission-matrix` |
| Access mapping | `POST /access-mappings/group-users` (+ `/remove`) · `POST /access-mappings/group-roles` (+ `/remove`) · `POST /access-mappings/role-permissions` (+ `/remove`) · `GET /access-mappings` · `DELETE /access-mappings/:id` · `GET /access-mappings/users/:userId/effective-access` |
| Other | `GET /access-control/me` (any signed-in user: my groups, roles, permission keys) · `GET /access-control/audit-logs` (who changed what: `changedByName`, `changedByEmail`, `entityLabel`; `search` by who or what) · `GET /access-control/audit-logs/stats` (page cards: total, last 24 hours, per action, people) |

**Fields**
- Role: `roleKey` (uppercase `A-Z 0-9 _ -`, unique; `GET /roles/next-key` suggests the next `ROLE-NN` via `common/utils/sequence-code.util.ts`), `roleName` (unique within its category, case-insensitive), `category` (built-in or admin-added via `POST /roles/categories`, stored in `role_categories`; SYSTEM reserved), `description` (no status: a role is always in effect; inactive roles from older data are switched back to active on start). `GET /roles/stats` returns the counts for the roles page.
- Permission: `permissionKey` (uppercase, unique), `permissionName` (unique, case-insensitive), `description`, `metadata: [{ key, value, action }]` (up to 20, unique keys, actions from `/permissions/actions`, plain-text values only), `status`.
- Group: `category` (built-in or admin-added via `POST /groups/categories`, stored in `group_categories`), `parentGroupId` (empty = main group), `groupId` (optional; same format as role keys: letters, digits, `_ -`, starts with a letter, stored uppercase; the next `GRP-NN` when empty, see `GET /groups/next-id`), `groupName` (unique among siblings), `description`, `tags` (comma-separated string or array; each tag letters, numbers, `_ - :`; stored lowercase without duplicates; max 20 × 30 chars). No status: a group is always in effect (inactive groups from older data are switched back to active on start). The list returns `memberCount` and `roleCount`; `GET /groups/stats` returns the counts for the groups page.

**Lists** (`GET /roles`, `/permissions`, `/groups`): `page`, `limit` (≤ 100), `search` (case-insensitive, literal), status / category filters, `createdFrom/To`, `updatedFrom/To`, `sortBy` (allowlisted) + `sortOrder`; default newest update first. Permissions also filter by `metadataKey`, `metadataValue`, `action`; groups by `parentGroupId`, `level=ROOT|CHILD`, `tags=a,b` + `tagMode=ANY|ALL`. **Dropdowns** are separate endpoints returning **every** active record (no limit; optional `search`) as `{ id, label, key, parentId?, category?, level? }`; groups with `withPath=true` add `path` ("Development / Backend Team"); `GET /groups/dropdown?excludeId=<group>` gives valid parents while editing (the group and its sub-groups are left out).

**Rules**
- Duplicates: one `409 DUPLICATE_RESOURCE` listing every clashing field; backed by partial unique indexes (concurrent duplicates also get 409). Keys and names are reusable after a delete.
- Updates: partial; optional `version` → `409 VERSION_CONFLICT` if someone else changed the record.
- Deletes are soft and blocked while in use (`409 RESOURCE_IN_USE` with counts): a role used by groups, a permission used by roles, a group with sub-groups or members. A deleted role's permission links and a deleted group's role links are removed with it.
- Hierarchy: no own-parent, no cycles (moving under a descendant), max 10 levels (`400 INVALID_GROUP_HIERARCHY`). Moving a group moves its whole subtree.
- Assignments: bulk (≤ 100 ids), everything must exist and be ACTIVE (`404` / `400 RESOURCE_INACTIVE` listing the ids); already-assigned ids are skipped and reported. Users who are suspended / banned / rejected / deactivated can't be added.
- **No privilege escalation:** non-ADMIN callers can only grant permissions they hold themselves (`403` listing the missing keys) and can't change their own group membership.
- Inactive roles / permissions / groups grant nothing. Changes apply immediately on the instance that made them; other instances within 30 seconds (permission cache).
- Every change is in the audit log (who, IP, before / after of the changed fields).

**More group / role tools**
- `GET /groups/tree`: the hierarchy as nested nodes; `category`, `rootId` (one sub-tree), `maxDepth`, `status`, `withCounts` (members / roles per node).
- `GET /groups/code/:groupCode?category=`: details by business group ID (e.g. GRP-DEV), optionally only within a category. Details (also `GET /groups/:id`) include the group's roles.
- `GET /groups/:id/permission-matrix?category=`: the group's roles (columns), the permissions they grant (rows, `grantedByRoleIds`) and a module × action grid from the permission metadata.
- `GET /roles|permissions|groups/exists`: "is this key / name taken?" for live form validation (`excludeId` while editing) → `{ exists, conflicts[] }`.
- `GET / PATCH / DELETE /roles/key/:roleKey`: the same as by id, addressed by role key.
- `PATCH /roles/bulk`: up to 100 role updates; all validated first, nothing applied if any fails (`400 BULK_OPERATION_FAILED` with `roles.<index>.<field>`).
- `POST /roles/setup`: create or update (matched by roleKey) a role and assign its groups and permissions in one call; `replaceAssignments` makes the lists complete. Validated before anything is written.

### My account: `/api/v1/users/me` and `/api/v1/account/recovery`

| Endpoint | Purpose |
| --- | --- |
| `GET /users/me` | Profile, status, preferences, custom variable values (`attributes`; `?include=` adds returned=REQUEST ones) and `missingRequired` |
| `PATCH /users/me` | firstName, lastName, username (registration rules; `null` removes lastName / username) |
| `PATCH /users/me/attributes` | Personal details: `{ attributes: { gender, birthdate, phone_number, address: { … }, employee_id, … } }` validated against the user schema; `given_name` / `family_name` / `preferred_username` map to the built-in fields; groups merge; `null` clears |
| `GET /users/me/avatar` · `POST /users/me/avatar` · `DELETE /users/me/avatar` | Profile picture: multipart `file` (JPEG / PNG / WebP ≤ `UPLOAD_AVATAR_MAX_SIZE_MB`); replaces the previous one; sets `picture` to its public URL |
| `POST /users/me/export` | "Download my data": `{ currentPassword }` → JSON file (account, personal details, sessions, devices, groups / roles, files, activity; no secrets). 3 per hour, recorded as `DATA_EXPORTED` |
| `GET /users/me/devices` · `DELETE /users/me/devices/:id` | Known devices (new-device alerts); forgetting one makes its next sign-in "new" again |
| `GET /users/me/activity` | Recent activity: sign-ins (incl. failed), logouts, password / email / profile changes, with device, browser, IP and verification type; `?event=` filter |
| `PATCH /users/me/preferences` | language, timezone (IANA), notifications.productUpdates / loginAlerts |
| `POST /users/me/email/change` | `{ newEmail, currentPassword }` → 6-digit code to the **new** address (nothing changes yet) |
| `POST /users/me/email/confirm` | `{ code }` → email changed (verified); the old address gets a notice |
| `POST /users/me/deactivate` | `{ currentPassword, reason? }` → INACTIVE, signed out everywhere |
| `DELETE /users/me` | `{ currentPassword, reason? }` → deactivated now, permanently deleted after `ACCOUNT_DELETION_GRACE_DAYS` |
| `POST /account/recovery/request` | public `{ email }`: same answer for every email; code only for accounts the user closed themselves |
| `POST /account/recovery/confirm` | public `{ email, code }` → ACTIVE again, scheduled deletion cancelled |

- Sensitive actions need the current password; wrong ones count toward the sign-in lockout.
- Codes: HMAC-stored, `ACCOUNT_CODE_TTL_MINUTES`, `ACCOUNT_CODE_MAX_ATTEMPTS` wrong tries, `ACCOUNT_CODE_RESEND_COOLDOWN_SECONDS` between emails (429 with Retry-After).
- Sign-in of a closed account: `403 AUTH_ACCOUNT_INACTIVE` (mentions recovery) or `403 AUTH_ACCOUNT_PENDING_DELETION`. Accounts an admin suspended / banned / deactivated cannot self-recover.
- The last active ADMIN cannot deactivate or delete themselves.
- **Permanent deletion** (scheduled purge every `ACCOUNT_PURGE_INTERVAL_MINUTES`, one instance at a time via a lock) removes the user, sessions, group memberships, reset / verification / account codes, expiry reminders and sign-in attempts. Audit logs are kept.

### User administration: `/api/v1/admin/users`

Needs `USER_READ` / `USER_CREATE` / `USER_UPDATE` / `USER_DELETE` / `USER_PASSWORD_MANAGE` (the default role `SUPER_ADMIN` has all; ADMIN passes everything).

| Endpoint | Purpose |
| --- | --- |
| `GET /admin/users` | List: search (email, username, names **and custom variables marked "include in search filter"**, e.g. employee ID), `status` / `role` (one or more, comma-separated), `groupId` (members of these groups), `activity=ACTIVE\|DORMANT\|INACTIVE`, source, isEmailVerified, isPendingDeletion, `deleted=EXCLUDE\|ONLY\|INCLUDE`, dates, sort, `attr[name]=value` |
| `GET /admin/users/stats` | Search page cards: total, active (signed in within 30 days), dormant (active account, no sign-in for 30 days or never), inactive (any other status), counts per status. Also `admins`, `verified` (email confirmed), `neverSignedIn` and `newLast30Days`. |
| `POST /admin/users/reports` | Generate report: CSV of the users matching the same query parameters as the list (background job, max 25 000 rows, private file kept 7 days; formula-looking cells are escaped) |
| `GET /admin/users/reports` · `GET …/reports/:id/download` · `DELETE …/reports/:id` | My reports ("View downloads"), download a READY one (409 while preparing), delete |
| `GET /admin/users/:id` | User info: profile, status history, active sessions, groups, effective permissions, sign-in lock, `lastActivityAt`, custom variable values |
| `GET /admin/users/create-config` | Create form setup (USER_CREATE): name fields as configured in the user schema (label / enabled / required), the custom variables to show (enabled, incl. internal), active password rules, defaults, whether groups can be picked |
| `GET /admin/users/availability?email=&username=` | Live "already taken" check for the create form (POST still decides with 409) |
| `POST /admin/users` | Create: ACTIVE, initial password (policy; never emailed), verified email and "must change password" by default, optional groups and welcome email | — custom variable values go in `attributes` |
| `PATCH /admin/users/:id` | Names, username, email (old address notified), `isEmailVerified` toggle |
| `PATCH /admin/users/:id/attributes` | Personal details (custom variables), incl. internal and read-only ones |
| `POST /admin/users/:id/set-password` | "Reset password" panel: `{ newPassword, confirmPassword, notifyByEmail, requireChangeOnNextLogin, signOutAllSessions }`; policy + history apply; the email never contains the password. "Generate" = `POST /password-policies/generate-password` |
| `GET /admin/users/:id/access` | Groups & roles panel: group → roles → permissions with mapping ids and end dates (`PATCH /access-mappings/:id { expiresAt }` = "Set Expiry", `DELETE /access-mappings/:id` = remove) |
| `POST /admin/users/:id/avatar` · `DELETE /admin/users/:id/avatar` | Profile picture for the user (USER_UPDATE) |
| `GET /admin/users/:id/activity` | Recent user activities (same as `/users/me/activity`) |
| `PATCH /admin/users/:id/status` | ACTIVE / INACTIVE / SUSPENDED / BANNED + reason (emailed unless `notifyUser: false`); non-ACTIVE signs out everywhere |
| `PATCH /admin/users/:id/role` | ADMIN / USER: **ADMIN callers only** |
| `POST /admin/users/:id/reset-password` | Sends the normal password-reset email |
| `POST /admin/users/:id/force-password-reset` | Silent: must change at next sign-in (only change-password, /me, logout work until then); signs out unless `signOutAllSessions: false` |
| `POST /admin/users/:id/unlock` | Clears the failed-sign-in lock |
| `GET /admin/users/:id/sessions` · `POST /admin/users/:id/sessions/revoke` | Active sessions; sign out everywhere |
| `DELETE /admin/users/:id` · `POST /admin/users/:id/restore` | Soft delete (cannot sign in, hidden) / restore |
| `DELETE /admin/users/:id/permanent` | Erase a soft-deleted user or an account pending deletion (409 otherwise) |
| `POST /admin/users/deletion-purge/run` | Run the scheduled purge now |

Guard rails: admins can't act on their own account here (use `/users/me`); only ADMIN users manage ADMIN accounts; the last active ADMIN can't be suspended, demoted or deleted. Every action is in the audit log (`GET /access-control/audit-logs?entityType=USER`).

### Bulk user operations: `/api/v1/admin/users/bulk/:type`

Create users, update users or reset passwords from a CSV or Excel (.xlsx) file, up to 1000 rows. `:type` is `create`, `update` or `password`. Every route needs USER_READ; templates, exports and uploads also need the operation's permission (USER_CREATE / USER_UPDATE / USER_PASSWORD_MANAGE). Each row goes through the same service as the single-user endpoints (password policy, unique email / username, "only grant access you have"), so the rules never differ.

| Endpoint | What it does |
| --- | --- |
| `GET …/:type/template` | Blank CSV with every column, including the custom profile fields (object groups as `group.field`) |
| `GET …/:type/export` | update / password: the users matching the search filters (same query as `GET /admin/users`) as an editable CSV; 400 above 1000 |
| `POST …/:type/upload` | multipart `file`. Checks the columns, then runs the rows in the background: 202 with the job (PROCESSING). Wrong columns, an empty / unreadable file or more than 1000 rows are kept as INVALID_TEMPLATE with the reason |
| `GET …/:type/jobs` · `GET …/:type/jobs/:id` | History (newest first, `search` by file name or uploader) / one job's status and counts (poll while PROCESSING) |
| `GET …/:type/jobs/:id/result` | The uploaded rows with a `result` (Succeeded / Skipped / Failed) and `reason` column |
| `GET …/:type/stats` | Page cards: files, rows, succeeded, failed, rejected files |

Columns: **create** `email`*, `given_name`*, `family_name`, `username`, `password`*, `must_change_password` (default true), `email_verified` (default true), `send_welcome_email` (default false), `groups` (group IDs separated by `|`, e.g. `GRP-01|GRP-05`). **update** `email`* (finds the user), `given_name`, `family_name`, `username`, `email_verified`, `status`, `groups` (every group the user should be in; `-` = none); a blank cell keeps the value, a single `-` empties it. **password** `email`*, `action` (`link` emails a reset link, the default; `set` uses `new_password`), `new_password`, `must_change_password`, `notify`. Custom profile fields are extra columns (booleans true / false, dropdowns by value or label, multi-selects separated by `|`).

Passwords are never stored with the job or written to the results. Jobs live in `bulk_jobs`; one still running when the server stops is marked FAILED on the next start. The runner (`modules/bulk-jobs`) and the CSV / Excel helpers (`common/utils/csv.util.ts`, `common/utils/table-file.util.ts`) are generic: another feature gives `BulkJobsService.start` a definition of one row.

### User invites: `/api/v1/user-invites`

| Endpoint | Purpose |
| --- | --- |
| `POST /user-invites` | `{ email, firstName?, lastName?, groupIds?, message? }` → email with `INVITE_ACCEPT_URL?token=…`, valid `INVITE_TTL_DAYS` |
| `POST /user-invites/bulk` | Up to 100 people; registered / already invited / repeated emails skipped with a reason |
| `GET /user-invites/stats` | Invites page cards: total, pending (link still valid), accepted, expired (incl. pending past expiry), revoked, sent in the last 7 days, self-registered accounts, acceptance rate (% of answered invites, null before any). Needs USER_READ |
| `GET /user-invites` · `GET /user-invites/:id` | List (status PENDING / ACCEPTED / REVOKED / EXPIRED, invitedBy, search, dates, sort) / details |
| `POST /user-invites/:id/resend` | New link (old one stops working), new expiry; `INVITE_RESEND_COOLDOWN_SECONDS` |
| `POST /user-invites/:id/revoke` · `DELETE /user-invites/:id` | Revoke a pending invite / delete (accepted invites are kept) |
| `POST /user-invites/public/info` | Public `{ token }`: email, inviter, expiry, status for the accept page |
| `POST /user-invites/accept` | Public `{ token, password, confirmPassword, firstName?, lastName?, username? }` → ACTIVE, verified account in the invite's groups |

Needs `USER_INVITE` (send / resend / revoke / delete) and `USER_READ` (list / details). Tokens are HMAC-stored and travel in request bodies only (never in URLs or logs). Groups on an invite follow the no-escalation rule; accepting works once (atomic).

### User schema (custom user variables): `/api/v1/user-schema`

The fields a user profile has. Needs `USER_SCHEMA_READ` / `USER_SCHEMA_MANAGE` (both in the default `SUPER_ADMIN` role); `GET /user-schema/form` is open to any signed-in user.

| Endpoint | Purpose |
| --- | --- |
| `GET /user-schema/attributes` | Tree (groups with `children`) or `?flat=true`; `?search=` by name / label |
| `GET /user-schema/attributes/:id` | One variable (groups include their children) |
| `POST /user-schema/attributes` | Create a FIELD (data type) or GROUP (Field Group Type OBJECT / LIST); `parentId` adds a child to a group |
| `PATCH /user-schema/attributes/:id` | Update (name, kind, type and parent are fixed; optimistic `version`) |
| `DELETE /user-schema/attributes/:id` | Custom variables only; groups must be empty; removes the value from every user |
| `GET /user-schema/options` | Dropdown values: kinds, data types, group types, scopes, locales, mutability, returned |
| `GET /user-schema/form` | Enabled, non-internal variables as a tree, to render the profile form |

- **Data types:** TEXT, TEXTAREA, EMAIL, MOBILE (E.164), NUMBER (min / max), BOOLEAN, DATE (YYYY-MM-DD), DATETIME, URL, DROPDOWN, MULTI_SELECT (options). Text-like types take minLength / maxLength.
- **Settings:** scopes (openid, profile, email, phone, address or custom like `hr:read`), locales, isEnabled, isRequired, isInternal (admins only), isUsername (sign in with it; implies unique), isPassword (Argon2-hashed, write-only, never returned), isUnique (case-insensitive), isMatchEnabled + matchWith (e.g. confirm fields; never stored), includeInToken (access-token claim `attrs`, max 2 KB), includeInSearchFilter (`GET /admin/users?attr[name]=value`), mutability READ_WRITE / READ_ONLY (admins write) / IMMUTABLE (set once) / WRITE_ONLY, returned ALWAYS / DEFAULT / REQUEST / NEVER, displayOrder.
- **System variables** (seeded; cannot be deleted; structure and security flags fixed): the OpenID Connect claims given_name, family_name, middle_name, nickname, preferred_username, profile, picture, website, email, email_verified, gender, birthdate, zoneinfo, locale, phone_number, phone_number_verified, address (formatted, street_address, locality, region, postal_code, country), password, confirm_password. Core ones map to built-in user fields; email and password keep their own endpoints.
- Values are stored on the user (`attributes`) and validated on every write; all problems come back at once (`attributes.<path>`). Changes are audited (`entityType=USER_ATTRIBUTE`).

### Business settings (branding): `/api/v1/settings/business`

Site name, description, logos and favicon, shown by the frontend on every page. Reading the public part needs no sign-in; the rest needs `BUSINESS_SETTINGS_READ` / `BUSINESS_SETTINGS_MANAGE` (default role `SUPER_ADMIN`, a role holding them, or `ADMIN`). Until the first save the values come from `project.config.json`.

| Endpoint | Purpose |
| --- | --- |
| `GET /settings/business/public` | Public: name, description, image URLs (null = default); `Cache-Control: no-cache` |
| `GET /settings/business` | With file details, `isDefault`, `version`, `updatedBy` |
| `PATCH /settings/business` | `siteName` (1–60), `siteDescription` (0–300); optimistic `version` (409 `VERSION_CONFLICT`) |
| `POST /settings/business/assets/:slot` | multipart `file`; slot `logo` · `logo-mark` · `auth-logo` · `favicon`; PNG / WebP / JPEG (no SVG), scanned, re-encoded (logos fit 1024 × 512, mark / favicon on 256 × 256); replaces the previous one |
| `DELETE /settings/business/assets/:slot` | Remove an image (default again) |

Images are public files of internal purposes (`BRAND_*`): the generic `/files` endpoints cannot upload or delete them. Guide: `docs/frontend/business-settings.md`.

### Appearance: `/api/v1/settings/appearance`

One look for the whole application, set by the super admin (`APPEARANCE_SETTINGS_READ` / `APPEARANCE_SETTINGS_MANAGE`, default role `SUPER_ADMIN`; ADMIN always passes): default mode, color preset and appearance options. `GET /settings/appearance/public` (no sign-in) is applied by every page; `PUT /settings/appearance` saves it (optimistic `version`). Users only keep their own light / dark choice in the browser. Guide: `docs/frontend/theme-system.md#one-application-look-super-admin`.

### File storage and uploads: `/api/v1/settings/storage`, `/api/v1/uploads`

One active storage receives every upload: the built-in local folder (`STORAGE_LOCAL_DIR`) or a bucket on Amazon S3, Backblaze B2, Tigris, Supabase Storage or any S3-compatible service. Admins add storages (credentials encrypted with `STORAGE_SECRETS_KEY`, never returned), test them and pick the active one (`STORAGE_SETTINGS_READ` / `STORAGE_SETTINGS_MANAGE`, default role `SUPER_ADMIN`). Files remember their storage, so switching never breaks older files.

`POST /uploads` (any signed-in user, multipart `file`) → `{ id, name, key, url, fileType, fileSize, filePages }` — images, PDF, DOCX / XLSX / PPTX, CSV, TXT. Guide: `docs/backend/file-storage.md`.

### Files (common uploads): `/api/v1/files`

One module every feature uses for uploads: inject `FilesService` (`upload`, `list`, `get`, `content`, `remove`, `removeAllOf`) and put `@UseInterceptors(FileUploadInterceptor)` on a multipart route. Bytes go through a storage driver (`STORAGE_DRIVER=local` → `STORAGE_LOCAL_DIR`, default `./uploads` in the project, git-ignored); metadata is in the `files` collection.

| Endpoint | Purpose |
| --- | --- |
| `POST /files` | multipart/form-data: `file` + `purpose` → 201 file info |
| `GET /files` | My files (paginated, `purpose` filter); `ownerId` = another user's (FILE_READ) |
| `GET /files/:id` · `GET /files/:id/content` | Details / download: owner or FILE_READ (404 otherwise) |
| `GET /files/public/:id` | No sign-in, public purposes only (avatars) — usable in `<img src>` |
| `DELETE /files/:id` | Owner or FILE_DELETE: record and bytes |

| Purpose | Types | Max size | Visibility |
| --- | --- | --- | --- |
| `AVATAR` | JPEG, PNG, WebP | `UPLOAD_AVATAR_MAX_SIZE_MB` | Public; one per user (a new one replaces the old) |
| `DOCUMENT` | JPEG, PNG, WebP, GIF, PDF | `UPLOAD_MAX_FILE_SIZE_MB` | Private |

New purposes: add to `FilePurpose` and `FILE_PURPOSES` (`modules/files/constants/file.constants.ts`).

Safety:
- The type comes from the file's bytes (magic numbers), never from the name or Content-Type; SVG / HTML / anything unknown is rejected (415 `FILE_TYPE_NOT_ALLOWED`).
- Size limits are enforced while reading (413 `FILE_TOO_LARGE`); one file and a few small fields per request; uploads are read only after the auth guard passed.
- Stored names are generated (`<purpose>/<yyyy>/<mm>/<uuid>.<ext>`); the client's name is only kept (sanitized) for display and Content-Disposition. Keys are checked so nothing can leave the storage folder. Writes are atomic (temp file + rename).
- Downloads send the exact type, `X-Content-Type-Options: nosniff`, a sandboxing CSP, inline only for images, `private, no-store` for private files and long caching for public ones.
- Quota per user (`UPLOAD_MAX_FILES_PER_USER` → 409 `FILE_LIMIT_REACHED`); permanent user deletion removes their files; `/health/ready` checks the storage folder is writable.
- multipart/form-data is accepted only on upload routes; every other route stays JSON-only.
- **Images are re-encoded** with sharp (libvips): fully decoded (damaged / disguised files → 422 `FILE_UNREADABLE`), auto-rotated from EXIF, then **all metadata removed** (EXIF, GPS location, camera, XMP, IPTC). Avatars are cropped to an `IMAGE_AVATAR_SIZE` square; image documents shrink to fit `IMAGE_MAX_DIMENSION`. Images above `IMAGE_MAX_INPUT_PIXELS` are refused before decoding. The format stays the same (GIF animation kept); PDFs are stored unchanged. `size` / `sha256` describe the stored bytes, `originalSize` the upload.
- **Virus scanning** with ClamAV over the clamd protocol (INSTREAM, 64 KB chunks; no extra package). The original upload is scanned before anything is stored: malware → 422 `FILE_INFECTED` (logged with the signature, nothing kept). Scanner unreachable → 503 `FILE_SCAN_UNAVAILABLE` (`VIRUS_SCAN_FAIL_CLOSED=true`) or accepted as `SCAN_FAILED`. Every file records `scanStatus` (CLEAN / NOT_SCANNED / SCAN_FAILED); `/health/ready` pings ClamAV when enabled. Start one with `docker run -d --name clamav -p 3310:3310 clamav/clamav` (first start downloads signatures, ~1–2 min).

### Project identity: `project.config.json`

The name, slug and branding of this project, next to `package.json` (validated at startup; schema in `project.config.schema.json`):

| Field | Used for |
| --- | --- |
| `name` | Emails (`APP_NAME` default), Swagger title, startup log |
| `slug` | Log service name (`<slug>-backend`), metrics prefix (`<slug>_`), refresh cookie (`<slug>_refresh`), JWT issuer / audience, `WWW-Authenticate` realm, export file name, reserved username |
| `description` | Swagger description |
| `defaultLanguage` | `MAIL_DEFAULT_LANGUAGE` default |
| `branding` | Email color, logo, company, support email ("Need help? …" line in every email), website |

Environment variables still win (`APP_NAME`, `JWT_ISSUER`, …). **Copying this backend for another project:**

```bash
npm run project:init -- --name "Shop X" --slug shop-x --support-email help@shopx.com --reset-secrets
```

It updates `project.config.json`, the package name, and the project values in `.env.example` / `.env` (database name, issuer, cookie, sender; new secrets with `--reset-secrets`), then lists what is left (SMTP, admin, frontend URLs). `--dry-run` shows the changes first. Set the identity **before the first deploy**: changing the slug later renames the cookie and JWT issuer (everyone signs in again).

### Operations: metrics, key rotation, backups

- **Metrics**: `GET /api/v1/metrics` (Prometheus) — HTTP latency per route pattern, account events, emails sent / failed, process metrics. No personal data in labels.
- **JWT key rotation**: tokens carry `kid`; set the new `JWT_ACCESS_SECRET` and keep the old one in `JWT_ACCESS_PREVIOUS_SECRETS` for one token lifetime — nobody is signed out.
- **Email languages**: every email is sent in the user's `preferences.language` (English, Tamil, Hindi; others fall back to English) with dates in their time zone. Add a language: copy `modules/mail/locales/en.locale.ts`, translate, register it in `mail-locales.ts`.
- **Activity**: a user signing out one of their own devices is recorded as `SESSION_REVOKED`.
- **Orphan file cleanup** every `FILES_ORPHAN_CLEANUP_INTERVAL_HOURS` (or `POST /files/maintenance/orphan-cleanup`, FILE_DELETE): deletes stored bytes no record points to and stale temp files; reports records whose bytes are missing.
- **Lockouts per IP**: an attacker who knows a user's email locks out only their own IP; the account-wide lock needs `LOGIN_MAX_FAILED_ATTEMPTS_PER_ACCOUNT` failures. Admin user info shows `lockedIpCount`; unlock clears all. The locked email is sent at most once per lockout period.
- **Invite language**: `language` per invite (single and bulk) → invitation email in that language, saved as the new user's language.
- Backups / restore, alerts and secret rotation step by step: [docs/operations.md](../docs/operations.md).

### First administrator (bootstrap)

A fresh database has no one who can sign in as admin. At startup, if `BOOTSTRAP_ADMIN_EMAIL` doesn't exist yet, AuthCore creates it from `BOOTSTRAP_ADMIN_*`: ACTIVE, email verified, role **ADMIN** (all permissions), source `SYSTEM`. Local `.env` default: `sytemuser@authcore.com` / `Test@123`.

- Sign in with those credentials; with `BOOTSTRAP_ADMIN_MUST_CHANGE_PASSWORD=true` (default) only change-password, `/users/me` and logout work until you choose a new password (`PATCH /auth/change-password`).
- Runs on every start but **never changes an existing account**: editing the env values later does not reset the password, name, role or status (safe with several instances).
- The password must pass the password policy; in production the sample `Test@123` is refused. A refusal is logged and the API still starts. Logs never contain the email or password.
- Set `BOOTSTRAP_ADMIN_ENABLED=false` (or empty email / password) to skip it.

### Security notifications

- **New device**: every successful sign-in records the device (browser name + OS name + device type; versions ignored) in `known_devices`. A device not seen before (except on the very first sign-in) → `isNewDevice: true` in the sign-in response, a `NEW_DEVICE_LOGIN` activity entry, and a "New sign-in" email with time (user's time zone), device and IP, unless the user turned `notifications.loginAlerts` off or `NEW_DEVICE_ALERTS_ENABLED=false`. Devices expire after `KNOWN_DEVICE_RETENTION_DAYS` unused.
- **Account locked**: when `LOGIN_MAX_FAILED_ATTEMPTS` failures lock the account, the user gets one email (attempts, IP, unlock time; never a password) and an `ACCOUNT_LOCKED` activity entry. Always sent (security notice) unless `ACCOUNT_LOCKED_EMAIL_ENABLED=false`.
- Notices never break sign-in: failures are logged.

### Default groups (default role assignment)

`POST` / `PATCH /groups` with `isDefault: true` (list with `GET /groups?isDefault=true`): every **new** user — registration, accepted invite, admin-created — joins all active default groups and gets their roles. Assignments are recorded as `system` in the audit log. Making a group default needs the right to grant its permissions (no escalation). Existing users are not changed.

### Admin activity search: `/api/v1/admin/activity`

| Endpoint | Purpose |
| --- | --- |
| `GET /admin/activity` | Everyone's activity: `userId`, `search` (email / name), `events` (comma-separated), `isSuccess`, `ipAddress`, `deviceType`, `browser`, `from` / `to`, `sortOrder`; each entry includes the user |
| `GET /admin/activity/login-history` | Same filters, sign-in events only (LOGIN, LOGIN_FAILED, NEW_DEVICE_LOGIN, ACCOUNT_LOCKED, LOGOUT, LOGOUT_ALL) |
| `GET /admin/activity/stats` | Activity & sign-ins page cards. Last 24 hours: sign-ins, failed sign-ins, people who signed in, sign-outs. Last 7 days: new devices, lockouts, password changes (changed / reset / set by an admin). Plus events kept |
| `GET /admin/activity/event-types` | Event values + labels for the filter dropdown |

Needs `USER_READ`.

## 12. Deployment

Not documented yet: deployment instructions (environments, CI/CD pipeline, secrets, rollout and rollback) will be added with the CI/CD setup.
