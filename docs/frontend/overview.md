# AuthCore Frontend — Project Overview

## What it is

`authcore-frontend` has two jobs, kept apart on purpose:

1. **A reusable React starter kit** (Level 1). Layout, sidebar, navbar, routing, theme system, design-system components, API client, hooks. Nothing in it knows about AuthCore or any business domain. Every new project (ERP, CRM, HRMS, admin panel, SaaS) starts from it and changes **configuration files only** to get its own name, logo, colors, navigation and layout.
2. **The AuthCore client** (Level 2). Sign-in, registration, account self-service and the admin screens for everything `authcore-backend` provides. Projects that use AuthCore keep these features; projects that don't can delete the `auth`, `account` and `admin-*` feature folders without touching the foundation.

Goal: **build the foundation once, reuse it everywhere, change the look without touching components.**

## Build plan: three levels

| Level | Scope | Goal | Document |
| --- | --- | --- | --- |
| Level 1 | Modules 1–16 | Reusable starter kit: setup, config, theme, components, routing, layouts, sidebar, navbar, API, docs (testing is manual) | [level-1-modules.md](./level-1-modules.md) |
| Level 2 | Modules 17–26 | AuthCore client: auth flows, guards, my account, administration | [level-2-modules.md](./level-2-modules.md) |
| Level 3 | Modules 27–34 | Production and enterprise: i18n, monitoring, PWA, Docker / CI, MFA UI | [level-3-modules.md](./level-3-modules.md) |

Supporting documents:

| Document | Contents |
| --- | --- |
| [project-setup-checklist.md](./project-setup-checklist.md) | Tooling and foundation decisions, with what `authcore-frontend` already has (`[x]`) and what is missing |
| [folder-structure.md](./folder-structure.md) | Target folder / file structure, responsibilities, import rules, naming, migration of the current files |
| [theme-system.md](./theme-system.md) | Color mode, theme presets, appearance styles, design tokens, no-flash loading |
| [techstack.md](./techstack.md) | Installed and planned packages, versions, decisions (and why) |

## Design principles

| Principle | Meaning |
| --- | --- |
| Configuration over code | Branding, navigation, layout, theme and feature toggles live in `src/config/`. A new project edits those files, not components. |
| Tokens over colors | Components use design tokens (CSS variables via Tailwind theme), never hex values or palette classes like `bg-indigo-600`. Any preset works with any component. |
| Three independent theme axes | **Color mode** (light / dark / system), **preset** (blue, emerald, violet, …) and **appearance** (radius, density, sidebar / navbar / card / input / button styles) can each change without affecting the others. |
| Feature isolation | One folder per business area. A feature never imports another feature's internals; shared code moves down to `components/`, `hooks/` or `lib/`. |
| One source of truth | One `App.tsx`, one router, one place for paths, one API client, one place reading `import.meta.env`. |
| Thin UI | No `fetch` / API calls in components: features call their `api/` functions through hooks. |
| Accessible by default | Keyboard, focus, ARIA and contrast are part of every component, checked in every theme. |
| Add dependencies only when needed | Every package has a documented reason (see [techstack.md](./techstack.md)). |

## Relation to the backend

| Concern | Backend (`authcore-backend`) | Frontend |
| --- | --- | --- |
| Project identity | `project.config.json` (name, slug, branding) | `src/config/app.config.ts` (same values; `npm run project:init` keeps them in sync — Level 1 module 2) |
| API base URL | `/api/v1` | `VITE_API_BASE_URL` (dev: Vite proxy to `http://localhost:3000`) |
| Response format | `{ success, message, data, meta?, timestamp, path }` | `lib/api/client.ts` unwraps `data`, keeps `meta` for lists |
| Errors | `{ success: false, message, code, errors[], statusCode }` | `ApiError` class; `errors[]` mapped onto form fields; `code` drives UI decisions |
| Access token | JWT in the sign-in response, 15 min | Kept **in memory only** (never `localStorage`) |
| Refresh token | HttpOnly cookie `<slug>_refresh`, path `/api/v1/auth`, origin-checked | `credentials: 'include'`, one refresh at a time, queued requests retried |
| Permissions | Groups → roles → permissions, `GET /access-control/me` | `usePermissions()`, `PermissionGate`, permission-aware navigation |
| Languages | Emails in en / ta / hi (`preferences.language`) | UI i18n in Level 3 (same languages) |

## Current state (2026-11-17)

`authcore-frontend` was scaffolded with Vite and already contains first versions of the auth and account screens: login, register, verify email, forgot / reset password, recovery, profile, security, sessions, activity, a dashboard, a fetch-based API client with refresh handling, an `AuthContext` and route guards.

Not there yet: the starter-kit foundation (sidebar, theme system, design tokens, data router, lazy routes). Module 1 (strict TypeScript, linting, formatting, architecture checks, CI) is done. The [project setup checklist](./project-setup-checklist.md) marks each item, and [folder-structure.md](./folder-structure.md#migration-of-the-current-files) maps every current file to its place in the target structure, so the existing work is **moved, not rewritten**.

## Definition of done for the starter kit

Level 1 is complete when every scenario in the [acceptance checklist](./level-1-modules.md#acceptance-checklist) passes. In short, without editing any component:

- rename the app and replace the logo / favicon;
- add a module with nested pages to the sidebar;
- switch light / dark / system, four color presets and every appearance option;
- point the app at another backend URL;
- run format check, lint, type check, architecture rules and a production build in CI (`npm run verify`); behaviour is verified manually.
