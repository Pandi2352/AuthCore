import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Opens a route (or a whole controller) to unauthenticated callers.
 * Every other route requires a valid access token: secure by default.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
