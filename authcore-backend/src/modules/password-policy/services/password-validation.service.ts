import { randomInt } from 'node:crypto';

import { HttpStatus, Injectable } from '@nestjs/common';

import { ErrorCode } from '@common/constants/error-codes.constants';
import { AppException } from '@common/exceptions/app.exception';
import { ValidationException } from '@common/exceptions/validation.exception';
import { PasswordService } from '@shared/password.service';

import { COMMON_PASSWORDS } from '../constants/common-passwords.constants';
import {
  PERSONAL_INFO_MIN_LENGTH,
  SPECIAL_CHARACTER,
} from '../constants/password-policy.constants';
import type {
  PasswordExpiryStatus,
  PasswordOwnerInfo,
  PasswordPolicyRules,
  PasswordViolation,
} from '../interfaces/password-policy-rules.interface';
import { CompromisedPasswordService } from './compromised-password.service';
import {
  effectiveCaseCount,
  PasswordPolicyService,
} from './password-policy.service';

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

/** The account a new password is for: its current hash and previous hashes. */
export interface PasswordAccount {
  passwordHash: string;
  history: string[];
}

/**
 * Applies the active password policy. The one place that decides whether a
 * password is acceptable: register, reset and change all call it, so the
 * rules can't drift between flows.
 */
@Injectable()
export class PasswordValidationService {
  constructor(
    private readonly passwordPolicyService: PasswordPolicyService,
    private readonly passwordService: PasswordService,
    private readonly compromisedPasswordService: CompromisedPasswordService,
  ) {}

  /** Every rule the password breaks (empty = acceptable). History not included. */
  async validate(
    password: string,
    owner: PasswordOwnerInfo = {},
  ): Promise<PasswordViolation[]> {
    const policy = await this.passwordPolicyService.getRules();
    const violations = checkRules(password, owner, policy);

    if (
      violations.length === 0 &&
      policy.additionalRules.blockCompromisedPasswords
    ) {
      if (
        (await this.compromisedPasswordService.isCompromised(password)) === true
      ) {
        violations.push({
          rule: 'blockCompromisedPasswords',
          message:
            'This password has appeared in a data breach. Choose a different one.',
        });
      }
    }
    return violations;
  }

  /**
   * Throws 400 if the password breaks the policy: VALIDATION_FAILED with one
   * entry per broken rule (all at once, so the user can fix them together),
   * or AUTH_PASSWORD_REUSED when it matches the current / a recent password.
   */
  async assertAcceptable(
    password: string,
    field: string,
    owner: PasswordOwnerInfo,
    account?: PasswordAccount,
  ): Promise<void> {
    const violations = await this.validate(password, owner);
    if (violations.length > 0) {
      throw new ValidationException(
        violations.map((v) => ({ field, message: v.message })),
      );
    }
    if (account) {
      await this.assertNotReused(password, account, field);
    }
  }

  /** How many previous hashes to keep with a new password. */
  /**
   * A random password that satisfies the current policy (required character
   * classes, length, no whitespace, repeat limit, not a common password).
   * `length` is clamped to the policy's minimum / maximum; default: the
   * larger of 16 and the minimum.
   */
  async generate(requestedLength?: number): Promise<string> {
    const policy = await this.passwordPolicyService.getRules();
    const { characterLength: limits, complexity } = policy;
    const length = Math.min(
      limits.maximum,
      Math.max(limits.minimum, requestedLength ?? Math.max(16, limits.minimum)),
    );
    const required = [
      ...pick(
        UPPER,
        effectiveCaseCount(
          complexity.requireUpperAndLowerCase,
          complexity.minimumUppercaseCount,
        ),
      ),
      ...pick(
        LOWER,
        effectiveCaseCount(
          complexity.requireUpperAndLowerCase,
          complexity.minimumLowercaseCount,
        ),
      ),
      ...pick(DIGITS, complexity.minimumDigitCount),
      ...pick(SPECIALS, complexity.minimumSpecialCharacterCount),
    ];
    for (let attempt = 0; attempt < 50; attempt++) {
      const chars = [
        ...required,
        ...pick(
          UPPER + LOWER + DIGITS + SPECIALS,
          Math.max(0, length - required.length),
        ),
      ];
      const password = shuffle(chars).join('');
      if (checkRules(password, {}, policy).length === 0) {
        return password;
      }
    }
    throw new AppException(
      HttpStatus.UNPROCESSABLE_ENTITY,
      ErrorCode.UnprocessableEntity,
      'Could not generate a password for the current policy',
    );
  }

  async historySize(): Promise<number> {
    const { passwordHistory } = await this.passwordPolicyService.getRules();
    return passwordHistory.preventReuse ? passwordHistory.historyCount : 0;
  }

  async getExpiryStatus(
    passwordChangedAt: Date,
    now = new Date(),
  ): Promise<PasswordExpiryStatus> {
    const { passwordValidity: validity } =
      await this.passwordPolicyService.getRules();
    if (!validity.enabled) {
      return { expiresAt: null, isExpired: false, isChangeRequired: false };
    }
    const expiresAt = new Date(
      passwordChangedAt.getTime() + validity.validityDays * DAY_MS,
    );
    const graceEndsAt = expiresAt.getTime() + validity.gracePeriodDays * DAY_MS;
    return {
      expiresAt,
      isExpired: now >= expiresAt,
      isChangeRequired:
        validity.forceChangeOnExpiry && now.getTime() >= graceEndsAt,
    };
  }

  /** The user may not change the password again before the minimum age (expired passwords excepted). */
  async assertMinimumAgeReached(passwordChangedAt: Date): Promise<void> {
    const { additionalRules } = await this.passwordPolicyService.getRules();
    const hours = additionalRules.minimumPasswordAgeHours;
    if (hours === 0) {
      return;
    }
    const allowedAt = new Date(passwordChangedAt.getTime() + hours * HOUR_MS);
    if (
      allowedAt > new Date() &&
      !(await this.getExpiryStatus(passwordChangedAt)).isExpired
    ) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.AuthPasswordChangedTooRecently,
        `Your password was changed recently. You can change it again after ${allowedAt.toISOString()}.`,
      );
    }
  }

  private async assertNotReused(
    password: string,
    account: PasswordAccount,
    field: string,
  ): Promise<void> {
    const { passwordHistory } = await this.passwordPolicyService.getRules();
    if (!passwordHistory.preventReuse) {
      return;
    }
    const count = passwordHistory.historyCount;
    const recent = count > 0 ? account.history.slice(-count) : [];
    for (const hash of [account.passwordHash, ...recent]) {
      if (await this.passwordService.verify(hash, password)) {
        throw new AppException(
          HttpStatus.BAD_REQUEST,
          ErrorCode.AuthPasswordReused,
          count > 0
            ? `Choose a password you haven't used recently (your current and last ${String(count)} passwords can't be reused)`
            : 'The new password must be different from the current one',
          [{ field, message: `${field} was used before` }],
        );
      }
    }
  }
}

/** The synchronous rules, in the order a user would fix them. */
function checkRules(
  password: string,
  owner: PasswordOwnerInfo,
  policy: PasswordPolicyRules,
): PasswordViolation[] {
  const {
    characterLength: length,
    complexity,
    additionalRules: extra,
  } = policy;
  const violations: PasswordViolation[] = [];
  const add = (rule: string, message: string) =>
    violations.push({ rule, message });
  const count = (pattern: RegExp) => password.match(pattern)?.length ?? 0;
  const plural = (n: number, word: string) =>
    `${String(n)} ${word}${n === 1 ? '' : 's'}`;
  // Code points, so an emoji counts as one character.
  const chars = Array.from(password);

  if (chars.length < length.minimum) {
    add(
      'minimumLength',
      `Password must be at least ${plural(length.minimum, 'character')} long`,
    );
  }
  if (chars.length > length.maximum) {
    add(
      'maximumLength',
      `Password must be at most ${plural(length.maximum, 'character')} long`,
    );
  }
  const upper = effectiveCaseCount(
    complexity.requireUpperAndLowerCase,
    complexity.minimumUppercaseCount,
  );
  const lower = effectiveCaseCount(
    complexity.requireUpperAndLowerCase,
    complexity.minimumLowercaseCount,
  );
  if (count(/\p{Lu}/gu) < upper) {
    add(
      'minimumUppercaseCount',
      `Password must contain at least ${plural(upper, 'uppercase letter')}`,
    );
  }
  if (count(/\p{Ll}/gu) < lower) {
    add(
      'minimumLowercaseCount',
      `Password must contain at least ${plural(lower, 'lowercase letter')}`,
    );
  }
  if (count(/\p{N}/gu) < complexity.minimumDigitCount) {
    add(
      'minimumDigitCount',
      `Password must contain at least ${plural(complexity.minimumDigitCount, 'digit')}`,
    );
  }
  if (count(SPECIAL_CHARACTER) < complexity.minimumSpecialCharacterCount) {
    add(
      'minimumSpecialCharacterCount',
      `Password must contain at least ${plural(complexity.minimumSpecialCharacterCount, 'special character')} (e.g. @ # $ % !)`,
    );
  }
  if (!extra.allowWhitespace && /\s/u.test(password)) {
    add('allowWhitespace', 'Password must not contain spaces');
  }
  const maxRun = extra.maximumRepeatedCharacters;
  if (maxRun > 0 && longestRun(chars) > maxRun) {
    add(
      'maximumRepeatedCharacters',
      `Password must not repeat a character more than ${String(maxRun)} times in a row`,
    );
  }
  if (
    extra.preventPersonalInfoInPassword &&
    containsPersonalInfo(password, owner)
  ) {
    add(
      'preventPersonalInfoInPassword',
      'Password must not contain your email, username or name',
    );
  }
  if (
    extra.blockCommonPasswords &&
    COMMON_PASSWORDS.has(password.toLowerCase())
  ) {
    add(
      'blockCommonPasswords',
      'This password is too common. Choose a less predictable one.',
    );
  }
  return violations;
}

function longestRun(chars: string[]): number {
  let longest = 0;
  let run = 0;
  chars.forEach((char, index) => {
    run = index > 0 && chars[index - 1] === char ? run + 1 : 1;
    longest = Math.max(longest, run);
  });
  return longest;
}

function containsPersonalInfo(
  password: string,
  owner: PasswordOwnerInfo,
): boolean {
  const lower = password.toLowerCase();
  return [
    owner.email?.split('@')[0],
    owner.username,
    owner.firstName,
    owner.lastName,
  ]
    .filter((part): part is string => typeof part === 'string')
    .map((part) => part.toLowerCase())
    .filter((part) => part.length >= PERSONAL_INFO_MIN_LENGTH)
    .some((part) => lower.includes(part));
}

// Generator alphabet: no look-alike characters (0/O, 1/l/I) and no whitespace.
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWER = 'abcdefghijkmnopqrstuvwxyz';
const DIGITS = '23456789';
const SPECIALS = '!@#$%^&*()-_=+[]{}?';

function pick(alphabet: string, count: number): string[] {
  return Array.from(
    { length: count },
    () => alphabet[randomInt(alphabet.length)] ?? '',
  );
}

/** Fisher–Yates with a cryptographic RNG. */
function shuffle(chars: string[]): string[] {
  const result = [...chars];
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [result[i], result[j]] = [result[j] ?? '', result[i] ?? ''];
  }
  return result;
}
