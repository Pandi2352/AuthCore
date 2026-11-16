# End-to-end tests

Black-box tests: each suite starts the built app (`dist/main.js`), calls the HTTP API like a client, and checks responses, the database and the emails written to an outbox folder.

```bash
npm run build                    # the suites run dist/main.js
npm run test:e2e                 # all suites
npm run test:e2e -- login files  # only some
npm run test:e2e -- users --verbose
npm run test:e2e:build           # build + all suites
```

Needs a local MongoDB (`mongodb://localhost:27017`). Nothing else: no SMTP, no ClamAV (the files suite uses a fake ClamAV that speaks the real protocol), no internet.

## Isolation

- **Own port**: `E2E_PORT` (default `3999`), so a dev server on 3000 is not affected. The runner refuses to start if the port is busy and stops leftover test apps between suites.
- **Own database**: `E2E_MONGODB_URI` (default `mongodb://localhost:27017/authcore_e2e`). It is **dropped at the start of every run**, so the runner refuses any database whose name doesn't end in `_e2e` or `_test`.
- **No `.env`**: the apps start with `IGNORE_ENV_FILE=true` and get `.env.example` + test overrides (random secrets, outbox mail, scanning off). Your local `.env` (real SMTP, other settings) never applies, so results are the same on every machine and in CI, and no real email is ever sent.

## Suites

| Suite | Covers |
| --- | --- |
| flows | Registration flows (direct, OTP, link, approval), startup configuration checks |
| login | Sign-in, JWT claims, sessions, brute-force protection (per IP and per account), timing |
| refresh | Refresh-token rotation, reuse detection, cookie / body delivery, CSRF origin check |
| me, logout, sessions | Current user, logout / logout-all, device list and revocation |
| password | Forgot / reset / change password, lockout on wrong current password |
| policy | Password policy, history, expiry, reminder scheduler |
| access | Roles, permissions, groups, access mapping, escalation rules, audit log |
| users | My account, user administration, invites |
| profile | User schema (custom variables), personal details, activity, admin set-password, generator |
| files | Uploads, downloads, avatars, image processing, virus scanning (fake clamd), purge |
| notify | New-device alerts, account-locked email, default groups, admin activity search |
| bootstrap | First administrator from BOOTSTRAP_ADMIN_* |
| ops | Self-revoke logging, data export, metrics, JWT key rotation, localized emails |
| maintenance | project.config.json identity, orphan file cleanup, invite language, lockout scopes |

## Writing a suite

Copy an existing one (e.g. `suites/bootstrap.e2e.js`): start the app with `spawn(process.execPath, ['dist/main.js'], { env: { ...process.env, ...overrides } })`, use `process.env.E2E_PORT` / `E2E_MONGODB_URI`, give test users a unique email prefix and clean them up, print `PASS` / `FAIL` lines, exit non-zero on failure, then add the name to `SUITES` in `run.js`.

CI: `.github/workflows/backend-ci.yml` runs `npm run verify`, the production audit and all suites on every push / pull request.
