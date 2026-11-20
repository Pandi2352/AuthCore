import {
  CircleCheck,
  CircleX,
  Download,
  FileSpreadsheet,
  FileWarning,
  History,
  Rows3,
  Upload,
  UploadCloud,
} from 'lucide-react';
import { memo, useCallback, useEffect, useState, type ReactNode } from 'react';

import { FileDropzone, type RejectedFile } from '@/components/common/FileDropzone';
import { SearchInput } from '@/components/common/SearchInput';
import { StatCard } from '@/components/common/StatCard';
import { StepList, type Step } from '@/components/common/StepList';
import { notifyError, notifySuccess } from '@/components/feedback';
import {
  Badge,
  Button,
  Progress,
  Select,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui';
import { isAbortError } from '@/lib/api';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';

import { adminUsersApi, toApiFilters } from '../api/admin-users.api';
import { bulkUsersApi } from '../api/bulk-users.api';
import type { BulkJob, BulkJobStats, BulkUserType } from '../types/bulk-users.types';
import { downloadResults, JOB_STATUS } from './bulk-job-meta';
import { BulkHistoryTable } from './BulkHistoryTable';
import { STATUS_LABEL } from './user-labels';

const MAX_ROWS = 1000;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ACCEPT = ['.csv', '.xlsx', 'text/csv'];
const POLL_MS = 1500;

interface ColumnHelp {
  column: string;
  required?: boolean;
  text: string;
}

/** What each column means, per operation (shown in step 2). */
const COLUMNS: Record<BulkUserType, ColumnHelp[]> = {
  create: [
    { column: 'email', required: true, text: 'Sign-in email; must not be in use yet' },
    { column: 'given_name', required: true, text: 'First name' },
    { column: 'family_name', text: 'Last name' },
    { column: 'username', text: 'Optional sign-in name (lowercase)' },
    { column: 'password', required: true, text: 'Initial password; must meet the password policy' },
    { column: 'must_change_password', text: 'true / false — default true' },
    { column: 'email_verified', text: 'true / false — default true' },
    { column: 'send_welcome_email', text: 'true / false — default false' },
    { column: 'groups', text: 'Group IDs separated by | — e.g. GRP-01|GRP-05' },
  ],
  update: [
    { column: 'email', required: true, text: 'Finds the user (it is not changed)' },
    { column: 'given_name', text: 'First name' },
    { column: 'family_name', text: 'Last name' },
    { column: 'username', text: 'Sign-in name (lowercase)' },
    { column: 'email_verified', text: 'true / false' },
    { column: 'status', text: 'ACTIVE, INACTIVE, SUSPENDED or BANNED' },
    { column: 'groups', text: 'Every group the user should be in (GRP-01|GRP-05); - = none' },
  ],
  password: [
    { column: 'email', required: true, text: 'Finds the user' },
    { column: 'given_name, family_name', text: 'For reading only — ignored' },
    { column: 'action', text: 'link = email a reset link (default) · set = use new_password' },
    { column: 'new_password', text: 'For set: must meet the password policy' },
    { column: 'must_change_password', text: 'For set: true / false — default true' },
    { column: 'notify', text: 'For set: email the user that it changed — default true' },
  ],
};

const NOTES: Record<BulkUserType, string> = {
  create:
    'The template also has one column per custom profile field (e.g. phone_number, address.street). Keep the column names as they are.',
  update:
    'A blank cell leaves the value as it is; a single - empties it. Custom profile fields are columns too.',
  password:
    'Passwords are never stored with the results. Rows with action link email a reset link that expires.',
};

// ---------------------------------------------------------------- pieces

function ColumnGuide({ type }: { type: BulkUserType }) {
  return (
    <div className="space-y-2">
      <div className="scrollbar-slim overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[34rem] border-collapse text-sm">
          <caption className="sr-only">Columns</caption>
          <thead>
            <tr>
              {['Column', 'What to put in it'].map((h) => (
                <th
                  key={h}
                  scope="col"
                  className="border-b border-border bg-muted px-3 py-2 text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COLUMNS[type].map((c) => (
              <tr key={c.column} className="even:bg-muted/60">
                <td className="border-b border-border px-3 py-2 whitespace-nowrap">
                  <code className="font-mono text-xs text-primary">{c.column}</code>
                  {c.required && <span className="text-danger"> *</span>}
                </td>
                <td className="border-b border-border px-3 py-2 text-muted-foreground">{c.text}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">Note:</span> {NOTES[type]}
      </p>
    </div>
  );
}

/** Update / reset password, step 1: which users (same filters as Search users). */
function UserChooser({
  filters,
  onChange,
  count,
}: {
  filters: { search: string; status: string; group: string };
  onChange: (next: { search: string; status: string; group: string }) => void;
  count: number | null;
}) {
  const [groups, setGroups] = useState<Array<{ value: string; label: string }>>([]);
  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const list = await adminUsersApi.groups(controller.signal);
        setGroups(list.map((g) => ({ value: g.id, label: g.label })));
      } catch {
        // No group filter without GROUP_READ.
      }
    };
    void load();
    return () => controller.abort();
  }, []);
  const tooMany = count !== null && count > MAX_ROWS;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full sm:w-80">
          <SearchInput
            size="toolbar"
            value={filters.search}
            onSearch={(search) => onChange({ ...filters, search })}
            placeholder="Search by name, email or employee ID"
            aria-label="Search users"
          />
        </div>
        <div className="w-full sm:w-44">
          <Select
            size="toolbar"
            aria-label="Status"
            value={filters.status}
            options={[
              { value: '', label: 'Any status' },
              ...Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label })),
            ]}
            onValueChange={(status) => onChange({ ...filters, status: status ?? '' })}
          />
        </div>
        {groups.length > 0 && (
          <div className="w-full sm:w-52">
            <Select
              size="toolbar"
              aria-label="Group"
              value={filters.group}
              options={[{ value: '', label: 'Any group' }, ...groups]}
              onValueChange={(group) => onChange({ ...filters, group: group ?? '' })}
            />
          </div>
        )}
      </div>
      <p
        className={cn('text-sm', tooMany ? 'text-danger' : 'text-muted-foreground')}
        aria-live="polite"
      >
        {count === null
          ? 'Counting users…'
          : tooMany
            ? `${formatNumber(count)} users match — narrow it to ${formatNumber(MAX_ROWS)} or fewer`
            : `${formatNumber(count)} ${count === 1 ? 'user matches' : 'users match'}`}
      </p>
    </div>
  );
}

/** The file just uploaded: live progress, then counts and the results download. */
function JobProgress({ type, job }: { type: BulkUserType; job: BulkJob }) {
  const meta = JOB_STATUS[job.status];
  const done = job.status !== 'PROCESSING';
  const percent = job.totalCount > 0 ? Math.round((job.processedCount / job.totalCount) * 100) : 0;
  return (
    <section
      aria-label="Upload progress"
      aria-live="polite"
      className={cn(
        'space-y-3 rounded-md border p-4',
        job.status === 'INVALID_TEMPLATE'
          ? 'border-danger/40 bg-danger-soft/30'
          : done
            ? 'border-success/40 bg-success-soft/30'
            : 'border-info/40 bg-info-soft/30',
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <FileSpreadsheet className="size-4 text-success" aria-hidden="true" />
        <span className="min-w-0 truncate font-medium text-foreground">{job.fileName}</span>
        <Badge size="sm" tone={meta.tone}>
          {meta.label}
        </Badge>
      </div>
      {job.status === 'INVALID_TEMPLATE' ? (
        <p className="text-sm text-danger">{job.message}</p>
      ) : (
        <>
          <Progress
            value={percent}
            tone={job.errorCount > 0 && done ? 'warning' : done ? 'success' : 'primary'}
            label="Rows processed"
            size="md"
          />
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <span className="text-foreground">
              {formatNumber(job.processedCount)} of {formatNumber(job.totalCount)} rows
            </span>
            <span className="text-success">{formatNumber(job.successCount)} succeeded</span>
            {job.skippedCount > 0 && (
              <span className="text-muted-foreground">
                {formatNumber(job.skippedCount)} unchanged
              </span>
            )}
            <span className={job.errorCount > 0 ? 'text-danger' : 'text-muted-foreground'}>
              {formatNumber(job.errorCount)} failed
            </span>
          </p>
          {job.message && <p className="text-sm text-warning">{job.message}</p>}
          {done && (
            <Button
              size="sm"
              variant="outline"
              leftIcon={<Download />}
              onClick={() => void downloadResults(type, job)}
            >
              Download results
            </Button>
          )}
        </>
      )}
    </section>
  );
}

/** The four counts for one operation. */
const BulkStatCards = memo(function BulkStatCards({ stats: s }: { stats: BulkJobStats | null }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        tone="primary"
        pattern="rings"
        icon={FileSpreadsheet}
        label="Files uploaded"
        value={s?.jobs ?? null}
        hint={
          s && s.invalidFiles > 0 ? `${s.invalidFiles} rejected (wrong columns)` : 'Every upload'
        }
      />
      <StatCard
        tone="info"
        pattern="grid"
        icon={Rows3}
        label="Rows"
        value={s?.rows ?? null}
        hint="In all files"
      />
      <StatCard
        tone="success"
        pattern="waves"
        icon={CircleCheck}
        label="Succeeded"
        value={s?.succeeded ?? null}
        hint="Rows applied"
      />
      <StatCard
        tone="danger"
        pattern="stripes"
        icon={CircleX}
        label="Failed"
        value={s?.failed ?? null}
        hint="See the results file for why"
      />
    </div>
  );
});

// ---------------------------------------------------------------- the panel

const TITLES: Record<BulkUserType, { upload: string }> = {
  create: { upload: 'Upload the filled-in file' },
  update: { upload: 'Edit the file and upload it' },
  password: { upload: 'Upload the file' },
};

/** One operation (create / update / reset password): counts, Upload steps and History. */
export function BulkOperationPanel({ type }: { type: BulkUserType }) {
  const [tab, setTab] = useState<'upload' | 'history'>('upload');
  const [statsState, setStats] = useState<{ key: string; value: BulkJobStats } | null>(null);
  const [statsKey, setStatsKey] = useState(0);
  const [historyKey, setHistoryKey] = useState(0);
  const [files, setFiles] = useState<File[]>([]);
  const [uploadPercent, setUploadPercent] = useState<number | null>(null);
  const [job, setJob] = useState<BulkJob | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [filters, setFilters] = useState({ search: '', status: '', group: '' });
  const [count, setCount] = useState<{ key: string; value: number } | null>(null);
  const filterKey = JSON.stringify(filters);

  // Counts.
  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        setStats({
          key: `${type}#${statsKey}`,
          value: await bulkUsersApi.stats(type, controller.signal),
        });
      } catch (error) {
        if (!isAbortError(error)) notifyError(error, 'Could not load the counts');
      }
    };
    void load();
    return () => controller.abort();
  }, [type, statsKey]);

  // Update / reset password: how many users the filters pick.
  const needsUsers = type !== 'create';
  useEffect(() => {
    if (!needsUsers) return;
    const controller = new AbortController();
    const current = JSON.parse(filterKey) as typeof filters;
    const load = async () => {
      try {
        const page = await adminUsersApi.list(
          {
            page: 1,
            pageSize: 1,
            search: current.search,
            sort: [],
            filters: {
              ...(current.status ? { status: [current.status] } : {}),
              ...(current.group ? { group: [current.group] } : {}),
            },
          },
          controller.signal,
        );
        setCount({ key: filterKey, value: page.total });
      } catch (error) {
        if (!isAbortError(error)) setCount({ key: filterKey, value: 0 });
      }
    };
    void load();
    return () => controller.abort();
  }, [filterKey, needsUsers]);

  // The uploaded file: poll until it finishes, then refresh counts and history.
  const jobId = job?.id;
  const isRunning = job?.status === 'PROCESSING';
  useEffect(() => {
    if (!jobId || !isRunning) return;
    const timer = window.setInterval(() => {
      void (async () => {
        try {
          const next = await bulkUsersApi.job(type, jobId);
          setJob(next);
          if (next.status !== 'PROCESSING') {
            setStatsKey((n) => n + 1);
            setHistoryKey((n) => n + 1);
            if (next.errorCount > 0) {
              notifyError(
                new Error(`${next.errorCount} row(s) failed — download the results to see why`),
                `“${next.fileName}” finished with errors`,
              );
            } else {
              notifySuccess(`“${next.fileName}” finished`, {
                description: `${next.successCount} succeeded.`,
              });
            }
          }
        } catch {
          // Try again on the next tick.
        }
      })();
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [jobId, isRunning, type]);

  const refreshCounts = useCallback(() => setStatsKey((n) => n + 1), []);
  const stats = statsState?.value ?? null;

  const downloadStart = async () => {
    setIsDownloading(true);
    try {
      if (type === 'create') {
        await bulkUsersApi.template('create');
      } else {
        await bulkUsersApi.export(
          type,
          toApiFilters({
            search: filters.search,
            sort: [],
            filters: {
              ...(filters.status ? { status: [filters.status] } : {}),
              ...(filters.group ? { group: [filters.group] } : {}),
            },
          }),
        );
      }
    } catch (err) {
      notifyError(err, 'Could not download the file');
    } finally {
      setIsDownloading(false);
    }
  };

  const upload = async () => {
    const file = files[0];
    if (!file) return;
    setUploadPercent(0);
    try {
      const started = await bulkUsersApi.upload(type, file, {
        onProgress: (p) => setUploadPercent(p.percent),
      });
      setJob(started);
      setFiles([]);
      setHistoryKey((n) => n + 1);
      setStatsKey((n) => n + 1);
      if (started.status === 'INVALID_TEMPLATE') {
        notifyError(new Error(started.message ?? 'Wrong columns'), 'The file was rejected');
      } else {
        notifySuccess(`“${started.fileName}” uploaded`, {
          description: `${started.totalCount} rows are being processed.`,
        });
      }
    } catch (err) {
      notifyError(err, 'Could not upload the file');
    } finally {
      setUploadPercent(null);
    }
  };

  const userCount = count?.key === filterKey ? count.value : null;
  const canExport = userCount !== null && userCount > 0 && userCount <= MAX_ROWS;

  const downloadButton = (label: ReactNode, disabled = false) => (
    <Button
      variant="outline"
      size="toolbar"
      leftIcon={<Download />}
      isLoading={isDownloading}
      disabled={disabled}
      onClick={() => void downloadStart()}
    >
      {label}
    </Button>
  );

  const uploadStep: Step = {
    title: TITLES[type].upload,
    required: true,
    description: `CSV or Excel (.xlsx), up to ${formatNumber(MAX_ROWS)} users and 5 MB.`,
    content: (
      <div className="space-y-3">
        <FileDropzone
          files={files}
          onFilesChange={setFiles}
          onReject={(rejected: RejectedFile[]) => {
            const first = rejected[0];
            if (first) notifyError(new Error(first.reason), `Can't use ${first.file.name}`);
          }}
          accept={ACCEPT}
          maxSize={MAX_FILE_BYTES}
          label="Drop a CSV or Excel file here, or choose one"
          hint=".csv or .xlsx"
          disabled={uploadPercent !== null || isRunning}
        />
        {uploadPercent !== null && (
          <Progress
            value={uploadPercent}
            label="Uploading"
            showValue
            size="sm"
            className="max-w-sm"
          />
        )}
        <Button
          size="toolbar"
          leftIcon={<UploadCloud />}
          disabled={files.length === 0 || isRunning}
          isLoading={uploadPercent !== null}
          onClick={() => void upload()}
        >
          Upload and run
        </Button>
        {job && <JobProgress type={type} job={job} />}
      </div>
    ),
  };

  const steps: Step[] =
    type === 'create'
      ? [
          {
            title: 'Download the template',
            description: 'A CSV with every column, including your custom profile fields.',
            content: downloadButton('Download blank CSV template'),
          },
          {
            title: 'Add one row per user',
            description: 'Fill it in with Excel, Google Sheets or any editor.',
            content: <ColumnGuide type="create" />,
          },
          uploadStep,
        ]
      : [
          {
            title: 'Choose the users',
            description: 'Same filters as Search users.',
            content: <UserChooser filters={filters} onChange={setFilters} count={userCount} />,
          },
          {
            title: 'Download them as a CSV',
            description:
              type === 'update'
                ? 'Their current details, ready to edit.'
                : 'One row per user, set to email a reset link.',
            content: (
              <div className="space-y-3">
                {downloadButton(
                  userCount === null
                    ? 'Download users in a CSV file'
                    : `Download ${formatNumber(Math.min(userCount, MAX_ROWS))} users in a CSV file`,
                  !canExport,
                )}
                <ColumnGuide type={type} />
              </div>
            ),
          },
          uploadStep,
        ];

  return (
    <div className="space-y-6">
      <BulkStatCards stats={stats} />
      <Tabs value={tab} onValueChange={(value) => setTab(value as 'upload' | 'history')}>
        <TabsList>
          <TabsTrigger value="upload">
            <Upload className="size-4" aria-hidden="true" />
            Upload
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="size-4" aria-hidden="true" />
            History
            {stats && (
              <Badge size="sm" tone="neutral" className="tabular-nums">
                {stats.jobs}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="upload" className="pt-4">
          <section
            aria-label="Upload"
            className="rounded-md border border-border bg-surface p-card"
          >
            <StepList steps={steps} />
          </section>
        </TabsContent>
        <TabsContent value="history" className="pt-4">
          {tab === 'history' && (
            <BulkHistoryTable type={type} reloadKey={historyKey} onRefresh={refreshCounts} />
          )}
          {stats && stats.invalidFiles > 0 && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <FileWarning className="size-3.5" aria-hidden="true" />
              Hover an “Invalid template” status to see why the file was rejected.
            </p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
