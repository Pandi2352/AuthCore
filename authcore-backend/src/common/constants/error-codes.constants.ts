import { HttpStatus } from '@nestjs/common';

/**
 * Machine-readable error codes. Clients should branch on `code`,
 * never on the human-readable `message`.
 */
export enum ErrorCode {
  BadRequest = 'BAD_REQUEST',
  ValidationFailed = 'VALIDATION_FAILED',
  InvalidId = 'INVALID_ID',
  Unauthorized = 'UNAUTHORIZED',
  Forbidden = 'FORBIDDEN',
  NotFound = 'NOT_FOUND',
  MethodNotAllowed = 'METHOD_NOT_ALLOWED',
  Conflict = 'CONFLICT',
  DuplicateResource = 'DUPLICATE_RESOURCE',
  PayloadTooLarge = 'PAYLOAD_TOO_LARGE',
  UnsupportedMediaType = 'UNSUPPORTED_MEDIA_TYPE',
  UnprocessableEntity = 'UNPROCESSABLE_ENTITY',
  TooManyRequests = 'TOO_MANY_REQUESTS',
  InternalError = 'INTERNAL_ERROR',
  ServiceUnavailable = 'SERVICE_UNAVAILABLE',
  RequestTimeout = 'REQUEST_TIMEOUT',

  // Auth: email verification
  AuthInvalidVerificationCode = 'AUTH_INVALID_VERIFICATION_CODE',
  AuthInvalidVerificationToken = 'AUTH_INVALID_VERIFICATION_TOKEN',
  AuthVerificationAttemptsExceeded = 'AUTH_VERIFICATION_ATTEMPTS_EXCEEDED',

  // Auth: login
  AuthInvalidCredentials = 'AUTH_INVALID_CREDENTIALS',
  AuthTooManyFailedAttempts = 'AUTH_TOO_MANY_FAILED_ATTEMPTS',
  AuthEmailNotVerified = 'AUTH_EMAIL_NOT_VERIFIED',
  AuthAccountPendingApproval = 'AUTH_ACCOUNT_PENDING_APPROVAL',
  AuthAccountSuspended = 'AUTH_ACCOUNT_SUSPENDED',
  AuthAccountInactive = 'AUTH_ACCOUNT_INACTIVE',
  AuthAccountDisabled = 'AUTH_ACCOUNT_DISABLED',

  // Auth: refresh token
  AuthInvalidRefreshToken = 'AUTH_INVALID_REFRESH_TOKEN',
  AuthRefreshTokenReused = 'AUTH_REFRESH_TOKEN_REUSED',
  AuthInvalidOrigin = 'AUTH_INVALID_ORIGIN',

  // Auth: access token (protected routes)
  AuthAccessTokenMissing = 'AUTH_ACCESS_TOKEN_MISSING',
  AuthAccessTokenInvalid = 'AUTH_ACCESS_TOKEN_INVALID',
  AuthAccessTokenExpired = 'AUTH_ACCESS_TOKEN_EXPIRED',
  AuthSessionRevoked = 'AUTH_SESSION_REVOKED',

  // Auth: password reset / change
  AuthInvalidResetCode = 'AUTH_INVALID_RESET_CODE',
  AuthResetAttemptsExceeded = 'AUTH_RESET_ATTEMPTS_EXCEEDED',
  AuthInvalidResetToken = 'AUTH_INVALID_RESET_TOKEN',
  AuthInvalidCurrentPassword = 'AUTH_INVALID_CURRENT_PASSWORD',
  AuthPasswordReused = 'AUTH_PASSWORD_REUSED',
  AuthPasswordChangedTooRecently = 'AUTH_PASSWORD_CHANGED_TOO_RECENTLY',
  AuthPasswordExpired = 'AUTH_PASSWORD_EXPIRED',

  // Password policy
  InvalidPasswordPolicy = 'INVALID_PASSWORD_POLICY',

  // Access control
  ResourceInUse = 'RESOURCE_IN_USE',
  SystemResourceProtected = 'SYSTEM_RESOURCE_PROTECTED',
  ResourceInactive = 'RESOURCE_INACTIVE',
  InvalidGroupHierarchy = 'INVALID_GROUP_HIERARCHY',
  VersionConflict = 'VERSION_CONFLICT',
  BulkOperationFailed = 'BULK_OPERATION_FAILED',
}

/** Default code and safe client message for each HTTP status. */
export const HTTP_ERROR_DEFAULTS: Partial<
  Record<number, { code: ErrorCode; message: string }>
> = {
  [HttpStatus.BAD_REQUEST]: {
    code: ErrorCode.BadRequest,
    message: 'The request is invalid',
  },
  [HttpStatus.UNAUTHORIZED]: {
    code: ErrorCode.Unauthorized,
    message: 'Authentication is required',
  },
  [HttpStatus.FORBIDDEN]: {
    code: ErrorCode.Forbidden,
    message: 'You do not have permission to perform this action',
  },
  [HttpStatus.NOT_FOUND]: {
    code: ErrorCode.NotFound,
    message: 'The requested resource was not found',
  },
  [HttpStatus.METHOD_NOT_ALLOWED]: {
    code: ErrorCode.MethodNotAllowed,
    message: 'This HTTP method is not allowed',
  },
  [HttpStatus.REQUEST_TIMEOUT]: {
    code: ErrorCode.RequestTimeout,
    message: 'The request took too long to complete',
  },
  [HttpStatus.CONFLICT]: {
    code: ErrorCode.Conflict,
    message: 'The request conflicts with the current state of the resource',
  },
  [HttpStatus.PAYLOAD_TOO_LARGE]: {
    code: ErrorCode.PayloadTooLarge,
    message: 'The request body is too large',
  },
  [HttpStatus.UNSUPPORTED_MEDIA_TYPE]: {
    code: ErrorCode.UnsupportedMediaType,
    message: 'The request content type is not supported',
  },
  [HttpStatus.UNPROCESSABLE_ENTITY]: {
    code: ErrorCode.UnprocessableEntity,
    message: 'The request could not be processed',
  },
  [HttpStatus.TOO_MANY_REQUESTS]: {
    code: ErrorCode.TooManyRequests,
    message: 'Too many requests. Please try again later',
  },
  [HttpStatus.INTERNAL_SERVER_ERROR]: {
    code: ErrorCode.InternalError,
    message: 'Something went wrong. Please try again later',
  },
  [HttpStatus.SERVICE_UNAVAILABLE]: {
    code: ErrorCode.ServiceUnavailable,
    message: 'The service is temporarily unavailable',
  },
};

export function getHttpErrorDefaults(status: number): {
  code: ErrorCode;
  message: string;
} {
  const defaults = HTTP_ERROR_DEFAULTS[status];
  if (defaults) {
    return defaults;
  }
  return status >= 500
    ? {
        code: ErrorCode.InternalError,
        message: 'Something went wrong. Please try again later',
      }
    : { code: ErrorCode.BadRequest, message: 'The request is invalid' };
}
