# Changelog

Changes to the AuthCore frontend starter kit that matter to **projects copied from an earlier version**. Each entry says what changed, whether it breaks copied code, and how to follow.

Format: newest first. **Breaking** = copied code must change to take the update; _Additive_ = can be copied in as is.

When you change the kit: add an entry under **Unreleased** in the same commit. When a level is finished, give the block a version (and set `package.json → version`).

---

## Unreleased — Level 1 (foundation)

The first structured version. Projects copied **before** Level 1 (flat `components/common`, `context/`, `services/`, `src/router/`) should not merge file by file: copy the new kit and move their business pages into `features/` (see [Migrating a pre-Level-1 copy](#migrating-a-pre-level-1-copy)).

### Error handling (module 14)

- _Additive:_ `lib/errors/` — `reportError` / `setErrorReporter` (no-op until a reporter is set), chunk-load "reload once" recovery, `installGlobalErrorHandlers()` (called in `main.tsx`).
- _Additive:_ `ErrorAlert`, `notifyError` / `notifySuccess`, `useApiError()`; `ErrorBoundary level="page"` wraps the content area in `AppLayout`.
- **Breaking (behavior):** `ErrorState` now renders `NoPermissionState` for 403 and a not-found state for 404, and renders nothing for cancelled requests / an expired session. Pages that handled 403 / 404 themselves before `ErrorState` keep working; remove the duplicate handling.
- **Breaking (behavior):** the API client fails at once with `NETWORK_ERROR` while the browser is offline (no request is sent).
- **Changed:** form pages keep the thrown error (`useApiError`) instead of a string. Pattern to follow: replace `setError(err instanceof ApiError ? err.message : '…')` with `setError(err, '…')` and the danger `<Alert>` with `<ErrorAlert error={error} fallback={fallback} fields={[…]} />`.

### API layer (module 13)

- **Breaking:** `src/lib/api-client.ts` → `lib/api/` (`client.ts`, `api-error.ts`, `types.ts`, `request-utils.ts`, `upload.ts`, `download.ts`, `get-error-message.ts`). Import from `@/lib/api`.
- **Breaking:** errors are `ApiError` (`status`, `code`, `fieldErrors`, `requestId`, `retryAfter`, `is*` getters) instead of a generic `Error`.
- **Breaking:** public auth calls pass `{ auth: false }`; the token is only sent to API URLs (not to absolute foreign URLs).
- _Additive:_ `getPage()` → `{ items, meta }`, timeout (`VITE_API_TIMEOUT_MS`), `AbortSignal` on every call, `X-Request-Id`, shared refresh on 401, client events (`unauthorized`, `forbidden`, `serverError`, `error`), `uploadFile` with progress, `downloadFile`.
- **Breaking:** `accountApi.exportData` returns a file download (`downloadFile`), not JSON.

### Utilities, hooks (modules 11–12)

- **Breaking:** `src/lib/utils.ts` → `lib/utils/` (`cn`, `variants`, `string`, `url`, `assert`, `platform`); formatting → `lib/format/`; constants → `lib/constants/`.
- **Breaking:** direct `localStorage` use replaced by `lib/storage.ts` + registered keys (`lib/constants/storage-keys.ts`, keys `<slug>:<name>:v<version>`). Old unversioned keys are ignored (users lose saved theme / sidebar state once).
- _Additive:_ hooks in `src/hooks/` (`useDebounce*`, `useDisclosure`, `useMediaQuery`/`useBreakpoint`, `useLocalStorage`, `usePagination`/`useUrlPagination`, `useQueryParams`, `useRequiredParam`, `useOnlineStatus`, …).
- **Breaking:** `usePermissions` moved to `features/auth` (import from `@/features/auth`).

### Page and feedback components (module 10)

- _Additive:_ `components/page/` (`PageContainer`, `PageHeader`, `PageSection`, `ResponsiveGrid`, `FilterBar`), `components/feedback/` (`LoadingState`, `EmptyState`, `ErrorState`, `NoPermissionState`, `OfflineBanner`, `ErrorBoundary`), `pages/` (`StatusPage`, `NotFoundPage`, `ForbiddenPage`, `RouteErrorPage`, planned pages).
- **Breaking:** `DateTime` prop `style` renamed to `format`.

### Navbar, sidebar, layouts, routing (modules 5–9)

- **Breaking:** `react-router-dom` data router (`createBrowserRouter`); routes in `app/routes/*.routes.tsx` with `lazyPage()` and `handle` (`title`, `breadcrumb`, `permission`, `featureFlag`). `src/router/index.tsx` is gone.
- **Breaking:** `ProtectedRoute` / `GuestRoute` → `app/layouts/guards/RequireAuth` (with `returnTo`) / `RequireGuest`; `Layout` / `Navbar` → `app/layouts/AppLayout` + `navbar/` + `sidebar/`.
- **Breaking:** every URL comes from `config/paths.ts`; inline path strings fail `check:architecture`.
- _Additive:_ config-driven sidebar (`navigation.config.ts`: groups, children, badges, flags, permissions, `status: 'planned'`), navbar actions (`layout.config.ts`), command menu, notifications bell, breadcrumbs, skip link, focus management on navigation, mobile drawer.

### UI component library (module 4)

- **Breaking:** `components/common/{Button,Input,Card,Badge,Alert}.tsx` → `components/ui/<name>/` with new props (`variant`, `size`, `isLoading`, `leftIcon`, `asChild` …). Import from `@/components/ui`.
- **Rule:** no UI libraries (no Radix, cva, sonner, cmdk …): own primitives in `components/ui/primitives`, own `variants()` helper, own toaster (`toast.success(…)`). Projects that added such a library must replace it before taking kit components that depend on the primitives.
- **Breaking:** native `<select>` is not allowed (rule in `check:architecture`); use `Select` / `Combobox`.
- _Additive:_ ~33 components (dialog, sheet, dropdown menu, popover, tooltip, tabs, accordion, table, pagination, combobox, command palette …), `/dev/ui` kitchen-sink page with usage notes.

### Theme and design tokens (module 3)

- **Breaking:** `src/index.css` → `styles/` (`tokens.css`, `themes.css`, `appearance.css`, `base.css`). Components use semantic tokens (`bg-surface`, `text-muted-foreground` …); hard-coded colors fail `check:architecture`.
- **Breaking (look):** defaults are `rounded-md` everywhere and **no shadows**; only `rounded-md` / `rounded-full` and `shadow-card` / `shadow-popover` are allowed.
- _Additive:_ mode × preset × appearance, user preferences page, no-flash script, `check:contrast`.

### Configuration (module 2)

- **Breaking:** `src/config/project.ts` → `app.config.ts` (identity, branding), `features.config.ts` (flags), `env.ts` (the only `import.meta.env` reader), plus `navigation`, `layout`, `theme`, `paths`, `icons` configs. Startup validation (Configuration problems page).
- _Additive:_ `npm run project:init`.

### Project setup (module 1)

- _Additive:_ oxlint (warnings fail), Prettier with import / Tailwind class sorting, `check:architecture`, `npm run verify` (format, lint, types, architecture, contrast, error codes, build) and GitHub Actions CI (`.github/workflows/frontend-ci.yml`).

### Migrating a pre-Level-1 copy

1. Copy the new kit into a branch; run `project:init` with your name and slug; re-apply branding in `app.config.ts`.
2. Move your business code into `features/<area>/` (`api/`, `pages/`, `components/`, `types/`); replace `services/*.service.ts` calls with `*.api.ts` over `apiClient`.
3. Add your URLs to `paths.ts`, routes to `app/routes/`, menu items to `navigation.config.ts`.
4. Replace old components with `@/components/ui` equivalents; replace raw colors with tokens.
5. `npm run verify` until green, then walk the [manual checklist](./README.md#manual-verification-checklist).

The old → new file map is in [folder-structure.md → Migration of the current files](../docs/frontend/folder-structure.md#migration-of-the-current-files).
