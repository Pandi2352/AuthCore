import { HttpStatus, Injectable, type PipeTransform } from '@nestjs/common';

import { ErrorCode } from '@common/constants/error-codes.constants';
import { AppException } from '@common/exceptions/app.exception';
import { isValidUuid } from '@common/utils/uuid.util';

/**
 * Validates an id route/query parameter as a UUID and returns it lowercase.
 * Invalid ids get 400 INVALID_ID before reaching the service.
 *
 *   @Get(':id')
 *   findOne(@Param('id', ParseIdPipe) id: string) { ... }
 */
@Injectable()
export class ParseIdPipe implements PipeTransform<unknown, string> {
  transform(value: unknown): string {
    if (!isValidUuid(value)) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.InvalidId,
        'Invalid id format',
      );
    }
    return value.toLowerCase();
  }
}
