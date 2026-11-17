# AuthCore Frontend — Tech Stack

## Installed (as of 2026-11-17)

| Layer | Package | Version | Purpose |
| --- | --- | --- | --- |
| Runtime (dev) | Node.js | 20.19.4 | Vite 8 needs Node `^20.19` or `>=22.12` |
| Build / dev server | `vite` | 8.3.x | Dev server, HMR, production build, env variables |
| React plugin | `@vitejs/plugin-react` | 6.1.x | JSX, Fast Refresh |
| UI runtime | `react`, `react-dom` | 19.3.x | |
| Language | `typescript` | 7.0.x | Native TypeScript compiler (`tsc -b` in `build`) |
| Styling | `tailwindcss`, `@tailwindcss/vite` | 4.3.x | CSS-first config (`@theme`), tokens as CSS variables |
| Routing | `react-router-dom` | 7.18.x | Data router, layouts, `<Outlet />`, lazy routes, error elements |
| Icons | `lucide-react` | 1.73.x | Tree-shakable SVG icons |
| Class names | `clsx` + `tailwind-merge` | 2.1.x / 3.7.x | `cn()` helper: conditional classes without conflicts |
| Linting | `oxlint` | 1.90.x | Fast linter (Rust); config `.oxlintrc.json`; warnings fail `npm run lint` |
| Formatting | `prettier` + `prettier-plugin-tailwindcss` + `@ianvs/prettier-plugin-sort-imports` | 3.10.x / 0.8.x / 4.7.x | One code style, sorted Tailwind classes, grouped imports |

## Planned (add when the module that needs it starts)

| Area | Package | Added in | Why |
| --- | --- | --- | --- |
| Accessible primitives | **Own code** (no library): `components/ui/primitives/` — Slot, Portal, useFloating, useDismiss, list navigation; hooks useFocusTrap, useScrollLock, useControllableState | Level 1 · module 4 | Keyboard, focus trapping and ARIA solved; styled with our tokens |
| Variants | **Own** `variants()` helper (`lib/utils/variants.ts`) | Level 1 · module 4 | Typed `variant` / `size` props per component |
| Toasts | **Own** toast store + `<Toaster>` (`components/ui/toaster/`) | Level 1 · module 4 | Accessible notifications, theme-aware |
| Server state | `@tanstack/react-query` (+ devtools in development) | Level 2 · module 17 | Caching, refetching, invalidation, pagination for admin lists |
| Forms | `react-hook-form` + `@hookform/resolvers` | Level 2 · module 18 | Uncontrolled forms, field errors from the API |
| Validation | `zod` | Level 2 · module 18 | Schemas shared by forms and API response parsing |
| Tables | `@tanstack/react-table` | Level 2 · module 21 | Sorting, column visibility, selection for admin lists |
| Command menu | Own implementation (planned) | Level 1 · module 8 (optional) | Global search / command palette |
| Dates | Built-in `Intl` (no library) | Level 1 · module 12 | Format in the user's locale and time zone |
| i18n | `i18next` + `react-i18next` | Level 3 · module 27 | UI in en / ta / hi like the backend emails |
| E2E tests | `@playwright/test` | Not planned (manual testing) | Only if the team later decides to automate tests |
| Error tracking | `@sentry/react` (or similar) | Level 3 · module 29 | Production error reports with release / user context |
| Bundle analysis | `rollup-plugin-visualizer` | Level 3 · module 30 | Size budget checks |

**Rule:** a package is added in the module that needs it, with its reason in this table. Nothing is installed "just in case".

## Decisions

### Testing: manual

No test framework (Vitest, Testing Library, MSW) — the same decision as the backend. `npm run verify` (format, lint, types, architecture rules, build) is the automated gate; behaviour is checked by hand with the module checklists and the `/dev/ui` kitchen-sink page.

### HTTP client: keep `fetch` behind `lib/api/client.ts`

The existing `lib/api-client.ts` already uses `fetch` with a refresh queue. Keep it, moved to `lib/api/client.ts`:

- no dependency, same features as Axios interceptors (request hook, response unwrap, refresh-and-retry, timeout with `AbortController`);
- the rest of the app imports only `apiClient` / `ApiError`, so switching to Axios later changes one file.

The one thing `fetch` can't do is **upload progress**: `lib/api/upload.ts` uses `XMLHttpRequest` for that single case. If you prefer Axios, swap the implementation of `client.ts`; the public API stays the same.

### Linter: oxlint (+ Prettier), not ESLint

- Already set up, very fast, has React, TypeScript, import, jsx-a11y and unicorn rule sets.
- `typescript-eslint`'s type-aware rules depend on the TypeScript compiler API; check its TypeScript 7 support before adding ESLint. Until then oxlint covers linting and `tsc -b` covers types.
- Architecture rules (feature isolation, no `import.meta.env` outside `config/env.ts`) are enforced with oxlint `no-restricted-imports` / `no-restricted-syntax` where possible, otherwise with a small script in `scripts/check-architecture.mjs` run by `npm run verify`.

### Router: data router (`createBrowserRouter`)

`createBrowserRouter` + `<RouterProvider>` (module 5): route-level `errorElement`, `lazy` per route, route `handle` for titles / breadcrumbs / permissions / feature flags; loaders later if useful.

React Router 7 ships everything in `react-router`; `react-router-dom` re-exports it. Import from one package consistently (`react-router-dom` while it is the installed one).

### Components: our own design system, no UI library

Every component in `components/ui/` is our code end to end — including the hard accessibility parts (focus trap, layered dismiss, roving focus, typeahead, collision-aware positioning, portals) in `components/ui/primitives/`. No Radix, cva, sonner or cmdk; dropdowns are custom listboxes, never `<select>`. Components follow the WAI-ARIA Authoring Practices patterns; the oxlint rules that prefer native tags are switched off only for `components/ui/**` and `app/layouts/**` for that reason. No component library theme to fight, no runtime CSS-in-JS.

### Styling: Tailwind v4 + CSS variables

Tokens are CSS variables (`--color-primary`, `--radius-md`, …) registered in Tailwind's `@theme`, so utilities like `bg-primary` and `rounded-md` follow the active preset / mode / appearance automatically. See [theme-system.md](./theme-system.md).

### State

| Kind | Where |
| --- | --- |
| Server data | TanStack Query (Level 2) |
| Session / user | `AuthProvider` context (Level 2) |
| Theme, sidebar collapse | Context + `localStorage` (via `useLocalStorage`) |
| Forms | React Hook Form |
| URL state (filters, page, tabs) | Search params (`useSearchParams`) |
| Everything else | Local component state |

No global store (Redux / Zustand) unless a real cross-feature client state appears.

## Versions policy

- Exact versions come from `package-lock.json`; install with `npm ci`.
- Upgrades: one package at a time, followed by `npm run verify` and a manual check of the affected screens.
- `.nvmrc` pins Node for local development and CI.
