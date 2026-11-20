import {
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';

import { API_TAGS } from '@common/constants/api-tags.constants';
import {
  ApiErrorResponses,
  ApiPaginatedResponse,
  ApiWrappedResponse,
} from '@common/decorators/api-response.decorator';
import { RequirePermissions } from '@common/decorators/require-permissions.decorator';
import { ResponseMessage } from '@common/decorators/response-message.decorator';
import type { Paginated } from '@common/interfaces/api-response.interface';
import { ParseIdPipe } from '@common/pipes/parse-id.pipe';
import { USER_PERMISSIONS as U } from '@modules/access-control/constants/access-control.constants';
import { CurrentActor } from '@modules/access-control/decorators/current-actor.decorator';
import type { Actor } from '@modules/access-control/interfaces/actor.interface';
import {
  BulkJobDto,
  BulkJobListQueryDto,
  BulkJobStatsDto,
} from '@modules/bulk-jobs/dto/bulk-job.dto';
import { FileUploadInterceptor } from '@modules/files/interceptors/file-upload.interceptor';
import type { IncomingFile } from '@modules/files/services/files.service';

import { AdminUserListQueryDto } from './dto/admin-user.dto';
import {
  BULK_USER_TYPES,
  bulkType,
  BulkUsersService,
} from './services/bulk-users.service';

const TYPE_PARAM = {
  name: 'type',
  enum: BULK_USER_TYPES,
  description: 'create · update · password (reset password)',
};
const FILE_BODY = {
  schema: {
    type: 'object',
    properties: {
      file: {
        type: 'string',
        format: 'binary',
        description: 'CSV or Excel (.xlsx), up to 1000 rows',
      },
    },
    required: ['file'],
  },
};

/** Sends a CSV as a download. */
function sendCsv(
  response: Response,
  fileName: string,
  csv: string,
): StreamableFile {
  response.setHeader('Content-Type', 'text/csv; charset=utf-8');
  response.setHeader(
    'Content-Disposition',
    `attachment; filename="${fileName}"`,
  );
  response.setHeader('Cache-Control', 'no-store');
  return new StreamableFile(Buffer.from(csv, 'utf8'));
}

/**
 * Users → Bulk user operations: create users, update users and reset passwords from a CSV /
 * Excel file (up to 1000 rows). Every route needs USER_READ; templates, exports and uploads
 * also need the operation's permission (USER_CREATE / USER_UPDATE / USER_PASSWORD_MANAGE).
 */
@ApiTags(API_TAGS.UserAdmin.name)
@ApiBearerAuth('access-token')
@Controller('admin/users/bulk')
export class BulkUsersController {
  constructor(private readonly bulkUsers: BulkUsersService) {}

  @Get(':type/template')
  @RequirePermissions(U.Read)
  @ApiParam(TYPE_PARAM)
  @ApiOperation({
    summary: 'Blank template (CSV)',
    description:
      'Column names for the operation, including the custom profile fields (object groups as `group.field`). ' +
      'groups = group IDs separated by | (GRP-01|GRP-05).',
  })
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN)
  async template(
    @Param('type') type: string,
    @CurrentActor() actor: Actor,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const { fileName, csv } = await this.bulkUsers.template(
      bulkType(type),
      actor,
    );
    return sendCsv(response, fileName, csv);
  }

  @Get(':type/export')
  @RequirePermissions(U.Read)
  @ApiParam({ ...TYPE_PARAM, enum: ['update', 'password'] })
  @ApiOperation({
    summary: 'The matching users as a CSV to edit (update / reset password)',
    description:
      'Same filters as GET /admin/users (search, status, activity, group …); at most 1000 users. ' +
      'Update: edit cells and upload (blank = keep, "-" = empty it). Reset password: action link / set.',
  })
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.FORBIDDEN,
  )
  async export(
    @Param('type') type: string,
    @Query() query: AdminUserListQueryDto,
    @CurrentActor() actor: Actor,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const parsed = bulkType(type);
    const exportType = parsed === 'create' ? 'update' : parsed;
    const { fileName, csv } = await this.bulkUsers.export(
      exportType,
      query,
      actor,
    );
    return sendCsv(response, fileName, csv);
  }

  @Post(':type/upload')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseInterceptors(FileUploadInterceptor)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @RequirePermissions(U.Read)
  @ResponseMessage('File accepted')
  @ApiParam(TYPE_PARAM)
  @ApiConsumes('multipart/form-data')
  @ApiBody(FILE_BODY)
  @ApiOperation({
    summary: 'Upload a filled-in file',
    description:
      'Checks the columns, then runs the rows in the background (202, status PROCESSING). A file with wrong ' +
      'columns is kept as INVALID_TEMPLATE. Poll GET /admin/users/bulk/:type/jobs/:id; results as CSV.',
  })
  @ApiWrappedResponse(BulkJobDto, { status: HttpStatus.ACCEPTED })
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.FORBIDDEN,
    HttpStatus.PAYLOAD_TOO_LARGE,
  )
  upload(
    @Param('type') type: string,
    @UploadedFile() file: IncomingFile | undefined,
    @CurrentActor() actor: Actor,
  ): Promise<BulkJobDto> {
    return this.bulkUsers.upload(bulkType(type), file, actor);
  }

  @Get(':type/stats')
  @RequirePermissions(U.Read)
  @Header('Cache-Control', 'no-store')
  @ResponseMessage('Bulk counts')
  @ApiParam(TYPE_PARAM)
  @ApiOperation({
    summary: 'Counts for the page cards (files, rows, succeeded, failed …)',
  })
  @ApiWrappedResponse(BulkJobStatsDto)
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN)
  stats(@Param('type') type: string): Promise<BulkJobStatsDto> {
    return this.bulkUsers.stats(bulkType(type));
  }

  @Get(':type/jobs')
  @RequirePermissions(U.Read)
  @Header('Cache-Control', 'no-store')
  @ResponseMessage('Bulk history')
  @ApiParam(TYPE_PARAM)
  @ApiOperation({ summary: 'Uploaded files, newest first' })
  @ApiPaginatedResponse(BulkJobDto)
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN)
  jobs(
    @Param('type') type: string,
    @Query() query: BulkJobListQueryDto,
  ): Promise<Paginated<BulkJobDto>> {
    return this.bulkUsers.list(bulkType(type), query);
  }

  @Get(':type/jobs/:id')
  @RequirePermissions(U.Read)
  @Header('Cache-Control', 'no-store')
  @ResponseMessage('Bulk job')
  @ApiParam(TYPE_PARAM)
  @ApiOperation({
    summary: 'One file: status and counts (poll while PROCESSING)',
  })
  @ApiWrappedResponse(BulkJobDto)
  @ApiErrorResponses(
    HttpStatus.UNAUTHORIZED,
    HttpStatus.FORBIDDEN,
    HttpStatus.NOT_FOUND,
  )
  job(
    @Param('type') type: string,
    @Param('id', ParseIdPipe) id: string,
  ): Promise<BulkJobDto> {
    return this.bulkUsers.get(bulkType(type), id);
  }

  @Get(':type/jobs/:id/result')
  @RequirePermissions(U.Read)
  @ApiParam(TYPE_PARAM)
  @ApiOperation({
    summary: 'Results as CSV',
    description:
      'The uploaded rows (passwords left out) with a result and reason column.',
  })
  @ApiErrorResponses(
    HttpStatus.UNAUTHORIZED,
    HttpStatus.FORBIDDEN,
    HttpStatus.NOT_FOUND,
  )
  async result(
    @Param('type') type: string,
    @Param('id', ParseIdPipe) id: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const { fileName, csv } = await this.bulkUsers.result(bulkType(type), id);
    return sendCsv(response, fileName, csv);
  }
}
