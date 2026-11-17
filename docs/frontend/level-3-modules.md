# AuthCore Frontend — Level 3 Modules (Production & Enterprise)

**Level 3: Modules 27–34 — Production hardening and enterprise features**

Start after Level 2. Each module is optional per project; the starter kit stays usable without them.

- Level 1 (Modules 1–16, starter kit): [level-1-modules.md](./level-1-modules.md)
- Level 2 (Modules 17–26, AuthCore client): [level-2-modules.md](./level-2-modules.md)

---

## 27. Internationalization (i18n)

- [ ] `i18next` + `react-i18next`; namespaces per feature (`common`, `auth`, `account`, `admin`)
- [ ] Languages en, ta, hi (same as the backend emails); English fallback; missing-key warnings in development
- [ ] Language from the user's `preferences.language` when signed in, browser language otherwise; switcher in the navbar / preferences
- [ ] Lazy-loaded translation files; type-safe keys
- [ ] Dates, numbers, currency, plurals through `Intl` with the active locale and the user's time zone
- [ ] RTL readiness (logical CSS properties: `ms-*`, `me-*`, `start`, `end`) for future RTL languages
- [ ] Navigation, page titles and validation messages translated; backend error `message` shown as fallback, `code` mapped to translated text where defined

## 28. End-to-End Testing (not planned)

> Testing is manual (decision of 2026-11-17). Keep this module only if the team later decides to automate browser tests.

- [ ] Playwright against the real backend (backend `test:e2e` style isolated database) and against MSW for UI-only runs
- [ ] Critical journeys: register → verify → sign in → refresh after reload → sign out; forgot / reset; admin creates user → user signs in → must change password; permission-gated navigation
- [ ] Visual checks of the kitchen-sink page in each preset × mode (screenshots compared on demand)
- [ ] Accessibility scan (`@axe-core/playwright`) on key pages
- [ ] Runs in CI on pull requests (backend + MongoDB service + frontend preview)

## 29. Monitoring & Error Tracking

- [ ] Error reporting (Sentry or similar): errors from boundaries, route errors, unhandled rejections; release version, route, user id (no personal data); source maps uploaded, not served
- [ ] Web Vitals (LCP, INP, CLS) reported to the monitoring backend
- [ ] Correlate with the backend: `X-Request-Id` from failed API calls attached to error reports
- [ ] Privacy: no tokens, passwords, emails or form contents in reports; sampling configurable by env

## 30. Performance Budget & Optimization

- [ ] `npm run analyze` (bundle visualizer); budget for the shell and per route checked in CI
- [ ] Route-level prefetch for the most used modules
- [ ] Virtualized long lists / tables (`@tanstack/react-virtual`) where row counts are large
- [ ] Image pipeline: responsive `srcset`, AVIF / WebP
- [ ] Lighthouse CI on the preview build (Performance ≥ 90, Accessibility ≥ 95)

## 31. Progressive Web App (optional)

- [ ] Web app manifest from `app.config.ts` (name, colors, icons)
- [ ] Service worker for the app shell (vite-plugin-pwa), update prompt on new versions
- [ ] Offline page; API calls never cached when they carry user data
- [ ] Install prompt (optional per project)

## 32. Deployment & Delivery

- [ ] Production `Dockerfile` (multi-stage: build with Node, serve `dist/` with nginx, non-root)
- [ ] `nginx.conf`: SPA fallback (`try_files … /index.html`), long cache for hashed assets, no cache for `index.html`, gzip / brotli, security headers (CSP with the no-flash script hash, `frame-ancestors 'none'`, `Referrer-Policy`, `Permissions-Policy`, HSTS behind TLS)
- [ ] `/api` reverse proxy to the backend in the same nginx (same origin → refresh cookie and origin check work without CORS)
- [ ] Runtime configuration option (`/config.json` loaded before boot) for images promoted across environments without rebuilding
- [ ] Docker Compose with the backend, MongoDB and ClamAV for full local stacks
- [ ] CI: build, image publish; preview deployments per pull request (optional)
- [ ] Rollback: previous image tag; chunk-load error handling (Level 1 module 14) covers clients on the old version

## 33. Advanced Security UI

- [ ] MFA screens when the backend adds MFA (backend Level 1 module 13): enable with QR code, verify, backup codes (download / regenerate), MFA challenge at sign-in, recovery
- [ ] Step-up confirmation (re-enter password) before sensitive actions, using the backend's current-password endpoints
- [ ] Idle timeout warning ("You will be signed out in 60 s") configurable per project
- [ ] Security dashboard for admins: failed sign-ins over time, locked accounts / IPs, new-device sign-ins (from `/admin/activity`)
- [ ] CAPTCHA integration point on sign-in / registration (provider pluggable) when the backend supports it

## 34. Developer Experience & Starter-Kit Lifecycle

- [ ] Component documentation (Storybook or an extended kitchen-sink page with usage snippets)
- [ ] Code generators: `npm run gen:feature <name>`, `gen:page`, `gen:component` (folders, files, routes, nav entry)
- [ ] Starter-kit versioning: changelog and upgrade notes so projects copied earlier can pull improvements
- [ ] Shared packages (optional, monorepo): `@org/ui` (design system), `@org/config-types` when several projects need the same components without copy-paste
- [ ] Public config endpoint idea: backend exposes non-secret project identity (name, branding, enabled auth flows, login identifiers) so the frontend can read them instead of duplicating `project.config.json`
- [ ] Feature flags from a remote source (optional)

---

## Suggested order

| Order | Module | When |
| --- | --- | --- |
| 1 | 32. Deployment & delivery | Before the first real deployment |
| 2 | 29. Monitoring & error tracking | With the first deployment |
| 3 | 28. End-to-end testing | Not planned (manual testing); only if automation is decided later |
| 4 | 27. Internationalization | When a non-English audience is planned |
| 5 | 30. Performance budget | When modules grow |
| 6 | 33. Advanced security UI | When the backend adds MFA / CAPTCHA |
| 7 | 34. Developer experience | When a second project starts from the kit |
| 8 | 31. PWA | Only if offline / install is a requirement |
