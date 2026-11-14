# AuthCore — Tech Stack

## Core stack

| Layer | Technology | Installed version |
| --- | --- | --- |
| Runtime | Node.js | 20.19.4 |
| Package manager | npm | 10.8.2 |
| Framework | NestJS (`@nestjs/core`, `@nestjs/common`, `@nestjs/platform-express`) | 11.2.x |
| Language | TypeScript (strict mode) | 5.9.3 |
| Database | MongoDB | — |
| ODM | Mongoose + `@nestjs/mongoose` | 8.24.9 / 11.0.4 |
| API documentation | Swagger / OpenAPI (`@nestjs/swagger`) | 11.4.8 |
| CLI | `@nestjs/cli` | 11.0.24 |

## Planned technology stack (from the module blueprint)

| Area | Technology | Status |
| --- | --- | --- |
| Backend | NestJS + TypeScript | Installed |
| Database | MongoDB + Mongoose | Installed |
| Cache | Redis | Planned |
| Authentication | Passport + JWT | Planned |
| Password hashing | Argon2 | Planned |
| Validation | class-validator + class-transformer | Installed |
| Configuration | @nestjs/config + Joi | Installed |
| Rate limiting | @nestjs/throttler | Installed |
| Email | Nodemailer | Planned |
| Queue | BullMQ | Planned |
| Logging | Winston (nest-winston) | Installed |
| API documentation | Swagger | Installed |
| Testing | Manual testing (no automated test setup for now) | — |
| Containerization | Docker | Planned |
| CI/CD | GitLab CI/CD | Planned |

## Tooling (from the Nest scaffold)

| Purpose | Tool |
| --- | --- |
| Linting | ESLint 9 + typescript-eslint |
| Formatting | Prettier 3 |
| HTTP adapter | Express (`@nestjs/platform-express`) |

## Why NestJS 11 and not 12

The latest NestJS CLI (v12) requires Node `^22.22.3 || ^24.15.0 || >=26`. This machine runs Node 20.19.4, so the project uses the NestJS 11 line, which supports Node 20. `@nestjs/swagger` 12 needs `@nestjs/common` 12, so Swagger and Mongoose are pinned to their Nest 11–compatible majors.

To move to NestJS 12 later: upgrade Node to 24 LTS, then upgrade `@nestjs/*` packages together.

## Project setup

Backend folder: `D:\AuthCore\authcore-backend`

Command used to create it (from `D:\AuthCore`):

```bash
npx @nestjs/cli@11 new authcore-backend --directory authcore-backend --package-manager npm --strict
```

General form of the command: `nest new <project-name>` (e.g. `nest new task-management-api`).

Additional packages:

```bash
npm install @nestjs/mongoose@^11 @nestjs/swagger@^11 mongoose@^8
```

## Common commands

Run these from `authcore-backend`:

```bash
npm run start:dev   # dev server with watch mode
npm run build       # compile to dist/
npm run start:prod  # run compiled build
npm run typecheck   # type check only
npm run verify      # lint + format + typecheck + build
npm run lint        # lint and auto-fix
```

## Notes

- For SAML, SCIM, OAuth/OIDC and cryptographic key management, use well-maintained standard libraries rather than custom protocol code (see [overview.md](./overview.md)).
