import { SetMetadata } from '@nestjs/common';

export const RESPONSE_MESSAGE_KEY = 'responseMessage';

/**
 * Sets the `message` of the success envelope for a route.
 *   @ResponseMessage('User created successfully')
 * Without it, the default message is used.
 */
export const ResponseMessage = (message: string) =>
  SetMetadata(RESPONSE_MESSAGE_KEY, message);
