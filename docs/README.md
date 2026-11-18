# AuthCore Documentation

Planning and setup documents for both applications.

**Starting a new product (CRM, e-commerce, HRMS …) from AuthCore?** Follow [new-project-guide.md](new-project-guide.md) step by step.

## Backend — `authcore-backend` (NestJS + MongoDB)

| Document | Contents |
| --- | --- |
| [backend/overview.md](backend/overview.md) | Goals, scope (28 modules), build levels |
| [backend/level-1-modules.md](backend/level-1-modules.md) | Modules 1–20 (MVP) with the sprint plan |
| [backend/level-2-modules.md](backend/level-2-modules.md) | Modules 21–24: advanced security and identity |
| [backend/level-3-modules.md](backend/level-3-modules.md) | Modules 25–28: enterprise IAM and compliance |
| [backend/project-setup-checklist.md](backend/project-setup-checklist.md) | Production-ready foundation: setup decisions, conventions, verification |
| [backend/techstack.md](backend/techstack.md) | Technology stack and versions |
| [backend/access-control-checklist.md](backend/access-control-checklist.md) | Roles, permissions, groups, access mapping |

## Frontend — `authcore-frontend` (React + Vite + Tailwind)

| Document | Contents |
| --- | --- |
| [frontend/overview.md](frontend/overview.md) | Starter kit + AuthCore client, principles, relation to the backend, current state |
| [frontend/project-setup-checklist.md](frontend/project-setup-checklist.md) | Tooling and foundation checklist with an audit of the current code |
| [frontend/folder-structure.md](frontend/folder-structure.md) | Target structure, import rules, naming, migration of current files, recipes |
| [frontend/data-table.md](frontend/data-table.md) | Reusable data table: usage, server paging, checklist mapping |
| [backend/file-storage.md](backend/file-storage.md) | File storage: local folder / S3 / Backblaze B2 / Tigris / Supabase, active storage, POST /uploads, adding a provider |
| [frontend/business-settings.md](frontend/business-settings.md) | Business settings: site name, description, logos, favicon — API, runtime branding, admin page |
| [frontend/api-integration-checklist.md](frontend/api-integration-checklist.md) | Connecting backend APIs: shared foundation status + per-module checklist |
| [frontend/theme-system.md](frontend/theme-system.md) | Color mode, presets, appearance, design tokens, no-flash loading |
| [frontend/level-1-modules.md](frontend/level-1-modules.md) | Modules 1–16: reusable starter kit, acceptance checklist, sprint plan |
| [frontend/level-2-modules.md](frontend/level-2-modules.md) | Modules 17–26: every AuthCore backend feature in the UI |
| [frontend/level-3-modules.md](frontend/level-3-modules.md) | Modules 27–34: i18n, E2E, monitoring, deployment, MFA UI, DX |
| [frontend/techstack.md](frontend/techstack.md) | Installed and planned packages, decisions |
| [../authcore-frontend/README.md](../authcore-frontend/README.md) | **Using the kit:** quick start, scripts, env, configuration, recipes, verification, deployment, troubleshooting |
| [../authcore-frontend/CHANGELOG.md](../authcore-frontend/CHANGELOG.md) | Breaking changes for projects copied from earlier versions |
