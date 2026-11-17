# Changelog

Changes to the AuthCore frontend starter kit that matter to **projects copied from an earlier version**. Each entry says what changed, whether it breaks copied code, and how to follow.

Format: newest first. **Breaking** = copied code must change to take the update; _Additive_ = can be copied in as is.

When you change the kit: add an entry under **Unreleased** in the same commit. When a level is finished, give the block a version (and set `package.json → version`).

---

## Unreleased — Level 1 (foundation)

### Appearance page

- _Additive:_ redesigned **Settings → Appearance**: quick presets, mode + auto dark at night, accent chips + custom color, radius / density / sidebar / navbar / icon cards, typography (20 fonts, Google Fonts loaded only when selected; text size 13–18 px), contrast & effects, preferences, live preview, configuration summary, live accessibility (contrast) check, copy settings, reset. Guide: `docs/frontend/theme-system.md#appearance-page`.
- _Additive:_ new theme appearance keys `fontSize`, `contrast`, `contentWidth`, `sidebarPosition`, `navbarSearch`, `breadcrumbs`, `striped`, `gradientButtons`, `strongFocus`, `reduceMotion`, `tooltips`, `autoDark`, `customColor`; preset `custom`; `useTheme().applyTheme()`; `Button` renders `data-variant`.
- **Breaking:** `layout.content.maxWidth` removed — content width is the theme option `contentWidth` (`fluid` · `boxed` · `narrow`). Sidebar position, search box, breadcrumbs and tooltips now follow the user's theme (config values are the defaults / master switches). `ThemeRuntimeOptions` gained `fonts`. Features may import `@/app/theme` (architecture rule).

### Data table

- _Additive:_ `components/data-table` — reusable server-side table (`DataTable` + `useServerTable` + `useTableLayout`): search (shared `SearchInput` with clear), visible filters with chips, multi-sort, pagination with totals, explicit selection scope across pages + bulk actions with confirmation, density / column order / visibility / widths remembered per user, sticky header + frozen columns, mobile cards, skeleton / empty / no-results / error states, keyboard navigation and live announcements. Guide: `docs/frontend/data-table.md`.
- _Additive:_ Administration → Users list (`features/admin-users`) on the data table with mock data (243 users; `?mock=error`, `?mock=empty`).

The first structured version. Projects copied **before** Level 1 (flat `components/common`, `context/`, `services/`, `src/router/`) should not merge file by file: copy the new kit and move their business pages into `features/` (see [Migrating a pre-Level-1 copy](#migrating-a-pre-level-1-copy)).

### Navbar and theme

- **Breaking (theme values):** sidebar and navbar styles are the same four — `classic` · `minimal` · `floating` · `compact`. Removed: sidebar `dark`; navbar `standard` (→ `classic`), `transparent` (→ `minimal`), `bordered`, `blurred`. Stored preferences with removed values fall back to `classic`. Compact navbar: `--navbar-height` is 12 px shorter (layout token renamed `--navbar-height-base`). Navbar style is user-customizable. Inside the sidebar, page tokens follow `--sidebar-*`.
- **Changed:** status pages inside the app are full-bleed — the background runs edge to edge (no padding, no border); crash screens (page and app error boundaries) use the same design (`pages/CrashPage.tsx`).
- **Fixed:** "Cannot read properties of null (reading 'useContext')" after switching to a non-classic icon style in a running dev server — `@phosphor-icons/react` is pre-bundled (`optimizeDeps.include`). Restart the dev server once after pulling.
- _Additive:_ 6 more color presets — `indigo`, `sky`, `teal`, `pink`, `amber`, `lime` (13 in total, all offered on the Appearance page).
- **Changed (look):** outline buttons follow the theme color (primary border + text, soft primary hover).
- **Rule:** filled-button text (`--primary-foreground`) is black(-ish) on light fills and white(-ish) on dark fills, whichever reads better — `check:contrast` now fails a preset / mode that gets it wrong.
- **Changed:** status pages (403 / 404 / error / coming soon) are drawn with theme tokens only — no background images; they follow the color preset and light / dark mode (the forced-light `status-light-canvas` and the `public/brand/status-bg*.jpg` images are removed).
- _Additive:_ full-screen action — `layout.config.ts → navbar.actions` 'fullscreen' (feature flag `ui.fullscreen`): navbar button (Full screen / Exit full screen), item in the "more" menu on small screens, command-menu action, custom-action command `toggleFullscreen`, hook `useFullscreen()`. Hidden where the browser doesn't allow full screen; follows Esc / F11.
- **Fixed:** switching mode / preset / appearance applies instantly — color transitions are switched off for the one frame the theme changes (elements with `transition-colors` used to fade one by one).

### Sidebar

- _Additive:_ icon style — theme `appearance.icons`: `classic` (lucide, default) · `modern` (Phosphor) · `duotone` (two-tone, fill in the primary color) · `color` (each item its own color; `NavItem.iconColor` or stable from the id). Users can pick it on the Appearance page. New dependency `@phosphor-icons/react` 2.1.10; every icon in `config/icons.ts` needs an entry in `config/modern-icons.ts` (type-checked); that module is loaded only when a non-classic style is used (own ~18 kB gzip chunk).
- **Changed (look):** tighter menu rows (34 px, compact 30 px; submenu rows 30 px) and smaller gaps between rows and groups.
- **Changed:** collapsed-sidebar flyouts open on hover only after a 350 ms rest (not while passing over) and only one at a time.
- **Changed (look):** the sidebar header has a bottom border on the same line as the navbar's; the sidebar toggle uses its own three-line icon (`SidebarToggleIcon`: long / muted medium / short, lengths swap when collapsed).
- **Changed:** sidebar 240 px wide (was 264); one submenu open at a time (`layout.config.ts → sidebar.singleSubmenu`, default true).
- **Changed:** tooltips — only one visible at a time, normal hover delay in the collapsed sidebar (moving along the icons stays quick), short fade-in, arrow pointing at the trigger.
- **Fixed:** slim custom scrollbars now actually apply in Chrome / Edge (sidebar, content area, menus, tables). The utility is renamed `scrollbar-thin` → `scrollbar-slim` (Tailwind 4.3 has its own `scrollbar-thin`, which switched the custom styles off); the standard `scrollbar-*` properties are set for Firefox only.
- **Fixed:** clicking a menu item sometimes didn't change the page. `usePermissions()` returned new functions every render, so the sidebar's "auto-expand the active branch" effect re-ran forever ("Maximum update depth exceeded") and froze rendering. `usePermissions` is now memoized, `setExpanded` keeps the same array when nothing changes, and the effect depends only on the active branch id.
- **Changed (look):** expanded submenus animate open / closed, with a guide line and an accent bar on the current page; closed submenus are inert (not in the tab order).
- **Changed:** collapsed sidebar — parent icons open their flyout on hover (mouse) as well as click / keyboard; the flyout has a section header and marks the current page.

### Forms and fields

- **Changed (layout):** content is full width by default (`layout.config.ts → content.maxWidth: 'full'`); pages no longer narrow themselves (`<PageContainer>` without `width`). Set `maxWidth: 'container'` for a centered max width — one place for every page.
- **Changed (look):** checkboxes are square (`rounded-none`); `check:architecture` now allows `rounded-none` alongside `rounded-md` / `rounded-full`.
- _Additive:_ `features/auth/components/AuthCard` — welcome title and message inside the card (no icon tile), form, footer links. Every auth page uses it (friendlier copy, sentence-case buttons); the login page now shows the success message sent by register / reset / verify.
- **Changed (look):** control height `h-control-md` is 44 px by default (comfortable: sm 36 / md 44 / lg 48; compact 32 / 38 / 44; spacious 40 / 48 / 56). Fields and form buttons share it — use the default size for both.
- **Changed (look):** text fields and outline buttons use a lighter border token `--field-border` (`border-field`); checkbox / radio / switch keep `--input`. Checked by `check:contrast` at 1.25:1 (focus and error borders stay ≥ 3:1).
- **Changed:** auth pages have a top bar — logo on the left, theme toggle on the right; the form is centered below.
- _Additive:_ every control (Input, PasswordInput, Textarea, Select, Combobox, Checkbox, Switch, RadioGroup) accepts `label`, `hint`, `error` (`string` = message, `true` = invalid only) and `required` from the parent (`FieldShell` / `field-props.ts`). `Field` takes `hint` (`description` still works).
- **Fixed:** Select / Combobox no longer drop the built-in behavior when the parent passes `onClick` / `onBlur`; Switch labels now toggle the switch outside a `<Field>`.
- **Changed (look):** focus border uses the theme `primary` color; error messages have an icon; placeholders describe the input; `PasswordRequirements` is a compact strength meter (`passwordStrength()`).
- _Additive:_ `lib/validation` + `useFormValidation`: client validation with errors under each field (all auth and account forms use it). Forms use `noValidate`.
- **Breaking (look):** focused fields show a border color only — no focus ring / glow.
- **Breaking (behavior):** `Card` wraps plain children in a padded `CardContent` (new `contentClassName` prop). Cards that padded their content themselves should move those classes to `contentClassName`.

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
