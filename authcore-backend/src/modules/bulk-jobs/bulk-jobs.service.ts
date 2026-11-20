import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { ErrorCode } from '@common/constants/error-codes.constants';
import { AppException } from '@common/exceptions/app.exception';
import type { Paginated } from '@common/interfaces/api-response.interface';
import { toCsv } from '@common/utils/csv.util';
import { normalizePagination, paginate } from '@common/utils/pagination.util';
import { containsPattern } from '@common/utils/query.util';
import { readTableFile, TableFileError } from '@common/utils/table-file.util';
import { generateUuid } from '@common/utils/uuid.util';

import type { BulkJobDto, BulkJobStatsDto } from './dto/bulk-job.dto';
import {
  BulkJob,
  type BulkRowResult,
  type BulkRowStatus,
} from './schemas/bulk-job.schema';

/** What a row handler returns; throwing marks the row as an error (the message is shown). */
export interface BulkRowOutcome {
  status: Extract<BulkRowStatus, 'SUCCESS' | 'SKIPPED'>;
  message: string;
}

/**
 * One kind of bulk job (create users, update users …). The runner checks the columns, runs
 * `processRow` for every row in order and keeps the results; the kind only knows one row.
 */
export interface BulkJobDefinition<Context = unknown> {
  kind: string;
  /** Rows per file. */
  maxRows: number;
  /** Must be present (lower case). */
  requiredColumns: readonly string[];
  /** Every column the file may have (required ones included); others reject the file. */
  allowedColumns: readonly string[];
  /** Never stored or echoed in results (passwords). */
  secretColumns?: readonly string[];
  /** Column that names the row in results (e.g. "email"). */
  keyColumn: string;
  /** Once per file, before the rows (e.g. load groups by code). */
  prepare?: () => Promise<Context>;
  processRow: (
    values: Record<string, string>,
    context: Context,
  ) => Promise<BulkRowOutcome>;
}

const PROGRESS_EVERY = 20;
const STATUS_LABEL: Record<BulkRowStatus, string> = {
  SUCCESS: 'Succeeded',
  SKIPPED: 'Skipped',
  ERROR: 'Failed',
};

/**
 * Runs uploaded CSV / Excel files row by row in the background and keeps their history and
 * results (any feature can use it: give it a definition). Results download as CSV.
 */
@Injectable()
export class BulkJobsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(BulkJobsService.name);

  constructor(
    @InjectModel(BulkJob.name) private readonly jobModel: Model<BulkJob>,
  ) {}

  /** A job still "running" after a restart was cut off: say so. */
  async onApplicationBootstrap(): Promise<void> {
    const result = await this.jobModel.updateMany(
      { status: 'PROCESSING' },
      {
        $set: {
          status: 'FAILED',
          message:
            'Stopped: the server restarted while it ran. Upload the remaining rows again.',
          finishedAt: new Date(),
        },
      },
    );
    if (result.modifiedCount > 0) {
      this.logger.warn({
        message: 'Interrupted bulk jobs marked failed',
        count: result.modifiedCount,
      });
    }
  }

  /**
   * Checks the file and starts the job; returns at once (status PROCESSING), or with status
   * INVALID_TEMPLATE when the file can't be used (it still shows in the history).
   */
  async start<Context>(
    definition: BulkJobDefinition<Context>,
    file: { originalname: string; buffer: Buffer },
    uploader: { userId: string; email: string | null },
  ): Promise<BulkJobDto> {
    const base = {
      _id: generateUuid(),
      kind: definition.kind,
      fileName: file.originalname.slice(0, 200),
      uploadedBy: uploader.userId,
      uploadedByEmail: uploader.email,
      startedAt: new Date(),
    };
    const secret = new Set(definition.secretColumns ?? []);
    let table;
    try {
      table = await readTableFile(file, definition.maxRows);
    } catch (error) {
      if (!(error instanceof TableFileError)) {
        throw error;
      }
      return this.rejected(base, error.message, 0);
    }
    const allowed = new Set(definition.allowedColumns);
    const missing = definition.requiredColumns.filter(
      (c) => !table.headers.includes(c),
    );
    const unknown = table.headers.filter((h) => h !== '' && !allowed.has(h));
    if (missing.length > 0 || unknown.length > 0) {
      const parts = [
        missing.length > 0 ? `missing column(s): ${missing.join(', ')}` : '',
        unknown.length > 0 ? `unknown column(s): ${unknown.join(', ')}` : '',
      ].filter(Boolean);
      return this.rejected(
        base,
        `The columns don't match the template — ${parts.join('; ')}. Download the template and keep its column names.`,
        table.rows.length,
      );
    }
    const job = await this.jobModel.create({
      ...base,
      status: 'PROCESSING',
      columns: table.headers.filter((h) => h !== '' && !secret.has(h)),
      totalCount: table.rows.length,
    });
    // Runs after the response; progress is saved as it goes.
    void this.run(job._id, definition, table.rows, secret);
    return toDto(job);
  }

  async list(
    kind: string,
    query: { page?: number; limit?: number; search?: string },
  ): Promise<Paginated<BulkJobDto>> {
    const { page, limit, skip } = normalizePagination(query.page, query.limit);
    const search = query.search ? containsPattern(query.search) : null;
    const filter = {
      kind,
      ...(search
        ? { $or: [{ fileName: search }, { uploadedByEmail: search }] }
        : {}),
    };
    const [jobs, total] = await Promise.all([
      this.jobModel
        .find(filter, { results: 0 })
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.jobModel.countDocuments(filter),
    ]);
    return paginate(jobs.map(toDto), page, limit, total);
  }

  async get(kind: string, id: string): Promise<BulkJobDto> {
    return toDto(await this.findOrThrow(kind, id, false));
  }

  /** The uploaded rows (passwords left out) with each row's result. */
  async resultCsv(
    kind: string,
    id: string,
  ): Promise<{ fileName: string; csv: string }> {
    const job = await this.findOrThrow(kind, id, true);
    const csv = toCsv(
      ['row', ...job.columns, 'result', 'reason'],
      job.results.map((r) => [
        r.rowNumber,
        ...job.columns.map((c) => r.values[c] ?? ''),
        STATUS_LABEL[r.status],
        r.message,
      ]),
    );
    const base = job.fileName.replace(/\.(csv|xlsx)$/i, '');
    return { fileName: `${base}-results.csv`, csv };
  }

  async stats(kind: string): Promise<BulkJobStatsDto> {
    const [totals] = await this.jobModel.aggregate<{
      jobs: number;
      rows: number;
      succeeded: number;
      failed: number;
      invalidFiles: number;
      lastRunAt: Date | null;
    }>([
      { $match: { kind } },
      {
        $group: {
          _id: null,
          jobs: { $sum: 1 },
          rows: { $sum: '$totalCount' },
          succeeded: { $sum: '$successCount' },
          failed: { $sum: '$errorCount' },
          invalidFiles: {
            $sum: { $cond: [{ $eq: ['$status', 'INVALID_TEMPLATE'] }, 1, 0] },
          },
          lastRunAt: { $max: '$startedAt' },
        },
      },
    ]);
    return {
      jobs: totals?.jobs ?? 0,
      rows: totals?.rows ?? 0,
      succeeded: totals?.succeeded ?? 0,
      failed: totals?.failed ?? 0,
      invalidFiles: totals?.invalidFiles ?? 0,
      lastRunAt: totals?.lastRunAt ?? null,
    };
  }

  // ---------------------------------------------------------------- internals

  private async rejected(
    base: Record<string, unknown>,
    message: string,
    rowCount: number,
  ): Promise<BulkJobDto> {
    const job = await this.jobModel.create({
      ...base,
      status: 'INVALID_TEMPLATE',
      message,
      totalCount: rowCount,
      errorCount: rowCount,
      finishedAt: null,
    });
    return toDto(job);
  }

  private async run<Context>(
    jobId: string,
    definition: BulkJobDefinition<Context>,
    rows: Array<{ rowNumber: number; values: Record<string, string> }>,
    secret: ReadonlySet<string>,
  ): Promise<void> {
    const results: BulkRowResult[] = [];
    const counts = { successCount: 0, skippedCount: 0, errorCount: 0 };
    const save = (extra: Record<string, unknown> = {}) =>
      this.jobModel.updateOne(
        { _id: jobId },
        { $set: { ...counts, results, ...extra } },
      );
    try {
      const context = definition.prepare
        ? await definition.prepare()
        : (undefined as Context);
      for (const row of rows) {
        const key = row.values[definition.keyColumn] ?? '';
        const stored = Object.fromEntries(
          Object.entries(row.values).filter(([column]) => !secret.has(column)),
        );
        let status: BulkRowStatus;
        let message: string;
        try {
          // One row at a time, in file order (later rows may depend on earlier ones).

          const outcome = await definition.processRow(row.values, context);
          status = outcome.status;
          message = outcome.message;
        } catch (error) {
          status = 'ERROR';
          message = errorText(error);
        }
        results.push({
          rowNumber: row.rowNumber,
          key,
          status,
          message,
          values: stored,
        });
        counts[
          status === 'SUCCESS'
            ? 'successCount'
            : status === 'SKIPPED'
              ? 'skippedCount'
              : 'errorCount'
        ]++;
        if (results.length % PROGRESS_EVERY === 0) {
          await save();
        }
      }
      await save({ status: 'DONE', finishedAt: new Date() });
    } catch (error) {
      this.logger.error(
        { message: 'Bulk job stopped', jobId, kind: definition.kind },
        error instanceof Error ? error.stack : undefined,
      );
      await save({
        status: 'FAILED',
        message: `Stopped after ${String(results.length)} row(s): ${errorText(error)}`,
        finishedAt: new Date(),
      }).catch(() => undefined);
    }
  }

  private async findOrThrow(
    kind: string,
    id: string,
    withResults: boolean,
  ): Promise<BulkJob> {
    const job = await this.jobModel
      .findOne({ _id: id, kind }, withResults ? {} : { results: 0 })
      .lean();
    if (!job) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.NotFound,
        'Bulk job not found',
      );
    }
    return job;
  }
}

function toDto(job: BulkJob): BulkJobDto {
  return {
    id: job._id,
    kind: job.kind,
    fileName: job.fileName,
    uploadedBy: job.uploadedBy,
    uploadedByEmail: job.uploadedByEmail,
    status: job.status,
    message: job.message,
    totalCount: job.totalCount,
    successCount: job.successCount,
    skippedCount: job.skippedCount,
    errorCount: job.errorCount,
    processedCount: job.successCount + job.skippedCount + job.errorCount,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
  };
}

/** A thrown error as one line for the results file ("email: An account … exists"). */
export function errorText(error: unknown): string {
  if (error instanceof AppException && error.errors.length > 0) {
    return error.errors
      .map((e) => (e.field ? `${e.field}: ${e.message}` : e.message))
      .join('; ');
  }
  if (error instanceof HttpException) {
    const response = error.getResponse();
    if (typeof response === 'object' && 'message' in response) {
      const message = response.message;
      return Array.isArray(message) ? message.join('; ') : String(message);
    }
    return error.message;
  }
  return error instanceof Error ? error.message : 'Unexpected error';
}
