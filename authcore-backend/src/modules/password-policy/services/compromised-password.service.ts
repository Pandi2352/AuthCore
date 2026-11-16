import { createHash } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';

import { PROJECT } from '@config/project';

const RANGE_API = 'https://api.pwnedpasswords.com/range/';
const TIMEOUT_MS = 3000;

/**
 * Checks a password against Have I Been Pwned's breach corpus using
 * k-anonymity: only the first 5 hex characters of the SHA-1 hash are sent;
 * the password and full hash never leave the server. Responses are padded
 * so their size reveals nothing.
 *
 * Only possible while the plaintext is at hand (register / reset / change):
 * stored Argon2 hashes can't be checked later.
 */
@Injectable()
export class CompromisedPasswordService {
  private readonly logger = new Logger(CompromisedPasswordService.name);

  /** true = found in breaches; null = service unavailable (the check is skipped). */
  async isCompromised(password: string): Promise<boolean | null> {
    const hash = createHash('sha1')
      .update(password)
      .digest('hex')
      .toUpperCase();
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);
    try {
      const response = await fetch(RANGE_API + prefix, {
        headers: {
          'Add-Padding': 'true',
          'User-Agent': `${PROJECT.slug}-password-policy`,
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${String(response.status)}`);
      }
      const body = await response.text();
      return body.split('\n').some((line) => {
        const [lineSuffix, count] = line.trim().split(':');
        return lineSuffix === suffix && Number(count) > 0;
      });
    } catch (error) {
      this.logger.warn({
        message: 'Breached-password check unavailable; skipped',
        reason: error instanceof Error ? error.message : 'unknown',
      });
      return null;
    }
  }
}
