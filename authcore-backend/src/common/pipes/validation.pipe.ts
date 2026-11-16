import { type ValidationError, ValidationPipe } from '@nestjs/common';

import { ValidationException } from '@common/exceptions/validation.exception';
import { ApiFieldError } from '@common/interfaces/api-response.interface';

/** Flattens nested class-validator errors into `field` dot paths. */
export function flattenValidationErrors(
  errors: ValidationError[],
  parentPath = '',
): ApiFieldError[] {
  return errors.flatMap((error) => {
    const field = parentPath
      ? `${parentPath}.${error.property}`
      : error.property;
    const own = Object.values(error.constraints ?? {}).map((message) => ({
      field,
      message,
    }));
    return [...own, ...flattenValidationErrors(error.children ?? [], field)];
  });
}

/**
 * Global validation for every @Body(), @Query() and @Param() DTO:
 * - whitelist: properties without validation decorators are stripped
 * - forbidNonWhitelisted: ...and unknown properties are rejected (400)
 * - transform: payloads become DTO class instances (with @Type conversions)
 * - submitted values are never echoed back in error details
 */
export function createValidationPipe(): ValidationPipe {
  // Factory for the APP_PIPE provider (useFactory), so "new" is intended here.
  // eslint-disable-next-line no-restricted-syntax
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    forbidUnknownValues: true,
    // One error per field (the first rule that fails), not every rule.
    stopAtFirstError: true,
    transform: true,
    transformOptions: { enableImplicitConversion: false },
    validationError: { target: false, value: false },
    exceptionFactory: (errors: ValidationError[]) =>
      new ValidationException(flattenValidationErrors(errors)),
  });
}
