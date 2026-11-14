import { HttpStatus } from '@nestjs/common';

import { ErrorCode } from '@common/constants/error-codes.constants';
import { ApiFieldError } from '@common/interfaces/api-response.interface';

import { AppException } from './app.exception';

/** 400 VALIDATION_FAILED with one entry per invalid field. */
export class ValidationException extends AppException {
  constructor(errors: ApiFieldError[], message = 'Validation failed') {
    super(HttpStatus.BAD_REQUEST, ErrorCode.ValidationFailed, message, errors);
  }
}
