import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type {
  FullConfig,
  FullResult,
  Location,
  Reporter,
  Suite,
  TestCase,
  TestError,
  TestResult,
  TestStep,
} from '@playwright/test/reporter';

/**
 * Records every run in full for the test dashboard (dashboard/server.mjs):
 *   reports/runs/<runId>/run.json      everything about the run, every test and attempt
 *   reports/runs/<runId>/attachments/  screenshots, videos, traces, logs (copied, because
 *                                      test-results/ is wiped at the start of the next run)
 *   reports/index.json                 one summary line per run, newest first
 *   reports/live.json                  progress while a run is going
 */

const ROOT = path.resolve(import.meta.dirname, '..');
const REPORTS = path.join(ROOT, 'reports');
const RUNS = path.join(REPORTS, 'runs');
const KEEP = Math.max(1, Number(process.env.PW_DASHBOARD_KEEP ?? 50));
const MAX_STEPS = 800;
const MAX_OUTPUT = 200_000;

// eslint-disable-next-line no-control-regex
const ANSI = /\u001b\[[0-9;]*[A-Za-z]/g;
const clean = (text?: string) => (text ? text.replace(ANSI, '') : undefined);

type State = 'passed' | 'failed' | 'flaky' | 'skipped' | 'timedOut' | 'interrupted';

interface Counts {
  total: number;
  passed: number;
  failed: number;
  flaky: number;
  skipped: number;
  timedOut: number;
  interrupted: number;
}

const emptyCounts = (): Counts => ({
  total: 0,
  passed: 0,
  failed: 0,
  flaky: 0,
  skipped: 0,
  timedOut: 0,
  interrupted: 0,
});

function git(args: string[]): string | null {
  try {
    return execFileSync('git', args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return null;
  }
}

function writeJson(file: string, value: unknown): void {
  // Write then rename, so the dashboard never reads a half-written file.
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(value));
  renameSync(tmp, file);
}

function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

function stateOf(test: TestCase): State {
  const last = test.results.at(-1);
  switch (test.outcome()) {
    case 'flaky':
      return 'flaky';
    case 'skipped':
      return 'skipped';
    case 'expected':
      return 'passed';
    default:
      if (last?.status === 'timedOut') return 'timedOut';
      if (last?.status === 'interrupted') return 'interrupted';
      return 'failed';
  }
}

export default class DashboardReporter implements Reporter {
  private config!: FullConfig;
  private suite!: Suite;
  private runId = '';
  private runDir = '';
  private startedAt = new Date();
  private live = { ...emptyCounts(), done: 0 };
  private running = new Map<string, { title: string; project: string; startedAt: string }>();
  private globalErrors: Array<ReturnType<DashboardReporter['error']>> = [];
  private globalOutput: string[] = [];
  private outputSize = 0;
  private testIndex = new Map<string, number>();

  printsToStdio(): boolean {
    return false;
  }

  onBegin(config: FullConfig, suite: Suite): void {
    this.config = config;
    this.suite = suite;
    this.startedAt = new Date();
    this.runId = this.startedAt.toISOString().replace(/[:.]/g, '-');
    this.runDir = path.join(RUNS, this.runId);
    mkdirSync(path.join(this.runDir, 'attachments'), { recursive: true });
    suite.allTests().forEach((t, i) => this.testIndex.set(t.id, i));
    this.live.total = suite.allTests().length;
    this.writeLive('running');
  }

  onTestBegin(test: TestCase, result: TestResult): void {
    this.running.set(`${test.id}:${result.retry}`, {
      title: test.titlePath().slice(3).join(' › ') || test.title,
      project: test.parent.project()?.name ?? '',
      startedAt: new Date().toISOString(),
    });
    this.writeLive('running');
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    this.running.delete(`${test.id}:${result.retry}`);
    // Count a test once, when its last attempt is done.
    const willRetry =
      result.status !== 'passed' &&
      result.status !== 'skipped' &&
      result.retry < test.retries &&
      result.status !== 'interrupted';
    if (!willRetry) {
      this.live.done++;
      const state = stateOf(test);
      this.live[state]++;
    }
    this.writeLive('running');
  }

  onStdOut(chunk: string | Buffer, test?: TestCase): void {
    if (!test) this.keepOutput(chunk);
  }

  onStdErr(chunk: string | Buffer, test?: TestCase): void {
    if (!test) this.keepOutput(chunk);
  }

  onError(error: TestError): void {
    this.globalErrors.push(this.error(error));
  }

  onEnd(result: FullResult): void {
    const tests = this.suite.allTests().map((test) => this.test(test));
    const counts = emptyCounts();
    for (const t of tests) {
      counts.total++;
      counts[t.state]++;
    }
    const executed = counts.total - counts.skipped;
    const ok = counts.passed + counts.flaky;
    const projects = [...new Set(tests.map((t) => t.project))];
    const summary = {
      id: this.runId,
      label: process.env.PW_RUN_LABEL || null,
      trigger: process.env.PW_RUN_TRIGGER === 'ui' ? 'dashboard' : 'command line',
      status: result.status,
      startedAt: this.startedAt.toISOString(),
      duration: Math.round(result.duration),
      counts,
      passRate: executed > 0 ? Math.round((ok / executed) * 1000) / 10 : null,
      projects,
      branch: git(['rev-parse', '--abbrev-ref', 'HEAD']),
      commit: git(['rev-parse', '--short', 'HEAD']),
      errors: this.globalErrors.length,
    };
    const run = {
      ...summary,
      environment: this.environment(),
      config: this.configInfo(),
      globalErrors: this.globalErrors,
      globalOutput: this.globalOutput.join(''),
      tests,
    };
    writeJson(path.join(this.runDir, 'run.json'), run);

    const index = readJson<Array<typeof summary>>(path.join(REPORTS, 'index.json'), []).filter(
      (r) => r.id !== this.runId && existsSync(path.join(RUNS, r.id, 'run.json')),
    );
    index.unshift(summary);
    for (const old of index.splice(KEEP)) rmSync(path.join(RUNS, old.id), { recursive: true, force: true });
    writeJson(path.join(REPORTS, 'index.json'), index);
    this.running.clear();
    this.writeLive('finished');
  }

  // ---------------------------------------------------------------------------------------

  private writeLive(status: 'running' | 'finished'): void {
    try {
      mkdirSync(REPORTS, { recursive: true });
      writeJson(path.join(REPORTS, 'live.json'), {
        runId: this.runId,
        status,
        startedAt: this.startedAt.toISOString(),
        updatedAt: new Date().toISOString(),
        ...this.live,
        running: [...this.running.values()],
      });
    } catch {
      // Progress is best effort; the final report is what matters.
    }
  }

  private keepOutput(chunk: string | Buffer): void {
    if (this.outputSize > MAX_OUTPUT) return;
    const text = clean(chunk.toString()) ?? '';
    this.outputSize += text.length;
    this.globalOutput.push(text);
  }

  private rel(file?: string): string | undefined {
    return file ? path.relative(ROOT, file).split(path.sep).join('/') : undefined;
  }

  private location(location?: Location) {
    return location
      ? { file: this.rel(location.file), line: location.line, column: location.column }
      : undefined;
  }

  private error(error: TestError): {
    message?: string;
    stack?: string;
    snippet?: string;
    value?: string;
    location?: { file?: string; line: number; column: number };
    cause?: string;
  } {
    return {
      message: clean(error.message),
      stack: clean(error.stack),
      snippet: clean(error.snippet),
      value: clean(error.value),
      location: this.location(error.location),
      cause: clean(error.cause?.message),
    };
  }

  private steps(steps: TestStep[], budget: { left: number }): unknown[] {
    const out: unknown[] = [];
    for (const step of steps) {
      if (budget.left-- <= 0) break;
      out.push({
        title: step.title,
        category: step.category,
        startTime: step.startTime.toISOString(),
        duration: step.duration,
        location: this.location(step.location),
        error: step.error ? clean(step.error.message) : undefined,
        annotations: step.annotations,
        steps: step.steps.length ? this.steps(step.steps, budget) : undefined,
      });
    }
    return out;
  }

  private attachments(test: TestCase, result: TestResult) {
    const index = this.testIndex.get(test.id) ?? 0;
    return result.attachments.map((a, i) => {
      const safe = (name: string) => name.replace(/[^\w.-]+/g, '_').slice(0, 80);
      const base = `${index}-r${result.retry}-${i}-`;
      let file: string | undefined;
      let size = 0;
      try {
        if (a.path && existsSync(a.path)) {
          file = base + safe(path.basename(a.path));
          copyFileSync(a.path, path.join(this.runDir, 'attachments', file));
          size = statSync(a.path).size;
        } else if (a.body) {
          const ext = a.contentType.startsWith('text/')
            ? '.txt'
            : a.contentType === 'application/json'
              ? '.json'
              : a.contentType.startsWith('image/')
                ? `.${a.contentType.split('/')[1]}`
                : '';
          file = base + safe(a.name) + ext;
          writeFileSync(path.join(this.runDir, 'attachments', file), a.body);
          size = a.body.length;
        }
      } catch {
        file = undefined;
      }
      return { name: a.name, contentType: a.contentType, file, size };
    });
  }

  private output(chunks: Array<string | Buffer>): string {
    return (clean(chunks.map((c) => c.toString()).join('')) ?? '').slice(0, MAX_OUTPUT);
  }

  private test(test: TestCase) {
    const project = test.parent.project();
    const titlePath = test.titlePath();
    // titlePath: ['', project, file, ...describe, title]
    const describe = titlePath.slice(3, -1);
    return {
      id: test.id,
      title: test.title,
      describe,
      fullTitle: titlePath.slice(3).join(' › '),
      project: project?.name ?? '',
      file: this.rel(test.location.file),
      line: test.location.line,
      column: test.location.column,
      tags: test.tags,
      annotations: test.annotations,
      expectedStatus: test.expectedStatus,
      outcome: test.outcome(),
      state: stateOf(test),
      retries: test.retries,
      timeout: test.timeout,
      repeatEachIndex: test.repeatEachIndex,
      duration: test.results.reduce((sum, r) => sum + r.duration, 0),
      attempts: test.results.length,
      results: test.results.map((r) => ({
        retry: r.retry,
        status: r.status,
        startTime: r.startTime.toISOString(),
        duration: r.duration,
        workerIndex: r.workerIndex,
        parallelIndex: r.parallelIndex,
        errors: r.errors.map((e) => this.error(e)),
        annotations: r.annotations,
        steps: this.steps(r.steps, { left: MAX_STEPS }),
        attachments: this.attachments(test, r),
        stdout: this.output(r.stdout),
        stderr: this.output(r.stderr),
      })),
    };
  }

  private environment() {
    let playwright = 'unknown';
    try {
      playwright = this.config.version;
    } catch {
      /* older versions */
    }
    return {
      playwright,
      node: process.version,
      os: `${os.type()} ${os.release()} (${os.arch()})`,
      host: os.hostname(),
      cpus: os.cpus().length,
      memoryGb: Math.round(os.totalmem() / 1024 ** 3),
      ci: Boolean(process.env.CI),
      baseURL: process.env.PW_BASE_URL ?? 'http://localhost:5173',
      account: process.env.E2E_ADMIN_EMAIL ?? null,
      command: `playwright ${process.argv.slice(2).join(' ')}`.trim(),
      gitDirty: (git(['status', '--porcelain']) ?? '').split('\n').filter(Boolean).length,
      gitMessage: git(['log', '-1', '--format=%s']),
    };
  }

  private configInfo() {
    const c = this.config;
    return {
      workers: c.workers,
      fullyParallel: c.fullyParallel,
      forbidOnly: c.forbidOnly,
      maxFailures: c.maxFailures,
      globalTimeout: c.globalTimeout,
      shard: c.shard,
      grep: String(c.grep),
      reporters: c.reporter.map(([name]) => this.rel(name) ?? name).map((n) => n.replace(/^\.\.\//, '')),
      projects: c.projects.map((p) => ({
        name: p.name,
        testDir: this.rel(p.testDir),
        timeout: p.timeout,
        retries: p.retries,
        repeatEach: p.repeatEach,
        grep: String(p.grep),
        browser: p.use.browserName ?? 'chromium',
        viewport: p.use.viewport ? `${p.use.viewport.width}×${p.use.viewport.height}` : null,
        isMobile: Boolean(p.use.isMobile),
        trace: typeof p.use.trace === 'string' ? p.use.trace : (p.use.trace?.mode ?? null),
        screenshot:
          typeof p.use.screenshot === 'string' ? p.use.screenshot : (p.use.screenshot?.mode ?? null),
        video: typeof p.use.video === 'string' ? p.use.video : (p.use.video?.mode ?? null),
      })),
    };
  }
}

