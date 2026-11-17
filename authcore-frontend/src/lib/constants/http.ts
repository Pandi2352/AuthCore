/** HTTP status codes the app branches on (use these instead of bare numbers). */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
} as const;

export type HttpStatus = (typeof HTTP_STATUS)[keyof typeof HTTP_STATUS];

export const isServerError = (status: number): boolean => status >= 500 && status <= 599;
export const isClientError = (status: number): boolean => status >= 400 && status <= 499;

/** Statuses worth retrying automatically (transient). */
export const RETRYABLE_STATUSES: ReadonlySet<number> = new Set([408, 429, 502, 503, 504]);

/** Headers the API client sends / reads. */
export const HTTP_HEADERS = {
  REQUEST_ID: 'X-Request-Id',
  RETRY_AFTER: 'Retry-After',
  AUTHORIZATION: 'Authorization',
  CONTENT_TYPE: 'Content-Type',
} as const;
