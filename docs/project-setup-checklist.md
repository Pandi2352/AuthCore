# AuthCore — Project Setup Checklist

**NestJS + TypeScript + MongoDB + Swagger: setup before any feature code**

Before writing any business logic, prepare a backend foundation that is secure, scalable, maintainable, reusable and production-ready.

The goal is an empty NestJS starter template that can be reused for multiple projects without repeating the initial setup. **This is infrastructure only: no project features.**

> **Scope note:** Automated testing (unit, integration, E2E, Jest/Supertest setup, coverage) is left out of this checklist on purpose. Testing is done manually for now.

`[x]` = already done in `authcore-backend` (as of 2026-11-14).

The checklist has 3 levels:

- **Level 1 – Basic Foundation:** everything every NestJS project should have.
- **Level 2 – Advanced Foundation:** security, performance, reliability and production readiness.
- **Level 3 – Final Verification:** checks before starting actual feature development.

## Technology stack

| Area | Technology |
| --- | --- |
| Backend | NestJS + TypeScript |
| Database | MongoDB + Mongoose |
| API docs | Swagger / OpenAPI |
| Validation | class-validator + class-transformer |
| Code quality | ESLint + Prettier |

---

# Level 1 – Basic foundation

These are the essential things to implement before developing any features.

## 1. Project initialization

- [x] Install the correct Node.js LTS version. *(Using Node 20.19.4 for now. Node 20 reached end-of-life in April 2026; upgrade to Node 22/24 LTS later.)*
- [x] Install NestJS CLI. *(Installed locally as a dev dependency `@nestjs/cli@11`; used via `npx`.)*
- [x] Create a NestJS project using TypeScript.
- [x] Configure TypeScript compiler options. *(`tsconfig.json`: target ES2023, `nodenext` modules, decorators enabled, `rootDir: ./src`, `types: ["node"]`, no deprecated `baseUrl`. Works with both TypeScript 5.9 (project) and TypeScript 6 (editor).)*
- [x] Enable strict TypeScript mode. *(`"strict": true` plus `noImplicitReturns`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `forceConsistentCasingInFileNames`.)*
- [x] Configure module aliases. *(`@config/*`, `@common/*`, `@database/*`, `@modules/*`, `@shared/*`, verified in the compiled build.)*
- [x] Configure `tsconfig.build.json`. *(Compiles only `src/`; excludes `node_modules` and `dist`; no source maps or declarations in the build output. The incremental build cache is kept in `dist/`, so it is deleted with each clean build.)*
- [x] Configure `.gitignore`. *(Also ignores all `.env.*` except `.env.example`, private keys/certificates, and `*.tsbuildinfo`.)*
- [x] Create a proper folder structure. *(Empty folders from section 4 created, no `.gitkeep` files; files are added in later sections.)*
- [x] Configure package scripts. *(Added `typecheck`, `lint:check`, `format:check` and `verify`; see below.)*
- [x] Add a `.nvmrc` or equivalent Node version declaration. *(`.nvmrc` = `20.19.4`; `engines` set in `package.json`.)*
- [x] Pin dependency versions using the lockfile. *(`package-lock.json` exists.)*
- [x] Remove spec files and automated test setup. *(Deleted `*.spec.ts`, `test/` folder, Jest config, test scripts and test packages. Testing is manual.)*
- [x] Disable spec file generation. *(`nest-cli.json` → `"generateOptions": { "spec": false }`, so `nest g` never creates `*.spec.ts`.)*

Also added for consistent formatting on Windows: `.gitattributes` and `.editorconfig` (LF line endings) and `"endOfLine": "lf"` in `.prettierrc`.

Package scripts:

| Script | What it does |
| --- | --- |
| `npm run build` | Compile to `dist/` |
| `npm run typecheck` | TypeScript check without emitting files |
| `npm run start:dev` | Dev server with watch mode |
| `npm run start:prod` | Run the compiled build |
| `npm run lint` / `lint:check` | ESLint with auto-fix / check only |
| `npm run format` / `format:check` | Prettier write / check only |
| `npm run check:circular` | Fail if any circular import exists in `src/` |
| `npm run verify` | lint:check → format:check → typecheck → check:circular → build (use before every commit) |
| `npm run db:indexes` | Report missing/extra MongoDB indexes (run after `build`) |
| `npm run db:indexes:apply` | Create missing MongoDB indexes; never drops |
| `npm run audit:prod` | Scan production dependencies; fails on high/critical |
| `npm run audit:all` | Scan all dependencies, including dev tools |

## 2. Environment configuration

- [x] Create `.env` for local development. *(Git-ignored.)*
- [x] Create `.env.example` with placeholder values. *(The only env file that is committed.)*
- [x] Install and configure `@nestjs/config`. *(`@nestjs/config` 4.0.4 + `joi` 18.3.2; global and cached, set up in `src/config/configuration.ts`.)*
- [x] Separate development, staging and production configurations. *(`NODE_ENV` picks `.env.<NODE_ENV>` first, then `.env`. Real environment variables always override files.)*
- [x] Validate environment variables at application startup. *(Joi schema in `src/config/validation.ts`; reports all errors at once.)*
- [x] Define required and optional environment variables. *(See table below.)*
- [x] Define environment variable types. *(Joi types + typed config objects via `registerAs` / `ConfigType`.)*
- [x] Keep secrets outside source code. *(All values come from env files or real environment variables.)*
- [x] Never commit actual `.env` files. *(`.gitignore` ignores `.env` and `.env.*`, except `.env.example`.)*
- [x] Fail application startup when required configuration is missing. *(Exits with code 1 and a clear message.)*
- [x] Avoid using `process.env` throughout application code; access configuration through a configuration service. *(An ESLint rule blocks `process.env` everywhere except `src/config/`.)*

Environment variables:

| Variable | Required | Type / rule | Default |
| --- | --- | --- | --- |
| `NODE_ENV` | No | `development` \| `staging` \| `production` | `development` |
| `PORT` | No | Valid port number | `3000` |
| `API_PREFIX` | No | Lowercase path, no version (e.g. `api`) | `api` |
| `MONGODB_URI` | **Yes** | URI with `mongodb://` or `mongodb+srv://` | — |
| `SWAGGER_ENABLED` | No | Boolean; must be `false` in production | `false` |
| `SWAGGER_PATH` | No | Lowercase path, e.g. `api/docs` | `api/docs` |
| `CORS_ORIGIN` | **Yes** | Comma-separated `http(s)` origins; `*` rejected | — |

Environment files (first match wins; real environment variables override all of them):

| File | Purpose | Committed |
| --- | --- | --- |
| `.env.example` | Template with placeholders | Yes |
| `.env` | Local development | No |
| `.env.staging` / `.env.production` | Optional per-environment files | No |

In staging and production, prefer real environment variables or the deployment's secret manager over files.

Using config in code (never `process.env`):

```ts
import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { appConfig } from '@config/configuration';

@Injectable()
export class ExampleService {
  constructor(
    @Inject(appConfig.KEY) private readonly app: ConfigType<typeof appConfig>,
  ) {}
}
```

Config namespaces: `appConfig` (nodeEnv, isProduction, port, apiPrefix, corsOrigins), `databaseConfig` (uri), `swaggerConfig` (enabled, path).

Verified by starting the app:

| Scenario | Result |
| --- | --- |
| Valid `.env` | Starts |
| No `.env` | Exit 1: `"MONGODB_URI" is required. "CORS_ORIGIN" is required` |
| `CORS_ORIGIN=*` | Exit 1: `"CORS_ORIGIN" must not be "*"` |
| `PORT=abc`, `NODE_ENV=prod`, `MONGODB_URI=localhost` | Exit 1: all three errors listed |
| `NODE_ENV=staging` | Loads `.env.staging` |

Example environment variables:

```env
NODE_ENV=development
PORT=3000
API_PREFIX=api

MONGODB_URI=mongodb://localhost:27017/myapp

SWAGGER_ENABLED=true
SWAGGER_PATH=api/docs

CORS_ORIGIN=http://localhost:5173
```

## 3. Database setup

- [x] Install `@nestjs/mongoose`. *(11.0.4)*
- [x] Install `mongoose`. *(8.24.9)*
- [x] Configure MongoDB connection. *(`src/database/database.module.ts`, `MongooseModule.forRootAsync` using the typed `databaseConfig`; imported in `AppModule`.)*
- [x] Use environment-based connection strings. *(`MONGODB_URI`, validated as `mongodb://` or `mongodb+srv://`.)*
- [x] Configure connection retry behavior. *(Initial connection: `MONGODB_RETRY_ATTEMPTS` × `MONGODB_RETRY_DELAY_MS`, then startup fails with exit 1. After connecting, the driver reconnects automatically. `retryWrites: true`.)*
- [x] Configure connection timeout. *(Server selection 5s, connect 10s, socket 45s; all configurable.)*
- [x] Configure connection pool limits. *(`maxPoolSize` 10, `minPoolSize` 0; configurable.)*
- [x] Configure database connection lifecycle. *(Listeners for connected, reconnected, disconnected, close and error. The connection is closed on app shutdown by `@nestjs/mongoose` once shutdown hooks are enabled in section 12.)*
- [x] Handle connection errors. *(Logged with the error message only; the URI and credentials are never logged.)*
- [x] Handle database disconnection. *(Logged as a warning; the driver reconnects and logs "Reconnected". Commands are buffered until then.)*
- [x] Create a reusable base schema. *(`src/database/schemas/base.schema.ts`: `BaseSchema` class + `baseSchemaOptions`.)*
- [x] Configure automatic timestamps. *(`timestamps: true` → `createdAt` / `updatedAt` as UTC dates.)*
- [x] Configure UUID generation strategy if required. *(Decision: **UUID v7 everywhere, no ObjectId.** `_id` is a UUID v7 string generated by `generateUuid()` in `src/common/utils/uuid.util.ts`.)*
- [x] Establish a consistent ObjectId/reference strategy. *(UUID strategy instead: ids and references are UUID strings; see rules below.)*
- [x] Define common schema options. *(See table below.)*
- [x] Ensure indexes can be managed safely across environments. *(Auto-index on in development/staging, off in production. `npm run db:indexes` reports and `npm run db:indexes:apply` creates missing indexes; never drops.)*

Common base schema fields:

| Field | Purpose |
| --- | --- |
| `_id` | Document identifier: UUID v7 string, generated on create (exposed as `id`) |
| `createdAt` | Creation timestamp |
| `updatedAt` | Last modification timestamp |
| `__v` | Mongoose version key, if retained (kept in the DB, hidden from API output) |

Do not add business-specific fields to the base schema.

Common schema options (`baseSchemaOptions`):

| Option | Value | Why |
| --- | --- | --- |
| `timestamps` | `true` | Automatic `createdAt` / `updatedAt` |
| `strict` | `'throw'` | Saving a field that isn't in the schema throws an error (blocks mass assignment) |
| `versionKey` | `'__v'` | Document versioning |
| `id` | `false` | No automatic `id` getter |
| `toJSON` / `toObject` | transform | Output `id` (string), remove `_id` and `__v` |

Global Mongoose setting: `strictQuery: true`, so query filters on unknown fields are dropped.

Using the base schema in a feature module:

```ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { BaseSchema, baseSchemaOptions } from '@database/schemas/base.schema';

@Schema({ ...baseSchemaOptions, collection: 'examples' })
export class Example extends BaseSchema {
  @Prop({ required: true, trim: true })
  name!: string;
}

export type ExampleDocument = HydratedDocument<Example>;
export const ExampleSchema = SchemaFactory.createForClass(Example);
```

### ID strategy: UUID v7 (no ObjectId)

Every id in AuthCore is a UUID string, never a MongoDB ObjectId: document `_id`s, references between documents, ids in URLs and request ids.

- **`_id` is a UUID v7**, set automatically by `BaseSchema` (`@Prop({ type: String, default: () => generateUuid() })`). APIs expose it as `id`.
- **Why v7, not random v4:** v7 starts with a millisecond timestamp, so ids sort by creation time and MongoDB inserts stay at the end of the `_id` index. Random v4 ids scatter writes across the index and slow down as collections grow.
- **References** are UUID strings: `@Prop({ type: String, ref: 'User', index: true }) userId!: string;`. Never `Types.ObjectId`.
- **Index** every reference field that is used in queries.
- **Request ids** use the `ParseIdPipe`: `@Param('id', ParseIdPipe) id: string`. Invalid ids → `400 INVALID_ID`; valid ids are returned lowercase.
- **In DTOs** validate id fields with `@IsUUID()` from class-validator.
- **Not secrets:** a v7 id reveals its creation time and is not random enough to act as a token. Use `crypto.randomBytes` for tokens, reset codes and API keys. Use `generateRandomUuid()` (v4) for an id that must not reveal its creation time.

`src/common/utils/uuid.util.ts`:

| Function | Returns |
| --- | --- |
| `generateUuid()` | New UUID v7, lowercase, e.g. `01a1df95-4816-7727-bab3-ca48f2d57e54` |
| `generateRandomUuid()` | New random UUID v4 |
| `isValidUuid(value)` | `true` for any UUID (v1–v8, any case) |
| `isUuidV7(value)` | `true` for a UUID v7 |
| `getUuidV7Date(id)` | Creation `Date` embedded in a v7 id, or `null` |

`src/common/pipes/parse-id.pipe.ts`: `ParseIdPipe` validates and lowercases id parameters.

Verified against local MongoDB: the stored `_id` is a string UUID v7, `toJSON()` returns it as `id`, `findById(id)` works, ids sort by creation time, and the embedded date matches the creation time.

Index management:

| Environment | `MONGODB_AUTO_INDEX` default | How indexes get created |
| --- | --- | --- |
| development / staging | `true` | Automatically on startup |
| production | `false` | `npm run db:indexes` (report), then `npm run db:indexes:apply` (create) |

Unused indexes are never dropped automatically; review and drop them manually.

MongoDB tuning variables (all optional):

| Variable | Default |
| --- | --- |
| `MONGODB_MAX_POOL_SIZE` | `10` |
| `MONGODB_MIN_POOL_SIZE` | `0` |
| `MONGODB_SERVER_SELECTION_TIMEOUT_MS` | `5000` |
| `MONGODB_CONNECT_TIMEOUT_MS` | `10000` |
| `MONGODB_SOCKET_TIMEOUT_MS` | `45000` |
| `MONGODB_RETRY_ATTEMPTS` | `5` |
| `MONGODB_RETRY_DELAY_MS` | `3000` |
| `MONGODB_AUTO_INDEX` | `true` (`false` in production) |

Verified against local MongoDB 8.0:

| Scenario | Result |
| --- | --- |
| Normal start | `Connected to database "authcore"` |
| Unreachable database (2 retries) | Logs each retry, then exits with code 1; URI not in logs |
| Base schema | Timestamps set; output has `id`, no `_id` / `__v`; unknown field rejected (`StrictModeError`) |
| `npm run db:indexes` | Runs; reports "No models registered" for now |

## 4. Application architecture

- [x] Establish a modular architecture. *(Layered folders with one-way dependencies, enforced by ESLint; see "Architecture rules" below.)*
- [x] Separate controllers, services, modules, schemas and DTOs. *(Standard feature module layout below; controllers cannot import schemas or database code.)*
- [x] Establish a modules folder. *(`src/modules/`: every feature module, including `health`, lives here.)*
- [x] Establish a common shared folder.
- [x] Establish a database folder.
- [x] Establish a configuration folder.
- [x] Establish a common decorator folder.
- [x] Establish a common guard folder.
- [x] Establish a common interceptor folder.
- [x] Establish a common filter folder.
- [x] Establish a common pipe folder.
- [x] Establish a common middleware folder.
- [x] Avoid circular dependencies. *(`npm run check:circular` with `madge` 8.0.0; part of `npm run verify`, so a cycle fails the check.)*
- [x] Avoid putting business logic inside controllers. *(ESLint: controllers can't import `mongoose`, `@nestjs/mongoose`, schemas or `@database/*`; warns on long or complex handlers.)*
- [x] Use dependency injection consistently. *(ESLint blocks `new XxxService()` and similar for any injectable class.)*

### Architecture rules

Dependencies point one way only:

```text
modules/  ──►  shared/  ──►  common/
   │                            ▲
   ├──────►  database/  ────────┤
   │                            │
   └──────►  config/  ──────────┘
```

| Layer | May import | Must not import |
| --- | --- | --- |
| `modules/<name>/` | `common`, `shared`, `config`, `database`, other modules through their exported Nest module | — |
| `shared/` | `common`, `config` | `modules` |
| `database/` | `common`, `config`, `mongoose` | `modules` |
| `config/` | `common` | `modules` |
| `common/` | Libraries only | `modules` |

Enforced automatically by `npm run verify` (ESLint + `madge`):

| Rule | Where | Enforcement |
| --- | --- | --- |
| No circular imports | All of `src/` | `madge` fails `verify` |
| Lower layers don't import feature modules | `common`, `config`, `shared`, `database` | ESLint error |
| No database access in controllers (`mongoose`, `@nestjs/mongoose`, schemas, `@database/*`) | `*.controller.ts` | ESLint error |
| Default `mongoose` import (connect, model, set) only in `src/database` | All of `src/` | ESLint error; type imports like `Types` are allowed |
| No `new` on injectable classes (Service, Repository, Controller, Guard, Interceptor, Pipe, Filter, Middleware) | All of `src/` | ESLint error |
| `process.env` only in `src/config` | All of `src/` | ESLint error |
| Controller handlers stay short (≤ 15 lines) and simple (complexity ≤ 3) | `*.controller.ts` | ESLint warning |

Each probe below was added temporarily and caught, then removed:

| Violation | Caught by |
| --- | --- |
| `common/` importing `@modules/...` | ESLint error |
| Controller importing `@nestjs/mongoose` | ESLint error |
| Controller importing `./schemas/...` | ESLint error |
| `new ProbeService()` in a controller | ESLint error |
| `import mongoose from 'mongoose'` in a module | ESLint error |
| `a.ts` ↔ `b.ts` import cycle | `madge`: "Found 1 circular dependency" |

### Responsibilities

| File | Does | Does not |
| --- | --- | --- |
| `*.controller.ts` | Routes, read params/body via DTOs, call one service method, return the result | Database queries, business rules, building response envelopes |
| `*.service.ts` | Business logic, database access through injected models | Read `req`/`res`, know about HTTP status codes |
| `*.module.ts` | Wire controllers, providers and imports; export what other modules may use | Contain logic |
| `schemas/*.schema.ts` | Mongoose schema extending `BaseSchema` | Validation of request input |
| `dto/*.dto.ts` | Request/response shapes with `class-validator` and Swagger decorators | Database logic |

### Dependency injection rules

- Register every service as a provider and inject it through the constructor.
- Inject config with `@Inject(appConfig.KEY)`; inject models with `@InjectModel(Name.name)`.
- Use another module's service only after that module exports it and your module imports that module.
- Plain helpers with no dependencies (e.g. `common/utils`) are regular functions, not injectables.

Folder structure (folders exist now; files are added in later sections):

```text
src/
├── main.ts
├── app.module.ts
│
├── config/                     # @config/*
│   ├── configuration.ts
│   └── validation.ts
│
├── database/                   # @database/*
│   ├── database.module.ts
│   └── schemas/
│       └── base.schema.ts
│
├── common/                     # @common/*
│   ├── constants/
│   ├── decorators/
│   ├── dto/
│   ├── enums/
│   ├── filters/
│   ├── guards/
│   ├── interceptors/
│   ├── middleware/
│   ├── pipes/
│   ├── interfaces/
│   └── utils/
│
├── modules/                    # @modules/*  (all feature modules)
│   └── health/
│       ├── health.module.ts
│       ├── health.controller.ts
│       └── health.service.ts
│
└── shared/                     # @shared/*
    ├── shared.module.ts
    └── shared.service.ts
```

**Module rules**

- Every module goes in `src/modules/<module-name>/`, starting with `health` now and adding feature modules sprint by sprint (e.g. `modules/users/`, `modules/auth/`, `modules/sessions/`).
- No spec files: `nest g` is configured not to generate `*.spec.ts`.

Standard layout for a feature module:

```text
src/modules/<module-name>/
├── <module-name>.module.ts
├── <module-name>.controller.ts
├── <module-name>.service.ts
├── dto/
├── schemas/
├── interfaces/
└── constants/
```

Generate a module with the Nest CLI:

```bash
npx nest g module modules/<module-name>
npx nest g controller modules/<module-name>
npx nest g service modules/<module-name>
```

## 5. Common API standards

- [x] Establish a common success response structure. *(`ApiSuccessResponse<T>` in `src/common/interfaces/api-response.interface.ts`; built by `buildSuccessResponse()`.)*
- [x] Establish a common error response structure. *(`ApiErrorResponse`; built by `buildErrorResponse()`; adds a machine-readable `code`.)*
- [x] Standardize HTTP status codes. *(Table below.)*
- [x] Standardize error messages. *(`ErrorCode` enum + safe default message per status in `src/common/constants/error-codes.constants.ts`.)*
- [x] Establish API versioning. *(URI versioning, default version `1`.)*
- [x] Configure a global API prefix. *(`API_PREFIX=api` → routes at `/api/v1/...`.)*
- [x] Configure pagination conventions for future APIs. *(`PaginationQueryDto`, `paginate()`; max 100 per page.)*
- [x] Establish consistent date/time formats (UTC). *(ISO 8601 UTC everywhere; `utcNow()`.)*
- [x] Establish consistent naming conventions. *(Table below.)*
- [x] Establish request validation conventions. *(`class-validator` 0.15.1 + `class-transformer` 0.5.1; rules below.)*
- [x] Establish response serialization conventions. *(Rules below.)*
- [x] Establish API documentation conventions. *(Rules below; Swagger is set up in section 6.)*

> The format is defined here. It is applied to every response automatically by the global exception filter (section 9) and the response interceptor (section 10). Until then, Nest's default error shape is still returned.

### Files

| File | Contents |
| --- | --- |
| `common/constants/api.constants.ts` | `DEFAULT_API_VERSION`, `PAGINATION` limits, default success message |
| `common/constants/error-codes.constants.ts` | `ErrorCode` enum, default code + message per HTTP status |
| `common/interfaces/api-response.interface.ts` | `ApiSuccessResponse`, `ApiErrorResponse`, `ApiFieldError`, `PaginationMeta`, `Paginated` |
| `common/utils/api-response.util.ts` | `buildSuccessResponse()`, `buildErrorResponse()`, `utcNow()` |
| `common/utils/pagination.util.ts` | `normalizePagination()`, `buildPaginationMeta()`, `paginate()` |
| `common/dto/pagination-query.dto.ts` | `PaginationQueryDto` (`page`, `limit`) |
| `common/decorators/response-message.decorator.ts` | `@ResponseMessage('...')` to set the success message per route |

### Success response

```json
{
  "success": true,
  "message": "Request completed successfully",
  "data": {},
  "timestamp": "2026-11-14T10:00:00.000Z",
  "path": "/api/v1/example"
}
```

Paginated list (`data` is the array; `meta` is added):

```json
{
  "success": true,
  "message": "Items fetched",
  "data": [{ "id": "01a1df95-4816-7727-bab3-ca48f2d57e54" }],
  "meta": {
    "page": 2,
    "limit": 20,
    "totalItems": 45,
    "totalPages": 3,
    "hasNextPage": true,
    "hasPreviousPage": true
  },
  "timestamp": "2026-11-14T10:00:00.000Z",
  "path": "/api/v1/items"
}
```

### Error response

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

- `code` is stable and machine-readable; clients branch on it, never on `message`.
- `errors` is always an array (empty when there are no field errors).
- `message` is always safe to show to users: no stack traces, database errors or internal details.

### HTTP status codes

| Status | When |
| --- | --- |
| `200 OK` | Successful GET, PUT, PATCH, DELETE, and actions |
| `201 Created` | Successful POST that creates a resource |
| `400 Bad Request` | Invalid input, validation failed (`VALIDATION_FAILED`), invalid id (`INVALID_ID`) |
| `401 Unauthorized` | Not authenticated or invalid/expired credentials |
| `403 Forbidden` | Authenticated but not allowed |
| `404 Not Found` | Resource or route does not exist |
| `409 Conflict` | Duplicate or state conflict (`DUPLICATE_RESOURCE`, `CONFLICT`) |
| `413 Payload Too Large` | Body exceeds the size limit |
| `422 Unprocessable Entity` | Valid input that breaks a business rule |
| `429 Too Many Requests` | Rate limit exceeded |
| `500 Internal Server Error` | Unexpected error (generic message only) |
| `503 Service Unavailable` | Dependency down, e.g. database |

DELETE returns `200` with the standard envelope (not `204`), so every response has the same shape.

### Error codes

`BAD_REQUEST`, `VALIDATION_FAILED`, `INVALID_ID`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `METHOD_NOT_ALLOWED`, `CONFLICT`, `DUPLICATE_RESOURCE`, `PAYLOAD_TOO_LARGE`, `UNSUPPORTED_MEDIA_TYPE`, `UNPROCESSABLE_ENTITY`, `TOO_MANY_REQUESTS`, `INTERNAL_ERROR`, `SERVICE_UNAVAILABLE`, `REQUEST_TIMEOUT`

Add new codes to the `ErrorCode` enum. Feature-specific codes use a prefix, e.g. `AUTH_INVALID_CREDENTIALS`.

### Prefix and versioning

- All routes: `/<API_PREFIX>/v<version>/<resource>` → `/api/v1/users`.
- `API_PREFIX` must not contain the version; `v1` is added by URI versioning.
- Default version is `1`. A breaking change gets a new version on that route (`@Version('2')`) while `v1` keeps working.
- Non-breaking changes (new optional fields, new endpoints) stay in the current version.

### Pagination

- Query: `?page=1&limit=20`. Defaults: page `1`, limit `20`. Maximum limit `100`.
- List endpoints accept a DTO that extends `PaginationQueryDto`.
- Services return `paginate(items, page, limit, totalItems)`; the response interceptor turns it into `data` + `meta`.
- Every list query must be paginated; never return an unbounded list.
- Sorting/filtering fields are whitelisted per endpoint in its DTO; never pass raw query objects to MongoDB.

### Date and time

- All dates in requests and responses are ISO 8601 in UTC with `Z`: `2026-11-14T10:00:00.000Z`.
- MongoDB stores dates as UTC; `createdAt` / `updatedAt` come from the base schema.
- Server code never formats dates in local time. Converting to the user's time zone is the client's job.

### Naming conventions

| Item | Convention | Example |
| --- | --- | --- |
| URL paths | lowercase, kebab-case, plural nouns | `/api/v1/user-sessions` |
| Route params | camelCase | `/users/:userId` |
| Query params | camelCase | `?page=1&sortBy=createdAt` |
| JSON fields | camelCase | `createdAt`, `isActive` |
| Error codes | UPPER_SNAKE_CASE | `VALIDATION_FAILED` |
| MongoDB collections | lowercase plural | `users`, `user_sessions` |
| Files | kebab-case + type suffix | `user-session.service.ts`, `create-user.dto.ts` |
| Classes | PascalCase + type suffix | `UserSessionService`, `CreateUserDto` |
| DTOs | `<Action><Resource>Dto` | `CreateUserDto`, `UpdateUserDto`, `ListUsersQueryDto` |
| Boolean fields | `is` / `has` / `can` prefix | `isVerified`, `hasMfa` |
| Enum values | UPPER_SNAKE_CASE strings | `ACTIVE`, `SUSPENDED` |

### Request validation

- Every body, query and param is a DTO class with `class-validator` decorators. No untyped `@Body() body: any`.
- Query/param numbers use `@Type(() => Number)` so strings are converted before validation.
- Validate ids with `ParseIdPipe` (route params) or `@IsUUID()` (DTO fields) before they reach the service.
- The global `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`, `transform`) is enabled in section 8.

### Response serialization

- Controllers return plain data; the interceptor wraps it in the envelope. Never build the envelope by hand.
- Return response DTOs or plain objects, never raw Mongoose documents with internal fields.
- Sensitive fields (passwords, token hashes, secrets) use `select: false` in the schema and are never put in a response.
- `_id` is exposed as `id`; `__v` is never exposed (base schema `toJSON`).
- Missing values are `null`, not omitted, when the field is part of the documented response.

### API documentation (Swagger)

- Every controller has `@ApiTags()`; every route has `@ApiOperation({ summary })`.
- Every DTO property has `@ApiProperty()` / `@ApiPropertyOptional()` with a `description` and `example`.
- Every route documents its success response and its expected error statuses.
- Swagger must match the code; it is generated from the DTOs and decorators, never written by hand.

Verified:

| Check | Result |
| --- | --- |
| `GET /api/v1` | `200` |
| `GET /`, `/api`, `/api/v2` | `404` |
| `buildSuccessResponse` (single + paginated) | Matches the formats above |
| `buildErrorResponse` | Matches the format above |
| `normalizePagination(0, 5000)` | Clamped to page `1`, limit `100` |
| `PaginationQueryDto` with `page=0`, `limit=500`, `page=abc` | Rejected with clear messages |

## 6. Swagger / OpenAPI setup

- [x] Install `@nestjs/swagger`. *(11.4.8)*
- [x] Configure Swagger in `main.ts`. *(`main.ts` calls `setupSwagger()` from `src/common/swagger/setup-swagger.ts` when enabled.)*
- [x] Configure API title and description. *("AuthCore API"; the description explains the response envelope.)*
- [x] Configure API version. *(`1.0`, taken from `DEFAULT_API_VERSION`.)*
- [x] Configure API tags. *(`API_TAGS` constants in `src/common/constants/api-tags.constants.ts`.)*
- [x] Configure global API prefix. *(Paths appear as `/api/v1/...` in the docs.)*
- [x] Configure DTO property documentation. *(Swagger CLI plugin reads DTO types, `class-validator` rules and JSDoc comments; `@ApiProperty` adds examples.)*
- [x] Configure request and response examples. *(Examples on every envelope field; error examples per status.)*
- [x] Configure standard HTTP response documentation. *(`@ApiWrappedResponse`, `@ApiPaginatedResponse`, `@ApiErrorResponses`, `@ApiStandardErrors`.)*
- [x] Configure API grouping. *(One tag per feature module, sorted alphabetically; operation IDs like `App_getHello`.)*
- [x] Configure Swagger JSON endpoint. *(`/api/docs/openapi.json`, plus `/api/docs/openapi.yaml`.)*
- [x] Enable Swagger only in permitted environments. *(Off by default; allowed in development and staging; `SWAGGER_ENABLED=true` with `NODE_ENV=production` fails startup.)*
- [x] Keep Swagger documentation synchronized with DTOs and controllers. *(Generated from code by the CLI plugin at build time; nothing is written by hand.)*

### Swagger URLs

| URL | Content |
| --- | --- |
| `/api/docs` | Swagger UI |
| `/api/docs/openapi.json` | OpenAPI JSON (import into Postman, client generators) |
| `/api/docs/openapi.yaml` | OpenAPI YAML |

The path comes from `SWAGGER_PATH` (default `api/docs`).

### Environment rules

| `NODE_ENV` | `SWAGGER_ENABLED` default | Allowed to enable |
| --- | --- | --- |
| development | `false` (local `.env` sets `true`) | Yes |
| staging | `false` | Yes |
| production | `false` | No: startup fails with `"SWAGGER_ENABLED" must be false in production` |

### Files

| File | Contents |
| --- | --- |
| `common/swagger/setup-swagger.ts` | Document builder, UI options, JSON/YAML URLs |
| `common/constants/api-tags.constants.ts` | `API_TAGS`: name + description per group |
| `common/dto/api-response.dto.ts` | Swagger models: `SuccessResponseDto`, `ErrorResponseDto`, `FieldErrorDto`, `PaginationMetaDto` |
| `common/decorators/api-response.decorator.ts` | Response documentation decorators |
| `nest-cli.json` | Swagger CLI plugin (`.dto.ts` and `.controller.ts` files) |

### Response documentation decorators

| Decorator | Documents |
| --- | --- |
| `@ApiWrappedResponse(Model)` | `200` success envelope with `data: Model` |
| `@ApiWrappedResponse(Model, { status: HttpStatus.CREATED })` | `201` success envelope |
| `@ApiWrappedResponse(Model, { isArray: true })` | `data: Model[]` |
| `@ApiPaginatedResponse(Model)` | `data: Model[]` + `meta` |
| `@ApiErrorResponses(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND)` | Error envelope with an example per status |
| `@ApiStandardErrors()` | `429` and `500`; put it on every controller |

Example controller:

```ts
@ApiTags(API_TAGS.Users.name)
@ApiStandardErrors()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'List users' })
  @ApiPaginatedResponse(UserResponseDto)
  list(@Query() query: ListUsersQueryDto) {
    return this.usersService.list(query);
  }

  @Post()
  @ApiOperation({ summary: 'Create a user' })
  @ResponseMessage('User created successfully')
  @ApiWrappedResponse(UserResponseDto, { status: HttpStatus.CREATED })
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, HttpStatus.CONFLICT)
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }
}
```

### Swagger CLI plugin

Enabled in `nest-cli.json` with `classValidatorShim` and `introspectComments`:

- Every property in a `*.dto.ts` file is documented automatically from its TypeScript type.
- `class-validator` rules (`@Min`, `@Max`, `@IsOptional`, ...) become schema constraints.
- A JSDoc comment above a property becomes its description.
- Add `@ApiProperty({ example })` when you want a specific example.

DTO files must end in `.dto.ts`, or the plugin skips them.

> **Note for section 8:** Helmet's default Content-Security-Policy blocks the Swagger UI scripts. When Helmet is added, allow Swagger's assets on the docs path. Swagger is never served in production, so production CSP can stay strict.

Verified:

| Check | Result |
| --- | --- |
| `GET /api/docs`, `/openapi.json`, `/openapi.yaml` (development) | `200` |
| OpenAPI document | Title, version `1.0`, tag `App`, path `/api/v1`, operation `App_getHello` with `200` (envelope), `429`, `500` (with examples) |
| `SWAGGER_ENABLED=false` | Docs return `404` |
| `NODE_ENV=production` + `SWAGGER_ENABLED=true` | Startup fails with a clear message |
| `NODE_ENV=production`, Swagger off | App runs, docs return `404` |
| CLI plugin | Metadata generated for both DTO files |

## 7. Code quality and standards

- [x] Configure ESLint. *(`eslint.config.mjs` with `typescript-eslint` **strictTypeChecked**, plus architecture and naming rules.)*
- [x] Configure Prettier. *(`.prettierrc` with every option explicit; `.prettierignore`.)*
- [x] Configure consistent formatting rules. *(Prettier + `.editorconfig` + `.gitattributes`; LF line endings.)*
- [x] Configure import sorting. *(`eslint-plugin-simple-import-sort` 14.0.0, auto-fixed by `npm run lint`.)*
- [x] Configure unused variable detection. *(`@typescript-eslint/no-unused-vars` as error; `_name` allowed for intentionally unused.)*
- [x] Configure strict TypeScript checks. *(`strict` + `noUncheckedIndexedAccess`, `noImplicitReturns`, `noImplicitOverride`, `allowUnreachableCode: false`, `allowUnusedLabels: false`; ESLint `strictTypeChecked`, `no-explicit-any` as error.)*
- [x] Establish naming conventions. *(`@typescript-eslint/naming-convention`; table below.)*
- [x] Establish file naming conventions. *(`eslint-plugin-check-file` 3.3.2: kebab-case files and folders, required suffix per folder.)*
- [x] Establish class and method naming conventions. *(Class suffix must match the file type, e.g. `*.service.ts` → `...Service`.)*
- [x] Add lint and format scripts. *(`lint`, `lint:check`, `format`, `format:check`.)*
- [x] Add build verification script. *(`npm run verify` = lint → format → typecheck → circular check → build.)*

### Formatting (Prettier)

| Option | Value |
| --- | --- |
| `semi` | `true` |
| `singleQuote` | `true` |
| `trailingComma` | `"all"` |
| `printWidth` | `80` |
| `tabWidth` / `useTabs` | `2` / `false` |
| `bracketSpacing` | `true` |
| `arrowParens` | `"always"` |
| `endOfLine` | `"lf"` |

Formatted: `src/**/*.ts` and root `*.json` / `*.mjs`. Ignored: `dist`, `node_modules`, `coverage`, `package-lock.json`.

### Import order

Groups, separated by a blank line, sorted alphabetically within each group:

```ts
import { randomUUID } from 'node:crypto';          // 1. Node built-ins

import { Injectable } from '@nestjs/common';       // 2. Packages (@nestjs first)
import { Model } from 'mongoose';

import { ErrorCode } from '@common/constants/error-codes.constants';  // 3. Aliases
import { appConfig } from '@config/configuration';

import { CreateUserDto } from './dto/create-user.dto';                // 4. Relative
```

Duplicate imports from the same module are an error. Use the `node:` prefix for built-ins.

### Naming conventions (enforced)

| Item | Rule | Example |
| --- | --- | --- |
| Variables | camelCase; `UPPER_CASE` for constants; PascalCase for decorator factories | `userCount`, `MAX_LIMIT`, `ResponseMessage` |
| Boolean variables | Prefix `is`, `has`, `can`, `should`, `was`, `will`, `did` | `isActive`, `shouldApply` |
| Functions | camelCase; PascalCase only for decorators | `buildPaginationMeta`, `ApiWrappedResponse` |
| Parameters | camelCase; `_name` if intentionally unused | `userId`, `_doc` |
| Classes, types, enums | PascalCase | `UserService`, `PaginationMeta` |
| Interfaces | PascalCase, **no** `I` prefix | `ApiFieldError` (not `IApiFieldError`) |
| Enum members | PascalCase (values are strings) | `ErrorCode.NotFound = 'NOT_FOUND'` |
| Class members | camelCase | `findById()`, `createdAt` |
| Exceptions | `_id`, `__v` (MongoDB fields); object keys (headers, env names) | |

### Class name must match the file type (enforced)

| File | Class name must end with |
| --- | --- |
| `*.controller.ts` | `Controller` |
| `*.service.ts` | `Service` |
| `*.module.ts` | `Module` |
| `*.dto.ts` | `Dto` |
| `*.guard.ts` | `Guard` |
| `*.interceptor.ts` | `Interceptor` |
| `*.filter.ts` | `Filter` |
| `*.pipe.ts` | `Pipe` |
| `*.middleware.ts` | `Middleware` |
| `*.exception.ts` | `Exception` |
| `*.strategy.ts` | `Strategy` |

### File and folder names (enforced)

- All files and folders under `src/` are kebab-case: `user-session.service.ts`, `modules/user-sessions/`.
- Files in these folders must end with the matching suffix:

| Folder | File suffix | Example |
| --- | --- | --- |
| `constants/` | `.constants.ts` | `error-codes.constants.ts` |
| `decorators/` | `.decorator.ts` | `response-message.decorator.ts` |
| `dto/` | `.dto.ts` | `create-user.dto.ts` |
| `enums/` | `.enum.ts` | `environment.enum.ts` |
| `filters/` | `.filter.ts` | `http-exception.filter.ts` |
| `guards/` | `.guard.ts` | `jwt-auth.guard.ts` |
| `interceptors/` | `.interceptor.ts` | `response.interceptor.ts` |
| `interfaces/` | `.interface.ts` | `api-response.interface.ts` |
| `middleware/` | `.middleware.ts` | `request-id.middleware.ts` |
| `pipes/` | `.pipe.ts` | `parse-id.pipe.ts` |
| `schemas/` | `.schema.ts` | `user.schema.ts` |
| `utils/` | `.util.ts` | `pagination.util.ts` |

(`error-codes.ts` and `api-tags.ts` were renamed to `*.constants.ts` to follow this.)

### Other quality rules

| Rule | Why |
| --- | --- |
| `eqeqeq` | Always `===` / `!==` |
| `curly: all` | Braces on every `if` / loop |
| `no-console` | Use Nest `Logger` |
| `no-explicit-any`, `no-unsafe-*` | No `any` leaks |
| `no-floating-promises` | Every promise is awaited or handled |
| `strictTypeChecked` | Catches unnecessary conditions, unsafe enum use, confusing void returns, ... |
| No `consistent-type-imports` | Deliberately off: `import type` on an injected class breaks Nest DI |

### Scripts

| Script | Use |
| --- | --- |
| `npm run lint` | Fix lint issues (including import order) |
| `npm run lint:check` | Check only (CI) |
| `npm run format` | Format files |
| `npm run format:check` | Check only (CI) |
| `npm run typecheck` | TypeScript check |
| `npm run check:circular` | Circular import check |
| `npm run verify` | All of the above + build. Run before every commit |

Verified: each violation below was added in a throwaway file and reported, then removed.

| Violation | Rule |
| --- | --- |
| `BadName.ts` | file must be kebab-case + `.util` in `utils/` |
| `dto/user.ts` | must end with `.dto.ts` |
| Folder `UserStuff/` | folder must be kebab-case |
| `class ProbeManager` in `probe.service.ts` | must end with `Service` |
| `interface IUser` | no `I` prefix |
| enum member `active` | must be PascalCase |
| `const flag = ...` (boolean) | needs `is`/`has`/... prefix |
| unused `const unused` | no-unused-vars |
| `input: any` | no-explicit-any |
| `==` | eqeqeq |
| `console.log` | no-console |
| duplicate `@nestjs/common` import | no-duplicate-imports |

---

# Level 2 – Advanced foundation

This is where you prepare the project for real-world production usage.

## 8. Security configuration

**High priority**

- [x] Install and configure `helmet`. *(`helmet` 8.3.0 with its default policy, in `main.ts`.)*
- [x] Configure CORS with an explicit origin allowlist. *(`CORS_ORIGIN` list; unknown origins get no `Access-Control-Allow-Origin` header, so browsers block them.)*
- [x] Never use unrestricted `origin: '*'` when credentials are enabled. *(Config validation rejects `*`.)*
- [x] Configure global rate limiting using `@nestjs/throttler`. *(6.7.1; global `ThrottlerGuard`; 100 requests / 60s per IP by default; `429` with `Retry-After`.)*
- [x] Configure request body size limits. *(JSON `BODY_LIMIT`, default `100kb`; larger → `413`.)*
- [x] Configure URL-encoded payload limits. *(Same limit; `extended: false`, so no nested objects.)*
- [x] Enable global `ValidationPipe`. *(Registered as `APP_PIPE` via `createValidationPipe()` in `src/common/pipes/validation.pipe.ts`.)*
- [x] Enable `whitelist: true`.
- [x] Enable `forbidNonWhitelisted: true`.
- [x] Enable `transform: true`. *(Plus `forbidUnknownValues`; implicit conversion off, use `@Type()`; submitted values never echoed in errors.)*
- [x] Validate and sanitize incoming data appropriately. *(DTO validation on every route; unknown fields rejected; field-level error list.)*
- [x] Prevent NoSQL injection through validated query construction. *(DTO types reject objects where strings are expected; `SecurityMiddleware` rejects any body/query key starting with `$` or containing `.`; Express 5 parses `?a[$ne]=1` as a plain key, not an object; `strictQuery`.)*
- [x] Never pass raw user-controlled objects directly into MongoDB queries. *(Rule: build filters from DTO fields only, e.g. `{ email: dto.email }`, never `find(req.body)` / `find(query)`.)*
- [x] Prevent mass assignment vulnerabilities. *(`whitelist` + `forbidNonWhitelisted` on DTOs, and `strict: 'throw'` on schemas.)*
- [x] Avoid exposing stack traces in production. *(Never sent in any environment; logged server-side for 5xx only.)*
- [x] Avoid exposing database errors to clients. *(Mapped to safe messages; duplicate keys expose the field name only, never the value.)*
- [x] Configure secure HTTP headers. *(See header table below; `X-Powered-By` removed.)*
- [x] Disable unnecessary HTTP methods. *(Only GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD; TRACE/CONNECT/others → `405`.)*
- [x] Configure request timeout limits. *(`REQUEST_TIMEOUT_MS` (30s) to receive a request, 20s for headers; slow-client protection. Handler timeouts: section 13.)*
- [x] Prevent sensitive data from appearing in logs. *(The exception filter logs method, path without query string, status, code and error; never bodies, headers or cookies. Full log redaction: section 11.)*
- [x] Establish a secrets management strategy. *(See below.)*
- [x] Establish a dependency vulnerability scanning process. *(`npm run audit:prod` (fails on high/critical) and `npm run audit:all`; to be run in CI in section 16.)*

Important packages:

| Package | Version | Purpose |
| --- | --- | --- |
| `helmet` | 8.3.0 | HTTP security headers |
| `@nestjs/throttler` | 6.7.1 | Rate limiting |
| `class-validator` | 0.15.1 | DTO validation |
| `class-transformer` | 0.5.1 | Request transformation |
| `@nestjs/config` | 4.0.4 | Secure configuration management |

Remember: these provide a security foundation, not complete application security. Authentication, authorization, CSRF protection where applicable, and session security should be implemented when those features are introduced.

### Request pipeline

```text
Request
  → helmet (security headers)
  → CORS (allowlist)
  → body parser (size limit) → bodyParserErrorHandler (safe 400 / 413)
  → SecurityMiddleware (allowed methods, no $ / dotted keys)
  → ThrottlerGuard (rate limit)
  → ValidationPipe (DTO whitelist + validation)
  → Controller → Service
  → AllExceptionsFilter (any error → standard error envelope)
```

### Files

| File | Purpose |
| --- | --- |
| `main.ts` | helmet, CORS, body limits, trust proxy, server timeouts |
| `app.module.ts` | Global `ThrottlerGuard`, `ValidationPipe`, `AllExceptionsFilter`; `SecurityMiddleware` on all routes |
| `common/middleware/security.middleware.ts` | Allowed HTTP methods; rejects `$` / dotted keys |
| `common/middleware/body-parser-error.middleware.ts` | Safe messages for malformed / oversized bodies |
| `common/pipes/validation.pipe.ts` | Global `ValidationPipe` + error flattening |
| `common/exceptions/app.exception.ts` | `AppException(status, code, message?, errors?)` |
| `common/exceptions/validation.exception.ts` | `ValidationException(errors)` → 400 `VALIDATION_FAILED` |

### Security environment variables (all optional)

| Variable | Default | Purpose |
| --- | --- | --- |
| `BODY_LIMIT` | `100kb` | Max JSON / form body size (`b`, `kb`, `mb`) |
| `THROTTLE_TTL_MS` | `60000` | Rate limit window |
| `THROTTLE_LIMIT` | `100` | Requests per window per client IP |
| `REQUEST_TIMEOUT_MS` | `30000` | Max time to receive a full request (min 5000) |
| `TRUST_PROXY_HOPS` | `0` | Number of proxies / load balancers in front of the app |

Set `TRUST_PROXY_HOPS` to the real number of proxies in production (e.g. `1` behind a load balancer). Otherwise every client shares the proxy's IP and one rate limit, or clients can spoof `X-Forwarded-For`.

The rate limiter stores counts in memory. With more than one app instance, switch it to Redis storage so limits are shared.

### Security headers (helmet defaults)

| Header | Value |
| --- | --- |
| `Content-Security-Policy` | `default-src 'self'; ...` (Swagger UI works with it: same-origin scripts, inline styles allowed) |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `SAMEORIGIN` |
| `Referrer-Policy` | `no-referrer` |
| `Cross-Origin-Opener-Policy` | `same-origin` |
| `X-Powered-By` | removed |

### Secrets management strategy

- Secrets live only in environment variables: local `.env` (git-ignored), and in staging/production the deployment platform's secret store (e.g. GitLab CI/CD masked variables, Kubernetes Secrets, a cloud secret manager).
- Never in source code, `.env.example`, Docker images, logs, error messages or Swagger examples.
- Every secret is read through the typed config (`src/config`) and validated at startup.
- Different secrets per environment; never reuse production secrets in development.
- Rotate on a schedule and immediately after any suspected leak; rotation must not need a code change.
- Database URIs with credentials are never logged (see section 3).

### Dependency scanning

| Script | Use |
| --- | --- |
| `npm run audit:prod` | Production dependencies; fails on high/critical. Use in CI. |
| `npm run audit:all` | Everything, including dev tools (report) |

Current result (2026-11-14):

- **Production dependencies: 0 vulnerabilities.**
- Dev tools only: 16 low/moderate, from `@nestjs/cli` 11, `madge` 8 and `typescript-eslint` sub-dependencies. They are not shipped in the production build. The available fixes are breaking (`@nestjs/cli` 12 needs Node 22+; `madge` 7 is a downgrade), so they wait for the Node upgrade.

### NoSQL injection rules for feature code

- Build every query from validated DTO fields: `this.model.findOne({ email: dto.email })`.
- Never pass `req.body`, `req.query` or a whole DTO as a filter or update: no `find(dto)`, `updateOne(filter, req.body)`.
- Updates list fields explicitly or use `$set` with a DTO that only contains allowed fields.
- Sort and filter fields come from an allowlist in the DTO (e.g. `@IsIn(['createdAt', 'name'])`).
- If an operator object really must come from code, build it in the service, never from client input.

## 9. Global exception handling

- [x] Create a global exception filter. *(`AllExceptionsFilter` in `src/common/filters/all-exceptions.filter.ts`, registered as `APP_FILTER`; catches everything, including middleware errors.)*
- [x] Handle `HttpException`. *(Its status and message are kept for 4xx; `AppException` code and field errors are kept.)*
- [x] Handle unexpected exceptions. *(Any other error or thrown value → `500 INTERNAL_ERROR` with a generic message.)*
- [x] Handle MongoDB/Mongoose validation errors. *(`400 VALIDATION_FAILED` with one entry per field.)*
- [x] Handle duplicate key errors. *(`409 DUPLICATE_RESOURCE`; lists the field, never the value.)*
- [x] Handle database connection errors. *(Network, not-connected, server-selection and buffering-timeout errors → `503 SERVICE_UNAVAILABLE`.)*
- [x] Handle invalid ObjectId errors. *(Ids are UUIDs: `ParseIdPipe` returns `400 INVALID_ID` for malformed ids; a Mongoose `CastError` on `_id` also maps to `400 INVALID_ID`.)*
- [x] Standardize error response format. *(Every error uses the section 5 envelope.)*
- [x] Hide internal error details in production. *(Hidden in every environment: 5xx always returns the generic message; no stack, error name or DB message in any response.)*
- [x] Preserve useful debugging information in internal logs. *(5xx: method, path, status, code, error name + message, stack trace.)*
- [x] Never expose passwords, tokens or secrets in errors. *(Validation errors never echo values; paths are logged and returned without the query string; duplicate keys show field names only.)*

### Error mapping

Implemented in `src/common/utils/exception-mapper.util.ts` (`mapException()`):

| Source | Status | Code | Message to client |
| --- | --- | --- | --- |
| `AppException` | its status | its code | its message (generic if 5xx) |
| `ValidationException` / DTO validation | 400 | `VALIDATION_FAILED` | `Validation failed` + field errors |
| Other `HttpException` 4xx | its status | per status | its message |
| `HttpException` 5xx, `429` | its status | per status | standard message |
| Malformed JSON body | 400 | `BAD_REQUEST` | `The request body is not valid JSON` |
| Body over limit | 413 | `PAYLOAD_TOO_LARGE` | `The request body is too large` |
| Mongoose `ValidationError` | 400 | `VALIDATION_FAILED` | field errors from the schema |
| Mongoose `CastError` on `_id` / an id field | 400 | `INVALID_ID` | `Invalid id format` |
| Mongoose `StrictModeError` | 400 | `BAD_REQUEST` | `Request contains a field that is not allowed` |
| Duplicate key (`11000`) | 409 | `DUPLICATE_RESOURCE` | field names only |
| `DocumentNotFoundError` | 404 | `NOT_FOUND` | standard message |
| `VersionError` | 409 | `CONFLICT` | `...modified by another request. Please retry` |
| Database unreachable / not connected / buffering timeout | 503 | `SERVICE_UNAVAILABLE` | standard message |
| Anything else | 500 | `INTERNAL_ERROR` | `Something went wrong. Please try again later` |

Nest converts a JSON `SyntaxError` into `BadRequestException(err.message)`, which would leak the raw parser message. `bodyParserErrorHandler` (registered right after the body parsers) converts body parser errors into an `AppException` with a safe message first.

### Throwing errors in feature code

```ts
// Business errors: always AppException with a code
throw new AppException(
  HttpStatus.CONFLICT,
  ErrorCode.DuplicateResource,
  'Email is already registered',
);

// Not found
throw new AppException(HttpStatus.NOT_FOUND, ErrorCode.NotFound, 'User not found');

// Field-level validation in a service
throw new ValidationException([
  { field: 'password', message: 'password is too weak' },
]);
```

Don't catch errors just to rethrow them as 500s. Let unexpected errors reach the filter, which logs them with the stack.

### Verified (temporary probe module, removed afterwards)

| Request | Response |
| --- | --- |
| `GET /api/v1` | Helmet headers present, no `X-Powered-By` |
| `Origin: http://localhost:5173` | `Access-Control-Allow-Origin` + credentials |
| `Origin: https://evil.example` | No CORS headers (browser blocks) |
| Preflight `OPTIONS` | `204`, allowed methods listed |
| 4th request with `THROTTLE_LIMIT=3` | `429 TOO_MANY_REQUESTS`, `Retry-After: 60` |
| Body missing `name`, extra `isAdmin`, `age:"x"` | `400 VALIDATION_FAILED`, 4 field errors, no values echoed |
| Duplicate unique `name` | `409 DUPLICATE_RESOURCE`, field `name` only |
| `{"name":{"$ne":null}}` | `400`, field name not allowed |
| `{"a.b":1}` | `400`, field name not allowed |
| `?$where=1` | `400`, field name not allowed |
| `?name[$ne]=x` | Plain string key (Express 5), not an operator |
| `{"name":` (malformed) | `400 The request body is not valid JSON` |
| 200 KB body | `413 PAYLOAD_TOO_LARGE` |
| `GET /probe/not-an-id` | `400 INVALID_ID` |
| `AppException` 404 / Nest `NotFoundException` | `404` with their messages |
| Unknown route | `404 NOT_FOUND` envelope |
| Handler throws `Error('DB password=...')` | `500` generic message; secret only in server log |
| `TRACE` | `405 METHOD_NOT_ALLOWED` |
| Production mode crash | Same safe `500`, no stack |
| Mapper: network / not-connected / buffering timeout | `503 SERVICE_UNAVAILABLE` |
| Mapper: `DocumentNotFoundError`, `VersionError`, `StrictModeError` | `404`, `409`, `400` |
| Swagger UI + assets with helmet CSP | `200` |

## 10. Global interceptors

- [x] Create a response transformation interceptor. *(`ResponseInterceptor` in `src/common/interceptors/response.interceptor.ts`, registered as `APP_INTERCEPTOR`.)*
- [x] Create a request logging interceptor or middleware. *(`accessLogMiddleware`, middleware rather than interceptor, so requests rejected before a controller (404, 405, 413, 429) are logged too.)*
- [x] Add request execution time tracking. *(`durationMs` on every access log line, measured with `process.hrtime`.)*
- [x] Add correlation/request ID tracking. *(`requestIdMiddleware` + `X-Request-Id` header + `AsyncLocalStorage` context; see below.)*
- [x] Establish consistent response formatting. *(Every success response uses the section 5 envelope; `@ResponseMessage()` sets the message.)*
- [x] Ensure exceptions are not incorrectly converted into success responses. *(The interceptor only maps successful results; errors skip it and reach `AllExceptionsFilter`.)*
- [x] Avoid unnecessary response transformations for streams or file downloads. *(`StreamableFile`, `Readable`, `Buffer` and `@Res()` responses are passed through; `@SkipResponseWrap()` opts a route out.)*

### Interceptors and middleware

| Piece | Type | What it does |
| --- | --- | --- |
| `requestIdMiddleware` | Express middleware (first) | Keeps a safe incoming `X-Request-Id` (≤128 chars, `[A-Za-z0-9._:-]`) or creates a UUID; sets `request.requestId`, the response header and the request context |
| `accessLogMiddleware` | Express middleware (second) | One log line per finished request; can be turned off with `LOG_HTTP_REQUESTS=false` |
| `RequestContextInterceptor` | Global interceptor (outer) | Re-enters the request context around the handler; the context can be lost while a request body stream is read |
| `ResponseInterceptor` | Global interceptor (inner) | Wraps results in the success envelope |

| Handler returns | Response |
| --- | --- |
| Object / string / array | `{ success: true, message, data, timestamp, path }` |
| `paginate(...)` result | `data` = items, plus `meta` |
| `undefined` | `data: null` |
| `StreamableFile`, stream, `Buffer` | Sent as-is |
| Route with `@SkipResponseWrap()` | Sent as-is |
| Thrown exception | Error envelope from `AllExceptionsFilter` |

### Request ID

- Every response has an `X-Request-Id` header. CORS exposes it to browsers.
- A client or gateway can send its own `X-Request-Id` to trace a request across services; unsafe values are replaced.
- Every log line written while a request is handled gets `requestId`, including logs from services (via `AsyncLocalStorage`). No need to pass it around.
- Ask users to report the `X-Request-Id` of a failed request, then search the logs for it.

Read it in code with `getRequestId()` from `@common/context/request-context` (e.g. to pass to another service).

## 11. Logging and monitoring

- [x] Configure structured logging. *(Winston: JSON lines with fixed fields; see below.)*
- [x] Choose a logging library (NestJS Logger, Pino or Winston). *(**Winston** 3.19.0 via `nest-winston` 2.0.0; replaces Nest's logger, so `new Logger('Context')` everywhere goes through Winston.)*
- [x] Separate development and production log levels. *(Development: `debug` + pretty; staging/production: `info` + JSON; override with `LOG_LEVEL` / `LOG_FORMAT`.)*
- [x] Add request IDs to logs. *(Added automatically to every entry during a request.)*
- [x] Log HTTP method, route, status code and duration. *(Access log: `method`, `path`, `statusCode`, `durationMs`, `ip`, `userAgent`, `requestId`.)*
- [x] Log application startup and shutdown. *(Startup: port, environment, prefix, log settings. Shutdown: "Shutting down (signal)" → "Shutdown complete"; `enableShutdownHooks()` is on.)*
- [x] Log database connection events. *(Section 3 listeners, now through Winston.)*
- [x] Log unexpected exceptions. *(5xx: `error` with stack, request id, method, path, code. Uncaught exceptions and unhandled rejections: logged by Winston, then the process exits.)*
- [x] Configure log redaction. *(Every entry is redacted before output; see below.)*
- [x] Avoid logging request bodies by default. *(Nothing logs bodies.)*
- [x] Avoid logging authorization headers and cookies. *(No headers are logged except `User-Agent`; `authorization` / `cookie` keys are redacted anywhere.)*
- [x] Establish log rotation and retention policies. *(Optional daily-rotated files: max 20 MB per file, kept 14 days, old files gzipped; see below.)*
- [x] Prepare integration with centralized log monitoring. *(JSON to stdout with stable field names; see below.)*

### Files

| File | Purpose |
| --- | --- |
| `common/logger/winston-options.ts` | Levels, formats (JSON / pretty), console + rotated file transports |
| `common/logger/log-redaction.ts` | Redaction of sensitive keys and patterns |
| `common/context/request-context.ts` | `AsyncLocalStorage` request context, `getRequestId()` |
| `common/middleware/request-id.middleware.ts` | Request id |
| `common/middleware/access-log.middleware.ts` | Access log |
| `common/interfaces/express-request.interface.ts` | Adds `requestId` to the Express `Request` type |
| `app.module.ts` | `WinstonModule.forRootAsync`, shutdown log hooks |
| `main.ts` | `bufferLogs` + `app.useLogger(...)`, middleware order, startup log |

### Logging environment variables (all optional)

| Variable | Default | Values |
| --- | --- | --- |
| `LOG_LEVEL` | `debug` (development), `info` (others) | `fatal`, `error`, `warn`, `info`, `verbose`, `debug` |
| `LOG_FORMAT` | `pretty` (development), `json` (others) | `pretty`, `json` |
| `LOG_HTTP_REQUESTS` | `true` | Access log on/off |
| `LOG_FILE_ENABLED` | `false` | Also write rotated files |
| `LOG_DIR` | `logs` | File directory (git-ignored) |
| `LOG_FILE_MAX_SIZE` | `20m` | Rotate when a file reaches this size (`k`, `m`, `g`) |
| `LOG_FILE_MAX_FILES` | `14d` | Keep files this many days (`14d`) or this many files (`14`) |

### Log entry fields (JSON)

| Field | Always | Example |
| --- | --- | --- |
| `timestamp` | Yes | `2026-11-14T06:37:50.211Z` (UTC) |
| `level` | Yes | `info` |
| `message` | Yes | `GET /api/v1 200 10.55ms` |
| `context` | Yes | `HTTP`, `MongoDB`, `ExceptionFilter`, `UsersService` |
| `service` | Yes | `authcore-backend` |
| `environment` | Yes | `production` |
| `requestId` | During a request | `5e1ba426-e5a7-4977-b9a9-a98cbb5af7f4` |
| `stack` | Errors | stack trace (redacted) |
| any other | When passed | `method`, `path`, `statusCode`, `durationMs`, ... |

Example:

```json
{"context":"HTTP","durationMs":10.55,"environment":"production","ip":"10.0.0.7","level":"info","message":"GET /api/v1 200 10.55ms","method":"GET","path":"/api/v1","requestId":"5e1ba426-e5a7-4977-b9a9-a98cbb5af7f4","service":"authcore-backend","statusCode":200,"timestamp":"2026-11-14T06:37:50.211Z","userAgent":"curl/8.22.0"}
```

Pretty (development):

```text
2026-11-14T06:36:26.632Z info [ProbeService] (client-trace-123) creating probe x
2026-11-14T06:36:26.634Z info [HTTP] (client-trace-123) POST /api/v1/probe 201 93.66ms {"method":"POST",...}
```

### Writing logs in feature code

```ts
private readonly logger = new Logger(UsersService.name);

this.logger.log('User created');                          // info
this.logger.log({ message: 'User created', userId });     // info + structured fields
this.logger.warn('Login failed');                          // warn
this.logger.error('Payment provider failed', error.stack); // error + stack
this.logger.debug('Cache miss');                          // debug (development only by default)
```

- Pass an object with `message` to add searchable fields.
- Log ids (`userId`), never whole documents, request bodies or DTOs.
- Don't log in a loop on hot paths; use `debug` for noisy details.

### Redaction

Applied to every field of every entry, at any depth, before output:

| What | Becomes |
| --- | --- |
| Keys containing `password`, `passwd`, `secret`, `token`, `authorization`, `cookie`, `apiKey` / `api_key`, `credential`, `privateKey`, `session`, or equal to `otp` / `pin` | `[REDACTED]` |
| `scheme://user:pass@host` in any string | `scheme://[REDACTED]@host` |
| `Bearer ...` / `Basic ...` | `Bearer [REDACTED]` |
| JWTs (`eyJ...`) | `[REDACTED]` |
| `password=...`, `"token": "..."`, `apiKey: ...` inside text | `password=[REDACTED]` |

Words like "passwordless" or "tokens count" are not touched. Redaction is a safety net: still never log secrets on purpose.

### Rotation and retention

- In containers (Docker / Kubernetes): keep `LOG_FILE_ENABLED=false`. Log to stdout and let the platform collect and keep logs.
- On a VM / bare server: `LOG_FILE_ENABLED=true`:
  - `logs/app-YYYY-MM-DD.log`: everything at the configured level
  - `logs/error-YYYY-MM-DD.log`: errors only
  - New file each day or at `LOG_FILE_MAX_SIZE`; old files gzipped; deleted after `LOG_FILE_MAX_FILES`.
- Retention policy: 14 days on the server by default. Long-term retention (e.g. 90 days for security audits) belongs in the central log system, not on the app server.

### Centralized log monitoring

- Production logs are one JSON object per line on stdout, which Loki/Grafana, ELK/OpenSearch, Datadog, CloudWatch and GCP Logging all ingest without parsing rules.
- Filter by `service`, `environment`, `level`, `context`; trace by `requestId`.
- Suggested alerts: any `level=error` or `fatal`; `context=HTTP` with `statusCode>=500` rate; `context=MongoDB` "Disconnected".
- To ship directly instead of via stdout, add a Winston transport in `createWinstonOptions()`; nothing else changes.

### Verified

| Check | Result |
| --- | --- |
| `GET /api/v1` | `{"success":true,"message":"Request completed successfully","data":"Hello World!",...}` |
| `@ResponseMessage('Probe created')` | Envelope message `Probe created`, status `201` |
| Paginated result | `data` array + `meta` |
| `StreamableFile`, `@SkipResponseWrap()` | Sent unchanged |
| `undefined` result | `data: null` |
| `AppException` | Error envelope (not wrapped as success) |
| `X-Request-Id: client-trace-123` | Kept, returned, and on the service log line of that POST |
| `X-Request-Id: bad id<script>` | Replaced with a UUID |
| Access log | Every request incl. `404`, with duration; `5xx` as `warn` |
| 5xx | `error` entry with request id + stack |
| Redaction | password, refreshToken, apiKey, authorization, JWT, Bearer, `user:pass@`, `password=...` in an error message: all `[REDACTED]` |
| `LOG_FORMAT=json` | 30/30 console lines valid JSON |
| `LOG_FILE_ENABLED=true` | `app-2026-11-14.log` (all), `error-2026-11-14.log` (errors only) |
| `LOG_LEVEL=warn` | Only `warn` and `error` lines |
| App close | `Shutting down` → `Shutdown complete` → MongoDB disconnected / closed |
| Invalid config | Still shows `Config validation error: ...` and exits with code 1 (printed by Nest's default logger, since Winston isn't created yet) |

## 12. Health checks and application lifecycle

- [x] Create a health-check endpoint. *(`src/modules/health/`: module, controller, service, response DTO; `@nestjs/terminus` 12.1.0.)*
- [x] Check application availability. *(`/health/live` answers `200` while the process runs.)*
- [x] Check MongoDB connectivity. *(Terminus Mongoose ping with `HEALTH_DB_TIMEOUT_MS` (1.5s) timeout.)*
- [x] Implement readiness checks. *(`/health/ready`: `503` when the database is unreachable or the app is shutting down.)*
- [x] Implement liveness checks. *(`/health/live`: no dependencies, so a database outage never restarts the process.)*
- [x] Configure graceful shutdown. *(`LifecycleService`: readiness fails → drain delay → HTTP server closes after in-flight requests → MongoDB closes; hard timeout.)*
- [x] Handle `SIGTERM` and `SIGINT`. *(`app.enableShutdownHooks()`.)*
- [x] Close database connections on shutdown. *(`@nestjs/mongoose` closes the connection in `onApplicationShutdown`, after the HTTP server.)*
- [x] Avoid accepting new work during shutdown. *(Readiness `503` so load balancers stop routing; `Connection: close` on keep-alive responses; server refuses new connections after the drain.)*
- [x] Configure startup failure handling. *(`abortOnError: false` + `bootstrap().catch()`: flush buffered logs, log `fatal` with stack, exit code `1`.)*

### Endpoints

All three are excluded from rate limiting (`@SkipThrottle()`), send `Cache-Control: no-store`, and are left out of the access log when they succeed.

| Endpoint | Checks | Use for | `200` data | Failure |
| --- | --- | --- | --- | --- |
| `GET /api/v1/health` | Database + not shutting down | Humans / monitoring | `{ status, checks: { database: "up" }, uptimeSeconds }` | `503` |
| `GET /api/v1/health/live` | Nothing (process answers) | Liveness probe (restart if failing) | `{ status: "ok" }` | No response |
| `GET /api/v1/health/ready` | Database + not shutting down | Readiness probe / load balancer | `{ status, checks: { database: "up" } }` | `503` |

Failure response (standard envelope; never contains database error details):

```json
{
  "success": false,
  "message": "The service is temporarily unavailable",
  "code": "SERVICE_UNAVAILABLE",
  "errors": [{ "field": "database", "message": "Database is not reachable" }],
  "statusCode": 503,
  "timestamp": "2026-11-14T06:53:25.224Z",
  "path": "/api/v1/health/ready"
}
```

Kubernetes example:

```yaml
livenessProbe:
  httpGet: { path: /api/v1/health/live, port: 3000 }
  periodSeconds: 10
  failureThreshold: 3
readinessProbe:
  httpGet: { path: /api/v1/health/ready, port: 3000 }
  periodSeconds: 5
  failureThreshold: 1
terminationGracePeriodSeconds: 30   # > SHUTDOWN_TIMEOUT_MS
```

### Graceful shutdown sequence

```text
SIGTERM / SIGINT
  1. LifecycleService.beforeApplicationShutdown
     - mark "shutting down" → /health/ready returns 503
     - start force-exit timer (SHUTDOWN_TIMEOUT_MS)
     - wait SHUTDOWN_DRAIN_DELAY_MS (load balancer notices readiness)
  2. Nest closes the HTTP server
     - new connections refused; idle keep-alive connections closed
     - in-flight requests run to completion
  3. onApplicationShutdown
     - MongoDB connection closed
  → process exits. If 1–3 take longer than SHUTDOWN_TIMEOUT_MS: "forcing exit", code 1.
```

| Variable | Default | Purpose |
| --- | --- | --- |
| `SHUTDOWN_TIMEOUT_MS` | `10000` | Hard limit for the whole shutdown |
| `SHUTDOWN_DRAIN_DELAY_MS` | `0` (development), `5000` (others) | Readiness fails this long before the server closes; must be less than the timeout |
| `HEALTH_DB_TIMEOUT_MS` | `1500` | MongoDB ping timeout in readiness |

Set the orchestrator's grace period (e.g. Kubernetes `terminationGracePeriodSeconds`, Docker `stop_grace_period`) higher than `SHUTDOWN_TIMEOUT_MS`.

### Startup failure handling

| Failure | Result |
| --- | --- |
| Invalid / missing config | `fatal [Bootstrap] Startup failed: Error: Config validation error: ...`, exit `1` |
| Database unreachable after retries | `fatal ... MongooseServerSelectionError ...`, exit `1` |
| Port already in use | `fatal [Bootstrap] Startup failed: Error: listen EADDRINUSE ...`, exit `1` |

Logs buffered during startup are flushed first, so nothing is lost. A config error happens before Winston exists, so that one is printed in Nest's default format.

### Files

| File | Purpose |
| --- | --- |
| `modules/health/health.controller.ts` | `/health`, `/health/live`, `/health/ready` |
| `modules/health/health.service.ts` | Checks; throws `503` with the failing component |
| `modules/health/dto/health-response.dto.ts` | Swagger model |
| `shared/lifecycle.service.ts` | Graceful shutdown steps and logs |
| `shared/shared.module.ts` | Global module for app-wide services |
| `common/context/app-state.ts` | `isShuttingDown()` / `markShuttingDown()` |
| `common/middleware/shutdown.middleware.ts` | `Connection: close` during shutdown |
| `main.ts` | `enableShutdownHooks()`, `abortOnError: false`, startup failure handler |

### Verified

| Check | Result |
| --- | --- |
| `/health`, `/health/live`, `/health/ready` | `200` with the data above; `Cache-Control: no-store` |
| 10 rapid `/health/ready` with `THROTTLE_LIMIT=3` | All `200` (not throttled); `/api/v1` throttled after 3 |
| Successful health probes in access log | Not logged |
| Temporary `mongod` killed | `/ready` and `/health` → `503` "Database is not reachable"; `/live` → `200`; one `warn` line per failed probe |
| `mongod` restarted | MongoDB reconnects; `/ready` back to `200` after ~8s |
| SIGTERM, drain 2s, 3s request in flight | During drain: `/ready` `503`, `/live` `200`; after drain: new connection refused; in-flight request finished `200`; then MongoDB closed |
| SIGTERM, timeout 2.5s, 6s request in flight | "Graceful shutdown took longer than 2500ms; forcing exit", exit code `1` |
| Startup: invalid config / database down / port in use | `fatal` log with reason, exit code `1` |

SIGTERM was simulated inside the process (Windows can't send real POSIX signals to Node); the Docker setup in section 14 runs on Linux where real signals apply.

## 13. API reliability and performance

- [x] Configure compression where appropriate. *(`compression` 1.8.2: gzip above 1 KB; never for `Cache-Control: no-store` responses (BREACH); `COMPRESSION_ENABLED`.)*
- [x] Configure request timeouts. *(`TimeoutInterceptor`: `408 REQUEST_TIMEOUT` after `HANDLER_TIMEOUT_MS` (15s); `@HandlerTimeout(ms)` per route. Receiving a request: `REQUEST_TIMEOUT_MS`, section 8.)*
- [x] Configure database connection pooling. *(Section 3: `maxPoolSize` 10, `minPoolSize` 0.)*
- [x] Establish query timeout policies. *(`queryTimeoutPlugin`: `maxTimeMS` = `MONGODB_QUERY_TIMEOUT_MS` (10s) on every query and aggregation without its own; exceeded → `503 REQUEST_TIMEOUT`, logged.)*
- [x] Establish MongoDB indexing conventions. *(Rules below.)*
- [x] Avoid unbounded database queries. *(Rules below; `paginate()` + `normalizePagination()`.)*
- [x] Establish maximum pagination limits. *(Section 5: max `100` per page.)*
- [x] Avoid unnecessary database projections. *(Rules below: select only needed fields, `.lean()` for reads.)*
- [x] Configure appropriate connection retry strategies. *(Section 3: startup retries; driver reconnects; `retryWrites`.)*
- [x] Avoid retrying non-idempotent operations blindly. *(Rules below.)*
- [x] Establish caching conventions for future use. *(Rules below.)*
- [x] Establish background job conventions for future use. *(Rules below.)*
- [x] Establish file upload limits and storage policies for future use. *(Rules below.)*

### Files

| File | Purpose |
| --- | --- |
| `common/interceptors/timeout.interceptor.ts` | Handler timeout → `408` |
| `common/decorators/handler-timeout.decorator.ts` | `@HandlerTimeout(ms)` per route / controller |
| `database/plugins/query-timeout.plugin.ts` | Default `maxTimeMS` for queries and aggregations |
| `common/utils/exception-mapper.util.ts` | MongoDB `MaxTimeMSExpired` (code 50) → `503 REQUEST_TIMEOUT` |
| `main.ts` | `compression` with the `no-store` filter |

### Performance environment variables (all optional)

| Variable | Default | Purpose |
| --- | --- | --- |
| `HANDLER_TIMEOUT_MS` | `15000` | Max handler time before `408` |
| `MONGODB_QUERY_TIMEOUT_MS` | `10000` | Default server-side `maxTimeMS`; keep it below `HANDLER_TIMEOUT_MS` |
| `COMPRESSION_ENABLED` | `true` | gzip responses |
| `COMPRESSION_THRESHOLD_BYTES` | `1024` | Don't compress smaller responses |

### Timeouts

| Layer | Limit | Result |
| --- | --- | --- |
| Receiving the request | `REQUEST_TIMEOUT_MS` 30s (headers 20s) | Connection closed |
| Route handler | `HANDLER_TIMEOUT_MS` 15s, or `@HandlerTimeout(ms)` | `408 REQUEST_TIMEOUT` |
| One MongoDB query | `MONGODB_QUERY_TIMEOUT_MS` 10s, or `.maxTimeMS(ms)` on the query | `503 REQUEST_TIMEOUT` |
| Health DB ping | `HEALTH_DB_TIMEOUT_MS` 1.5s | Readiness `503` |

A handler timeout answers the client but does not cancel work already started; the query timeout is what stops slow database work on the server.

```ts
@Get('export')
@HandlerTimeout(60_000)        // this route may take up to 60s
export() { ... }

this.model.find(filter).maxTimeMS(30_000);  // this query may take up to 30s
```

### Compression

- gzip for responses over 1 KB when the client accepts it.
- Responses with `Cache-Control: no-store` are never compressed. Compressing responses that contain secrets (tokens, codes) enables BREACH-style attacks. Every route that returns tokens or other secrets must set `@Header('Cache-Control', 'no-store')`, which also stops caching.
- Behind a reverse proxy that already compresses (nginx, a CDN), set `COMPRESSION_ENABLED=false`.

### MongoDB indexing conventions

- Every field used in a query filter or sort on a hot path has an index.
- Compound indexes follow Equality → Sort → Range (ESR): `{ tenantId: 1, status: 1, createdAt: -1 }`.
- Unique business keys get `unique: true` (e.g. normalized email); duplicates are `409` (section 9).
- Expiring data (tokens, OTPs, sessions) uses a TTL index: `@Prop({ expires: 0 })` on an `expiresAt` date, or `schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })`.
- Reference fields used in lookups are indexed (`@Prop({ type: String, ref: 'User', index: true })`).
- Declare indexes in the schema only (never create them by hand in production); production creates them with `npm run db:indexes:apply` (section 3).
- Don't index everything: each index slows writes and uses memory. Review with `npm run db:indexes` and MongoDB `explain()`.

### Query rules

- **No unbounded queries.** List queries always use `limit` (from `normalizePagination()`), and return `paginate(...)`. Internal batch jobs iterate with a cursor or in pages.
- **Projections.** Select only the fields a use case needs: `.select('email name status')`. Sensitive fields use `select: false` in the schema and are selected explicitly only where needed (`.select('+passwordHash')`).
- **`.lean()` for reads** that return data to the client; it skips building Mongoose documents. Not for documents you will modify and `save()`.
- **Count carefully.** `countDocuments` with the same filter as the list; avoid counting on every request for very large collections.

### Retries

- Connection: startup retries (`MONGODB_RETRY_ATTEMPTS`), then the driver reconnects automatically.
- Writes: `retryWrites: true` lets the driver retry a single write once on a network error, safely (the server de-duplicates it).
- Application code never retries blindly. Retry only operations that are idempotent (reads, `$set` to a fixed value, upserts with a unique key) or protected by an idempotency key. Never retry non-idempotent actions like sending an email, charging a payment or incrementing a counter.
- Retries use exponential backoff with a maximum number of attempts.

### Caching conventions (for future use)

- No cache in the template. When needed: `@nestjs/cache-manager` with Redis (shared by all instances).
- Key format: `authcore:<module>:<entity>:<id>`, e.g. `authcore:users:profile:65f...`. Include the tenant id when data is tenant-specific.
- Every entry has a TTL. Invalidate on write (delete the key when the data changes).
- Never cache secrets, tokens, or permission decisions without the user and tenant in the key.
- HTTP: user-specific and auth responses send `Cache-Control: no-store`; public static data may use `Cache-Control: public, max-age=...`.

### Background job conventions (for future use)

- No queue in the template. When needed: BullMQ with Redis, inside the feature module (`modules/<name>/jobs/`).
- Jobs are idempotent: running a job twice must have the same effect as once (use a job id / idempotency key).
- Job payloads carry ids, not whole documents or secrets.
- Retries with exponential backoff and a maximum attempt count; failed jobs go to a failed queue for inspection.
- Slow or failure-prone work (emails, webhooks, exports) never runs inside the HTTP request; the request enqueues and returns.
- Workers use the same Winston logger and include the job id in logs.
- Workers shut down gracefully: stop taking new jobs, finish the current one.

### File upload conventions (for future use)

- No upload endpoints in the template. When needed: `@nestjs/platform-express` `FileInterceptor` (multer).
- Limits on every upload route: `fileSize` (e.g. 5 MB), `files` count, `fields` count; enforce per route, not globally.
- Allow only listed file types, checked by content (magic bytes), not by extension or the client's `Content-Type`.
- Store files in object storage (S3, GCS, Azure Blob), never in MongoDB documents or on the container disk.
- Generate random storage keys; never use the client's filename in paths. Keep the original name only as metadata.
- Serve downloads through short-lived signed URLs or an authorized endpoint returning `StreamableFile`.
- Virus-scan uploads from untrusted users before making them available.

### Verified (temporary probe module, removed afterwards)

| Check | Result |
| --- | --- |
| Handler taking 3s with `HANDLER_TIMEOUT_MS=1000` | `408 REQUEST_TIMEOUT` after 1.0s |
| Same handler with `@HandlerTimeout(5000)` | `200` after 3.0s |
| Query taking ~500ms with `MONGODB_QUERY_TIMEOUT_MS=200` | `503 REQUEST_TIMEOUT` after 0.2s, logged as error |
| Same query with `.maxTimeMS(5000)` | `200`; plugin kept the query's own `5000` |
| 9 KB JSON with `Accept-Encoding: gzip` | `Content-Encoding: gzip`, 685 bytes |
| Same response with `Cache-Control: no-store` | Not compressed |
| `/api/docs/openapi.json` | gzip |

## 14. Docker and containerization

- [x] Create a production-ready Dockerfile. *(`authcore-backend/Dockerfile`.)*
- [x] Use a multi-stage Docker build. *(`build` → `prod-deps` → `runtime`.)*
- [x] Use a lightweight production image. *(Alpine; only `dist/`, production `node_modules` and `package.json`; npm and yarn removed.)*
- [x] Use a non-root container user. *(`node`, uid 1000; app files owned by root (read-only), only `/app/logs` writable.)*
- [x] Add `.dockerignore`. *(Allowlist: only `src/`, `package*.json`, `tsconfig*.json`, `nest-cli.json`.)*
- [x] Avoid copying `.env` into images. *(Not in the allowlist, plus explicit `**/.env` / `**/.env.*` excludes.)*
- [x] Use environment variables at runtime. *(Image sets only `NODE_ENV=production` and `PORT=3000`; everything else via `-e` / `--env-file` / orchestrator.)*
- [x] Configure container health checks where appropriate. *(`HEALTHCHECK` on `/api/v1/health/live` every 30s; uses `API_PREFIX` / `PORT`.)*
- [x] Configure graceful container shutdown. *(`tini` as PID 1 forwards SIGTERM to Node; `STOPSIGNAL SIGTERM`; use a stop grace period above `SHUTDOWN_TIMEOUT_MS`.)*
- [ ] Run the production build inside Docker and check it works. *(Not done yet: Docker Desktop wasn't running.)*
- [ ] Prepare Docker Compose for local MongoDB development. *(Later.)*
- [x] Pin container image versions. *(`node:20.19.4-alpine3.22`.)*

Usage: see [authcore-backend/README.md, section 11](../authcore-backend/README.md#11-docker).

## 15. Git and repository standards

- [x] Initialize Git. *(Initialized by the scaffold; no commits yet.)*
- [ ] Create a proper `.gitignore`.
- [ ] Establish branch naming conventions.
- [ ] Establish commit message conventions.
- [ ] Configure protected branches.
- [ ] Configure pull request/MR requirements.
- [ ] Establish code review requirements.
- [ ] Add a README.
- [ ] Add a contribution guide if needed.
- [ ] Add a license if appropriate.
- [ ] Configure secret scanning.
- [ ] Configure dependency scanning.
- [ ] Never commit credentials or private keys.

## 16. CI/CD and deployment preparation

- [ ] Create a CI pipeline.
- [ ] Run dependency installation using the lockfile.
- [ ] Run ESLint.
- [ ] Run Prettier checks.
- [ ] Run TypeScript build checks.
- [ ] Build the production application.
- [ ] Build and validate the Docker image.
- [ ] Separate development, UAT/staging and production environments.
- [ ] Configure environment-specific secrets.
- [ ] Configure deployment health checks.
- [ ] Establish rollback procedures.
- [ ] Establish database backup and restore procedures.
- [ ] Establish a deployment version/tag strategy.

## 17. Documentation

- [x] Create project README. *(Root `README.md`: overview, structure, docs index, quick start, status. `authcore-backend/README.md`: developer guide, replacing the Nest scaffold README.)*
- [x] Document installation instructions. *(Backend README §1.)*
- [x] Document local development setup. *(Backend README §2: start, workflow, debugging, common startup errors.)*
- [x] Document environment variables. *(Backend README §3: all 34 variables with defaults and rules, load order, typed config usage.)*
- [x] Document available npm scripts. *(Backend README §4.)*
- [x] Document architecture and folder structure. *(Backend README §5: folders, layer rules, module layout, naming, request pipeline.)*
- [x] Document database connection configuration. *(Backend README §6: connection, schemas, indexes, query rules.)*
- [x] Document Swagger access. *(Backend README §7.)*
- [x] Document API response standards. *(Backend README §8.)*
- [x] Document security configuration. *(Backend README §9.)*
- [x] Document Docker setup. *(Backend README §11; root README.)*
- [ ] Document deployment instructions. *(Later, with CI/CD.)*

| Document | Audience |
| --- | --- |
| `README.md` (root) | Anyone opening the repository: what AuthCore is, where things are, how to start |
| `authcore-backend/README.md` | Developers working on the backend |
| `docs/project-setup-checklist.md` | Why each setup decision was made, and how it was verified |
| `docs/overview.md`, `docs/level-*-modules.md` | Product scope and build order |

---

# Level 3 – Final verification

Before writing your first actual feature, verify these items manually.

| # | Check | How to verify | Done |
| --- | --- | --- | --- |
| 1 | Project builds successfully | `npm run build` | [ ] |
| 2 | Development server starts | `npm run start:dev` | [ ] |
| 3 | Environment validation works | Remove a required environment variable | [ ] |
| 4 | MongoDB connects successfully | Verify connection and failure handling | [ ] |
| 5 | Swagger works | Open the configured Swagger URL | [ ] |
| 6 | Global validation works | Send an invalid DTO request | [ ] |
| 7 | Unknown properties are rejected | Send additional unexpected request fields | [ ] |
| 8 | Global exception handling works | Trigger a controlled exception | [ ] |
| 9 | CORS is restricted | Call from an unauthorized origin | [ ] |
| 10 | Helmet headers are present | Inspect HTTP response headers | [ ] |
| 11 | Rate limiting works | Exceed the configured request limit | [ ] |
| 12 | Request IDs work | Inspect logs for a request ID | [ ] |
| 13 | Sensitive information is redacted | Inspect logs and error responses | [ ] |
| 14 | Health endpoints work | Call the live and ready checks | [ ] |
| 15 | Graceful shutdown works | Stop the application | [ ] |
| 16 | Docker works | Build and run the container | [ ] |
| 17 | CI pipeline passes | Push a test branch | [ ] |
| 18 | Git secrets check passes | Scan repository for credentials | [ ] |

---

## Recommended npm packages

A practical package list for the empty starter template.

| Category | Packages |
| --- | --- |
| Framework | `@nestjs/core`, `@nestjs/common`, `@nestjs/platform-express` |
| Database | `@nestjs/mongoose`, `mongoose` |
| Configuration | `@nestjs/config` |
| Validation | `class-validator`, `class-transformer` |
| Swagger | `@nestjs/swagger` |
| Security | `helmet`, `@nestjs/throttler` |
| Health | `@nestjs/terminus` |
| Logging | `nestjs-pino`, `pino-http` |
| Development | `typescript`, `eslint`, `prettier` |

Install only the packages you actually configure. You don't need to introduce Redis, Kafka, BullMQ or other infrastructure into an empty template.

## Recommended implementation order

| Order | Work | Priority |
| --- | --- | --- |
| 1 | Project initialization and TypeScript | Essential |
| 2 | Folder architecture and naming conventions | Essential |
| 3 | Environment configuration and validation | Essential |
| 4 | MongoDB connection and base schema | Essential |
| 5 | Global validation and transformation | Essential |
| 6 | Global exception handling | Essential |
| 7 | Standard API response conventions | Essential |
| 8 | Swagger configuration | Essential |
| 9 | Helmet, CORS and rate limiting | Critical |
| 10 | Logging and request tracking | Critical |
| 11 | Health checks and graceful shutdown | Critical |
| 12 | Docker configuration | Recommended |
| 13 | CI/CD pipeline | Recommended |
| 14 | Documentation | Recommended |

## What NOT to include in this empty template

Keep the distinction clear: this is a reusable infrastructure template, not a complete application.

Do not implement these yet:

- User registration and login
- JWT authentication
- Refresh token management
- Roles and permissions
- User management
- Email verification
- Forgot/reset password
- Business modules
- Business-specific MongoDB schemas
- File upload functionality
- Payment integrations
- Redis caching implementation
- Background job implementations

You can establish the common infrastructure needed to support these later.

## Final architecture

**NestJS Starter Template**

| Part | Responsibility |
| --- | --- |
| `main.ts` | Bootstrap · Security · Global configuration |
| Config Module | Environment validation |
| Database Module | MongoDB connection |
| Common Module | Filters, pipes, guards |
| Health Module | Health monitoring |
| Swagger | API documentation |
| App Module | Root application |
| Express HTTP Server | Request → Validation → Controller → Response |

**Recommendation:** Make this starter template a separate Git repository. Whenever you start a new NestJS project, clone this template rather than rebuilding the foundation.

Target:

- Security configured from day one.
- Consistent API standards across projects.
- Reusable database infrastructure.
- Proper error handling and logging.
- Swagger documentation ready.
- Deployment infrastructure ready.
- Zero business-specific functionality.

Once this foundation is complete, you can start implementing authentication and application-specific modules without touching the core infrastructure unnecessarily.
