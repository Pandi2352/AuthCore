import { HttpException, HttpStatus } from '@nestjs/common';
import { Error as MongooseError, mongo } from 'mongoose';

import {
  ErrorCode,
  getHttpErrorDefaults,
} from '@common/constants/error-codes.constants';
import { AppException } from '@common/exceptions/app.exception';
import { ApiFieldError } from '@common/interfaces/api-response.interface';

/** Client-safe description of an error, plus whether it is a server fault. */
export interface MappedException {
  statusCode: number;
  code: ErrorCode;
  message: string;
  errors: ApiFieldError[];
  /** 5xx: unexpected; log with full details. */
  isServerError: boolean;
}

function fromStatus(
  statusCode: number,
  overrides: Partial<Pick<MappedException, 'code' | 'message' | 'errors'>> = {},
): MappedException {
  const defaults = getHttpErrorDefaults(statusCode);
  return {
    statusCode,
    code: overrides.code ?? defaults.code,
    message: overrides.message ?? defaults.message,
    errors: overrides.errors ?? [],
    isServerError: statusCode >= 500,
  };
}

// ---------------------------------------------------------------------------
// Nest HttpException
// ---------------------------------------------------------------------------

function mapHttpException(exception: HttpException): MappedException {
  const statusCode = exception.getStatus();

  if (exception instanceof AppException) {
    return fromStatus(statusCode, {
      code: exception.code,
      // 5xx messages are always replaced with the generic one.
      message: statusCode >= 500 ? undefined : exception.message,
      errors: exception.errors,
    });
  }

  // Server errors and rate limiting always use the standard message.
  if (statusCode >= 500 || statusCode === 429) {
    return fromStatus(statusCode);
  }

  const body = exception.getResponse();
  if (typeof body === 'string') {
    return fromStatus(statusCode, { message: body });
  }

  const raw = (body as { message?: unknown }).message;
  if (Array.isArray(raw)) {
    const errors = raw
      .filter((item): item is string => typeof item === 'string')
      .map((message) => ({ field: '', message }));
    return fromStatus(statusCode, {
      code:
        statusCode === 400
          ? ErrorCode.ValidationFailed
          : getHttpErrorDefaults(statusCode).code,
      message: statusCode === 400 ? 'Validation failed' : undefined,
      errors,
    });
  }
  return fromStatus(statusCode, {
    message: typeof raw === 'string' ? raw : undefined,
  });
}

// ---------------------------------------------------------------------------
// MongoDB / Mongoose
// ---------------------------------------------------------------------------

const DUPLICATE_KEY_CODE = 11000;
const MAX_TIME_MS_EXPIRED_CODE = 50;

function isQueryTimeout(error: unknown): boolean {
  return (
    error instanceof mongo.MongoServerError &&
    error.code === MAX_TIME_MS_EXPIRED_CODE
  );
}

function isDuplicateKeyError(error: unknown): error is mongo.MongoServerError {
  return (
    error instanceof mongo.MongoServerError && error.code === DUPLICATE_KEY_CODE
  );
}

function isDatabaseUnavailable(error: unknown): boolean {
  return (
    error instanceof MongooseError.MongooseServerSelectionError ||
    error instanceof mongo.MongoNetworkError ||
    error instanceof mongo.MongoServerSelectionError ||
    error instanceof mongo.MongoNotConnectedError ||
    (error instanceof MongooseError &&
      error.message.includes('buffering timed out'))
  );
}

function mapMongoError(error: unknown): MappedException | null {
  if (error instanceof MongooseError.ValidationError) {
    const errors = Object.values(error.errors).map((item) => ({
      field: item.path,
      message: item.message,
    }));
    return fromStatus(HttpStatus.BAD_REQUEST, {
      code: ErrorCode.ValidationFailed,
      message: 'Validation failed',
      errors,
    });
  }
  if (error instanceof MongooseError.CastError) {
    const isObjectId = error.kind === 'ObjectId';
    return fromStatus(HttpStatus.BAD_REQUEST, {
      code: isObjectId ? ErrorCode.InvalidId : ErrorCode.BadRequest,
      message: isObjectId
        ? 'Invalid id format'
        : `Invalid value for "${error.path}"`,
    });
  }
  if (error instanceof MongooseError.StrictModeError) {
    return fromStatus(HttpStatus.BAD_REQUEST, {
      message: 'Request contains a field that is not allowed',
    });
  }
  if (isDuplicateKeyError(error)) {
    // Only field names are exposed, never the duplicated values.
    const fields = Object.keys(
      (error.keyValue as Record<string, unknown> | undefined) ?? {},
    );
    return fromStatus(HttpStatus.CONFLICT, {
      code: ErrorCode.DuplicateResource,
      message: 'A resource with the same unique value already exists',
      errors: fields.map((field) => ({
        field,
        message: `${field} must be unique`,
      })),
    });
  }
  if (error instanceof MongooseError.DocumentNotFoundError) {
    return fromStatus(HttpStatus.NOT_FOUND);
  }
  if (error instanceof MongooseError.VersionError) {
    return fromStatus(HttpStatus.CONFLICT, {
      message: 'The resource was modified by another request. Please retry',
    });
  }
  if (isQueryTimeout(error)) {
    // Query exceeded maxTimeMS (MONGODB_QUERY_TIMEOUT_MS): logged as a server error.
    return fromStatus(HttpStatus.SERVICE_UNAVAILABLE, {
      code: ErrorCode.RequestTimeout,
    });
  }
  if (isDatabaseUnavailable(error)) {
    return fromStatus(HttpStatus.SERVICE_UNAVAILABLE);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Body parser and other errors carrying an HTTP status (http-errors)
// ---------------------------------------------------------------------------

interface HttpLikeError {
  status: number;
  type?: string;
}

function isHttpLikeError(error: unknown): error is HttpLikeError {
  return (
    typeof error === 'object' &&
    error !== null &&
    typeof (error as { status?: unknown }).status === 'number'
  );
}

const BODY_PARSER_MESSAGES: Record<string, string> = {
  'entity.parse.failed': 'The request body is not valid JSON',
  'entity.too.large': 'The request body is too large',
  'encoding.unsupported': 'The request body encoding is not supported',
  'charset.unsupported': 'The request body charset is not supported',
};

function mapHttpLikeError(error: HttpLikeError): MappedException {
  const { status } = error;
  if (status < 400 || status >= 500) {
    return fromStatus(HttpStatus.INTERNAL_SERVER_ERROR);
  }
  const message = error.type ? BODY_PARSER_MESSAGES[error.type] : undefined;
  return fromStatus(status, { message });
}

/**
 * Converts a body parser error (http-errors with a known `type`) into an
 * AppException with a safe message. Anything else is returned unchanged.
 */
export function toBodyParserException(error: unknown): unknown {
  if (
    !isHttpLikeError(error) ||
    error.type === undefined ||
    !(error.type in BODY_PARSER_MESSAGES)
  ) {
    return error;
  }
  const mapped = mapHttpLikeError(error);
  return new AppException(mapped.statusCode, mapped.code, mapped.message);
}

// ---------------------------------------------------------------------------

/** Maps any thrown value to a client-safe error. Unknown errors become 500. */
export function mapException(exception: unknown): MappedException {
  if (exception instanceof HttpException) {
    return mapHttpException(exception);
  }
  const mongoMapped = mapMongoError(exception);
  if (mongoMapped) {
    return mongoMapped;
  }
  if (isHttpLikeError(exception)) {
    return mapHttpLikeError(exception);
  }
  return fromStatus(HttpStatus.INTERNAL_SERVER_ERROR);
}
