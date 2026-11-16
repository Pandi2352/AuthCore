import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
  type StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';

import { API_TAGS } from '@common/constants/api-tags.constants';
import {
  ApiErrorResponses,
  ApiPaginatedResponse,
  ApiStandardErrors,
  ApiWrappedResponse,
} from '@common/decorators/api-response.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { Public } from '@common/decorators/public.decorator';
import { ResponseMessage } from '@common/decorators/response-message.decorator';
import type { Paginated } from '@common/interfaces/api-response.interface';
import type { AuthContext } from '@common/interfaces/auth-context.interface';
import { ParseIdPipe } from '@common/pipes/parse-id.pipe';

import { PUBLIC_CACHE_SECONDS } from './constants/file.constants';
import {
  FileDeletedDto,
  FileListQueryDto,
  FileResponseDto,
  UPLOAD_BODY_SCHEMA,
  UploadFileDto,
} from './dto/file.dto';
import { FileUploadInterceptor } from './interceptors/file-upload.interceptor';
import {
  type FileContent,
  FilesService,
  type IncomingFile,
} from './services/files.service';
import { contentDisposition } from './utils/file-signature.util';

const UPLOAD_THROTTLE = { limit: 20, ttl: 60_000 } as const;

/** Common file upload / download for all features (local folder storage by default). */
@ApiTags(API_TAGS.Files.name)
@ApiStandardErrors()
@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post()
  @ApiBearerAuth('access-token')
  @UseInterceptors(FileUploadInterceptor)
  @Throttle({ default: UPLOAD_THROTTLE })
  @ResponseMessage('File uploaded')
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: UPLOAD_BODY_SCHEMA })
  @ApiOperation({
    summary: 'Upload a file',
    description:
      'multipart/form-data with `file` (one) and `purpose`. The type is detected from the content (never the name): ' +
      'AVATAR = JPEG / PNG / WebP up to UPLOAD_AVATAR_MAX_SIZE_MB, public, replaces the previous one; ' +
      'DOCUMENT = JPEG / PNG / WebP / GIF / PDF up to UPLOAD_MAX_FILE_SIZE_MB, private. Max UPLOAD_MAX_FILES_PER_USER files per user. ' +
      'For a profile picture prefer POST /users/me/avatar (also sets `picture`).',
  })
  @ApiWrappedResponse(FileResponseDto, { status: HttpStatus.CREATED })
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.CONFLICT,
    HttpStatus.PAYLOAD_TOO_LARGE,
    HttpStatus.UNSUPPORTED_MEDIA_TYPE,
  )
  upload(
    @UploadedFile() file: IncomingFile | undefined,
    @Body() dto: UploadFileDto,
    @CurrentUser() auth: AuthContext,
  ): Promise<FileResponseDto> {
    return this.filesService.upload(
      file,
      dto.purpose,
      auth.userId,
      auth.userId,
    );
  }

  @Get()
  @ApiBearerAuth('access-token')
  @Header('Cache-Control', 'no-store')
  @ResponseMessage('Files')
  @ApiOperation({
    summary: 'List files',
    description:
      "My files (newest first), or another user's with `ownerId` (needs FILE_READ). Filter by `purpose`.",
  })
  @ApiPaginatedResponse(FileResponseDto)
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.FORBIDDEN,
  )
  list(
    @Query() query: FileListQueryDto,
    @CurrentUser() auth: AuthContext,
  ): Promise<Paginated<FileResponseDto>> {
    return this.filesService.list(query, auth);
  }

  @Get('public/:id')
  @Public()
  @ApiProduces('image/jpeg', 'image/png', 'image/webp')
  @ApiOperation({
    summary: 'Public file (avatar)',
    description:
      'No sign-in: only files of a public purpose (AVATAR). Usable directly in <img src>. Cached (the content of an id never changes).',
  })
  @ApiErrorResponses(HttpStatus.NOT_FOUND)
  async publicContent(
    @Param('id', ParseIdPipe) id: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const content = await this.filesService.publicContent(id);
    setFileHeaders(response, content, true);
    return content.stream;
  }

  @Get(':id')
  @ApiBearerAuth('access-token')
  @Header('Cache-Control', 'no-store')
  @ResponseMessage('File')
  @ApiOperation({
    summary: 'File details',
    description: 'Owner, or FILE_READ (404 otherwise).',
  })
  @ApiWrappedResponse(FileResponseDto)
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED, HttpStatus.NOT_FOUND)
  get(
    @Param('id', ParseIdPipe) id: string,
    @CurrentUser() auth: AuthContext,
  ): Promise<FileResponseDto> {
    return this.filesService.get(id, auth);
  }

  @Get(':id/content')
  @ApiBearerAuth('access-token')
  @ApiProduces('application/octet-stream')
  @ApiOperation({
    summary: 'Download a file',
    description:
      'Owner, or FILE_READ (404 otherwise). Images inline, other types as an attachment.',
  })
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED, HttpStatus.NOT_FOUND)
  async content(
    @Param('id', ParseIdPipe) id: string,
    @CurrentUser() auth: AuthContext,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const content = await this.filesService.content(id, auth);
    setFileHeaders(response, content, false);
    return content.stream;
  }

  @Delete(':id')
  @ApiBearerAuth('access-token')
  @Throttle({ default: UPLOAD_THROTTLE })
  @ResponseMessage('File deleted')
  @ApiOperation({
    summary: 'Delete a file',
    description:
      'Owner, or FILE_DELETE (404 otherwise). Removes the record and the stored bytes.',
  })
  @ApiWrappedResponse(FileDeletedDto)
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED, HttpStatus.NOT_FOUND)
  remove(
    @Param('id', ParseIdPipe) id: string,
    @CurrentUser() auth: AuthContext,
  ): Promise<FileDeletedDto> {
    return this.filesService.remove(id, auth);
  }
}

/**
 * Safe download headers: exact type, no sniffing, scripts blocked even if a
 * file were opened directly, images inline / everything else as attachment.
 */
function setFileHeaders(
  response: Response,
  { file }: FileContent,
  isPublic: boolean,
): void {
  const isImage = file.mimeType.startsWith('image/');
  response.set({
    'Content-Disposition': contentDisposition(
      isImage ? 'inline' : 'attachment',
      file.originalName,
    ),
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy':
      "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
    ETag: `"${file.sha256}"`,
    // Public files never change (new upload = new id); frontends on other
    // origins may embed them (<img>).
    ...(isPublic
      ? {
          'Cache-Control': `public, max-age=${String(PUBLIC_CACHE_SECONDS)}, immutable`,
          'Cross-Origin-Resource-Policy': 'cross-origin',
        }
      : { 'Cache-Control': 'private, no-store' }),
  });
}
