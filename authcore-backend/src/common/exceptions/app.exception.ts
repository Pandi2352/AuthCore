import { HttpException } from '@nestjs/common';

import {
  ErrorCode,
  getHttpErrorDefaults,
} from '@common/constants/error-codes.constants';
import { ApiFieldError } from '@common/interfaces/api-response.interface';

/**
 * Base exception for application errors. Carries a machine-readable code
 * and an optional list of field errors.
 *
 *   throw new AppException(
 *     HttpStatus.CONFLICT,
 *     ErrorCode.DuplicateResource,
 *     'Email is already registered',
 *   );
 *
 * The message is shown to clients, so it must never contain internal details.
 */
export class AppException extends HttpException {
  constructor(
    status: number,
    readonly code: ErrorCode,
    message?: string,
    readonly errors: ApiFieldError[] = [],
  ) {
    super(message ?? getHttpErrorDefaults(status).message, status);
  }
}
