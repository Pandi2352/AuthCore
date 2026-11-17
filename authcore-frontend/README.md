# AuthCore Frontend

A reusable React starter for products built on **AuthCore Backend**: an app shell (sidebar, navbar, layouts), a hand-built component library, a theme system, and the sign-in / account screens already wired to the backend. Copy it, rename it, configure it, and build your business modules on top.

Everything a new project changes lives in `src/config/` and `.env`. Components never hard-code names, colors, navigation or URLs.

**Contents:** [Quick start](#quick-start) · [New project in 10 minutes](#start-a-new-project-in-10-minutes) · [Scripts](#scripts) · [Environment](#environment-variables) · [Configuration](#configuration-guide) · [Theme](#theme-guide) · [Structure](#project-structure) · [Rules](#architecture-rules) · [API and errors](#api-calls-and-error-handling) · [Recipes](#recipes) · [Manual verification](#manual-verification-checklist) · [Deployment](#deployment) · [Troubleshooting](#troubleshooting) · [Changelog](./CHANGELOG.md)

---

## Quick start

Requirements: Node `>= 20.19` (see `.nvmrc`), and the backend running on `http://localhost:3000`.

```bash
npm ci
cp .env.example .env          # defaults work with the local backend
npm run dev                   # http://localhost:5173
```

Sign in with the backend's bootstrap admin, or register a new account.

| URL                                               | What                                                                             |
| ------------------------------------------------- | -------------------------------------------------------------------------------- |
| `/login`, `/register`                             | Auth pages (which ones show depends on `features.config.ts → auth`)              |
| `/dashboard`                                      | App home                                                                         |
| `/profile`, `/security`, `/sessions`, `/activity` | The signed-in user's account                                                     |
| `/settings/appearance`                            | Theme preferences                                                                |
| `/dev/ui`                                         | **Development only:** every component, with usage notes and the theme customizer |
| `/dev/api`                                        | **Development only:** API client playground                                      |

Before committing: `npm run verify`.

---

## Start a new project in 10 minutes

The full guide for backend and frontend together (database, mail, auth flows, roles, deployment) is [docs/new-project-guide.md](../docs/new-project-guide.md). The frontend part:

| #   | Step                                                                                                          | Where                                          | Time  |
| --- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ----- |
| 1   | Copy without `.git`, `node_modules`, `dist`, `.env`                                                           | see the full guide, step 1                     | 1 min |
| 2   | Rename: `npm run project:init -- --name "Nexa CRM" --slug nexa-crm --color "#0f766e"` (add `--dry-run` first) | `app.config.ts`, `package.json`                | 1 min |
| 3   | Brand assets: replace `public/favicon.svg`; logos in `public/brand/` referenced from `app.config.ts → logos`  | `public/`, `app.config.ts`                     | 2 min |
| 4   | Navigation: your modules as `status: 'planned'` items (they get a "not built yet" page)                       | `navigation.config.ts`, `paths.ts`, `icons.ts` | 3 min |
| 5   | Theme: `defaults.preset` (`'brand'` uses your color), mode, what users may change                             | `theme.config.ts`                              | 1 min |
| 6   | Auth flows: match the backend `.env` (registration, verification, identifiers)                                | `features.config.ts → auth`                    | 1 min |
| 7   | Run: `npm ci && cp .env.example .env && npm run dev`, then `npm run verify`                                   | —                                              | 1 min |

Use the **same name and slug** as the backend (`authcore-backend: npm run project:init`). A wrong config value shows a **Configuration problems** page in development listing each problem.

---

## Scripts

| Script                            | What it does                                                          |
| --------------------------------- | --------------------------------------------------------------------- |
| `npm run dev`                     | Dev server on port 5173; `/api` is proxied to `http://localhost:3000` |
| `npm run build`                   | Type-check and production build into `dist/` (dev routes are removed) |
| `npm run preview`                 | Serve the production build locally                                    |
| `npm run verify`                  | **Run before every commit (CI runs it):** all checks below + build    |
| `npm run format` / `format:check` | Prettier (import order, Tailwind class order)                         |
| `npm run lint` / `lint:fix`       | oxlint incl. React-compiler rules; warnings fail                      |
| `npm run typecheck`               | `tsc -b`                                                              |
| `npm run check:architecture`      | Project rules (see [Architecture rules](#architecture-rules))         |
| `npm run check:contrast`          | Every theme preset × mode meets WCAG contrast                         |
| `npm run check:error-codes`       | `lib/constants/error-codes.ts` matches the backend `ErrorCode` enum   |
| `npm run project:init -- …`       | Rename / rebrand a copy (`--help` for all options)                    |

There is no automated test framework: modules are verified by hand (see the [checklist](#manual-verification-checklist)).

---

## Environment variables

Copy `.env.example` to `.env` (git-ignored). Every `VITE_` variable ends up in the browser bundle: **never put secrets here.** Variables are read only through `src/config/env.ts` (validated, typed); their types are in `src/types/env.d.ts`.

| Variable              | Default   | Notes                                                                                                                                                                                 |
| --------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_API_BASE_URL`   | `/api/v1` | Same-origin path (dev proxy / production web server, recommended: the refresh cookie and the backend's origin check work without CORS) or a full URL `https://api.example.com/api/v1` |
| `VITE_API_TIMEOUT_MS` | `30000`   | Request timeout; `0` = none. Uploads have no timeout unless the call sets one                                                                                                         |

The dev proxy target is in `vite.config.ts → server.proxy` (change it if the backend runs on another port).

**Adding a variable:** add it to `.env.example` (with a comment), `src/types/env.d.ts` and `src/config/env.ts` (parse + validate). Nothing else may read `import.meta.env` (checked by `check:architecture`).

---

## Configuration guide

All in `src/config/`. Wrong values are reported at startup by `validate-config.ts`.

| File                   | What you set                                                                                                                                                                                                                                                                                                                                                                         |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `app.config.ts`        | Name, short name, slug, description, logos (`light` / `dark` / `mark`), favicon, locale (language, time zone), branding color, company, support email, legal links. Fills `index.html` (title, meta, favicon, theme color) at build time                                                                                                                                             |
| `features.config.ts`   | On / off switches: `ui` (theme switcher, customizer, search, command menu, notifications, breadcrumbs), `auth` (registration + flow, login identifiers, remember me, recovery, invites), `account` (sessions, activity, devices, preferences, data export, self-deletion), `admin.enabled`. A disabled feature hides its navigation items and its routes return 404                  |
| `navigation.config.ts` | Sidebar groups and items: `id`, `title`, `path`, `icon`, `children`, `badge`, `featureFlag`, `permission`, `match`, `status: 'planned'`                                                                                                                                                                                                                                              |
| `paths.ts`             | Every URL as a constant or builder (`paths.admin.userDetail(id)`); route patterns with `:params` in `routePatterns`. Never write a path string elsewhere                                                                                                                                                                                                                             |
| `icons.ts`             | Icon name → Lucide component (config stays serializable). Add an icon here before using its name in navigation                                                                                                                                                                                                                                                                       |
| `layout.config.ts`     | `sidebar` (position, width, collapsed width, collapsible, sticky behavior, mobile breakpoint), `navbar` (actions and their order, custom actions, logo rule, height, sticky, sidebar toggle, breadcrumbs), `content` (max width, padding), `auth` (auth page variant, side image). The sidebar _style_ (classic / minimal / floating / compact / dark) is a theme appearance setting |
| `theme.config.ts`      | Default mode, preset and appearance; what users may change (`userCustomizable`)                                                                                                                                                                                                                                                                                                      |
| `theme.presets.ts`     | Color presets (light + dark tokens each)                                                                                                                                                                                                                                                                                                                                             |
| `env.ts`               | The only reader of `import.meta.env`                                                                                                                                                                                                                                                                                                                                                 |

Feature flags in code: `isFeatureEnabled('account.sessionsPage')`; on routes `handle.featureFlag`; in navigation `featureFlag`.

---

## Theme guide

Full reference: [docs/frontend/theme-system.md](../docs/frontend/theme-system.md).

- **Three independent axes:** mode (`light` / `dark` / `system`), preset (color palette), appearance (radius, density, sidebar, navbar, cards, inputs, buttons, borders, shadows).
- **Kit defaults:** `radius: 'medium'` (`rounded-md` everywhere; `rounded-full` only for circles) and `shadows: 'none'`. Only the `shadow-card` / `shadow-popover` tokens exist, and they are empty unless a project turns shadows on.
- **Tokens only:** components use semantic classes (`bg-surface`, `text-muted-foreground`, `border-border`, `bg-primary`, `text-danger` …). Hex / rgb / named Tailwind colors fail `check:architecture`.
- **Brand color:** set `app.config.ts → branding.primaryColor` and `theme.config.ts → defaults.preset: 'brand'`; light and dark variants are derived and contrast-checked.
- **New preset:** add it to `theme.presets.ts` and `styles/themes.css` (see the theme doc), then `npm run check:contrast`.
- **No flash:** an inline script (built from `app/theme/theme-core.ts`) applies the stored theme before the first paint. With a Content-Security-Policy, allow it by hash.
- **Check:** open `/dev/ui`, switch every preset × mode × appearance in the customizer at the top.

---

## Project structure

Full annotated tree: [docs/frontend/folder-structure.md](../docs/frontend/folder-structure.md).

```text
src/
├── app/                 App.tsx, Providers.tsx, router.tsx
│   ├── routes/          Route tree per area (auth, dashboard, account, settings, admin, planned, dev)
│   ├── layouts/         Root / App / Auth / Public layouts, guards, sidebar/, navbar/, command-menu/
│   └── theme/           ThemeProvider, theme-core (no-flash script), preferences
├── components/
│   ├── ui/              Design system: ~33 hand-built components + primitives (no UI library)
│   ├── common/          Logo, ThemeToggle, ConfirmDialog, SearchInput, CopyButton, DateTime, FileDropzone …
│   ├── page/            PageContainer, PageHeader, PageSection, ResponsiveGrid, FilterBar
│   └── feedback/        LoadingState, EmptyState, ErrorState, ErrorAlert, NoPermissionState, ErrorBoundary, notify
├── features/            One folder per business area: api/, components/, pages/, types/, index.ts
│   ├── auth/            Session (AuthProvider, useAuth, token store), permissions, auth pages — public API in index.ts
│   ├── account/         Profile, security, sessions, activity
│   ├── dashboard/
│   └── settings/
├── pages/               App-wide pages: NotFound, Forbidden, RouteError, Planned*, ConfigError, dev/
├── config/              Everything a new project edits (see above)
├── hooks/               Generic hooks (no business logic)
├── lib/                 Plain TypeScript, no React: api/, errors/, format/, utils/, constants/, storage.ts
├── types/               Shared types, env.d.ts
└── styles/              tokens.css, themes.css, appearance.css, base.css
```

---

## Architecture rules

Enforced by `npm run check:architecture` where possible ([full list](../docs/frontend/level-1-modules.md#architecture-rules)):

1. **No hard-coded branding, navigation, colors or URLs** — from `config/` and tokens only.
2. **No UI libraries.** Components are our own, in `components/ui`. Allowed helpers: `clsx`, `tailwind-merge`, `lucide-react`. New dependencies need a reason in [techstack.md](../docs/frontend/techstack.md).
3. **No native `<select>`** — use `Select` / `Combobox` (keyboard, typeahead, theming).
4. **Shape:** only `rounded-md` / `rounded-full`; only `shadow-card` / `shadow-popover`.
5. **`cursor-pointer` on everything clickable** (buttons, menu items, triggers, clickable rows).
6. **Network calls only through `lib/api`**, from `features/*/api/*.api.ts` — never `fetch` in a component.
7. **Layers:** `components/` and `hooks/` contain no business logic; `lib/` contains no React; features don't import each other except through `features/auth` (its `index.ts`).
8. **Routes only in `app/routes/`**, paths only from `config/paths.ts`.
9. **Small components** (≈ 200 lines is a smell); local state first, context only for app-wide concerns.

---

## API calls and error handling

**Calling the backend** — one client, `lib/api/client.ts`:

```ts
// features/leads/api/leads.api.ts
import { apiClient } from '@/lib/api';

export const leadsApi = {
  list: (query: LeadQuery, signal?: AbortSignal) =>
    apiClient.getPage<Lead>('/leads', { query, signal }),
  get: (id: string, signal?: AbortSignal) =>
    apiClient.get<Lead>(`/leads/${encodeURIComponent(id)}`, { signal }),
  create: (data: CreateLead) => apiClient.post<Lead>('/leads', data),
  remove: (id: string) => apiClient.delete<null>(`/leads/${encodeURIComponent(id)}`),
};
```

- Unwraps the backend envelope (`data`); `getPage` returns `{ items, meta }`.
- Adds the access token (only to API URLs), `X-Request-Id`, timeout; on 401 refreshes once (shared by parallel requests) and retries.
- Throws `ApiError` (`status`, `code`, `message`, `fieldErrors`, `requestId`, `retryAfter`, `isNotFound`, `isForbidden` …). Codes are in `lib/constants/error-codes.ts`.
- Offline → fails at once with `NETWORK_ERROR`. Uploads with progress: `uploadFile`; file downloads: `downloadFile`.

**Showing errors** — pick by where the error happens:

| Situation                                       | Use                                                                                             | Example                                                            |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Page / section failed to load                   | `<ErrorState error={err} onRetry={load} />`                                                     | 403 → "no access", 404 → "not found", 5xx → message + reference id |
| Form submit failed                              | `useApiError()` + `<ErrorAlert error fields={[…]} />` + `error={fieldError('email')}` on inputs | Server validation errors appear next to the inputs                 |
| A button action failed (delete, revoke, upload) | `notifyError(err, 'Could not delete')` / `notifySuccess('Deleted')`                             | Toast; reference id for server errors                              |
| Text for anything else                          | `getErrorMessage(err, fallback)`                                                                | 429 → "Try again in 15 minutes."                                   |

```tsx
const { error, fallback, setError, fieldError } = useApiError();

const onSubmit = async () => {
  setError(null);
  try { await leadsApi.create(values); notifySuccess('Lead created'); }
  catch (err) { setError(err, 'Could not create the lead'); }
};

<ErrorAlert error={error} fallback={fallback} fields={['name', 'email']} onClose={() => setError(null)} />
<Input label="Email" error={fieldError('email')} … />
```

Cancelled requests and an expired session never show a message (the session end signs out with a toast). Loaders should pass an `AbortController` signal and abort on unmount.

**Crashes:** `ErrorBoundary` at app, page (keeps sidebar / navbar) and widget level; `RouteErrorPage` for route errors; a failed lazy chunk after a deploy reloads the page once.

**Error reporting:** `reportError` sends crashes and 5xx to the reporter — a no-op until you plug one in (Sentry in Level 3):

```ts
// main.tsx
setErrorReporter((error, ctx) =>
  Sentry.captureException(error, { tags: { source: ctx.source }, extra: ctx.extra }),
);
```

---

## Recipes

### Add a page to an existing area

1. URL in `src/config/paths.ts` (`account: { …, notifications: '/notifications' }`).
2. Page in `src/features/<area>/pages/NotificationsPage.tsx` (named export), built from `PageContainer`, `PageHeader`, `PageSection` and the feedback states.
3. Route in `src/app/routes/<area>.routes.tsx`:

   ```ts
   {
     path: paths.account.notifications,
     handle: { title: 'Notifications', breadcrumb: crumbs('Notifications') } satisfies RouteHandle,
     lazy: lazyPage(() => import('@/features/account/pages/NotificationsPage'), 'NotificationsPage'),
   },
   ```

   `handle.title` sets the browser title, `breadcrumb` the breadcrumbs, `permission` / `featureFlag` protect the route (403 / 404).

4. Navigation item in `src/config/navigation.config.ts` (with the same `featureFlag` / `permission`).

### Add a business module (e.g. Leads)

1. Plan it first: navigation items with `status: 'planned'` show a "not built yet" page until the routes exist.
2. Create the feature:

   ```text
   src/features/leads/
   ├── api/leads.api.ts        apiClient calls only (see above)
   ├── types/lead.types.ts
   ├── components/             LeadsTable, LeadForm (module-specific)
   ├── pages/                  LeadsListPage, LeadDetailPage
   └── index.ts                what other code may import
   ```

3. Paths in `paths.ts` (`leads: { list: '/leads', detail: (id) => … }`, pattern `'/leads/:id'` in `routePatterns`).
4. `src/app/routes/leads.routes.tsx` with `handle.permission: 'LEAD_READ'`; add it to `appRoutes` in `src/app/routes/index.tsx`.
5. Navigation: drop `status: 'planned'`, set `permission`.
6. Inside pages: `useRequiredParam('id')` for `:id`, `useUrlPagination({ total })` for lists (page in the URL), `usePermissions().hasPermission('LEAD_WRITE')` or `<PermissionGate permission="LEAD_WRITE">` for buttons.
7. Backend side: permissions and routes per the backend README.

### Add a UI component

1. Folder `src/components/ui/<name>/` with `Name.tsx`, `name.variants.ts` (use `variants()` from `lib/utils`, not cva) and `index.ts`; export it from `components/ui/index.ts`.
2. Build on `components/ui/primitives` (Slot / `asChild`, Portal, `useFloating`, `useDismiss`, list navigation) and hooks (`useControllableState`, `useFocusTrap`).
3. Tokens only, `rounded-md`, no shadow, `cursor-pointer` on clickable parts, visible focus ring, keyboard support and ARIA roles, controlled + uncontrolled.
4. Add it to `/dev/ui` (`src/pages/dev/UiKitchenSinkPage.tsx`) with a usage note in `kitchen-sink-notes.ts`; check every preset × mode.

Module-specific components belong in `features/<area>/components/`, not `components/ui`.

### Add a color preset

Add the preset to `src/config/theme.presets.ts` and its tokens to `src/styles/themes.css` ([steps](../docs/frontend/theme-system.md#adding-a-preset)); list it in `theme.config.ts → userCustomizable.presets` if users may pick it; run `npm run check:contrast`.

### Add a navbar action or command

`layout.config.ts → navbar.customActions` (a link or a built-in command); command-menu groups in `src/app/layouts/command-menu/AppCommandMenu.tsx`; notifications source in `src/app/layouts/navbar/notifications/use-notification-feed.ts`.

### Add a stored preference

Register the key in `lib/constants/storage-keys.ts` (`STORAGE_KEYS.myKey = { name: 'my-key', version: 1 }`; bump the version when the shape changes), then `useLocalStorage('myKey', defaultValue, { validate })`. Never call `localStorage` directly (`lib/storage.ts` is the only access).

---

## Manual verification checklist

Run before a release or after changing shared code (details: [level-1-modules.md, module 15](../docs/frontend/level-1-modules.md#15-manual-verification)).

- [ ] `npm run verify` green locally and in CI
- [ ] `/dev/ui`: every component in every preset × mode × appearance (light, dark, system)
- [ ] Theme: system mode follows the OS live; choice survives reload; no flash; corrupted storage falls back to defaults
- [ ] Sidebar: active item, collapse / expand, submenus by keyboard, mobile drawer, items hidden by flag / permission
- [ ] Routing: deep-link refresh, lazy pages, 404, 403, route error page, redirects, `returnTo` after sign-in
- [ ] Auth: sign-up (configured flow), sign-in, sign-out, forgot / reset password, session expiry → sign-out toast
- [ ] Errors: invalid form → field errors; offline (DevTools) → "You're offline"; backend stopped → error state with retry; 429 → "Try again in …"
- [ ] Responsive at 375 / 768 / 1280 / 1920; no horizontal scroll
- [ ] Keyboard-only walkthrough (skip link, focus visible, dialogs trap focus, Escape closes); Lighthouse accessibility ≥ 95
- [ ] Config change (name, logo, navigation item, preset) shows up without touching components

---

## Deployment

`npm run build` → static files in `dist/`. Serve them from any static host with:

1. **SPA fallback:** unknown paths return `index.html` (client-side routing).
2. **Same-origin API (recommended):** proxy `/api` to the backend, keep `VITE_API_BASE_URL=/api/v1`.
3. **Caching:** `assets/*` are content-hashed (cache for a year); `index.html` must not be cached, so new deploys are picked up (old tabs reload once when a chunk is missing).
4. **HTTPS** (the refresh cookie is `Secure` in production).

```nginx
server {
  listen 80;
  root /usr/share/nginx/html;

  location /api/ {
    proxy_pass http://backend:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
  location /assets/ {
    add_header Cache-Control "public, max-age=31536000, immutable";
  }
  location / {
    add_header Cache-Control "no-cache";
    try_files $uri /index.html;
  }
}
```

With the API on another domain: set `VITE_API_BASE_URL` to the full URL at build time, and on the backend `CORS_ORIGIN` (the frontend URL) and `REFRESH_COOKIE_SAMESITE=none` + `REFRESH_COOKIE_SECURE=true`.

`.env` values are baked in at **build** time: build once per environment. Docker image, CSP headers and monitoring are Level 3 (module 32).

---

## Troubleshooting

| Symptom                                            | Cause / fix                                                                                                                                                              |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| "Configuration problems" page                      | A config value is invalid; the page lists each one (file + field)                                                                                                        |
| Every request fails with "Cannot reach the server" | Backend not running, or the proxy target in `vite.config.ts` / `VITE_API_BASE_URL` is wrong                                                                              |
| Signed out after every reload                      | Refresh cookie not stored: use the same origin (proxy), or with separate domains set `CORS_ORIGIN`, `REFRESH_COOKIE_SAMESITE=none`, `REFRESH_COOKIE_SECURE=true` (HTTPS) |
| `AUTH_INVALID_ORIGIN` on refresh                   | The backend's `CORS_ORIGIN` / `FRONTEND_URL` doesn't include the frontend's origin                                                                                       |
| A page or menu item doesn't appear                 | Its `featureFlag` is off, the user lacks the `permission`, or the route isn't added to `appRoutes`                                                                       |
| "A new version is available"                       | A deploy removed old chunks and the automatic reload didn't help; reload, and check that `index.html` isn't cached                                                       |
| Theme flashes on load                              | `index.html` was edited and the no-flash script removed, or a CSP blocks it (allow its hash)                                                                             |
| `check:contrast` fails                             | A preset color is too light / dark; adjust the token in `themes.css`                                                                                                     |
| `check:error-codes` fails                          | The backend `ErrorCode` enum changed; update `lib/constants/error-codes.ts`                                                                                              |
| `check:architecture` fails                         | The message names the file, line and rule (hard-coded color, `fetch` outside `lib/api`, `<select>`, wrong radius …)                                                      |
| `/dev/ui` is 404 in production                     | Intentional: dev routes exist only in `npm run dev`                                                                                                                      |

---

## Documentation

| Document                                                                  | Contents                                                   |
| ------------------------------------------------------------------------- | ---------------------------------------------------------- |
| [docs/new-project-guide.md](../docs/new-project-guide.md)                 | Starting a product from AuthCore (backend + frontend)      |
| [docs/frontend/overview.md](../docs/frontend/overview.md)                 | Goals and levels                                           |
| [docs/frontend/level-1-modules.md](../docs/frontend/level-1-modules.md)   | Level 1 modules (this kit), rules, acceptance checklist    |
| [docs/frontend/folder-structure.md](../docs/frontend/folder-structure.md) | Every folder and file                                      |
| [docs/frontend/theme-system.md](../docs/frontend/theme-system.md)         | Tokens, presets, appearance                                |
| [docs/frontend/techstack.md](../docs/frontend/techstack.md)               | Every dependency and why                                   |
| [CHANGELOG.md](./CHANGELOG.md)                                            | Breaking changes for projects copied from earlier versions |
