import {
  type CallHandler,
  type ExecutionContext,
  HttpStatus,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, RequestHandler, Response } from 'express';
import multer, { MulterError } from 'multer';
import type { Observable } from 'rxjs';

import { ErrorCode } from '@common/constants/error-codes.constants';
import { AppException } from '@common/exceptions/app.exception';

import { UPLOAD_FIELD_NAME } from '../constants/file.constants';

/**
 * Reads one multipart file (field "file") into memory, with hard limits:
 * UPLOAD_MAX_FILE_SIZE_MB, one file, few small text fields. Runs after the
 * auth guard, so anonymous callers never get to send the body. Per-purpose
 * rules (type, smaller size) are checked by FilesService.
 */
@Injectable()
export class FileUploadInterceptor implements NestInterceptor {
  private readonly handler: RequestHandler;

  constructor(configService: ConfigService) {
    const maxBytes = configService.getOrThrow<number>(
      'storage.maxFileSizeBytes',
    );
    this.handler = multer({
      storage: multer.memoryStorage(),
      limits: {
        fileSize: maxBytes,
        files: 1,
        fields: 5,
        fieldSize: 1024,
        parts: 6,
        headerPairs: 50,
      },
    }).single(UPLOAD_FIELD_NAME);
  }

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    await new Promise<void>((resolve, reject) => {
      this.handler(request, response, (error: unknown) => {
        if (error) {
          reject(toAppException(error));
          return;
        }
        resolve();
      });
    });
    return next.handle();
  }
}

function toAppException(error: unknown): AppException {
  if (error instanceof MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return new AppException(
        HttpStatus.PAYLOAD_TOO_LARGE,
        ErrorCode.FileTooLarge,
        'The file is too large',
        [{ field: UPLOAD_FIELD_NAME, message: 'file is too large' }],
      );
    }
    const field = error.field ?? UPLOAD_FIELD_NAME;
    const message =
      error.code === 'LIMIT_UNEXPECTED_FILE'
        ? `send exactly one file in the "${UPLOAD_FIELD_NAME}" field`
        : 'the upload has too many or too large parts';
    return new AppException(
      HttpStatus.BAD_REQUEST,
      ErrorCode.BadRequest,
      'Invalid upload',
      [{ field, message }],
    );
  }
  return new AppException(
    HttpStatus.BAD_REQUEST,
    ErrorCode.BadRequest,
    'The upload could not be read (malformed multipart body)',
  );
}
