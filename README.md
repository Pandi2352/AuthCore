<div align="center">

# 🔐 AuthCore

### Reusable, production-grade authentication & authorization service

*An identity and access management foundation you drop into new projects instead of rebuilding auth every time.*

<br />

![Node.js](https://img.shields.io/badge/Node.js-20.19.4-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![NestJS](https://img.shields.io/badge/NestJS-11-E0234E?style=for-the-badge&logo=nestjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9_strict-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-8-47A248?style=for-the-badge&logo=mongodb&logoColor=white)

![Swagger](https://img.shields.io/badge/Swagger-OpenAPI-85EA2D?style=for-the-badge&logo=swagger&logoColor=black)
![Winston](https://img.shields.io/badge/Logging-Winston-F5A623?style=for-the-badge)
![Docker](https://img.shields.io/badge/Docker-multi--stage-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![ESLint](https://img.shields.io/badge/ESLint-strict-4B32C3?style=for-the-badge&logo=eslint&logoColor=white)
![Prettier](https://img.shields.io/badge/Prettier-formatted-F7B93E?style=for-the-badge&logo=prettier&logoColor=black)

![Foundation](https://img.shields.io/badge/foundation-complete-success?style=flat-square)
![Features](https://img.shields.io/badge/features-not_started-lightgrey?style=flat-square)
![Modules](https://img.shields.io/badge/planned_modules-28-blueviolet?style=flat-square)

[🚀 Getting started](#-getting-started) •
[📚 Docs](#-documentation) •
[🐳 Docker](#-docker) •
[⚙️ Configuration](#%EF%B8%8F-configuration) •
[📊 Status](#-project-status)

</div>

---

> [!NOTE]
> **Status:** the project foundation (setup checklist sections 1–13) is complete. Feature development has started: user registration is live. See [Project status](#-project-status).

## 📁 Repository structure

```text
AuthCore/
├── 🟢 authcore-backend/        NestJS API (the service)
│   ├── src/
│   │   ├── main.ts             Bootstrap: security, logging, Swagger, shutdown
│   │   ├── app.module.ts       Root module: global guards, pipes, interceptors, filter
│   │   ├── config/             Typed configuration + environment validation
│   │   ├── database/           MongoDB connection, base schema, plugins, scripts
│   │   ├── common/             Shared building blocks (filters, interceptors, DTOs, ...)
│   │   ├── shared/             App-wide services (graceful shutdown)
│   │   └── modules/            Feature modules (health, users, auth)
│   ├── Dockerfile
│   └── .env.example
└── 📘 docs/                    Planning and setup documentation
```

## 📚 Documentation

| | Document | Contents |
| :---: | --- | --- |
| 🧭 | [docs/overview.md](docs/overview.md) | Project goals, scope (28 modules), build levels |
| 🟩 | [docs/level-1-modules.md](docs/level-1-modules.md) | Modules 1–20 (MVP) with the sprint plan |
| 🟨 | [docs/level-2-modules.md](docs/level-2-modules.md) | Modules 21–24: advanced security and identity |
| 🟥 | [docs/level-3-modules.md](docs/level-3-modules.md) | Modules 25–28: enterprise IAM and compliance |
| ✅ | [docs/project-setup-checklist.md](docs/project-setup-checklist.md) | Production-ready foundation: every setup decision, convention and verification |
| 🧰 | [docs/techstack.md](docs/techstack.md) | Technology stack and versions |
| 🔑 | [docs/login-api-checklist.md](docs/login-api-checklist.md) | Login API: production checklist status |
| 👩‍💻 | [authcore-backend/README.md](authcore-backend/README.md) | Developer guide for the backend |

## 🧰 Tech stack

| Area | Technology |
| --- | --- |
| 🟢 Runtime | Node.js 20.19.4 |
| 🔴 Framework | NestJS 11 + TypeScript 5.9 (strict) |
| 🍃 Database | MongoDB 8 + Mongoose 8 |
| 📖 API docs | Swagger / OpenAPI (`@nestjs/swagger`) |
| ✔️ Validation | class-validator + class-transformer |
| ⚙️ Configuration | `@nestjs/config` + Joi |
| 🛡️ Security | helmet, `@nestjs/throttler`, CORS allowlist |
| 📝 Logging | Winston (`nest-winston`), JSON in production |
| 💓 Health | `@nestjs/terminus` |
| 🧹 Code quality | ESLint (strict type-checked) + Prettier + madge |
| 🐳 Container | Docker (multi-stage, non-root) |

## 📋 Prerequisites

- 🟢 **Node.js 20.19.4** (see `authcore-backend/.nvmrc`) and **npm 10**
- 🍃 **MongoDB 8** running locally, or any reachable MongoDB instance
- 🐳 **Docker** (optional, for the container image)

> [!WARNING]
> Node 20 reached end-of-life in April 2026. Upgrading to Node 22/24 LTS (and NestJS 12) is planned.

## 🚀 Getting started

```bash
cd authcore-backend

# 1️⃣ Install dependencies (exact versions from the lockfile)
npm ci

# 2️⃣ Create your local environment file and adjust values
cp .env.example .env
#    Required: MONGODB_URI, CORS_ORIGIN

# 3️⃣ Start in watch mode
npm run start:dev
```

> [!TIP]
> The app refuses to start if a required environment variable is missing or invalid, and tells you exactly which one.

Once running:

| | URL | What |
| :---: | --- | --- |
| 🌐 | http://localhost:3000/api/v1 | API base (all routes: `/api/v1/...`) |
| 💚 | http://localhost:3000/api/v1/health | Overall health |
| 💓 | http://localhost:3000/api/v1/health/live | Liveness |
| 🟢 | http://localhost:3000/api/v1/health/ready | Readiness (includes MongoDB) |
| 📖 | http://localhost:3000/api/docs | Swagger UI (development / staging only) |
| 📄 | http://localhost:3000/api/docs/openapi.json | OpenAPI JSON (import into Postman) |

## 🛠️ npm scripts

Run from `authcore-backend/`.

| Script | Purpose |
| --- | --- |
| ▶️ `npm run start:dev` | Development server with watch mode |
| 🏗️ `npm run build` | Compile to `dist/` |
| 🚢 `npm run start:prod` | Run the compiled build |
| ✅ `npm run verify` | Lint + format check + type check + circular-import check + build |
| 🧹 `npm run lint` / `lint:check` | ESLint fix / check only |
| 🎨 `npm run format` / `format:check` | Prettier write / check only |
| 🔎 `npm run typecheck` | TypeScript check |
| 🔁 `npm run check:circular` | Fail on circular imports |
| 🗂️ `npm run db:indexes` / `db:indexes:apply` | Report / create MongoDB indexes (production) |
| 🛡️ `npm run audit:prod` / `audit:all` | Dependency vulnerability scan |

> [!IMPORTANT]
> Run `npm run verify` before every commit. It must pass.

Testing is manual for now; there is no automated test setup.

## 🐳 Docker

Build and run from `authcore-backend/`:

```bash
# Build the production image
docker build -t authcore-backend .

# Run it (pass configuration as environment variables; never bake .env into the image)
docker run --rm -p 3000:3000 \
  -e MONGODB_URI="mongodb://host.docker.internal:27017/authcore" \
  -e CORS_ORIGIN="http://localhost:5173" \
  authcore-backend
```

- 🔗 `host.docker.internal` reaches MongoDB running on your machine from inside the container.
- 👤 The container runs as the non-root `node` user, with `tini` as PID 1 so `docker stop` triggers a graceful shutdown.
- 🏭 `NODE_ENV=production` is set in the image: JSON logs, Swagger off, auto-indexing off (create indexes with `npm run db:indexes:apply`).
- 💓 The image has a `HEALTHCHECK` on `/api/v1/health/live`. Use `/api/v1/health/ready` for load balancer readiness.
- ⏱️ Give the container a stop grace period longer than `SHUTDOWN_TIMEOUT_MS` (default 10s), e.g. `docker stop -t 30`.

## ⚙️ Configuration

All configuration comes from environment variables, validated at startup. See [`authcore-backend/.env.example`](authcore-backend/.env.example) for every variable with its default, and the [backend README](authcore-backend/README.md#3-environment-variables) for the full reference.

| Required | Purpose |
| --- | --- |
| 🍃 `MONGODB_URI` | MongoDB connection string (`mongodb://` or `mongodb+srv://`) |
| 🌍 `CORS_ORIGIN` | Comma-separated allowed origins (`*` is rejected) |

> [!CAUTION]
> Never commit `.env` files or secrets. Only `.env.example` is tracked.

## 📐 API conventions

- 🔢 All routes are versioned: `/api/v1/<resource>`.
- ✅ Success: `{ "success": true, "message", "data", "meta"?, "timestamp", "path" }`
- ❌ Error: `{ "success": false, "message", "code", "errors", "statusCode", "timestamp", "path" }`
- 🏷️ Every response has an `X-Request-Id` header; quote it when reporting a problem.
- 🕒 Dates are ISO 8601 in UTC.

Full conventions: [setup checklist, sections 4–5](docs/project-setup-checklist.md).

## 📊 Project status

| Area | Status |
| --- | :---: |
| 🗺️ Planning docs (28 modules, sprint order) | ✅ Done |
| 🧱 Foundation: config, database, architecture, API standards, Swagger, code quality (sections 1–7) | ✅ Done |
| 🛡️ Security, errors, responses, logging, health, shutdown, performance (sections 8–13) | ✅ Done |
| 🐳 Docker: Dockerfile + `.dockerignore` | ✅ Done |
| 🐳 Docker: image build test, Docker Compose | ⏳ Pending |
| 📝 Documentation (except deployment) | ✅ Done |
| 🌿 Git standards, CI/CD, deployment docs (sections 15–17) | ⏳ Not started |
| 🧩 Registration: Direct / Email OTP / Email link / Admin approval (configurable) | ✅ Done |
| 🔑 Login: email / username + password, JWT, sessions, lockout | ✅ Done |
| 🔄 Refresh token: rotation, reuse detection, CSRF origin check | ✅ Done |
| 🛡️ Auth guard (secure by default) + GET /auth/me | ✅ Done |
| 🚪 Logout + logout from all devices | ✅ Done |
| 📱 Session management: list / view / revoke my devices | ✅ Done |
| 🔐 Forgot / reset / change password | ✅ Done |
| 📏 Password policy: rules, expiry, reminder scheduler (admin API) | ✅ Done |
| 🧑‍🤝‍🧑 Access control: roles, permissions, groups, access mapping (RBAC) | ✅ Done |
| 👤 My account: profile, preferences, email change, deactivate / delete, recovery | ✅ Done |
| 🛠️ User administration + invites | ✅ Done |
| 📁 Common file uploads (local folder storage) + profile pictures | ✅ Done |
| 👑 First administrator from `.env` (bootstrap admin) | ✅ Done |
| 🔔 New-device sign-in alerts, account-locked email, default groups, admin activity search / login history | ✅ Done |
| 🧩 User schema (custom user variables), personal details, recent activity, admin set-password, password generator | ✅ Done |

---

<div align="center">

Built with 💙 using **NestJS** · **TypeScript** · **MongoDB**

</div>
