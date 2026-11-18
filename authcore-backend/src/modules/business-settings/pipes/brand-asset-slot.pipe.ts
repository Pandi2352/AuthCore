import { HttpStatus, Injectable, type PipeTransform } from '@nestjs/common';

import { ErrorCode } from '@common/constants/error-codes.constants';
import { AppException } from '@common/exceptions/app.exception';

import {
  BRAND_ASSET_SLOTS,
  type BrandAssetSlot,
} from '../constants/business-settings.constants';

/** `:slot` must be logo, logo-mark, auth-logo or favicon (400 VALIDATION_FAILED). */
@Injectable()
export class BrandAssetSlotPipe implements PipeTransform<
  unknown,
  BrandAssetSlot
> {
  transform(value: unknown): BrandAssetSlot {
    const slot = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (!(BRAND_ASSET_SLOTS as string[]).includes(slot)) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.ValidationFailed,
        `Unknown image slot. Use one of: ${BRAND_ASSET_SLOTS.join(', ')}`,
        [{ field: 'slot', message: `one of ${BRAND_ASSET_SLOTS.join(', ')}` }],
      );
    }
    return slot as BrandAssetSlot;
  }
}
