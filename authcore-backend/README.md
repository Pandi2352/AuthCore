# AuthCore Backend

NestJS API for AuthCore, a reusable authentication and authorization service. This guide covers installing, running and working on the backend. For the project overview see the [root README](../README.md); for every setup decision see the [setup checklist](../docs/project-setup-checklist.md).

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
5. Test manually through Swagger or Postman (import `/api/docs/openapi.json`).

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

Files and folders: kebab-case with a type suffix (`user-session.service.ts`). Class names must match the file type (`UserSessionService`). Interfaces have no `I` prefix; boolean variables start with `is` / `has` / `can` / ...; enum members are PascalCase. Full rules: [checklist section 7](../docs/project-setup-checklist.md).

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

### Indexes

- Declare indexes in schemas only.
- Development/staging build them on startup (`MONGODB_AUTO_INDEX`); production does not.
- Production: `npm run db:indexes` (report), then `npm run db:indexes:apply` (create). Nothing is dropped automatically.

### Query rules

Build filters from DTO fields only (never `find(req.body)`); paginate every list (`paginate()`, max 100); select only needed fields; use `.lean()` for reads. Full rules: [checklist sections 8 and 13](../docs/project-setup-checklist.md).

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

Error codes live in `src/common/constants/error-codes.constants.ts`. Full conventions: [checklist section 5](../docs/project-setup-checklist.md).

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

## 12. Deployment

Not documented yet: deployment instructions (environments, CI/CD pipeline, secrets, rollout and rollback) will be added with the CI/CD setup.
