import {
  HttpStatus,
  Injectable,
  Logger,
  type StreamableFile,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { ErrorCode } from '@common/constants/error-codes.constants';
import { AppException } from '@common/exceptions/app.exception';
import type { AuthContext } from '@common/interfaces/auth-context.interface';
import { csvCell } from '@common/utils/csv.util';
import { generateUuid } from '@common/utils/uuid.util';
import { FilePurpose } from '@modules/files/enums/file.enum';
import { FilesService } from '@modules/files/services/files.service';
import { UserAttributeValuesService } from '@modules/user-schema/services/user-attribute-values.service';
import { UserStatus } from '@modules/users/enums/user-status.enum';
import { UsersService } from '@modules/users/users.service';

import {
  REPORT_MAX_ROWS,
  REPORT_PAGE_SIZE,
  REPORT_TTL_DAYS,
  REPORTS_KEPT_PER_USER,
} from '../constants/user-admin.constants';
import type {
  AdminUserListQueryDto,
  UserReportDto,
} from '../dto/admin-user.dto';
import { UserReport } from '../schemas/user-report.schema';
import { UserAdminService } from './user-admin.service';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Filters worth remembering on a report (no paging). */
function filtersOf(query: AdminUserListQueryDto): Record<string, unknown> {
  const picked: Record<string, unknown> = {
    search: query.search,
    status: query.status,
    role: query.role,
    groupId: query.groupId,
    activity: query.activity,
    source: query.source,
    isEmailVerified: query.isEmailVerified,
    attr: query.attr,
  };
  return Object.fromEntries(
    Object.entries(picked).filter(
      ([, v]) =>
        v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0),
    ),
  );
}

/**
 * "Generate report" on the user search page: the users matching the current filters as a CSV,
 * built in the background and stored as a private file; listed under "Downloads" for
 * REPORT_TTL_DAYS.
 */
@Injectable()
export class UserReportsService {
  private readonly logger = new Logger(UserReportsService.name);

  constructor(
    @InjectModel(UserReport.name)
    private readonly reportModel: Model<UserReport>,
    private readonly userAdminService: UserAdminService,
    private readonly usersService: UsersService,
    private readonly attributeValuesService: UserAttributeValuesService,
    private readonly filesService: FilesService,
  ) {}

  async create(
    query: AdminUserListQueryDto,
    auth: AuthContext,
  ): Promise<UserReportDto> {
    await this.removeExpired(auth.userId);
    const stamp = new Date()
      .toISOString()
      .slice(0, 16)
      .replace('T', '-')
      .replace(':', '');
    const report = await this.reportModel.create({
      _id: generateUuid(),
      requestedBy: auth.userId,
      status: 'PENDING',
      format: 'CSV',
      fileName: `users-${stamp}.csv`,
      filters: filtersOf(query),
      expiresAt: new Date(Date.now() + REPORT_TTL_DAYS * DAY_MS),
    });
    // Built after the response; the page polls GET /admin/users/reports.
    setImmediate(() => void this.generate(report._id, query, auth));
    // Re-read (lean): the schema's toObject transform drops _id.
    const saved = await this.reportModel.findById(report._id).lean();
    return toDto(saved ?? report.toObject());
  }

  async list(auth: AuthContext): Promise<UserReportDto[]> {
    await this.removeExpired(auth.userId);
    const reports = await this.reportModel
      .find({ requestedBy: auth.userId })
      .sort({ createdAt: -1 })
      .limit(REPORTS_KEPT_PER_USER)
      .lean();
    return reports.map(toDto);
  }

  async download(
    id: string,
    auth: AuthContext,
  ): Promise<{ report: UserReportDto; stream: StreamableFile }> {
    const report = await this.findOwn(id, auth);
    if (report.status !== 'READY' || !report.fileId) {
      throw new AppException(
        HttpStatus.CONFLICT,
        ErrorCode.Conflict,
        report.status === 'FAILED'
          ? 'This report failed; generate it again.'
          : 'This report is still being prepared.',
      );
    }
    const content = await this.filesService.content(report.fileId, auth);
    return { report: toDto(report), stream: content.stream };
  }

  async remove(id: string, auth: AuthContext): Promise<{ id: string }> {
    const report = await this.findOwn(id, auth);
    await this.deleteWithFile(report, auth.userId);
    return { id };
  }

  // ---------------------------------------------------------------- internals

  private async generate(
    id: string,
    query: AdminUserListQueryDto,
    auth: AuthContext,
  ): Promise<void> {
    try {
      const [filter, columns, total] = await Promise.all([
        this.userAdminService.buildFilter(query),
        this.attributeValuesService.exportColumns(),
        this.userAdminService.countMatching(query),
      ]);
      const sort = this.userAdminService.sortOf(query);
      const header = [
        '#',
        'First name',
        'Last name',
        'Email',
        'Username',
        'Status',
        'Activity',
        'Role',
        'Source',
        'Email verified',
        'Last sign-in',
        'Created',
        ...columns.map((c) => c.label),
      ];
      const lines = [header.map(csvCell).join(',')];
      const dormantBefore = this.userAdminService.dormantBefore();
      let rowNumber = 0;
      for (
        let skip = 0;
        skip < Math.min(total, REPORT_MAX_ROWS);
        skip += REPORT_PAGE_SIZE
      ) {
        const users = await this.usersService.listForExport(
          filter,
          sort,
          skip,
          Math.min(REPORT_PAGE_SIZE, REPORT_MAX_ROWS - skip),
        );
        for (const u of users) {
          rowNumber += 1;
          const activity =
            u.status !== UserStatus.Active
              ? 'Inactive'
              : u.lastLoginAt && new Date(u.lastLoginAt) >= dormantBefore
                ? 'Active'
                : 'Dormant';
          lines.push(
            [
              rowNumber,
              u.firstName,
              u.lastName,
              u.email,
              u.username,
              u.status,
              activity,
              u.role,
              u.source,
              u.isEmailVerified ? 'Yes' : 'No',
              u.lastLoginAt,
              u.createdAt,
              ...columns.map((c) => u.attributes[c.name]),
            ]
              .map(csvCell)
              .join(','),
          );
        }
        if (users.length === 0) {
          break;
        }
      }
      // BOM: Excel opens the UTF-8 file with the right characters.
      const buffer = Buffer.from(`\uFEFF${lines.join('\r\n')}\r\n`, 'utf8');
      const current = await this.reportModel.findById(id).lean();
      if (!current) {
        return;
      } // deleted meanwhile
      const file = await this.filesService.upload(
        { originalname: current.fileName, size: buffer.length, buffer },
        FilePurpose.Report,
        auth.userId,
        auth.userId,
      );
      await this.reportModel.updateOne(
        { _id: id },
        {
          $set: {
            status: 'READY',
            fileId: file.id,
            fileSize: buffer.length,
            rowCount: rowNumber,
            isTruncated: total > REPORT_MAX_ROWS,
            completedAt: new Date(),
          },
        },
      );
      this.logger.log({
        message: 'User report ready',
        reportId: id,
        rows: rowNumber,
        userId: auth.userId,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'The report could not be generated';
      await this.reportModel.updateOne(
        { _id: id },
        {
          $set: {
            status: 'FAILED',
            error: message.slice(0, 300),
            completedAt: new Date(),
          },
        },
      );
      this.logger.error(
        { message: 'User report failed', reportId: id, userId: auth.userId },
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private async findOwn(id: string, auth: AuthContext): Promise<UserReport> {
    const report = await this.reportModel
      .findOne({ _id: id, requestedBy: auth.userId })
      .lean();
    if (!report) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.NotFound,
        'Report not found',
      );
    }
    return report;
  }

  private async deleteWithFile(
    report: UserReport,
    userId: string,
  ): Promise<void> {
    if (report.fileId) {
      try {
        await this.filesService.remove(report.fileId, {
          userId,
          sessionId: '',
          tokenId: '',
          role: '',
        });
      } catch {
        // The file may already be gone; the report record is removed anyway.
      }
    }
    await this.reportModel.deleteOne({ _id: report._id });
  }

  /** Expired reports (and anything beyond the per-person limit) are cleaned up lazily. */
  private async removeExpired(userId: string): Promise<void> {
    const stale = await this.reportModel
      .find({ requestedBy: userId, expiresAt: { $lt: new Date() } })
      .lean();
    const extra = await this.reportModel
      .find({ requestedBy: userId })
      .sort({ createdAt: -1 })
      .skip(REPORTS_KEPT_PER_USER)
      .lean();
    for (const report of [...stale, ...extra]) {
      await this.deleteWithFile(report, userId);
    }
  }
}

function toDto(r: UserReport): UserReportDto {
  return {
    id: r._id,
    status: r.status,
    format: r.format,
    fileName: r.fileName,
    rowCount: r.rowCount,
    fileSize: r.fileSize,
    // Mongo drops an empty filters object.
    filters: Object.assign({}, r.filters),
    isTruncated: r.isTruncated,
    error: r.error ?? null,
    createdAt: r.createdAt,
    completedAt: r.completedAt ?? null,
    expiresAt: r.expiresAt,
  };
}
