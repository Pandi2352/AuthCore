import { randomBytes } from 'node:crypto';

import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { type Algorithm, hash, verify } from '@node-rs/argon2';

import { securityConfig } from '@config/configuration';

/**
 * Algorithm.Argon2id. The package exports Algorithm as an ambient const enum,
 * which can't be referenced under isolatedModules, so the value is used here.
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-enum-assignment
const ARGON2ID: Algorithm.Argon2id = 2;

/** Parameters encoded in an Argon2 PHC string: $argon2id$v=19$m=..,t=..,p=..$ */
const PHC_PARAMS = /^\$argon2id\$v=\d+\$m=(\d+),t=(\d+),p=(\d+)\$/;

/**
 * Password hashing with Argon2id (OWASP recommended). Used by registration,
 * login, password change and reset. Plain passwords are never stored or logged.
 */
@Injectable()
export class PasswordService implements OnModuleInit {
  /** Hash of a random value, verified when a login's user doesn't exist. */
  private dummyHash = '';

  constructor(
    @Inject(securityConfig.KEY)
    private readonly security: ConfigType<typeof securityConfig>,
  ) {}

  async onModuleInit(): Promise<void> {
    this.dummyHash = await this.hash(randomBytes(32).toString('hex'));
  }

  /** Returns a self-describing PHC string (algorithm, params, salt, hash). */
  hash(plainPassword: string): Promise<string> {
    return hash(plainPassword, {
      algorithm: ARGON2ID,
      memoryCost: this.security.argon2MemoryKib,
      timeCost: this.security.argon2TimeCost,
      parallelism: this.security.argon2Parallelism,
    });
  }

  /** Constant-time check. A malformed stored hash counts as "no match". */
  async verify(passwordHash: string, plainPassword: string): Promise<boolean> {
    try {
      return await verify(passwordHash, plainPassword);
    } catch {
      return false;
    }
  }

  /**
   * Does the same work as verify() and always returns false. Called when the
   * user doesn't exist, so "unknown email" and "wrong password" take the same
   * time and can't be told apart.
   */
  async verifyDummy(plainPassword: string): Promise<false> {
    await this.verify(this.dummyHash, plainPassword);
    return false;
  }

  /**
   * True when a stored hash was made with weaker settings than the current
   * config. Login can then re-hash the password (after a successful verify).
   */
  needsRehash(passwordHash: string): boolean {
    const match = PHC_PARAMS.exec(passwordHash);
    if (!match) {
      return true;
    }
    const [, memory, time, parallelism] = match.map(Number);
    return (
      memory !== this.security.argon2MemoryKib ||
      time !== this.security.argon2TimeCost ||
      parallelism !== this.security.argon2Parallelism
    );
  }
}
