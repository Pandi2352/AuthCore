import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDefined,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import { trim } from '@common/utils/transform.util';

import { PASSWORD_HARD_LIMITS as LIMITS } from '../constants/password-policy.constants';

/*
 * Field-level limits live here (400 VALIDATION_FAILED); rules that compare
 * fields (minimum <= maximum, counts fit in the length, reminders within the
 * validity period) are checked by PasswordPolicyService (400
 * INVALID_PASSWORD_POLICY). Unknown fields are rejected everywhere.
 */

export class CharacterLengthDto {
  @ApiProperty({
    example: 8,
    minimum: LIMITS.minLength,
    maximum: LIMITS.maxLength,
  })
  @Max(LIMITS.maxLength)
  @Min(LIMITS.minLength)
  @IsInt()
  @IsDefined()
  minimum!: number;

  @ApiProperty({
    example: 64,
    minimum: LIMITS.minLength,
    maximum: LIMITS.maxLength,
  })
  @Max(LIMITS.maxLength)
  @Min(LIMITS.minLength)
  @IsInt()
  @IsDefined()
  maximum!: number;
}

export class ComplexityDto {
  @ApiProperty({
    example: 1,
    minimum: 0,
    maximum: LIMITS.maxCharacterClassCount,
  })
  @Max(LIMITS.maxCharacterClassCount)
  @Min(0)
  @IsInt()
  @IsDefined()
  minimumDigitCount!: number;

  @ApiProperty({
    example: 1,
    minimum: 0,
    maximum: LIMITS.maxCharacterClassCount,
  })
  @Max(LIMITS.maxCharacterClassCount)
  @Min(0)
  @IsInt()
  @IsDefined()
  minimumSpecialCharacterCount!: number;

  @ApiProperty({
    example: true,
    description: 'At least one lowercase and one uppercase letter',
  })
  @IsBoolean()
  @IsDefined()
  requireUpperAndLowerCase!: boolean;

  @ApiProperty({
    example: 0,
    minimum: 0,
    maximum: LIMITS.maxCharacterClassCount,
  })
  @Max(LIMITS.maxCharacterClassCount)
  @Min(0)
  @IsInt()
  @IsDefined()
  minimumUppercaseCount!: number;

  @ApiProperty({
    example: 0,
    minimum: 0,
    maximum: LIMITS.maxCharacterClassCount,
  })
  @Max(LIMITS.maxCharacterClassCount)
  @Min(0)
  @IsInt()
  @IsDefined()
  minimumLowercaseCount!: number;
}

export class PasswordHistoryDto {
  @ApiProperty({
    example: true,
    description: 'The current password can never be reused while on',
  })
  @IsBoolean()
  @IsDefined()
  preventReuse!: boolean;

  @ApiProperty({
    example: 5,
    minimum: 0,
    maximum: LIMITS.maxHistoryCount,
    description:
      'Previous passwords checked besides the current one (0 when preventReuse is off)',
  })
  @Max(LIMITS.maxHistoryCount)
  @Min(0)
  @IsInt()
  @IsDefined()
  historyCount!: number;
}

export class AdditionalRulesDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  @IsDefined()
  blockCommonPasswords!: boolean;

  @ApiProperty({
    example: false,
    description:
      'Check new passwords against Have I Been Pwned (k-anonymity: only the first 5 characters ' +
      'of the SHA-1 hash are sent). If the service is unreachable the check is skipped.',
  })
  @IsBoolean()
  @IsDefined()
  blockCompromisedPasswords!: boolean;

  @ApiProperty({
    example: true,
    description: 'Email name, username, first / last name not allowed',
  })
  @IsBoolean()
  @IsDefined()
  preventPersonalInfoInPassword!: boolean;

  @ApiProperty({ example: false })
  @IsBoolean()
  @IsDefined()
  allowWhitespace!: boolean;

  @ApiProperty({
    example: 0,
    minimum: 0,
    maximum: LIMITS.maxRepeatedCharacters,
    description:
      'Longest run of one character, e.g. 3 rejects "aaaa" (0 = no limit; else at least 2)',
  })
  @Max(LIMITS.maxRepeatedCharacters)
  @Min(0)
  @IsInt()
  @IsDefined()
  maximumRepeatedCharacters!: number;

  @ApiProperty({
    example: 0,
    minimum: 0,
    maximum: LIMITS.maxMinimumAgeHours,
    description:
      'Minimum hours between password changes by the user (0 = no limit)',
  })
  @Max(LIMITS.maxMinimumAgeHours)
  @Min(0)
  @IsInt()
  @IsDefined()
  minimumPasswordAgeHours!: number;
}

export class PasswordValidityDto {
  @ApiProperty({
    example: false,
    description: 'Passwords expire after validityDays',
  })
  @IsBoolean()
  @IsDefined()
  enabled!: boolean;

  @ApiProperty({ example: 90, minimum: 1, maximum: LIMITS.maxValidityDays })
  @Max(LIMITS.maxValidityDays)
  @Min(1)
  @IsInt()
  @IsDefined()
  validityDays!: number;

  @ApiProperty({
    example: [14, 7, 3],
    type: [Number],
    description:
      'Reminder emails this many days before expiry (each smaller than validityDays)',
  })
  @Max(LIMITS.maxValidityDays, { each: true })
  @Min(1, { each: true })
  @IsInt({ each: true })
  @ArrayUnique()
  @ArrayMaxSize(LIMITS.maxNotificationDays)
  @IsArray()
  @IsDefined()
  notificationDaysBeforeExpiry!: number[];

  @ApiProperty({ example: 0, minimum: 0, maximum: LIMITS.maxGracePeriodDays })
  @Max(LIMITS.maxGracePeriodDays)
  @Min(0)
  @IsInt()
  @IsDefined()
  gracePeriodDays!: number;

  @ApiProperty({
    example: true,
    description:
      'After expiry (+ grace): the user can only change the password, read /me and sign out. ' +
      'Off: expiry is informational only.',
  })
  @IsBoolean()
  @IsDefined()
  forceChangeOnExpiry!: boolean;
}

/** PUT /password-policies: the complete policy (every group is required). */
export class UpdatePasswordPolicyDto {
  @ApiProperty({ example: 'default', maxLength: 100 })
  @Transform(trim)
  @MaxLength(100)
  @IsNotEmpty({ message: 'policyName is required' })
  @IsString()
  @IsDefined({ message: 'policyName is required' })
  policyName!: string;

  @ApiProperty({ type: CharacterLengthDto })
  @ValidateNested()
  @Type(() => CharacterLengthDto)
  @IsObject()
  @IsDefined()
  characterLength!: CharacterLengthDto;

  @ApiProperty({ type: ComplexityDto })
  @ValidateNested()
  @Type(() => ComplexityDto)
  @IsObject()
  @IsDefined()
  complexity!: ComplexityDto;

  @ApiProperty({ type: PasswordHistoryDto })
  @ValidateNested()
  @Type(() => PasswordHistoryDto)
  @IsObject()
  @IsDefined()
  passwordHistory!: PasswordHistoryDto;

  @ApiProperty({ type: AdditionalRulesDto })
  @ValidateNested()
  @Type(() => AdditionalRulesDto)
  @IsObject()
  @IsDefined()
  additionalRules!: AdditionalRulesDto;

  @ApiProperty({ type: PasswordValidityDto })
  @ValidateNested()
  @Type(() => PasswordValidityDto)
  @IsObject()
  @IsDefined()
  passwordValidity!: PasswordValidityDto;
}

export class PasswordPolicyResponseDto {
  @ApiProperty({
    type: String,
    nullable: true,
    example: '01a1e301-7b1c-7d2e-9f40-6a5b4c3d2e1f',
    description:
      'null while the built-in default is in use (nothing saved yet)',
  })
  id!: string | null;

  @ApiProperty({ example: 'default' })
  policyName!: string;

  @ApiProperty({ type: CharacterLengthDto })
  characterLength!: CharacterLengthDto;

  @ApiProperty({ type: ComplexityDto })
  complexity!: ComplexityDto;

  @ApiProperty({ type: PasswordHistoryDto })
  passwordHistory!: PasswordHistoryDto;

  @ApiProperty({ type: AdditionalRulesDto })
  additionalRules!: AdditionalRulesDto;

  @ApiProperty({ type: PasswordValidityDto })
  passwordValidity!: PasswordValidityDto;

  @ApiProperty({
    example: true,
    description: 'true = built-in default (never saved)',
  })
  isDefault!: boolean;

  @ApiProperty({
    example: true,
    description: 'The policy in force (exactly one is active)',
  })
  isActive!: boolean;

  @ApiProperty({
    example: 1,
    description: 'Incremented on every update; 0 for the built-in default',
  })
  version!: number;

  @ApiProperty({
    type: String,
    nullable: true,
    example: '01a1e2fc-ed85-786d-b210-770651b13404',
  })
  updatedBy!: string | null;

  @ApiProperty({
    type: Date,
    nullable: true,
    example: '2026-11-16T05:30:00.000Z',
  })
  createdAt!: Date | null;

  @ApiProperty({
    type: Date,
    nullable: true,
    example: '2026-11-16T05:30:00.000Z',
  })
  updatedAt!: Date | null;
}

/** What a sign-up / reset / change form needs to show and pre-check (public). */
export class PasswordRequirementsDto {
  @ApiProperty({ example: 8 })
  minimumLength!: number;

  @ApiProperty({ example: 64 })
  maximumLength!: number;

  @ApiProperty({ example: 1 })
  minimumDigitCount!: number;

  @ApiProperty({ example: 1 })
  minimumSpecialCharacterCount!: number;

  @ApiProperty({ example: 1 })
  minimumUppercaseCount!: number;

  @ApiProperty({ example: 1 })
  minimumLowercaseCount!: number;

  @ApiProperty({ example: false })
  allowWhitespace!: boolean;

  @ApiProperty({ example: 0 })
  maximumRepeatedCharacters!: number;

  @ApiProperty({ example: true })
  blockCommonPasswords!: boolean;

  @ApiProperty({ example: false })
  blockCompromisedPasswords!: boolean;

  @ApiProperty({ example: true })
  preventPersonalInfoInPassword!: boolean;

  @ApiProperty({
    example: 5,
    description: 'Recent passwords that cannot be reused (0 = none)',
  })
  passwordHistoryCount!: number;

  @ApiProperty({
    type: [String],
    example: [
      '8–64 characters',
      'At least 1 digit',
      'At least 1 special character',
    ],
    description: 'Human-readable list, ready to display',
  })
  rules!: string[];
}

export class PolicyAuditEntryDto {
  @ApiProperty({ example: '01a1e301-7b1c-7d2e-9f40-6a5b4c3d2e1f' })
  id!: string;

  @ApiProperty({
    example: 'policy',
    description: '"policy" or "scheduler:<JOB>"',
  })
  target!: string;

  @ApiProperty({ example: 'UPDATE', enum: ['CREATE', 'UPDATE'] })
  action!: string;

  @ApiProperty({ example: '01a1e2fc-ed85-786d-b210-770651b13404' })
  changedBy!: string;

  @ApiProperty({ type: [String], example: ['characterLength.minimum'] })
  changedFields!: string[];

  @ApiProperty({
    type: Object,
    nullable: true,
    example: { characterLength: { minimum: 8, maximum: 64 } },
  })
  oldValues!: Record<string, unknown> | null;

  @ApiProperty({
    type: Object,
    example: { characterLength: { minimum: 10, maximum: 64 } },
  })
  newValues!: Record<string, unknown>;

  @ApiProperty({ type: Number, nullable: true, example: 2 })
  version!: number | null;

  @ApiProperty({ type: String, nullable: true, example: '203.0.113.10' })
  ipAddress!: string | null;

  @ApiProperty({ example: '2026-11-16T05:30:00.000Z' })
  createdAt!: Date;
}
