import { HttpStatus, Injectable, type PipeTransform } from '@nestjs/common';

import { ErrorCode } from '@common/constants/error-codes.constants';
import { AppException } from '@common/exceptions/app.exception';

import {
  KEY_PATTERN,
  ROLE_KEY_MAX_LENGTH,
} from '../constants/access-control.constants';

/** Route param :roleKey → trimmed, uppercase, format-checked (400 INVALID_ID otherwise). */
@Injectable()
export class RoleKeyPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    const key = value.trim().toUpperCase();
    if (
      key.length < 2 ||
      key.length > ROLE_KEY_MAX_LENGTH ||
      !KEY_PATTERN.test(key)
    ) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.InvalidId,
        'Invalid role key',
        [
          {
            field: 'roleKey',
            message: 'roleKey may contain only letters, digits and _',
          },
        ],
      );
    }
    return key;
  }
}
