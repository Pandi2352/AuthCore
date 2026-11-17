# AuthCore Frontend — Level 1 Modules (Starter Kit)

**Level 1: Modules 1–16 — Reusable React starter kit**

Everything every project needs, with no business logic. When Level 1 is done, a new ERP / CRM / HRMS / admin / SaaS project starts by copying the repository and editing `src/config/`.

- Level 2 (Modules 17–26, AuthCore client): [level-2-modules.md](./level-2-modules.md)
- Level 3 (Modules 27–34, production & enterprise): [level-3-modules.md](./level-3-modules.md)
- Tooling checklist: [project-setup-checklist.md](./project-setup-checklist.md) · Structure: [folder-structure.md](./folder-structure.md) · Theme: [theme-system.md](./theme-system.md)

`[x]` = done in `authcore-frontend` (2026-11-17).

> **Testing is manual** (decision of 2026-11-17, same as the backend): no Vitest, Testing Library or MSW. Every module is checked by hand with the checklists in these documents and the `/dev/ui` kitchen-sink page; `npm run verify` (format, lint, types, architecture rules, build) is the automated gate. Modules are numbered in build order (Module N = Sprint N); see the [sprint plan](#sprint-plan-build-order).

---

## 1. Project Setup & Code Quality

Details: [project-setup-checklist.md](./project-setup-checklist.md), sections 1–5 and 10.

- [x] Vite + React 19 + TypeScript
- [x] Tailwind CSS v4 (`@tailwindcss/vite`)
- [x] Path alias `@/`
- [x] `.env.example`, `.gitignore`, dev proxy to the backend
- [x] TypeScript strict mode and extra checks *(`strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `noImplicitReturns`, `verbatimModuleSyntax`, … in both tsconfigs; the existing code passes)*
- [x] oxlint full rule set *(plugins react (incl. hooks), typescript, import, jsx-a11y, unicorn, promise, oxc; correctness = error, suspicious / perf = warn, `--deny-warnings` in `lint`; existing findings fixed)*
- [x] Prettier (+ Tailwind class sorting), `.editorconfig`, `.gitattributes`, `.nvmrc` *(Prettier 3, `prettier-plugin-tailwindcss` (also inside `cn` / `clsx` / `cva`), 100-column lines, LF; Node 20.19.4 + `engines`)*
- [x] Import ordering *(`@ianvs/prettier-plugin-sort-imports`: Node built-ins → packages → `@/` → relative)*
- [x] Architecture checks *(`scripts/check-architecture.mjs`: env access, network calls, layer boundaries, feature isolation, hard-coded colors (since module 3), project name / inline routes (module 2), corner radius / shadows (module 3))*
- [x] Scripts *(`typecheck`, `lint`, `lint:fix`, `format`, `format:check`, `check:architecture`, `verify`)*
- [x] Remove template leftovers; `index.html` title / meta from config *(`App.css`, sample images, `icons.svg` removed; `%APP_*%` placeholders filled from `src/config/app.config.ts` by a Vite plugin)*
- [x] CI workflow *(`.github/workflows/frontend-ci.yml`: `npm ci` → `npm run verify` → production audit → `dist` artifact)*
- [x] Testing: manual (no test framework)

## 2. Configuration System

Everything a new project edits is in `src/config/` (import from `@/config`); the types are in `src/types/config.types.ts`, `navigation.types.ts`, `theme.types.ts`.

- [x] Central project config split *(`src/config/project.ts` removed; every consumer now reads `appConfig` / `featuresConfig` / `env`)*
- [x] `app.config.ts`: name, short name, slug, description, logos (light / dark / mark), favicon, theme colors, default language / time zone, company, support email, website, legal links *(version: `env.appVersion` from `package.json` via Vite `define`; the file stays plain data because `vite.config.ts` reads it for `index.html`)*
- [x] `features.config.ts`: `ui` (theme switcher, theme customizer, global search, command menu, notifications, breadcrumbs), `auth` (registration, flow, login identifiers, remember me, self recovery, invites), `account` pages, `admin` *(typed `FeatureFlag` = `"section.key"`; `isFeatureEnabled(flag)`)*
- [x] `navigation.config.ts`: groups and items *(id, title, path, icon, children (one level), badge (text or live count), external, disabled, hidden, featureFlag, permission, status `planned`, match; account pages + planned admin area; footer group. Rendered by the sidebar in [module 7](#7-sidebar-system))*
- [x] `layout.config.ts`: sidebar (enabled, position, width, collapsed width, collapsible, default collapsed, sticky / fixed, mobile breakpoint), navbar (enabled, height, sticky, show logo, breadcrumbs, built-in + custom actions), content (max width, padding), auth page variant *(visual variants are theme appearance)*
- [x] `theme.config.ts` + `theme.presets.ts` *(defaults, what users may change, offered presets; preset metadata + swatches. Tokens and the provider: [module 3](#3-theme--design-tokens))*
- [x] `icons.ts`: icon name → Lucide component registry *(`IconName` type derived from it; configs stay plain data)*
- [x] `paths.ts`: every URL, constants + builders (`paths.admin.userDetail(id)`, `withQuery`) *(in `config/` so the navigation config can use it; all inline route strings in pages / router replaced)*
- [x] `env.ts`: only reader of `import.meta.env`; validated, typed, frozen *(+ `appVersion`)*
- [x] Startup validation *(`validate-config.ts`: slug / colors / URLs / language / time zone, duplicate nav ids, unknown icons / feature flags, nesting, sizes, unregistered presets … → development: `ConfigErrorPage` lists the problems instead of the app; production: `console.error`. Route-exists check comes with the data router in module 5)*
- [x] `npm run project:init -- --name "…" --slug …` *(`scripts/project-init.mjs`: updates `app.config.ts` (name, short name, slug, description, color, company, support email, website, language, time zone) and the `package.json` / lock name; `--dry-run`; prints what is left. `index.html` meta follows automatically; the slug is the storage-key prefix; `.env.example` has no project values)*
- [x] No project-specific value hard-coded outside `config/` *(architecture check: the app name / slug from `app.config.ts` and inline routes (`to="/…"`, `href="/…"`, `navigate('/…')`) are errors outside `config/`)*

## 3. Theme & Design Tokens

Full design: [theme-system.md](./theme-system.md). **Project defaults: corners `rounded-md` everywhere, no shadows** (`theme.config.ts` → `radius: 'medium'`, `shadows: 'none'`; enforced by the architecture check).

- [x] Semantic color tokens *(background, foreground, surface, muted, accent, primary (+ hover, soft), secondary, border, input, ring, success / warning / danger / info (+ foreground, soft), overlay, sidebar-*, navbar-*, chart-1…5 in `styles/themes.css`)*
- [x] Non-color tokens *(radius scale from one `--radius-base`; control heights `h-control-sm/md/lg`; spacing `p-page`, `p-card`, `gap-form`, `gap-section`; font families; shadows `shadow-card` / `shadow-popover` (every `shadow-*` step follows the setting); border strength; layout sizes from `layout.config.ts`; motion durations; z-index scale)*
- [x] Tokens registered in Tailwind v4 `@theme inline` (`styles/tokens.css`); `dark` custom variant on `[data-mode="dark"]`
- [x] Color mode: light, dark, system *(`matchMedia` via `useSyncExternalStore`: follows OS changes live)*
- [x] Presets: default (blue), emerald, violet, orange, slate, rose, brand — light and dark each *(brand: `branding.primaryColor`, darkened / lightened at runtime just enough for 4.5:1, black or white text picked automatically)*
- [x] Appearance: radius, density, font, shadows, borders, sidebar / navbar / card / input / button styles *(all set as `data-*` on `<html>`; radius / density / font / shadows / borders have token values now; sidebar / navbar / card / input / button styles are read by those components in modules 4, 7, 8)*
- [x] `ThemeProvider`, `useTheme()` *(`src/app/theme/`; stored in `<slug>:theme:v1` through `lib/storage.ts`, only the axes users may change; invalid stored values fall back to defaults; cross-tab sync via the `storage` event)*
- [x] No theme flash on load *(inline script generated at build from `theme-core.ts`, the same functions the provider uses; sets `data-*`, `color-scheme`, `theme-color` meta)*
- [x] `ThemeToggle` (navbar: light → dark → system) and `ThemeCustomizer` (Appearance page, `/settings/appearance`) *(respect `userCustomizable` and the `ui.themeSwitcher` / `ui.themeCustomizer` flags; native radio groups)*
- [x] Reduced motion, focus ring, scrollbar, selection and placeholder styles in `styles/base.css`
- [x] Contrast check for every preset × mode *(`npm run check:contrast`, part of `verify`: 408 text / ring pairs, WCAG 4.5:1 text, 3:1 ring; incl. the dark sidebar and the brand color)*
- [x] Replace every palette class / hex color in the current code with tokens *(281 → 0; hard-coded colors are now errors; `Badge` variants are semantic: neutral / primary / success / warning / danger / info)*

## 4. UI Component Library (Design System)

Every component: typed props, `className` merge (`cn`), ref forwarding, variants + sizes (cva), disabled / loading / invalid states where they apply, keyboard + ARIA, tokens only, export via `components/ui/index.ts`, entry on the `/dev/ui` kitchen-sink page (manual check in every preset × mode).

Actions and inputs:

- [~] Button *(exists in `components/common`; to move, add variants solid / soft / outline / ghost / link / destructive, sizes, loading, icon-only, `asChild`)*
- [ ] IconButton (required `aria-label`)
- [~] Input *(exists; add sizes, prefix / suffix, invalid state, `InputGroup`, `PasswordInput` with show / hide)*
- [ ] Textarea (auto-resize option)
- [ ] Select (Radix), Combobox (searchable, optional)
- [ ] Checkbox, RadioGroup, Switch
- [ ] Label, Field (label + control + description + error + required mark)

Overlays:

- [ ] Dialog, AlertDialog (focus trap, Esc, return focus)
- [ ] Sheet / Drawer (left / right / bottom)
- [ ] DropdownMenu (submenus, checkbox / radio items, shortcuts)
- [ ] Popover, Tooltip (delay, collision-aware)
- [ ] Command menu (optional, `cmdk`)

Display:

- [~] Card *(exists; variants bordered / filled / elevated / minimal, header / content / footer parts)*
- [~] Badge *(exists; variants neutral / primary / success / warning / danger / info, dot, sizes)*
- [~] Alert *(exists; variants + icon + dismissible)*
- [ ] Avatar (image, initials fallback, status dot, sizes, group)
- [ ] Separator, Skeleton, Spinner, Progress (linear, indeterminate)
- [ ] Tabs (URL-synced option), Accordion
- [ ] Breadcrumb, Pagination (page + page size, total), Kbd
- [ ] Table primitives (header, row, cell, sortable header, empty / loading rows, sticky header, responsive scroll)
- [ ] ScrollArea
- [ ] Toaster (Sonner) + `toast.success/error/info/promise` helper, theme-aware

## 5. Routing (React Router)

- [~] React Router installed and used *(`<BrowserRouter>` + `<Routes>`; to migrate)*
- [ ] `createBrowserRouter` + `<RouterProvider>`
- [x] `config/paths.ts`: constants + builders; no path strings elsewhere *(done in module 2; enforced by the architecture check)*
- [ ] Route files per area (`*.routes.tsx`), all pages lazy (`lazy` route property)
- [ ] Nested routes and layout routes (`PublicLayout`, `AuthLayout`, `AppLayout`) with `<Outlet />`
- [ ] Route `handle`: `title`, `breadcrumb`, `permission`, `featureFlag`
- [ ] `errorElement` at root and per layout (render errors, chunk-load errors)
- [ ] 404 catch-all, 403 page, redirects (`/` → home, old paths → new)
- [ ] Dynamic params (`:id`) with typed helpers; query-param helpers (`useQueryParams`)
- [ ] Navigation state (`returnTo`, `from`) handled safely (same-origin relative paths only)
- [ ] Document title from `handle.title` + app name
- [ ] Focus management on navigation (main heading), scroll restoration
- [ ] Planned routes generated from navigation config ("not built yet" pages)
- [ ] Deep-link refresh works in dev, preview and production hosting

Routing hierarchy:

```text
RouterProvider
├── PublicLayout           (optional per project)  /, /about, /privacy
├── AuthLayout             RequireGuest            /login, /register, /forgot-password, /reset-password,
│                                                  /verify-email, /recovery, /accept-invite
├── AppLayout              RequireAuth             Sidebar + Navbar + <Outlet>
│   ├── /dashboard
│   ├── /account/*         profile, security, sessions, devices, activity
│   ├── /admin/*           RequirePermission per page
│   ├── /settings/*
│   └── /:module/*         planned pages until built
├── /403, /404
└── *                      → 404
```

## 6. Layouts

- [~] App layout *(`Layout` = navbar + outlet; no sidebar)*
- [ ] `AppLayout`: sidebar + navbar + `MainContent` (`<Outlet />`)
- [ ] `AuthLayout`: centered card and split-screen variants (image / brand panel), configurable
- [ ] `PublicLayout`: header + footer for public pages (optional per project)
- [ ] Full-height layout (`100dvh`), independent sidebar and content scrolling, no horizontal page scroll
- [ ] Sticky / fixed navbar and sidebar options
- [ ] Configurable content width (full / container / narrow) and page padding
- [ ] Configurable navbar height, sidebar width, collapsed width, spacing (tokens)
- [ ] Skip link, landmarks (`header`, `nav`, `main`, `aside`)
- [ ] Route progress bar during lazy loading / navigation
- [ ] Breadcrumbs from route handles (toggle in layout config)

## 7. Sidebar System

- [ ] Containers: `Sidebar`, `SidebarHeader`, `SidebarContent`, `SidebarGroup`, `SidebarItem`, `SidebarSubmenu`, `SidebarFooter`, `SidebarMobile`
- [ ] Logo and app name from `app.config.ts`; logo mark when collapsed
- [ ] Groups and items from `navigation.config.ts` only (no hard-coded items)
- [ ] Nested items (2 levels), expand / collapse, auto-expand the active branch
- [ ] Active route highlighting (exact or prefix match per item)
- [ ] Expanded / collapsed (icon-only) mode; tooltips when collapsed; flyout submenus when collapsed
- [ ] Width, collapsed width, position (left / right), fixed / sticky from `layout.config.ts`
- [ ] Variants: classic, minimal, floating, compact, dark (theme tokens)
- [ ] Mobile drawer with overlay below `lg`; closes on navigation and Esc
- [ ] Keyboard: Tab order, Enter / Space toggles submenus, arrow keys within groups, `Ctrl/Cmd + B` toggles collapse
- [ ] Item options: badge / count (static or from a hook), disabled, external link (new tab, icon), hidden, `featureFlag`, `permission` (Level 2), `status: 'planned'`
- [ ] Collapsed state persisted per user (`localStorage`)
- [ ] Works with every theme preset, mode and appearance
- [ ] Manual check: renders config, active state, collapse / expand, submenu keyboard, mobile drawer, hidden by flag / permission

Navigation config shape:

```ts
// types/navigation.types.ts
export interface NavItem {
  id: string;                        // unique, stable (used for keys and persisted expand state)
  title: string;
  path?: string;                     // from config/paths.ts
  icon?: IconName;                   // key of config/icons.ts
  children?: NavItem[];
  badge?: { text: string; tone?: BadgeTone } | { useCount: () => number | undefined };
  external?: boolean;
  disabled?: boolean;
  hidden?: boolean;
  featureFlag?: FeatureFlag;         // hidden when the flag is off
  permission?: string | string[];    // Level 2: hidden without the permission
  status?: 'ready' | 'planned';      // planned → "not built yet" page
  match?: 'exact' | 'prefix';
}
export interface NavGroup { id: string; title?: string; items: NavItem[] }
```

```ts
// config/navigation.config.ts
export const navigationConfig: NavGroup[] = [
  {
    id: 'main',
    title: 'Main',
    items: [
      { id: 'dashboard', title: 'Dashboard', path: paths.dashboard, icon: 'LayoutDashboard' },
      {
        id: 'students',
        title: 'Students',
        icon: 'Users',
        status: 'planned',
        children: [
          { id: 'students-all', title: 'All students', path: '/students' },
          { id: 'students-new', title: 'Add student', path: '/students/new' },
        ],
      },
    ],
  },
];
```

## 8. Navbar System

- [~] Navbar *(exists with links and user info; to split and make configurable)*
- [ ] `Navbar`, `NavbarLeft`, `NavbarCenter`, `NavbarRight`, actions from `layout.config.ts`
- [ ] Sidebar toggle (collapse on desktop, drawer on mobile)
- [ ] Logo / title when the sidebar is hidden or collapsed (configurable)
- [ ] Breadcrumbs (optional)
- [ ] Global search / command menu slot (optional, `Ctrl/Cmd + K`)
- [ ] Theme toggle
- [ ] Notification slot (badge + popover; content from Level 2 / project)
- [ ] User menu slot (avatar dropdown; Level 2)
- [ ] Custom action buttons from config (icon, label, path / handler)
- [ ] Variants: standard, transparent, bordered, floating, blurred; configurable height; sticky option
- [ ] Responsive: actions collapse into an overflow menu on small screens
- [ ] Works with every layout preset and theme

## 9. Responsive & Accessibility

- [ ] Breakpoints in one place (`lib/constants/breakpoints.ts`, matching Tailwind): sm 640, md 768, lg 1024, xl 1280, 2xl 1536
- [ ] `useBreakpoint()` / `useMediaQuery()`
- [ ] Sidebar → drawer below `lg`; navbar overflow menu below `md`
- [ ] Tables scroll horizontally inside their container; dialogs become sheets on mobile (optional)
- [ ] Forms single-column on mobile; touch targets ≥ 44 px
- [ ] No content overflow at 320 px width
- [ ] Semantic HTML, labels for every control, `aria-*` only where HTML is not enough
- [ ] Visible focus (ring token) everywhere; skip link; focus moved on route change
- [ ] Dialogs / menus: focus trap, Esc, return focus (Radix)
- [ ] Status never by color alone (icon / text)
- [ ] `prefers-reduced-motion` respected
- [ ] Contrast ≥ 4.5:1 (text), ≥ 3:1 (UI, focus) in every theme

## 10. Page & Feedback Components

- [ ] `PageContainer`, `PageHeader` (title, description, actions, breadcrumbs slot), `PageSection`, `ResponsiveGrid`
- [ ] `LoadingState` (skeleton / spinner), `EmptyState` (icon, title, text, action), `ErrorState` (from `ApiError`, request id, retry), `NoPermissionState`
- [ ] `ConfirmDialog` (destructive variant, async confirm with loading)
- [ ] `SearchInput` (debounced, clearable), `FilterBar` (URL-synced filters + reset)
- [ ] `Logo`, `ThemeToggle`, `ThemeCustomizer`, `CopyButton`, `DateTime`, `StatusBadge`, `FileDropzone`
- [ ] `ErrorBoundary` (app and widget level), `OfflineBanner`
- [ ] Global pages: `NotFoundPage`, `ForbiddenPage`, `RouteErrorPage`, `PlannedModulePage`, `PlannedFeaturePage`
- [ ] `/dev/ui` kitchen-sink page (development only)

## 11. Hooks

- [ ] `useTheme` (module 3), `useSidebar` (module 7)
- [ ] `useMediaQuery`, `useBreakpoint`
- [ ] `useLocalStorage` (namespaced, JSON-safe, cross-tab sync)
- [ ] `useDisclosure` (open / close / toggle)
- [ ] `useDebounce`, `useDebouncedCallback`
- [ ] `useOnlineStatus`
- [ ] `useClickOutside`
- [ ] `useMounted`, `usePrevious`
- [ ] `useDocumentTitle`
- [ ] `useCopyToClipboard`
- [ ] `useQueryParams` (typed search-param state)
- [ ] `usePagination`

## 12. Utilities (`lib/`)

- [~] `cn()` *(exists in `lib/utils.ts`)*
- [ ] Formatting with `Intl`: date / time / relative time (user locale + time zone), number, currency, percent, file size
- [ ] String helpers (truncate, initials, slugify)
- [ ] URL helpers: query-string build / parse, `safeReturnTo()` (same-origin relative only)
- [ ] `local-storage.ts`: namespaced by app slug, versioned keys, safe JSON
- [ ] Constants: breakpoints, storage keys, HTTP status / error codes
- [ ] `invariant()`, exhaustive-switch helper

## 13. API Layer

- [~] Fetch client *(`lib/api-client.ts`: base URL, JSON, `credentials: 'include'`, Bearer token, refresh queue — to move and extend)*
- [ ] `lib/api/client.ts`: the only `fetch`; `get / post / put / patch / delete`; base URL from `env`; JSON + `FormData` bodies; query params
- [ ] Response envelope unwrapped (`data`), `meta` kept for paginated lists (`Paginated<T>`)
- [ ] `ApiError`: `status`, `code`, `message`, `fieldErrors` (`errors[]` → `{ field: message }`), `requestId` (`X-Request-Id`), `retryAfter`
- [ ] Request timeout (`AbortController`, `VITE_API_TIMEOUT_MS`), caller abort signals
- [ ] Network / offline errors mapped to a distinct code
- [ ] Hooks: `onUnauthorized` (Level 2 refresh), `onForbidden`, `onServerError` — registered by providers, not imported by the client
- [ ] `upload.ts` (XHR with progress, cancel), `download.ts` (blob + filename from `Content-Disposition`)
- [ ] `getErrorMessage(error)` for any thrown value
- [ ] Manual check against the running backend: envelope, errors, timeout, abort, retry after refresh (Level 2), upload progress

## 14. Error Handling

- [ ] Global `ErrorBoundary` with reset; route `errorElement`s
- [ ] Chunk-load error after deploy → reload once, then error page
- [ ] API errors → toast for actions, `ErrorState` for page loads, field errors for forms
- [ ] 401 → session handling (Level 2); 403 → `NoPermissionState` / `ForbiddenPage`; 404 → not-found state; 429 → "try again in N s"; 5xx → generic message + request id
- [ ] Offline banner; requests fail fast while offline
- [ ] Error-report hook (no-op now, Sentry in Level 3)

## 15. Manual Verification

No automated test framework (decision of 2026-11-17). Each module is verified by hand before it is ticked:

- [ ] `/dev/ui` kitchen-sink page: every component in every preset × mode × appearance
- [ ] ThemeProvider: system mode follows the OS, choice persists, corrupted storage falls back to defaults, no flash on reload
- [ ] Sidebar: config rendering, active state, collapse / expand, submenu keyboard, mobile drawer, items hidden by flag / permission
- [ ] Routing: nested layouts, lazy pages, 404, route error element, redirects, deep-link refresh
- [ ] Config overrides: a custom navigation / layout / theme config renders correctly
- [ ] API client: error envelope, field errors, timeout, offline, 429 countdown (against the running backend)
- [ ] Responsive (375 / 768 / 1280 / 1920) and keyboard-only walkthrough
- [ ] `npm run verify` green locally and in CI

## 16. Documentation

- [x] `docs/frontend/` planning documents
- [ ] README: quick start, scripts, environment, configuration guide, theme guide, structure, recipes (add page / module / component / preset), manual verification checklist, deployment, troubleshooting
- [ ] "Start a new project in 10 minutes" guide (copy → `project:init` → brand assets → navigation → theme → run)
- [ ] Component usage notes on the kitchen-sink page
- [ ] Changelog of breaking starter-kit changes (projects copied earlier can follow)

---

## Architecture rules

1. **No hard-coded branding** — name, logos, favicon from `app.config.ts`.
2. **No hard-coded navigation** — sidebar items only from `navigation.config.ts`.
3. **No hard-coded colors** — tokens and CSS variables only.
4. **No business logic in shared components** (`components/`, `hooks/`, `lib/`).
5. **No API calls in UI components** — `features/X/api` + hooks.
6. **No giant components** — split layouts and pages into parts (≈ 200 lines is a smell).
7. **No unnecessary global state** — local first; context only for app-wide concerns.
8. **No unnecessary dependencies** — every package has a reason in [techstack.md](./techstack.md).
9. **One source of truth** — one App, one router, one paths file, one API client, one env reader.
10. **No breaking theme changes** — every component works in every preset, mode and appearance.
11. **No feature coupling** — features don't import each other (except the `auth` public API).
12. **No premature abstraction** — make it reusable when a second use appears.

---

## Acceptance checklist

Level 1 is done when all of these pass **without editing any component**:

| # | Area | Scenario |
| --- | --- | --- |
| 1 | Branding | Change app name, logo and favicon in config; sidebar, navbar, title and favicon update |
| 2 | Navigation | Add a module with nested items in `navigation.config.ts`; it appears with a planned page |
| 3 | Routing | Add a lazy feature page under a nested layout; deep-link refresh works |
| 4 | Theme mode | Light, dark and system (OS change applies live) |
| 5 | Presets | Default, emerald, violet, orange and a custom brand color |
| 6 | Appearance | Radius, density, sidebar, navbar, cards, inputs, buttons, borders all switch |
| 7 | Layout | Sidebar classic / minimal / floating / compact / dark; collapsed and expanded |
| 8 | Responsive | Drawer + navbar on mobile (375), tablet (768), desktop (1280), wide (1920) |
| 9 | Persistence | Theme and sidebar preferences survive reload; no theme flash |
| 10 | Components | Kitchen-sink page correct in every preset × mode |
| 11 | API | Backend URL changed through `.env` only |
| 12 | Errors | Loading, empty, error, 403, 404 and route-error states render |
| 13 | Performance | Pages lazy-loaded; production build under budget |
| 14 | Verification | Manual checklist (module 15) passed; `npm run verify` green in CI |
| 15 | Documentation | A teammate starts a new project from the README alone |
| 16 | Accessibility | Keyboard-only walkthrough; Lighthouse accessibility ≥ 95 |

---

## Sprint plan (build order)

| Sprint | Module | Priority | Output |
| --- | --- | --- | --- |
| 1 | 1. Project setup & code quality | Critical | `npm run verify` green, CI running |
| 2 | 2. Configuration system ✅ | Critical | All config files typed and used; `project:init` |
| 3 | 3. Theme & design tokens ✅ | Critical | Modes, presets, appearance, no flash |
| 4 | 4. UI components (core: button, input, field, card, badge, alert, dialog, dropdown, tooltip, toaster) | Critical | Kitchen-sink page |
| 5 | 5. Routing | Critical | Data router, paths, lazy pages, error pages |
| 6 | 6. Layouts | Critical | App / auth / public layouts |
| 7 | 7. Sidebar | Critical | Config-driven, collapsible, mobile drawer |
| 8 | 8. Navbar | Critical | Configurable actions, responsive |
| 9 | 9. Responsive & accessibility | Critical | Breakpoint and keyboard pass |
| 10 | 10. Page & feedback components | High | Page scaffolding, states, global pages |
| 11 | 11–12. Hooks & utilities | High | Reusable helpers |
| 12 | 13. API layer | High | Client, errors, upload / download |
| 13 | 14. Error handling | High | Boundaries, chunk errors, offline |
| 14 | 4. UI components (rest: table, tabs, pagination, avatar, sheet, select, …) | High | Complete design system |
| 15 | 15. Manual verification | High | Checklist passed in every preset, mode and breakpoint |
| 16 | 16. Documentation | High | README + new-project guide; acceptance checklist passed |

Level 2 (AuthCore client) starts after Sprint 16. Authentication and permissions are deliberately later: the shell must work without them.
