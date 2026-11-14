import { applyDecorators, HttpStatus, Type } from '@nestjs/common';
import {
  ApiExtraModels,
  ApiResponse,
  getSchemaPath,
  type ReferenceObject,
  type SchemaObject,
} from '@nestjs/swagger';

import { getHttpErrorDefaults } from '@common/constants/error-codes.constants';
import {
  ErrorResponseDto,
  PaginationMetaDto,
  SuccessResponseDto,
} from '@common/dto/api-response.dto';

type Primitive = StringConstructor | NumberConstructor | BooleanConstructor;
type ResponseModel = Type<unknown> | Primitive;

const PRIMITIVES = new Map<unknown, SchemaObject['type']>([
  [String, 'string'],
  [Number, 'number'],
  [Boolean, 'boolean'],
]);

function itemSchema(model: ResponseModel): SchemaObject | ReferenceObject {
  const primitive = PRIMITIVES.get(model);
  return primitive
    ? { type: primitive }
    : { $ref: getSchemaPath(model as Type<unknown>) };
}

function extraModels(model?: ResponseModel): Type<unknown>[] {
  return model && !PRIMITIVES.has(model) ? [model as Type<unknown>] : [];
}

interface WrappedResponseOptions {
  status?: HttpStatus;
  description?: string;
  isArray?: boolean;
}

/**
 * Documents a success response wrapped in the standard envelope:
 *   @ApiWrappedResponse(UserResponseDto)
 *   @ApiWrappedResponse(UserResponseDto, { status: HttpStatus.CREATED })
 */
export function ApiWrappedResponse(
  model?: ResponseModel,
  options: WrappedResponseOptions = {},
) {
  const status = options.status ?? HttpStatus.OK;
  const data: SchemaObject | ReferenceObject = !model
    ? { type: 'object', nullable: true, example: null }
    : options.isArray
      ? { type: 'array', items: itemSchema(model) }
      : itemSchema(model);

  return applyDecorators(
    ApiExtraModels(SuccessResponseDto, ...extraModels(model)),
    ApiResponse({
      status,
      description: options.description ?? 'Success',
      schema: {
        allOf: [
          { $ref: getSchemaPath(SuccessResponseDto) },
          { properties: { data } },
        ],
      },
    }),
  );
}

/** Documents a paginated list: `data` is an array of `model`, plus `meta`. */
export function ApiPaginatedResponse(
  model: Type<unknown>,
  description = 'Paginated list',
) {
  return applyDecorators(
    ApiExtraModels(SuccessResponseDto, PaginationMetaDto, model),
    ApiResponse({
      status: HttpStatus.OK,
      description,
      schema: {
        allOf: [
          { $ref: getSchemaPath(SuccessResponseDto) },
          {
            properties: {
              data: { type: 'array', items: { $ref: getSchemaPath(model) } },
              meta: { $ref: getSchemaPath(PaginationMetaDto) },
            },
          },
        ],
      },
    }),
  );
}

/**
 * Documents error responses in the standard error envelope, with an example
 * per status:  @ApiErrorResponses(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND)
 */
export function ApiErrorResponses(...statuses: HttpStatus[]) {
  return applyDecorators(
    ApiExtraModels(ErrorResponseDto),
    ...statuses.map((status) => {
      const { code, message } = getHttpErrorDefaults(status);
      return ApiResponse({
        status,
        description: message,
        type: ErrorResponseDto,
        example: {
          success: false,
          message,
          code,
          errors: [],
          statusCode: status,
          timestamp: '2026-11-14T10:00:00.000Z',
          path: '/api/v1/example',
        },
      });
    }),
  );
}

/** Errors any route can return. Apply at controller level. */
export const ApiStandardErrors = () =>
  ApiErrorResponses(
    HttpStatus.TOO_MANY_REQUESTS,
    HttpStatus.INTERNAL_SERVER_ERROR,
  );
