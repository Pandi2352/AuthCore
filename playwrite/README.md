# AuthCore — browser tests (Playwright)

End-to-end tests that drive the real AuthCore frontend in a browser.
Playwright **1.65.1** (pinned), Chromium, TypeScript.

## Setup (once)

```bash
cd playwrite
npm install
npm run install:browsers      # downloads Chromium for Playwright
cp .env.example .env          # then fill it in
```

`.env`:

| Variable | What |
| --- | --- |
| `PW_BASE_URL` | The frontend to test (default `http://localhost:5173`, the Vite dev server) |
| `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD` | An ADMIN account on that environment |

> Prefer a **test environment** (its own database, backend started with
> `MAIL_TRANSPORT=outbox`) over your dev data: tests sign in, and later tests will create
> and change records. `.env` is git-ignored.

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
`reports/` (git-ignored; newest 50, change with `PW_DASHBOARD_KEEP`). Runs started
from the command line show up too. Pages:

| Page | What it shows |
| --- | --- |
| Overview | Latest run banner and counts, results per project, pass-rate / results / run-time trends, problems, slowest, flakiest and most failing tests |
| Runs | Every kept run: filter, open, download (JSON), delete, clear history |
| Run | Every test (search, filter by result/project/file/tag, sort), problems with screenshots, timeline per worker, by project/file/tag, run output and errors, environment and settings; export CSV / JSON, copy problems as Markdown, re-run, re-run failed |
| Test (popup) | Overview, errors with code and stack, steps tree, evidence (screenshots, video, trace → Trace Viewer, page snapshot, browser console, failed API calls), every try, output, history across runs |
| Tests | Every test in the code with last result, recent runs, pass rate, flaky count, average time; run one test |
| Run tests | Quick picks, projects, tags, files, name filters, workers, retries, repeat, stop-after, headed, traces, failed-only; live progress and output; stop |
| Setup | App reachable?, test account set?, versions, storage, commands |

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
