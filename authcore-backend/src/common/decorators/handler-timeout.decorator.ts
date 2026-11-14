import { SetMetadata } from '@nestjs/common';

export const HANDLER_TIMEOUT_KEY = 'handlerTimeoutMs';

/**
 * Overrides HANDLER_TIMEOUT_MS for one route or controller, e.g. a slow export:
 *   @HandlerTimeout(60_000)
 */
export const HandlerTimeout = (milliseconds: number) =>
  SetMetadata(HANDLER_TIMEOUT_KEY, milliseconds);
