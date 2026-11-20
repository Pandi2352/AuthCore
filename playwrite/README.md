# AuthCore — browser tests (Playwright)

End-to-end tests that drive the real AuthCore frontend in a browser.
Playwright **1.65.1** (pinned), Chromium, TypeScript.

## Setup (once)

```bash
cd playwrite
npm install
npm run install:browsers      # downloads Chromium for Playwright
cp .env.example .env
```

Needs MongoDB on `localhost:27017` (the same one the backend's own e2e tests use).

## Test environment (default target)

Tests run against a **separate AuthCore**, never your dev data:

```bash
npm run env:test          # build what changed, start, keep running (Ctrl+C stops)
npm run env:test:reset    # same, from an empty database, outbox and uploads
```

| Part | Where |
| --- | --- |
| App (built frontend; `/api` goes to the test backend) | http://localhost:5174 |
| Backend (built into `authcore-backend/dist-pw`; your `dist/` is untouched) | http://localhost:3998/api/v1, docs at `/api/docs` |
| Database | `mongodb://localhost:27017/authcore_pw_test` |
| Emails (never sent) | `.test-env/mail-outbox/*.eml`; tests read them with `tests/support/mail.ts` |
| Uploads, logs | `.test-env/uploads`, `.test-env/logs/backend.log` |

- Settings come from `authcore-backend/.env.example` plus test overrides, never from your
  backend `.env` (so no real SMTP, no dev database).
- The test admin `playwright.admin@authcore.test` is created by the backend's own first-run
  setup; its password is generated once and saved in `.env` (`E2E_TEST_ADMIN_PASSWORD`).
- Rebuilds only when backend or frontend sources changed (`-- --rebuild` forces it).
  The general per-IP request limit is raised for tests; sign-in limits stay as in the app.

### Choosing the target

| `.env` | Tests run against |
| --- | --- |
| `PW_ENV=test` (default) | The test environment above |
| `PW_ENV=dev` | Your dev servers (`PW_BASE_URL`, default http://localhost:5173) with `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD`: your dev database, and the dev backend may send real email |

The dashboard's **Run tests** page can pick either for one run. If the chosen app isn't
answering, the run stops at once and says how to start it.

## Run

| Command | What it does |
| --- | --- |
| `npm test` | Every test (headless) |
| `npm run test:smoke` | Only tests tagged `@smoke` |
| `npm run test:headed` | Watch the browser |
| `npm run test:ui` | Playwright's UI mode (pick, re-run, time-travel) |
| `npm run test:debug` | Step through with the inspector |
| `npm run report` | Open the last HTML report |
| `npm run codegen` | Record clicks into a new test |
| `npx playwright test --project=public` | Only the pages that need no sign-in |

## Test dashboard

```bash
npm run dashboard        # http://127.0.0.1:9400 (this machine only)
```

A local dashboard (AuthCore look, light/dark, phone-friendly) over every run kept in
`reports/` (git-ignored; newest 50 by default, set on Setup or with `PW_DASHBOARD_KEEP`).
Runs started from the command line show up too. Press `?` for keyboard shortcuts. Pages:

| Page | What it shows |
| --- | --- |
| Overview | Latest run banner and counts, results per project, pass-rate / results / run-time trends, problems (known issues last), slowest, flakiest and most failing tests |
| Runs | Every kept run: filter (also scheduled runs), open, compare with the run before, download (JSON), delete, clear history |
| Run | Every test (search, filter, sort), problems with screenshots and failures grouped by the same error, timeline per worker, by project/file/tag, output, environment; export CSV / JSON / one self-contained HTML file, print to PDF, re-run, re-run exactly the failed tests (any run), compare with previous |
| Test (popup) | Overview, errors, steps, evidence (screenshots, video, trace → Trace Viewer, console, failed API calls), tries, output, **backend log** of the test's time window, history, **notes and "known issue" mute**; copy link; run it now (visible browser, trace, repeat N times) |
| Compare runs | Two runs side by side: newly failing, fixed, still failing, newly flaky, slower, faster, new and removed tests |
| Tests | Every test in the code with last result, recent runs, pass rate, flaky count, average time, notes; run one test |
| Flaky & slow | Unstable tests with pass rate and "run it 10 times", slowest tests with trend lines, tests getting slower, the same error across a run and across all runs |
| Search | Test names, files and error text in every kept run |
| Run tests | Target, quick picks, **saved setups**, projects, tags, files, name filters, workers, retries, repeat, stop-after, headed, traces; start the test environment if it is down; live progress and output; stop |
| Schedules | Run tests every N minutes or daily at a time on chosen weekdays (optionally starting the test environment); run now, pause, edit. Runs while the dashboard runs |
| Coverage | App pages (from `authcore-frontend/src/config/paths.ts`) and API endpoints (from the backend's OpenAPI document) the tests reached, per run or across all runs |
| Screens | A screenshot of every page (desktop and phone) per run, and visual changes against approved screenshots (side by side, red difference, slider) |
| Accessibility & speed | axe scan (WCAG 2.2 AA) per page with how to fix, problems over runs; time to open each page with trends |
| Test health | `.only`, `page.pause()`, skipped tests, fixed waits, tests that check nothing, tests close to their time limit |
| Test environment | Start / restart / stop (optionally empty database or full rebuild), start-up output, live backend log with filters, leftover test data and clean-up |
| Emails | The test outbox: preview (sandboxed), text, links, source; search, filter by kind, new-mail notices, delete all |
| Setup | Targets, account, versions, how many runs to keep and for how many days, desktop notifications when a run finishes, commands |

The smoke tests record a screenshot, an accessibility scan and the load time of every page
(`tests/support/page-checks.ts`; only reported, never a failure; `PW_PAGE_CHECKS=0` turns it
off; the full suite took about 1.2 min without them and 2.4–3 min with them). Every test records the pages and API calls it
touched (`tests/support/coverage.ts`). Approved screenshots are kept in `visual-baselines/`;
notes, saved setups, schedules and settings in `reports/dashboard-data/` (this machine only).

The report comes from `reporters/dashboard-reporter.ts` (set in `playwright.config.ts`).
Passing `--reporter=...` on the command line replaces the configured reporters, so that
run will not reach the dashboard.

## How it is organised

```
playwright.config.ts        projects, base URL, evidence on failure
tests/
  support/constants.ts      routes, test account from .env
  support/fixtures.ts       signed-in `app` fixture: sign in once per worker, `app.open(path)`,
                            browser console problems and failed API calls attached to reports
reporters/
  dashboard-reporter.ts     writes every run in full to reports/ for the dashboard
dashboard/
  server.mjs                local server (Node built-ins only): UI, reports, start/stop runs
  public/                   the dashboard UI (hand-built, no libraries)
  public/                   no sign-in (project "public")
  smoke/                    signed-in pages (projects "chromium" and, for @mobile, "mobile")
```

- **Projects:** `public` (no sign-in), `chromium` (desktop) and `mobile` (Pixel 7, only
  tests tagged `@mobile`).
- **Sign-in:** each worker signs in once through the real login page and keeps that tab;
  tests move between pages with `app.open(path)`, inside the app, without reloading. Why: the
  refresh token is single-use (it rotates on every refresh), so a saved session can't be
  shared between parallel tests, and the backend allows only 10 sign-ins and 30 refreshes a
  minute per IP. Keep `workers` at 4 or less for the same reason.
- **On failure** a trace, screenshot and video are kept in `test-results/`; open the trace
  with `npx playwright show-trace <file>` or from the HTML report.

## Writing tests

- Signed-in tests: `import { test, expect } from '../support/fixtures'` and use `app`.
- Find elements the way people do: `getByRole`, `getByLabel`, `getByText` (the app's
  buttons and fields have accessible names).
- Tag fast checks `@smoke`, phone-width checks `@mobile`.
- Add new routes to `tests/support/constants.ts`.
