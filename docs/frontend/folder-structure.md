# AuthCore Frontend — Folder Structure

Target structure of `authcore-frontend`, the rules that keep it reusable, naming conventions, and where every current file moves.

The structure separates four things that change for different reasons:

| Layer | Folder | Changes when… |
| --- | --- | --- |
| Configuration | `src/config/` | A new project starts (name, logo, navigation, layout, theme, feature flags) |
| Design system | `src/components/ui/`, `src/styles/`, `src/app/theme/` | The visual language changes (rarely, once for all projects) |
| Shell | `src/app/` (router, layouts, providers) | The app's wiring changes (new area, new provider) |
| Business | `src/features/` | Product work: one folder per module |

---

## Project root

```text
authcore-frontend/
├── .github/ (repo root)          CI: frontend-ci.yml lives in D:\AuthCore\.github\workflows
├── public/
│   ├── brand/                    logo.svg, logo-dark.svg, logo-mark.svg, apple-touch-icon.png, og-image.png
│   ├── favicon.svg
│   └── robots.txt
├── scripts/
│   ├── check-architecture.mjs    Env / network / boundary / color rules (part of npm run verify) — exists
│   └── project-init.mjs          npm run project:init -- --name "Shop X" --slug shop-x (module 2)
├── src/                          (below)
├── .editorconfig
├── .env.example                  Every VITE_ variable, documented, no secrets
├── .gitattributes
├── .gitignore
├── .nvmrc
├── .oxlintrc.json
├── .prettierrc.json / .prettierignore
├── index.html                    Root div, no-flash theme script, title / meta from app config at build
├── package.json / package-lock.json
├── README.md
├── tsconfig.json / tsconfig.app.json / tsconfig.node.json
└── vite.config.ts                Alias, proxy, Tailwind, %APP_*% html placeholders from app.config.ts
```

## `src/`

```text
src/
├── main.tsx                         Mounts <App />. Nothing else.
│
├── app/                             Wiring: the only layer that knows every feature
│   ├── App.tsx                      <Providers> + <RouterProvider router={router} />
│   ├── Providers.tsx                ErrorBoundary → Theme → Query → Auth → Tooltip → Toaster
│   ├── router.tsx                   createBrowserRouter(routes)
│   ├── paths.ts                     Every URL: constants + builders (paths.users.detail(id))
│   │
│   ├── routes/                      One file per area; every page lazy
│   │   ├── index.tsx                The tree: layouts, guards, error elements, redirects, 404
│   │   ├── public.routes.tsx        PublicLayout pages (landing, about) — optional per project
│   │   ├── auth.routes.tsx          AuthLayout pages (login, register, verify, reset, invite)
│   │   ├── dashboard.routes.tsx
│   │   ├── account.routes.tsx       My profile, security, sessions, devices, activity
│   │   ├── admin.routes.tsx         Users, invites, access control, policies, schema, activity
│   │   ├── settings.routes.tsx
│   │   ├── planned.routes.tsx       Generated from navigation config: "not built yet" pages
│   │   └── dev.routes.tsx           /dev/ui kitchen sink (development builds only)
│   │
│   ├── layouts/
│   │   ├── AppLayout.tsx            Sidebar + Navbar + MainContent(<Outlet />)
│   │   ├── AuthLayout.tsx           Centered card / split screen for sign-in flows
│   │   ├── PublicLayout.tsx         Marketing header + footer
│   │   ├── components/
│   │   │   ├── MainContent.tsx      Scroll container, content width, skip-link target
│   │   │   ├── Breadcrumbs.tsx      From route handle.breadcrumb
│   │   │   ├── PageTitle.tsx        document.title from route handle.title + app name
│   │   │   ├── RouteProgress.tsx    Top progress bar during navigation / lazy load
│   │   │   └── SkipLink.tsx
│   │   ├── sidebar/
│   │   │   ├── Sidebar.tsx          Container: header, content, footer; variant from layout config
│   │   │   ├── SidebarHeader.tsx    Logo / logo mark (collapsed), app name
│   │   │   ├── SidebarContent.tsx   Groups from navigation config, filtered by permissions / flags
│   │   │   ├── SidebarGroup.tsx     Group label + items
│   │   │   ├── SidebarItem.tsx      Link row: icon, label, badge, active state, tooltip when collapsed
│   │   │   ├── SidebarSubmenu.tsx   Nested items, expand / collapse, keyboard support
│   │   │   ├── SidebarFooter.tsx    Settings / user section / collapse toggle
│   │   │   ├── SidebarMobile.tsx    Drawer + overlay below the lg breakpoint
│   │   │   ├── useSidebar.ts        Collapsed / mobile-open state (persisted)
│   │   │   ├── sidebar.variants.ts  classic | minimal | floating | compact
│   │   │   └── index.ts
│   │   ├── navbar/
│   │   │   ├── Navbar.tsx           Container; variant from layout config
│   │   │   ├── NavbarLeft.tsx       Menu toggle, logo (when sidebar hidden), breadcrumbs
│   │   │   ├── NavbarCenter.tsx     Global search slot (optional)
│   │   │   ├── NavbarRight.tsx      Actions from config: theme, notifications, user menu, custom
│   │   │   ├── UserMenu.tsx         Avatar dropdown (profile, security, sign out) — Level 2
│   │   │   ├── navbar.variants.ts   standard | transparent | bordered | floating
│   │   │   └── index.ts
│   │   └── guards/                  Route guards used by routes/index.tsx (Level 2)
│   │       ├── RequireAuth.tsx      Not signed in → /login?returnTo=…
│   │       ├── RequireGuest.tsx     Signed in → home
│   │       └── RequirePermission.tsx Missing permission → 403 page
│   │
│   └── theme/                       Theme runtime (configuration lives in config/)
│       ├── ThemeProvider.tsx        Mode + preset + appearance; applies data-* attributes on <html>
│       ├── theme-context.ts
│       ├── useTheme.ts
│       ├── apply-theme.ts           Pure: theme state → data attributes / CSS variables
│       ├── theme-storage.ts         Read / write / validate the persisted choice
│       └── no-flash-script.ts       Inline script source injected into index.html
│
├── components/                      Shared, business-free UI
│   ├── ui/                          Design system (one folder per component)
│   │   ├── button/                  Button.tsx, button.variants.ts, index.ts
│   │   ├── icon-button/
│   │   ├── input/                   Input, InputGroup (prefix / suffix), PasswordInput
│   │   ├── textarea/
│   │   ├── select/                  Radix Select
│   │   ├── combobox/                Searchable select (optional)
│   │   ├── checkbox/
│   │   ├── radio-group/
│   │   ├── switch/
│   │   ├── label/
│   │   ├── field/                   Field = Label + control + description + error message
│   │   ├── dialog/                  Dialog, AlertDialog
│   │   ├── sheet/                   Side panel (also used by the mobile sidebar)
│   │   ├── dropdown-menu/
│   │   ├── popover/
│   │   ├── tooltip/
│   │   ├── avatar/
│   │   ├── badge/
│   │   ├── card/
│   │   ├── alert/
│   │   ├── separator/
│   │   ├── skeleton/
│   │   ├── spinner/
│   │   ├── progress/
│   │   ├── tabs/
│   │   ├── accordion/
│   │   ├── breadcrumb/
│   │   ├── pagination/
│   │   ├── table/                   Table primitives (DataTable with TanStack Table in Level 2)
│   │   ├── scroll-area/
│   │   ├── kbd/
│   │   ├── command/                 Command palette (optional, cmdk)
│   │   ├── toaster/                 Sonner wrapper + toast() helper
│   │   └── index.ts                 Barrel: export * from each component
│   │
│   ├── common/                      App-level building blocks (still business-free)
│   │   ├── Logo.tsx                 From app config; light / dark / mark variants
│   │   ├── ThemeToggle.tsx          Light / dark / system
│   │   ├── ThemeCustomizer.tsx      Preset + appearance pickers (settings page, dev panel)
│   │   ├── SearchInput.tsx          Debounced, clearable
│   │   ├── ConfirmDialog.tsx        "Are you sure?" with destructive variant
│   │   ├── CopyButton.tsx
│   │   ├── DateTime.tsx             Formats with the user's locale / time zone
│   │   ├── FileDropzone.tsx         Drag-and-drop upload with type / size checks
│   │   ├── StatusBadge.tsx          Status → badge variant mapping
│   │   └── index.ts
│   │
│   ├── page/                        Page scaffolding
│   │   ├── PageContainer.tsx        Width + padding from layout config
│   │   ├── PageHeader.tsx           Title, description, actions, breadcrumbs slot
│   │   ├── PageSection.tsx          Titled section / card
│   │   ├── FilterBar.tsx            Search + filters + reset, synced to URL search params
│   │   ├── ResponsiveGrid.tsx
│   │   └── index.ts
│   │
│   ├── feedback/                    States every page needs
│   │   ├── LoadingState.tsx         Skeleton / spinner variants
│   │   ├── EmptyState.tsx           Icon, title, description, action
│   │   ├── ErrorState.tsx           From ApiError: message, request id, retry
│   │   ├── NoPermissionState.tsx    403 inside a page
│   │   ├── OfflineBanner.tsx
│   │   ├── ErrorBoundary.tsx
│   │   └── index.ts
│   │
│   └── form/                        Form glue (Level 2, with React Hook Form)
│       ├── Form.tsx                 FormProvider wrapper, submit handling, server-error mapping
│       ├── FormField.tsx            Field bound to RHF (label, control, error)
│       ├── FormActions.tsx          Submit / cancel row with loading state
│       └── index.ts
│
├── features/                        One folder per business module
│   ├── auth/                        Level 2 — the only feature others may import (via index.ts)
│   │   ├── api/                     auth.api.ts (login, register, verify, refresh, logout, reset, invites)
│   │   ├── session/                 AuthProvider.tsx, auth-context.ts, useAuth.ts, token-store.ts
│   │   ├── permissions/             usePermissions.ts, PermissionGate.tsx, can.ts
│   │   ├── components/              PasswordRequirements.tsx, PasswordStrength.tsx, OtpInput.tsx
│   │   ├── pages/                   LoginPage, RegisterPage, VerifyEmailPage, ForgotPasswordPage,
│   │   │                            ResetPasswordPage, AccountRecoveryPage, AcceptInvitePage
│   │   ├── schemas/                 Zod schemas for the forms
│   │   ├── types/                   auth.types.ts (LoginResponse, AuthUser, …)
│   │   └── index.ts                 Public API: useAuth, usePermissions, PermissionGate, types
│   ├── account/                     Profile, personal details, avatar, preferences, security,
│   │                                sessions, devices, activity, data export, close account
│   ├── dashboard/
│   │   ├── components/
│   │   ├── pages/DashboardPage.tsx
│   │   └── index.ts
│   ├── admin-users/                 Users list / detail / create, invites
│   ├── admin-access/                Permissions, roles, groups, mappings, audit log
│   ├── admin-security/              Password policy, user schema, files, activity / login history
│   └── settings/
│       ├── pages/GeneralSettingsPage.tsx, AppearanceSettingsPage.tsx
│       └── index.ts
│
├── pages/                           App-wide pages that belong to no feature
│   ├── NotFoundPage.tsx             404
│   ├── ForbiddenPage.tsx            403
│   ├── RouteErrorPage.tsx           errorElement: render / chunk-load errors
│   ├── PlannedModulePage.tsx        "Not built yet" module overview (from navigation config)
│   ├── PlannedFeaturePage.tsx       "Not built yet" page
│   └── dev/UiKitchenSinkPage.tsx    Every component × preset × mode (development only)
│
├── config/                          Everything a new project edits
│   ├── app.config.ts                Name, short name, description, logos, favicon, company, support, links
│   ├── features.config.ts           Feature toggles (theme switcher, search, notifications, auth flows)
│   ├── navigation.config.ts         Sidebar groups, items, children, icons, badges, permissions
│   ├── layout.config.ts             Sidebar / navbar / content options (variant, width, height, sticky)
│   ├── theme.config.ts              Default mode, preset, appearance; what users may change
│   ├── theme.presets.ts             Color presets (light + dark tokens each)
│   ├── icons.ts                     Icon name → Lucide component registry (config stays serializable)
│   ├── env.ts                       The only reader of import.meta.env (validated, typed, frozen)
│   └── index.ts
│
├── hooks/                           Generic React hooks (no business logic)
│   ├── useMediaQuery.ts / useBreakpoint.ts
│   ├── useLocalStorage.ts
│   ├── useDisclosure.ts
│   ├── useDebounce.ts / useDebouncedCallback.ts
│   ├── useOnlineStatus.ts
│   ├── useClickOutside.ts
│   ├── useMounted.ts / usePrevious.ts
│   ├── useDocumentTitle.ts
│   ├── useCopyToClipboard.ts
│   ├── useQueryParams.ts            Typed search-param state (filters, page, tab)
│   ├── usePagination.ts
│   └── index.ts
│
├── lib/                             Plain TypeScript, no React
│   ├── api/
│   │   ├── client.ts                The only fetch: base URL, headers, timeout, envelope unwrap,
│   │   │                            auth header, 401 → refresh once → retry, request id
│   │   ├── api-error.ts             ApiError(status, code, message, fieldErrors, requestId, retryAfter)
│   │   ├── get-error-message.ts     Any error → user-facing text
│   │   ├── upload.ts                XHR upload with progress (multipart)
│   │   ├── download.ts              Blob download with filename from Content-Disposition
│   │   └── types.ts                 ApiEnvelope<T>, Paginated<T>, PaginationMeta
│   ├── query/                       Level 2
│   │   ├── query-client.ts          TanStack Query defaults (retry rules by ApiError code)
│   │   └── query-keys.ts            Key factory per feature
│   ├── format/                      date.ts, number.ts, currency.ts, file-size.ts, string.ts
│   ├── utils/                       cn.ts, invariant.ts, sleep.ts, object.ts, url.ts (safe returnTo)
│   ├── storage/                     local-storage.ts (namespaced by app slug, JSON-safe, versioned)
│   ├── validation/                  Shared Zod helpers (email, password-policy rules), Level 2
│   └── constants/                   breakpoints.ts, storage-keys.ts, http.ts
│
├── types/                           Shared types
│   ├── navigation.types.ts
│   ├── theme.types.ts
│   ├── config.types.ts
│   ├── common.types.ts              Id, Nullable, Option, SortOrder, …
│   └── env.d.ts                     ImportMetaEnv for every VITE_ variable
│
├── styles/
│   ├── index.css                    @import order only (tailwind, tokens, themes, base, utilities)
│   ├── tokens.css                   @theme: color / radius / spacing / shadow / font / z-index tokens
│   ├── themes.css                   [data-preset][data-mode] → color values
│   ├── appearance.css               [data-radius] [data-density] … → token values
│   ├── base.css                     Element defaults, focus ring, scrollbar, reduced motion
│   └── utilities.css                @utility helpers (e.g. scrollbar-thin, text-balance)
│
└── assets/                          Imported by code (bundled, hashed): illustrations, empty-state art
```

---

## Responsibilities and import rules

| Folder | May import from | Must not |
| --- | --- | --- |
| `app/` | everything | — |
| `features/X/` | `components/`, `hooks/`, `lib/`, `config/`, `types/`, `@/features/auth` (public index only) | Other features' internals, `app/` |
| `pages/` | `components/`, `hooks/`, `lib/`, `config/`, `types/` | `features/`, `app/` |
| `components/ui/` | `lib/utils`, `hooks/`, `types/` | `components/common` / `page` / `feedback` / `form`, `features/`, `app/`, `config/` (except theme types) |
| `components/common`, `page`, `feedback`, `form` | `components/ui/`, `hooks/`, `lib/`, `config/`, `types/` | `features/`, `app/` |
| `hooks/` | `lib/`, `types/`, `config/` | React components, `features/`, `app/` |
| `lib/` | `lib/`, `types/`, `config/env.ts` | React, `components/`, `hooks/`, `features/`, `app/` |
| `config/` | `types/`, `lucide-react` (icons registry) | Everything else |

Other rules:

- **One public door per feature.** `features/X/index.ts` exports what the router needs (pages for lazy imports are imported by path) and what other features may use. Only `auth` is consumed by other features (`useAuth`, `usePermissions`, `PermissionGate`).
- **Moving shared code down.** When a second feature needs something from another feature, it moves to `components/`, `hooks/` or `lib/`. It is never imported sideways.
- **API calls only in `features/X/api/`**, through `lib/api/client.ts`. Components call hooks (`useUsersQuery`), hooks call `api/` functions.
- **No business words in `components/`.** If it mentions "user", "role" or "invoice", it belongs to a feature.
- **No hard-coded project values in reusable code.** Name, logo, URLs and colors come from `config/`.
- **Barrels only at component / feature boundaries** (`components/ui/index.ts`, `features/X/index.ts`), never deeper chains that create cycles.

## Anatomy

### A UI component

```text
components/ui/button/
├── Button.tsx            forwardRef, typed props, variants via cva, asChild (Radix Slot)
├── button.variants.ts    variant: solid | soft | outline | ghost | link | destructive; size: sm | md | lg | icon
└── index.ts              export { Button, type ButtonProps } from './Button'
```

Every component: typed props, `className` passthrough merged with `cn()`, ref forwarding, variants and sizes, disabled / loading / invalid states where they apply, keyboard and ARIA, tokens only, an entry on the `/dev/ui` kitchen-sink page.

### A feature

```text
features/admin-users/
├── api/              users.api.ts — typed functions over apiClient
├── hooks/            useUsersQuery.ts, useUpdateUserMutation.ts (TanStack Query)
├── components/       UsersTable.tsx, UserStatusBadge.tsx, UserForm.tsx
├── pages/            UsersListPage.tsx, UserDetailPage.tsx, UserCreatePage.tsx
├── schemas/          user.schema.ts (Zod)
├── types/            user.types.ts
├── utils/            (only if needed)
└── index.ts          public API (rarely more than types)
```

Routes for a feature live in `app/routes/<area>.routes.tsx` (wiring stays in `app/`); pages are imported lazily by path.

## Naming conventions

| Kind | Convention | Example |
| --- | --- | --- |
| Component file / export | `PascalCase.tsx`, named export | `SidebarItem.tsx` → `export function SidebarItem` |
| Page component | `…Page.tsx` | `UsersListPage.tsx` |
| Layout | `…Layout.tsx` | `AppLayout.tsx` |
| Hook | `useCamelCase.ts` | `useDisclosure.ts` |
| Context | `kebab-case-context.ts` + `…Provider.tsx` | `theme-context.ts`, `ThemeProvider.tsx` |
| Plain module | `kebab-case.ts` (with a role suffix where useful) | `api-error.ts`, `users.api.ts`, `user.schema.ts`, `button.variants.ts` |
| Config | `<name>.config.ts` | `navigation.config.ts` |
| Routes | `<area>.routes.tsx` | `admin.routes.tsx` |
| Types file | `<name>.types.ts` | `navigation.types.ts` |
| Folders | `kebab-case` | `admin-users/`, `radio-group/` |
| CSS custom properties | `--color-*`, `--radius-*`, `--space-*`, `--shadow-*`, `--sidebar-*`, `--navbar-*` | `--color-primary-foreground` |
| Storage keys | `<slug>:<name>:v<version>` | `authcore:theme:v1` |

Exports: named exports everywhere (default exports only where a tool requires them, e.g. lazy route modules exporting `Component`).

---

## Migration of the current files

The current code is kept and moved; nothing is rewritten from scratch.

| Current file | Target | Notes |
| --- | --- | --- |
| `src/main.tsx` | `src/main.tsx` | Import `@/app/App`; keep `StrictMode` |
| `src/App.tsx` | `src/app/App.tsx` | Providers + `RouterProvider` |
| `src/App.css`, `assets/hero.png`, `react.svg`, `vite.svg`, `public/icons.svg` | delete | Unused template files |
| `src/index.css` | `src/styles/index.css` + `tokens.css` / `themes.css` / `base.css` | Body colors become tokens |
| `src/router/index.tsx` | `src/app/router.tsx` + `src/app/routes/*.routes.tsx` + `src/app/paths.ts` | Data router, lazy pages |
| `src/config/project.ts` | `config/app.config.ts` (identity, branding), `config/features.config.ts` (flags), `config/env.ts` (API URL) | Same values |
| `src/components/common/Layout.tsx` | `app/layouts/AppLayout.tsx` | + sidebar, main content |
| `src/components/common/Navbar.tsx` | `app/layouts/navbar/*` | Split into left / right / user menu |
| `src/components/common/Button.tsx`, `Input.tsx`, `Card.tsx`, `Badge.tsx`, `Alert.tsx` | `components/ui/<name>/` | Variants via cva, tokens |
| `src/components/auth/ProtectedRoute.tsx` | `app/layouts/guards/RequireAuth.tsx` | `returnTo` support |
| `src/components/auth/GuestRoute.tsx` | `app/layouts/guards/RequireGuest.tsx` | |
| `src/components/auth/PermissionGate.tsx` | `features/auth/permissions/PermissionGate.tsx` | Exported via `features/auth/index.ts` |
| `src/components/auth/PasswordRequirements.tsx` | `features/auth/components/PasswordRequirements.tsx` | Rules from `GET /password-policies/requirements` |
| `src/context/AuthContext.tsx` | `features/auth/session/AuthProvider.tsx` + `auth-context.ts` + `useAuth.ts` | |
| `src/hooks/usePermissions.ts` | `features/auth/permissions/usePermissions.ts` | |
| `src/lib/api-client.ts` | `lib/api/client.ts` + `api-error.ts` + `types.ts` | Add timeout, typed errors |
| `src/lib/utils.ts` | `lib/utils/cn.ts` (+ others) | |
| `src/services/auth.service.ts` | `features/auth/api/auth.api.ts` | |
| `src/services/account.service.ts` | `features/account/api/account.api.ts` | |
| `src/services/access-control.service.ts` | `features/auth/api/access.api.ts` (my access) / `features/admin-access/api/` | |
| `src/types/api.ts` | `lib/api/types.ts` | |
| `src/types/auth.ts`, `user.ts`, `session.ts`, `access-control.ts` | `features/<feature>/types/` | Shared ones (`AuthUser`) exported via `features/auth` |
| `src/pages/auth/*.tsx` | `features/auth/pages/*Page.tsx` | Rendered inside `AuthLayout` |
| `src/pages/account/*.tsx` | `features/account/pages/*Page.tsx` | |
| `src/pages/dashboard/Dashboard.tsx` | `features/dashboard/pages/DashboardPage.tsx` | |
| `src/pages/NotFound.tsx` | `src/pages/NotFoundPage.tsx` | |

## How to…

| Task | Steps |
| --- | --- |
| Add a page to an existing module | Page in `features/X/pages/` → path in `app/paths.ts` → route (lazy) in `app/routes/<area>.routes.tsx` → item in `config/navigation.config.ts` |
| Add a new module | `features/<module>/` → `app/routes/<module>.routes.tsx` + include in `routes/index.tsx` → group / items in `navigation.config.ts` (until the routes exist, the planned pages show) |
| Add a UI component | `components/ui/<name>/` with component, variants, index → export in `components/ui/index.ts` → add to the kitchen-sink page and check every preset × mode |
| Add a theme preset | One entry in `config/theme.presets.ts` (light + dark tokens) → it appears in the theme customizer; check contrast on the kitchen-sink page |
| Rename / rebrand for a new project | `npm run project:init -- --name "…" --slug …` → replace files in `public/brand/` → edit `navigation.config.ts` |
