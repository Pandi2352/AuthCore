import { ApiProperty } from '@nestjs/swagger';

import { DEFAULT_SUCCESS_MESSAGE } from '@common/constants/api.constants';
import { ErrorCode } from '@common/constants/error-codes.constants';
import {
  ApiErrorResponse,
  ApiFieldError,
  PaginationMeta,
} from '@common/interfaces/api-response.interface';

/*
 * Swagger models for the standard response envelope (section 5).
 * They describe the format only; responses are built by the interceptor
 * and exception filter.
 */

export class PaginationMetaDto implements PaginationMeta {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 45 })
  totalItems!: number;

  @ApiProperty({ example: 3 })
  totalPages!: number;

  @ApiProperty({ example: true })
  hasNextPage!: boolean;

  @ApiProperty({ example: false })
  hasPreviousPage!: boolean;
}

export class SuccessResponseDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: DEFAULT_SUCCESS_MESSAGE })
  message!: string;

  @ApiProperty({
    example: '2026-11-14T10:00:00.000Z',
    description: 'ISO 8601, UTC',
  })
  timestamp!: string;

  @ApiProperty({ example: '/api/v1/example' })
  path!: string;
}

export class FieldErrorDto implements ApiFieldError {
  @ApiProperty({ example: 'email', description: 'Dot path of the field' })
  field!: string;

  @ApiProperty({ example: 'email must be an email' })
  message!: string;
}

export class ErrorResponseDto implements ApiErrorResponse {
  @ApiProperty({ example: false })
  success!: false;

  @ApiProperty({ example: 'Validation failed' })
  message!: string;

  @ApiProperty({
    enum: ErrorCode,
    enumName: 'ErrorCode',
    example: ErrorCode.ValidationFailed,
  })
  code!: ErrorCode;

  @ApiProperty({ type: [FieldErrorDto] })
  errors!: FieldErrorDto[];

  @ApiProperty({ example: 400 })
  statusCode!: number;

  @ApiProperty({
    example: '2026-11-14T10:00:00.000Z',
    description: 'ISO 8601, UTC',
  })
  timestamp!: string;

  @ApiProperty({ example: '/api/v1/example' })
  path!: string;
}
