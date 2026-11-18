# AuthCore Frontend — API Integration Checklist

**Connecting the NestJS APIs to the React + Vite + TypeScript frontend, the same way for every module**

Use this checklist for every backend module you connect (users, roles, permissions, groups, access mapping, password policy, sessions, …). Part A is the shared foundation, built once. Part B is repeated for each module.

`[x]` = already in `authcore-frontend` (2026-11-18). `[~]` = partly done (see the note). `[ ]` = to do.

> **Stack decisions (fixed):** native `fetch` through one client (`lib/api/client.ts`); no Axios. No TanStack Query/Router, Redux or Zustand: data comes from feature API files, custom hooks, React state, Context and React Router. Forms use our own fields + `useFormValidation`; there is no React Hook Form or Zod. Toasts are our own (`components/feedback/notify.ts`); there is no Sonner. No UI libraries. **Testing is manual**: each module is checked by hand against Part B, and `npm run verify` is the automated gate.

---

## How a request flows

```
Page (features/<x>/pages)                  ← loading / empty / error / success UI
  → feature hook or component state        ← AbortController, debounce, URL params
    → feature API (features/<x>/api)       ← typed functions, endpoint paths, DTO mapping
      → apiClient (lib/api/client.ts)      ← base URL, token, refresh, envelope, ApiError
        → NestJS  /api/v1/...              ← validates, authorizes, returns the envelope
```

Each layer has **one** job. Pages never call `fetch`. API files contain no JSX, toasts or navigation. The client knows no feature.

## Where files go

| What | Where |
| --- | --- |
| HTTP client, ApiError, upload / download, envelope types | `lib/api/` |
| Error codes (mirrored from the backend), HTTP constants, storage keys | `lib/constants/` |
| Validation rules shared by forms | `lib/validation/` |
| Environment (`VITE_*`, validated) | `config/env.ts` |
| Session (token store, AuthProvider, useAuth), permissions | `features/auth/session`, `features/auth/permissions` |
| Module API functions | `features/<module>/api/<module>.api.ts` |
| Module request / response types | `features/<module>/types/<module>.types.ts` |
| Module hooks (lists, details, mutations) | `features/<module>/hooks/` |
| Module pages and parts | `features/<module>/pages/`, `features/<module>/components/` |
| Generic hooks (debounce, pagination, API error state) | `hooks/` |
| Shared UI: fields, table, feedback, page layout | `components/ui`, `components/data-table`, `components/feedback`, `components/page` |
| Routes (lazy pages, permission, breadcrumbs) | `app/routes/<area>.routes.tsx` |

---

## Part A — Shared foundation (once)

### A1. Environment and configuration

- [x] `VITE_API_BASE_URL` (path such as `/api/v1` or a full URL) and `VITE_API_TIMEOUT_MS`, validated at startup in `config/env.ts`
- [x] `.env.example` lists every variable; `.env` is never committed
- [x] Vite dev proxy for `/api`, so cookies stay same-origin in development
- [x] Nothing secret in `VITE_*` variables: everything prefixed `VITE_` is shipped in the browser bundle
- [ ] Separate values per environment (`.env.development` / `.env.staging` / `.env.production`) when you deploy
- [x] API version lives in the base URL only, never repeated in feature code

### A2. HTTP client (`lib/api/client.ts`)

- [x] One client. It is the only file that calls `fetch` (architecture rule).
- [x] Base URL and query strings (`query` option): empty values left out, arrays repeat the key
- [x] JSON bodies; `FormData` / `Blob` / `URLSearchParams` are sent as they are
- [x] `credentials: 'include'` for the refresh cookie
- [x] `X-Request-Id` on every request (the backend logs the same id)
- [x] Timeout per request → `ApiError` `TIMEOUT`
- [x] Cancellation via `signal` → `ApiError` `ABORTED` (ignored by error UIs)
- [x] Offline detection → `NETWORK_ERROR`
- [x] Backend envelope unwrapped: callers get `data`; lists use `getPage()` → `{ items, meta }`
- [x] Bearer access token taken from the auth layer through an adapter (the client imports no feature)
- [x] 401 → **one shared refresh** for all requests in flight → each request retried once → if it fails again, the `unauthorized` event signs out
- [x] Events: `unauthorized`, `forbidden` (permissions may have changed), `serverError`, `error`
- [x] `Retry-After` read on 429 / 503
- [x] File upload with progress (`lib/api/upload.ts`) and download (`lib/api/download.ts`)
- [x] Tokens, passwords and response bodies are never logged

### A3. Response and error contract

- [x] Types follow the **NestJS envelope** (`lib/api/types.ts`): success / error envelopes, `Paginated<T>` with `meta`
- [x] Every failure is an `ApiError` carrying status, code, message, field errors, request id and Retry-After
- [x] Backend error codes mirrored in `lib/constants/error-codes.ts`; `npm run check:error-codes` fails on drift
- [x] One readable message per code (`lib/api/get-error-message.ts`); no raw backend text for unknown errors
- [x] Field errors mapped onto form fields (`useApiError().fieldError('email')`)
- [x] An error shows its request id, so the user can quote it in a support request
- [ ] When the backend adds a code: add it to `error-codes.ts` and give it a message in the same change

### A4. Session and authentication

- [x] Access token **in memory only** (`token-store.ts`); refresh token in an httpOnly, Secure, SameSite cookie set by the backend
- [x] Session restored on reload through the refresh cookie before protected routes render (no flash of the login page)
- [x] `AuthProvider` + `useAuth()`: user, status (`loading` / `authenticated` / `anonymous`), login, logout
- [x] Logout clears the token, the user and user-specific state
- [x] Protected and public-only routes; the requested URL is kept and the user returns to it after login
- [x] Login, register, verify email, forgot / reset password and account recovery pages wired to the API
- [ ] Sign-out in one tab signs out the others (`BroadcastChannel` or a `storage` event)
- [ ] MFA / OAuth callback pages (when the backend offers them)
- [ ] CSRF protection confirmed for every cookie-authenticated endpoint (backend: SameSite and an origin check, or a token)

### A5. Permissions (RBAC)

- [x] `usePermissions()` with `can` / any / all checks, and a `<PermissionGate>` component
- [x] Routes declare a permission; the navigation hides items the user cannot open
- [x] A 403 shows `NoPermissionState`, not a generic error
- [~] Permissions reloaded after the `forbidden` event (the event exists; wire the reload once the roles API is live)
- [x] Rule: hiding a button is convenience, not security. NestJS checks every protected endpoint.

### A6. Data loading without TanStack

- [x] Lists: `useServerTable` + `DataTable` (page, size, search, sort and filters in the URL; abort of outdated requests; selection; bulk actions)
- [x] `useDebounce` for search; `usePagination` for simple lists
- [ ] Small `useRequest(fn, deps)` hook for details pages: `{ data, error, status, reload }` and an AbortController per run, with the latest request winning
- [ ] Route `loader` only where data must exist before the page renders (e.g. an edit page by id); otherwise load in the page
- [ ] Short in-memory cache **only** for reference data used on many screens (roles list, permission catalogue), with a manual `invalidate()`
- [x] No global store: server data stays in the page or hook that shows it; Context only for session, theme and layout

### A7. Forms and mutations

- [x] Shared fields (Input, Select, Textarea, Checkbox, Switch, …) take `label`, `hint` and `error`; errors come from the parent
- [x] `useFormValidation` + rules in `lib/validation` for client-side checks; messages appear after the first submit
- [x] Backend validation errors mapped back onto the same fields (`useApiError`)
- [x] Submit button shows loading and blocks double submits (`isLoading`)
- [x] Success → `notifySuccess`; failure → inline `ErrorAlert` (forms) or `notifyError` (row actions)
- [ ] Edit forms: load, fill defaults, send only changed fields (`PATCH`), warn about unsaved changes on leave
- [ ] Destructive actions go through a confirmation dialog that names what will be removed
- [ ] Optimistic update only for safe toggles (activate / deactivate), rolled back on error

### A8. Shared UI states

- [x] `LoadingState` / skeletons, `EmptyState`, `ErrorState` (with retry), `NoPermissionState`, `OfflineBanner`
- [x] `ErrorBoundary` per route, plus a crash page; reload after a stale chunk (`chunk-reload.ts`)
- [x] Status pages: 403 (ForbiddenPage), 404 (NotFoundPage), route error, crash
- [ ] Maintenance page for 503 from the backend (with Retry-After)
- [x] Lazy route pages (`lazyPage`) with a loading fallback; route titles and breadcrumbs from route handles

---

## Part B — Per module (repeat for every API)

Copy this block into the module's PR or issue and tick it off.

### B1. Contract first

- [ ] Read the endpoint in Swagger / the Postman collection: method, path, permission, request DTO, response DTO, error codes
- [ ] Request and response **types** in `features/<module>/types/`, named after the backend DTOs (`CreateRoleRequest`, `Role`)
- [ ] Dates stay ISO strings in types; they're formatted only in the UI (`lib/format`)
- [ ] New error codes added to `lib/constants/error-codes.ts` (`npm run check:error-codes` passes)

### B2. API file (`features/<module>/api/<module>.api.ts`)

- [ ] One object of typed functions: `list(query, signal)`, `get(id, signal)`, `create(body)`, `update(id, body)`, `remove(id)` and module actions (`activate`, `assignPermissions`, …)
- [ ] Paths defined once in the file (`const BASE = '/roles'`), with ids encoded (`encodeURIComponent`)
- [ ] Lists map `TableQuery` → backend query params (`page`, `limit`, `search`, `sort`, filters) and return `TablePage<T>`
- [ ] Every GET accepts a `signal`
- [ ] No JSX, toasts, navigation or React state in the file
- [ ] Mock replaced (or kept behind a flag) with the same function signatures, so pages don't change

### B3. Page wiring

- [ ] Route in `app/routes/<area>.routes.tsx` with `permission`, a lazy page and a breadcrumb; navigation item un-planned
- [ ] List page on `DataTable`: search, filters, sort, pagination and page size, in sync with the URL
- [ ] Every state handled: first load (skeleton), empty, no results, error with retry, 403, offline
- [ ] Row actions and bulk actions behind `PermissionGate`
- [ ] Create / edit form: client rules, backend field errors, loading button, success toast, list refreshed
- [ ] Delete / deactivate: confirmation, then refresh, and the selection cleared
- [ ] Details page: load by id, 404 → not-found state, back keeps the list filters (URL)
- [ ] Import / export (if offered): upload with progress, download with the file name from the backend

### B4. Edge cases (check by hand)

- [ ] Typing fast in search sends **one** request; older responses never overwrite newer ones
- [ ] Leaving the page mid-request: no error toast, no state update after unmount
- [ ] Access token expires mid-session: the request succeeds after a silent refresh
- [ ] Several requests hit a 401 at once: **one** refresh call (Network tab)
- [ ] Refresh token expired or revoked: redirected to login, and back to the same URL after signing in
- [ ] Permission removed while the user is signed in: 403 state shown, with no crash or blank page
- [ ] Backend down / offline / timeout: readable message, retry works
- [ ] 429: message tells the user when to try again
- [ ] Validation error from the backend lands on the right field
- [ ] Double-click on submit creates **one** record
- [ ] Direct URL and browser reload on every module page (filters, page and sort restored)
- [ ] Empty list, a single item, and the last page after a delete
- [ ] Long names and values don't break the table or cards; works on a phone
- [ ] Keyboard only: open, filter, act, confirm, close

### B5. Done

- [ ] `npm run verify` passes (format, lint, types, architecture, contrast, error codes, build)
- [ ] Screenshots checked in light and dark, desktop and phone
- [ ] Backend: OpenAPI exported and the Postman collection synced for any API change
- [ ] Module doc / CHANGELOG entry updated

---

## Integration order

1. **Auth and session**: done. It is the base for every protected call.
2. **Account**: profile, security (change password), sessions (list / revoke), activity.
3. **Users**: replace `users.mock.ts` with the real list, status and delete endpoints.
4. **Roles → Permissions → Groups → Access mapping**: then reload permissions on `forbidden` (A5).
5. **Password policy and security settings**: feed the policy into the password rules shown on register / reset.
6. **Audit / activity and remaining planned pages.**

Each module goes through Part B completely before the next one starts.

## Rules that don't change

- Pages never call `fetch` or `apiClient` directly: always through the feature API file.
- The client knows no feature, and features never reach into another feature's internals (use its `index.ts`).
- Types follow the backend DTOs; the backend contract is not reshaped to fit the UI.
- The server does the filtering, sorting and paging; the UI never downloads everything to filter it locally.
- Tokens: access token in memory, refresh token in an httpOnly cookie. Never in `localStorage`.
- Every request that can be superseded or abandoned takes an `AbortSignal`.
- Every screen has loading, empty, error and no-permission states.
- No new dependency for something the kit already does (HTTP, forms, toasts, tables, state).
