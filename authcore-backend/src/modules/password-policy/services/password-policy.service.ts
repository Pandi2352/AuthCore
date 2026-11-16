import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { ErrorCode } from '@common/constants/error-codes.constants';
import { AppException } from '@common/exceptions/app.exception';
import type { AuthContext } from '@common/interfaces/auth-context.interface';
import type { ClientInfo } from '@common/interfaces/client-info.interface';

import {
  DEFAULT_PASSWORD_POLICY,
  GLOBAL_POLICY_KEY,
  POLICY_CACHE_TTL_MS,
} from '../constants/password-policy.constants';
import type {
  PasswordPolicyResponseDto,
  PasswordRequirementsDto,
  UpdatePasswordPolicyDto,
} from '../dto/password-policy.dto';
import type { PasswordPolicyRules } from '../interfaces/password-policy-rules.interface';
import { PasswordPolicy } from '../schemas/password-policy.schema';
import { PolicyAuditService } from './policy-audit.service';

interface FieldError {
  field: string;
  message: string;
}

/**
 * The active password policy: read (cached briefly, so updates reach every
 * instance within POLICY_CACHE_TTL_MS without a restart), updated by admins
 * (atomic, audited), and the built-in default until one is saved.
 */
@Injectable()
export class PasswordPolicyService {
  private readonly logger = new Logger(PasswordPolicyService.name);
  private cache: { value: PasswordPolicyResponseDto; loadedAt: number } | null =
    null;

  constructor(
    @InjectModel(PasswordPolicy.name)
    private readonly policyModel: Model<PasswordPolicy>,
    private readonly policyAuditService: PolicyAuditService,
  ) {}

  /** The rules in force (cached). */
  async getRules(): Promise<PasswordPolicyRules> {
    return this.getPolicy();
  }

  async getPolicy(): Promise<PasswordPolicyResponseDto> {
    if (this.cache && Date.now() - this.cache.loadedAt < POLICY_CACHE_TTL_MS) {
      return this.cache.value;
    }
    const stored = await this.policyModel
      .findOne({ key: GLOBAL_POLICY_KEY })
      .lean();
    const value = stored ? toResponse(stored) : defaultResponse();
    this.cache = { value, loadedAt: Date.now() };
    return value;
  }

  async update(
    dto: UpdatePasswordPolicyDto,
    actor: AuthContext,
    client: ClientInfo,
  ): Promise<PasswordPolicyResponseDto> {
    const rules = normalize(dto);
    assertConsistent(rules);

    // Atomic upsert; the previous document comes back for the audit trail.
    const previous = await this.policyModel
      .findOneAndUpdate(
        { key: GLOBAL_POLICY_KEY },
        {
          $set: { ...rules, updatedBy: actor.userId },
          $inc: { version: 1 },
          $setOnInsert: { key: GLOBAL_POLICY_KEY, createdBy: actor.userId },
        },
        { upsert: true, new: false },
      )
      .lean();
    this.cache = null;
    const updated = await this.getPolicy();

    const changedFields = await this.policyAuditService.record({
      target: 'policy',
      changedBy: actor.userId,
      oldValues: previous ? rulesOf(previous) : null,
      newValues: rulesOf(updated),
      version: updated.version,
      client,
    });
    this.logger.log({
      message: previous ? 'Password policy updated' : 'Password policy created',
      userId: actor.userId,
      version: updated.version,
      changedFields,
      ipAddress: client.ipAddress,
    });
    return updated;
  }

  async getRequirements(): Promise<PasswordRequirementsDto> {
    const policy = await this.getRules();
    const {
      characterLength: length,
      complexity,
      additionalRules: extra,
    } = policy;
    const minimumUppercaseCount = effectiveCaseCount(
      complexity.requireUpperAndLowerCase,
      complexity.minimumUppercaseCount,
    );
    const minimumLowercaseCount = effectiveCaseCount(
      complexity.requireUpperAndLowerCase,
      complexity.minimumLowercaseCount,
    );
    const historyCount = policy.passwordHistory.preventReuse
      ? policy.passwordHistory.historyCount
      : 0;

    const rules = [
      `${String(length.minimum)}–${String(length.maximum)} characters`,
    ];
    const atLeast = (count: number, what: string) => {
      if (count > 0) {
        rules.push(`At least ${String(count)} ${what}${count > 1 ? 's' : ''}`);
      }
    };
    atLeast(minimumUppercaseCount, 'uppercase letter');
    atLeast(minimumLowercaseCount, 'lowercase letter');
    atLeast(complexity.minimumDigitCount, 'digit');
    atLeast(complexity.minimumSpecialCharacterCount, 'special character');
    if (!extra.allowWhitespace) {
      rules.push('No spaces');
    }
    if (extra.maximumRepeatedCharacters > 0) {
      rules.push(
        `No character repeated more than ${String(extra.maximumRepeatedCharacters)} times in a row`,
      );
    }
    if (extra.preventPersonalInfoInPassword) {
      rules.push('Must not contain your email, username or name');
    }
    if (extra.blockCommonPasswords) {
      rules.push('Must not be a commonly used password');
    }
    if (extra.blockCompromisedPasswords) {
      rules.push('Must not appear in known data breaches');
    }
    if (policy.passwordHistory.preventReuse) {
      rules.push(
        historyCount > 0
          ? `Must not be one of your last ${String(historyCount + 1)} passwords`
          : 'Must differ from your current password',
      );
    }

    return {
      minimumLength: length.minimum,
      maximumLength: length.maximum,
      minimumDigitCount: complexity.minimumDigitCount,
      minimumSpecialCharacterCount: complexity.minimumSpecialCharacterCount,
      minimumUppercaseCount,
      minimumLowercaseCount,
      allowWhitespace: extra.allowWhitespace,
      maximumRepeatedCharacters: extra.maximumRepeatedCharacters,
      blockCommonPasswords: extra.blockCommonPasswords,
      blockCompromisedPasswords: extra.blockCompromisedPasswords,
      preventPersonalInfoInPassword: extra.preventPersonalInfoInPassword,
      passwordHistoryCount: historyCount,
      rules,
    };
  }
}

/** requireUpperAndLowerCase means "at least 1"; an explicit count can raise it. */
export function effectiveCaseCount(
  isRequired: boolean,
  minimum: number,
): number {
  return Math.max(isRequired ? 1 : 0, minimum);
}

/** Plain rules object (drops class instances, unknown keys and metadata). */
function normalize(dto: UpdatePasswordPolicyDto): PasswordPolicyRules {
  return {
    policyName: dto.policyName,
    characterLength: {
      minimum: dto.characterLength.minimum,
      maximum: dto.characterLength.maximum,
    },
    complexity: {
      minimumDigitCount: dto.complexity.minimumDigitCount,
      minimumSpecialCharacterCount: dto.complexity.minimumSpecialCharacterCount,
      requireUpperAndLowerCase: dto.complexity.requireUpperAndLowerCase,
      minimumUppercaseCount: dto.complexity.minimumUppercaseCount,
      minimumLowercaseCount: dto.complexity.minimumLowercaseCount,
    },
    passwordHistory: {
      preventReuse: dto.passwordHistory.preventReuse,
      // History is meaningless without reuse prevention.
      historyCount: dto.passwordHistory.preventReuse
        ? dto.passwordHistory.historyCount
        : 0,
    },
    additionalRules: {
      blockCommonPasswords: dto.additionalRules.blockCommonPasswords,
      blockCompromisedPasswords: dto.additionalRules.blockCompromisedPasswords,
      preventPersonalInfoInPassword:
        dto.additionalRules.preventPersonalInfoInPassword,
      allowWhitespace: dto.additionalRules.allowWhitespace,
      maximumRepeatedCharacters: dto.additionalRules.maximumRepeatedCharacters,
      minimumPasswordAgeHours: dto.additionalRules.minimumPasswordAgeHours,
    },
    passwordValidity: {
      enabled: dto.passwordValidity.enabled,
      validityDays: dto.passwordValidity.validityDays,
      notificationDaysBeforeExpiry: [
        ...dto.passwordValidity.notificationDaysBeforeExpiry,
      ].sort((a, b) => b - a),
      gracePeriodDays: dto.passwordValidity.gracePeriodDays,
      forceChangeOnExpiry: dto.passwordValidity.forceChangeOnExpiry,
    },
  };
}

/** Rules that compare fields: 400 INVALID_PASSWORD_POLICY listing every problem. */
function assertConsistent(rules: PasswordPolicyRules): void {
  const errors: FieldError[] = [];
  const {
    characterLength: length,
    complexity,
    additionalRules: extra,
    passwordValidity: validity,
  } = rules;

  if (length.minimum > length.maximum) {
    errors.push({
      field: 'characterLength.minimum',
      message: 'Minimum length cannot exceed maximum length',
    });
  }
  const required =
    complexity.minimumDigitCount +
    complexity.minimumSpecialCharacterCount +
    effectiveCaseCount(
      complexity.requireUpperAndLowerCase,
      complexity.minimumUppercaseCount,
    ) +
    effectiveCaseCount(
      complexity.requireUpperAndLowerCase,
      complexity.minimumLowercaseCount,
    );
  if (required > length.maximum) {
    errors.push({
      field: 'complexity',
      message: `The required characters (${String(required)}) do not fit in the maximum length (${String(length.maximum)})`,
    });
  }
  if (extra.maximumRepeatedCharacters === 1) {
    errors.push({
      field: 'additionalRules.maximumRepeatedCharacters',
      message: 'Use 0 (no limit) or at least 2',
    });
  }
  const tooLate = validity.notificationDaysBeforeExpiry.filter(
    (days) => days >= validity.validityDays,
  );
  if (tooLate.length > 0) {
    errors.push({
      field: 'passwordValidity.notificationDaysBeforeExpiry',
      message: `Reminder days must be less than validityDays (${String(validity.validityDays)})`,
    });
  }
  if (
    validity.enabled &&
    extra.minimumPasswordAgeHours >= validity.validityDays * 24
  ) {
    errors.push({
      field: 'additionalRules.minimumPasswordAgeHours',
      message: 'Minimum password age must be shorter than the validity period',
    });
  }

  if (errors.length > 0) {
    throw new AppException(
      HttpStatus.BAD_REQUEST,
      ErrorCode.InvalidPasswordPolicy,
      'Password policy validation failed',
      errors,
    );
  }
}

function rulesOf(policy: PasswordPolicyRules): Record<string, unknown> {
  return {
    policyName: policy.policyName,
    characterLength: policy.characterLength,
    complexity: policy.complexity,
    passwordHistory: policy.passwordHistory,
    additionalRules: policy.additionalRules,
    passwordValidity: policy.passwordValidity,
  };
}

function toResponse(policy: PasswordPolicy): PasswordPolicyResponseDto {
  return {
    id: policy._id,
    policyName: policy.policyName,
    characterLength: policy.characterLength,
    complexity: policy.complexity,
    passwordHistory: policy.passwordHistory,
    additionalRules: policy.additionalRules,
    passwordValidity: policy.passwordValidity,
    isDefault: false,
    version: policy.version,
    updatedBy: policy.updatedBy,
    createdAt: policy.createdAt,
    updatedAt: policy.updatedAt,
  };
}

function defaultResponse(): PasswordPolicyResponseDto {
  return {
    id: null,
    ...structuredClone(DEFAULT_PASSWORD_POLICY),
    isDefault: true,
    version: 0,
    updatedBy: null,
    createdAt: null,
    updatedAt: null,
  };
}
