import { SetMetadata } from '@nestjs/common';

export const SKIP_RESPONSE_WRAP_KEY = 'skipResponseWrap';

/**
 * Returns the handler's result as-is, without the success envelope.
 * Use only for responses with a format fixed by someone else
 * (e.g. a third-party webhook reply or a metrics endpoint).
 */
export const SkipResponseWrap = () => SetMetadata(SKIP_RESPONSE_WRAP_KEY, true);
