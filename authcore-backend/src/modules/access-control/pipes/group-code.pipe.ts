import { HttpStatus, Injectable, type PipeTransform } from '@nestjs/common';

import { ErrorCode } from '@common/constants/error-codes.constants';
import { AppException } from '@common/exceptions/app.exception';

import {
  GROUP_ID_MAX_LENGTH,
  GROUP_ID_PATTERN,
} from '../constants/access-control.constants';

/** Route param :groupCode (business group ID) → trimmed, uppercase, format-checked. */
@Injectable()
export class GroupCodePipe implements PipeTransform<string, string> {
  transform(value: string): string {
    const code = value.trim().toUpperCase();
    if (
      code.length < 2 ||
      code.length > GROUP_ID_MAX_LENGTH ||
      !GROUP_ID_PATTERN.test(code)
    ) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.InvalidId,
        'Invalid group ID',
        [
          {
            field: 'groupCode',
            message:
              "groupCode may contain only letters, numbers, '_', '-' and ':'",
          },
        ],
      );
    }
    return code;
  }
}
