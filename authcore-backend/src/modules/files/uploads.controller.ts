import {
  Controller,
  HttpStatus,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { API_TAGS } from '@common/constants/api-tags.constants';
import {
  ApiErrorResponses,
  ApiStandardErrors,
  ApiWrappedResponse,
} from '@common/decorators/api-response.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { ResponseMessage } from '@common/decorators/response-message.decorator';
import type { AuthContext } from '@common/interfaces/auth-context.interface';
import { UPLOAD_THROTTLE } from '@modules/storage/constants/storage.constants';

import { UploadedFileDto } from './dto/uploaded-file.dto';
import { FilePurpose } from './enums/file.enum';
import { FileUploadInterceptor } from './interceptors/file-upload.interceptor';
import { FilesService, type IncomingFile } from './services/files.service';
import { countPdfPages } from './utils/file-signature.util';

const BODY_SCHEMA = {
  type: 'object',
  required: ['file'],
  properties: {
    file: {
      type: 'string',
      format: 'binary',
      description:
        'JPEG, PNG, WebP, GIF, PDF, DOCX, XLSX, PPTX, CSV or TXT (UPLOAD_MAX_FILE_SIZE_MB)',
    },
  },
};

/** One upload endpoint for the whole app: stores on the active storage, returns the URL. */
@ApiTags(API_TAGS.Uploads.name)
@ApiStandardErrors()
@Controller('uploads')
export class UploadsController {
  constructor(private readonly filesService: FilesService) {}

  @Post()
  @ApiBearerAuth('access-token')
  @UseInterceptors(FileUploadInterceptor)
  @Throttle({ default: UPLOAD_THROTTLE })
  @ResponseMessage('File uploaded')
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: BODY_SCHEMA })
  @ApiOperation({
    summary: 'Upload a file',
    description:
      'Any signed-in user. multipart/form-data with `file`. Stored on the **active storage** ' +
      '(Settings → File storage: local folder, S3, Backblaze B2, Tigris, Supabase …). The type is ' +
      'detected from the content (never the name); images are re-encoded (metadata removed), ' +
      'everything is virus-scanned when scanning is on. Counts towards UPLOAD_MAX_FILES_PER_USER.',
  })
  @ApiWrappedResponse(UploadedFileDto, { status: HttpStatus.CREATED })
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.CONFLICT,
    HttpStatus.PAYLOAD_TOO_LARGE,
    HttpStatus.UNSUPPORTED_MEDIA_TYPE,
    HttpStatus.UNPROCESSABLE_ENTITY,
    HttpStatus.TOO_MANY_REQUESTS,
  )
  async upload(
    @UploadedFile() file: IncomingFile | undefined,
    @CurrentUser() auth: AuthContext,
  ): Promise<UploadedFileDto> {
    const stored = await this.filesService.uploadForUrl(
      file,
      FilePurpose.Upload,
      auth.userId,
    );
    return {
      id: stored.id,
      name: stored.originalName,
      key: stored.objectKey,
      url: stored.url,
      fileType: stored.mimeType,
      fileSize: stored.size,
      filePages:
        stored.mimeType === 'application/pdf' && file
          ? countPdfPages(file.buffer)
          : 0,
    };
  }
}
