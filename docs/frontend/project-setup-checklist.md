# AuthCore Frontend — Project Setup Checklist

**Vite + React + TypeScript + Tailwind CSS v4 + React Router: setup before feature work**

Prepare a frontend foundation that is reusable for every project (ERP, CRM, HRMS, admin panels, SaaS), configurable without editing components, accessible, tested and production-ready. **This checklist covers tooling and foundation only.** The modules built on it are in [level-1-modules.md](./level-1-modules.md).

`[x]` = already done in `authcore-frontend` (2026-11-17). `[~]` = partly done (see the note).

> **Testing is manual** (decision of 2026-11-17, same as the backend): no Vitest, Testing Library or MSW. Every module is checked by hand with the checklists in these documents and the `/dev/ui` kitchen-sink page; `npm run verify` (format, lint, types, architecture rules, build) is the automated gate.

The checklist has 3 levels:

- **Level 1 – Basic foundation:** what every project from this starter needs.
- **Level 2 – Advanced foundation:** quality gates, performance, security, CI.
- **Level 3 – Final verification:** checks before starting feature modules.

Related: [folder-structure.md](./folder-structure.md) · [theme-system.md](./theme-system.md) · [techstack.md](./techstack.md)

---

## Audit of the current code (2026-11-17)

What exists and what has to change before the starter kit is "foundation-ready":

| Area | Current state | Action |
| --- | --- | --- |
| Scaffold | Vite 8 + React 19 + TS 7 + Tailwind 4, alias `@/`, dev proxy `/api → :3000` | Keep |
| TypeScript | ~~`strict` off~~ → **done**: `strict` + extra checks, code passes | — |
| Lint / format | ~~2 rules, no Prettier~~ → **done**: full oxlint set, Prettier + Tailwind + import sorting | — |
| Template leftovers | ~~`App.css`, sample images, generic title~~ → **done**: removed; title / meta from `app.config.ts` | — |
| Entry / app | `main.tsx` → `App.tsx` with `<BrowserRouter>` + `AuthProvider` | `app/App.tsx` with `Providers` + `RouterProvider` (data router) |
| Routing | `<Routes>` in `router/index.tsx`, eager imports, path strings inline | `createBrowserRouter`, lazy pages, `paths.ts`, error elements |
| Layout | `Layout` = `Navbar` + `<Outlet>`; **no sidebar** | `AppLayout` / `AuthLayout` / `PublicLayout`, configurable sidebar + navbar |
| Styling | Palette classes in almost every file (`bg-indigo-600`, `text-slate-…`, `bg-white`); one `--primary` variable | Design tokens only; presets, dark mode, appearance (see [theme-system.md](./theme-system.md)) |
| Components | `Button`, `Input`, `Card`, `Badge`, `Alert` in `components/common` | Move to `components/ui/<name>/` with variants, sizes, states, tests |
| Config | ~~`config/project.ts`~~ | Done: `app.config.ts`, `features.config.ts`, `env.ts`, `paths.ts`, navigation, layout, theme configs (module 2) |
| API | `lib/api-client.ts`: fetch, `credentials: 'include'`, refresh queue, token in memory | Keep logic; move to `lib/api/`; add timeout, `ApiError`, typed errors, tests |
| Auth | `AuthContext`, `ProtectedRoute`, `GuestRoute`, `PermissionGate`, `usePermissions` | Keep logic; move into `features/auth/` (see migration table) |
| Pages | auth (6), account (4), dashboard, 404 | Move into features; add 403, route error, planned-module pages |
| Tests / CI | ~~None~~ → **done**: CI runs `npm run verify`; testing is manual (no test framework) | — |
| Docs | `README.md` | README per [section 12](#12-documentation) + this `docs/frontend/` folder |

---

# Level 1 – Basic foundation

## 1. Project initialization

- [x] Node.js version that Vite 8 supports. *(20.19.4; plan Node 22/24 LTS together with the backend.)*
- [x] Vite + React + TypeScript project. *(`npm create vite`, React 19.)*
- [x] Tailwind CSS v4 with `@tailwindcss/vite`. *(`@import "tailwindcss"` in `src/index.css`.)*
- [x] Path alias `@/` → `src/`. *(`vite.config.ts` + `tsconfig.app.json` `paths`.)*
- [x] `.env.example` with `VITE_API_BASE_URL`.
- [x] `.gitignore` ignores `node_modules`, `dist`, `.env`, `.env*.local`.
- [x] Dev proxy `/api` → `http://localhost:3000`. *(Same origin in development: the refresh cookie and the backend's origin check work.)*
- [x] Lockfile (`package-lock.json`).
- [x] `.nvmrc` + `"engines": { "node": ">=20.19.0" }` in `package.json`.
- [x] `.editorconfig` + `.gitattributes` (LF line endings, UTF-8, 2 spaces), like the backend.
- [x] Remove template leftovers (`App.css`, `assets/hero.png`, `react.svg`, `vite.svg`, `public/icons.svg`).
- [~] `index.html`: `lang`, title, description, application name and theme-color filled from `src/config/app.config.ts` at build time (Vite plugin in `vite.config.ts`). *(No-flash theme script comes with the theme module.)*
- [ ] Create the folder structure from [folder-structure.md](./folder-structure.md) (folders appear with their first file; no `.gitkeep`).

## 2. TypeScript

- [x] Compiler options. *(Bundler resolution, `noEmit`, `react-jsx`, DOM + DOM.Iterable libs.)*
- [x] `"strict": true` (app and node configs).
- [x] `noUncheckedIndexedAccess`, `noImplicitOverride`, `noImplicitReturns`, `forceConsistentCasingInFileNames`, `useUnknownInCatchVariables`. *(`exactOptionalPropertyTypes` left off: too noisy for little gain.)*
- [x] `verbatimModuleSyntax: true` in both tsconfigs (type-only imports stay `import type`).
- [x] `src/types/env.d.ts`: typed `ImportMetaEnv` for every `VITE_*` variable.
- [x] `vite/client` types (referenced from `env.d.ts` and `tsconfig.app.json`).
- [x] Type check script: `npm run typecheck` (`tsc -b`).

## 3. Code quality

- [x] oxlint installed and configured (`.oxlintrc.json`).
- [x] oxlint plugins and categories: `react` (incl. hooks rules), `typescript`, `import`, `jsx-a11y`, `unicorn`, `promise`, `oxc`; `correctness` = error, `suspicious` / `perf` = warn; `lint` fails on warnings.
- [x] Explicit rules: `rules-of-hooks`, `exhaustive-deps`, `jsx-key`, `no-danger`, `no-explicit-any`, `consistent-type-imports`, `import/no-cycle`, `no-duplicates`, jsx-a11y basics, `eqeqeq`, `no-console` (warn / error allowed), `localStorage` / `sessionStorage` restricted (use `lib/storage`).
- [x] Prettier + `prettier-plugin-tailwindcss` (`.prettierrc.json`, `.prettierignore`), `endOfLine: lf`, 100 columns.
- [x] Import order: `@ianvs/prettier-plugin-sort-imports` — Node built-ins → packages → `@/` → relative.
- [x] Architecture rules (`scripts/check-architecture.mjs`, `npm run check:architecture`):
  - [x] `import.meta.env` only in `src/config/env.ts`.
  - [x] `fetch` / `XMLHttpRequest` only in the API layer (`src/lib/api/`, today `src/lib/api-client.ts`).
  - [x] `features/A` never imports `features/B/**` (only `@/features/auth` public index); features never import `app/`.
  - [x] `components/`, `hooks/`, `lib/` never import `features/`, `app/` or pages; `lib/` never imports React; `config/` only imports types and config.
  - [x] No hex colors / palette classes outside `config/`, `styles/` and the theme runtime *(error since module 3; was 281 in 22 files)*.
  - [x] Only `rounded-md` (`rounded-full` for circles) and the themed `shadow-card` / `shadow-popover` *(module 3: project default is no shadows)*.
- [ ] File naming check (components `PascalCase.tsx`, hooks `useCamelCase.ts`, other files kebab-case): applied when files move into the target structure.
- [x] `npm run verify` = format check → lint → typecheck → architecture check → build. Must pass before every commit.

## 4. Package scripts

| Script | Purpose | Status |
| --- | --- | --- |
| `dev` | Vite dev server (port 5173, proxy to the backend) | [x] |
| `build` | `tsc -b && vite build` | [x] |
| `preview` | Serve `dist/` locally | [x] |
| `lint` | oxlint, warnings fail | [x] |
| `lint:fix` | oxlint `--fix` | [x] |
| `format` / `format:check` | Prettier write / check | [x] |
| `typecheck` | Types only (`tsc -b`) | [x] |
| `check:architecture` | Architecture rules (colors, shape, boundaries, env, network, identity, routes) | [x] |
| `check:contrast` | WCAG contrast of every preset × mode (module 3) | [x] |
| `verify` | Everything CI runs | [x] |
| `analyze` | Bundle size report | [ ] (Level 3) |
| `project:init` | Rename the starter for a new project (like the backend) | [ ] (Level 1 · module 2) |

## 5. Environment variables

- [x] `VITE_API_BASE_URL` (default `/api/v1`).
- [x] `src/config/env.ts`: the **only** reader of `import.meta.env`; parses, defaults and validates at startup; exports a typed, frozen `env` object; fails loudly on a bad `VITE_API_BASE_URL`.
- [ ] Planned variables (all optional with defaults): `VITE_APP_ENV` (development / staging / production), `VITE_API_TIMEOUT_MS`, `VITE_SENTRY_DSN` (Level 3), `VITE_DEFAULT_LOCALE` (Level 3).
- [x] Rule: no secrets in `VITE_*` (everything is public in the bundle). Documented in `.env.example`.

## 6. Application wiring

- [ ] `src/main.tsx` mounts `<App />` only (+ CSS import).
- [ ] `src/app/App.tsx` = `<Providers>` + `<RouterProvider>`; one `App` (delete the root `src/App.tsx`).
- [ ] `src/app/Providers.tsx` composes providers in a fixed order: ErrorBoundary → Theme → Query client (Level 2) → Auth (Level 2) → Tooltip → Toaster. Each added only when used.
- [ ] Global error boundary with a reset button and error reporting hook (Level 3: Sentry).
- [ ] `Suspense` fallback for lazy routes (top-progress bar / skeleton, no layout shift).

## 7. Routing foundation

- [ ] `createBrowserRouter` + `<RouterProvider>` (replaces `<BrowserRouter>` + `<Routes>`).
- [x] `src/config/paths.ts`: every URL as a constant and every dynamic URL as a builder (`paths.admin.userDetail(id)`); no path strings anywhere else.
- [ ] `src/app/routes/*.routes.tsx`: one file per area, pages lazy-loaded (`lazy: () => import(...)`).
- [ ] Route `handle`: `title`, `breadcrumb`, `permission` (for guards, document title, breadcrumbs).
- [ ] `errorElement` at the root and per layout; 404 catch-all; redirects (`/` → home).
- [ ] Production server fallback: every unknown path serves `index.html` (nginx `try_files`, Vercel / Netlify rewrites documented).

## 8. Styling and theme foundation

- [x] Tailwind v4 via `@tailwindcss/vite`.
- [ ] `styles/` split: `index.css` (imports only), `tokens.css` (`@theme` tokens), `themes.css` (presets × modes), `base.css` (element defaults), `utilities.css` (custom utilities).
- [ ] Dark mode as a custom variant on `[data-mode="dark"]` (not media-only), so the user's choice wins.
- [ ] Fonts: system stack by default; optional self-hosted font (no Google Fonts request) configurable in `app.config.ts`.
- [ ] Full design-token set, presets and appearance options per [theme-system.md](./theme-system.md).

## 9. Testing

- [x] Decision: **manual testing**, no test framework (Vitest, Testing Library, MSW not installed). Manual checklist: [level-1-modules.md, module 15](./level-1-modules.md#15-manual-verification).
- [x] Automated gate instead: `npm run verify` (format, lint, types, architecture rules, build) locally and in CI.

## 10. Git and CI

- [x] GitHub Actions workflow `.github/workflows/frontend-ci.yml` (path filter `authcore-frontend/**`): `npm ci` → `npm run verify` → `npm audit --omit=dev --audit-level=high` → `dist/` artifact.
- [ ] Optional pre-commit hook (lint-staged + Prettier + oxlint on staged files). Decide per team.
- [ ] Commit convention documented (e.g. Conventional Commits) if the backend uses one.

## 11. Assets and branding

- [x] `public/favicon.svg`.
- [ ] `public/brand/`: `logo.svg`, `logo-dark.svg`, `logo-mark.svg` (collapsed sidebar), `favicon.svg`, `apple-touch-icon.png`, `og-image.png`; paths referenced only from `app.config.ts`.
- [ ] SVGs optimized (SVGO); images sized and compressed; `loading="lazy"` for non-critical images.

## 12. Documentation

- [~] `README.md`. *(Exists; describes the current structure.)*
- [ ] README sections: quick start, scripts, environment, folder structure (link), configuration guide ("start a new project in 10 minutes"), theme guide, adding a feature / page / nav item / UI component, manual verification, deployment, troubleshooting.
- [x] `docs/frontend/` planning documents (this folder).

---

# Level 2 – Advanced foundation

## 13. Performance

- [ ] Every page lazy-loaded; heavy widgets (charts, editors, date pickers) lazy-loaded inside pages.
- [ ] Vendor chunking reviewed (`build.rollupOptions.output.manualChunks` only if analysis shows a need).
- [ ] Bundle budget: initial JS ≤ 200 kB gzip for the shell (layout + home); checked in CI (Level 3).
- [ ] Route prefetch on link hover / focus for heavy modules (optional).
- [ ] No unnecessary re-renders in layout: sidebar / navbar memoized where profiling shows it; context values memoized.
- [ ] Images: modern formats, explicit width / height (no layout shift).
- [ ] Fonts: `font-display: swap`, preload the main weight only.

## 14. Security

- [ ] Access token **in memory only**; never in `localStorage` / `sessionStorage` / cookies set by JS. *(Already true in `api-client.ts`.)*
- [ ] Refresh only via the HttpOnly cookie (`credentials: 'include'`); one refresh at a time; on refresh failure clear state and go to sign-in with `returnTo`.
- [ ] Never render HTML from the API (`dangerouslySetInnerHTML` banned by lint); user text always escaped.
- [ ] `returnTo` / redirect parameters validated as same-origin relative paths (no open redirects).
- [ ] Content Security Policy for production documented (served by nginx / host): `default-src 'self'`, `connect-src` API origin, no inline scripts except the hashed no-flash script.
- [ ] No secrets in `VITE_*` variables or the repository.
- [x] Dependency audit in CI (`npm audit --omit=dev --audit-level=high`).
- [ ] Clickjacking: `frame-ancestors 'none'` header documented for hosting.

## 15. Reliability and UX resilience

- [ ] Route error pages for loader / render errors; "Try again" re-renders, "Go home" navigates.
- [ ] Offline banner (`useOnlineStatus`), requests fail fast with a friendly message.
- [ ] Request timeout (default 30 s, `VITE_API_TIMEOUT_MS`) with a distinct error code.
- [ ] 429 handling: show "Try again in N seconds" from `Retry-After`.
- [ ] Session-expired handling: one toast + redirect, not one per failing request.
- [ ] Chunk-load failure after a deploy: catch `ChunkLoadError` / dynamic-import failures, reload once.

## 16. Accessibility baseline

- [ ] `lang` on `<html>`, one `<h1>` per page, landmarks (`header`, `nav`, `main`, `aside`).
- [ ] "Skip to content" link as the first focusable element.
- [ ] Visible focus ring token (`--color-ring`) in every theme.
- [ ] Route change: focus moves to the page heading; document title updates (`handle.title`).
- [ ] `prefers-reduced-motion` respected by every animation.
- [ ] Contrast ≥ 4.5:1 for text in every preset × mode (checked when a preset is added).

## 17. Browser support

- [ ] Browserslist / Vite `build.target` documented (last 2 versions of evergreen browsers, Safari ≥ 16).
- [ ] Tested in Chrome, Firefox, Safari (or WebKit), Edge; mobile Safari / Chrome for the responsive layout.

---

# Level 3 – Final verification

Run before starting feature modules (Level 2 of the module plan):

- [ ] `npm ci && npm run verify` passes on a clean clone.
- [ ] `npm run dev` with the backend running: sign-in works through the proxy, refresh survives a page reload.
- [ ] `npm run build && npm run preview`: deep link refresh (`/settings/general`) works; 404 for unknown URLs.
- [ ] Changing `app.config.ts` (name, logo) updates sidebar, navbar, title and favicon without other edits.
- [ ] Adding a module to `navigation.config.ts` shows it in the sidebar (with a "planned" page if no route exists yet).
- [ ] Every preset in light and dark looks correct on the kitchen-sink page (`/dev/ui`, development only).
- [ ] Every appearance option (radius, density, sidebar, navbar, card, input, button styles) switches without layout breakage.
- [ ] Theme and sidebar preferences survive reload; no theme flash on load.
- [ ] Mobile (375 px), tablet (768 px), desktop (1280 px), wide (1920 px) layouts checked.
- [ ] Keyboard-only walkthrough: skip link, sidebar, navbar menus, dialogs, forms.
- [ ] Lighthouse (production build): Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95.
- [ ] README "start a new project" steps followed on a fresh copy, start to finish.
