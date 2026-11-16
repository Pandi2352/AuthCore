import {
  ApiProperty,
  ApiPropertyOptional,
  OmitType,
  PartialType,
} from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDefined,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import {
  normalizeName,
  trim,
  trimLower,
  trimOrUndefined,
  trimUpper,
} from '@common/utils/transform.util';

import {
  ATTRIBUTE_NAME_MAX_LENGTH,
  ATTRIBUTE_NAME_PATTERN,
  LOCALE_PATTERN,
  MAX_OPTIONS,
  SCOPE_PATTERN,
} from '../constants/user-schema.constants';
import {
  AttributeDataType,
  AttributeGroupType,
  AttributeKind,
  AttributeMutability,
  AttributeReturned,
} from '../enums/user-schema.enum';

const toBoolean = ({ value }: { value: unknown }): unknown =>
  value === 'true' ? true : value === 'false' ? false : value;

export class AttributeOptionDto {
  @ApiProperty({ example: 'engineering' })
  @MaxLength(100)
  @IsNotEmpty()
  @Transform(trim)
  @IsString()
  @IsDefined()
  value!: string;

  @ApiProperty({ example: 'Engineering' })
  @MaxLength(100)
  @IsNotEmpty()
  @Transform(normalizeName)
  @IsString()
  @IsDefined()
  label!: string;
}

export class CreateAttributeDto {
  @ApiProperty({
    example: 'employee_id',
    description:
      'snake_case, unique among its siblings; the key in `attributes`',
  })
  @Matches(ATTRIBUTE_NAME_PATTERN, {
    message:
      'name must be snake_case: a lowercase letter, then letters, digits or _',
  })
  @MaxLength(ATTRIBUTE_NAME_MAX_LENGTH)
  @Transform(trimLower)
  @IsString()
  @IsDefined({ message: 'name is required' })
  name!: string;

  @ApiPropertyOptional({
    example: 'Employee ID',
    description: 'Display label (default: from the name)',
  })
  @MaxLength(100)
  @Transform(normalizeName)
  @IsString()
  @IsOptional()
  label?: string;

  @ApiPropertyOptional({ example: 'HR employee number', maxLength: 500 })
  @MaxLength(500)
  @Transform(trim)
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    enum: AttributeKind,
    example: AttributeKind.Field,
    description: 'FIELD (a value) or GROUP (child variables)',
  })
  @IsEnum(AttributeKind)
  @Transform(trimUpper)
  @IsDefined({ message: 'kind is required' })
  kind!: AttributeKind;

  @ApiPropertyOptional({
    enum: AttributeDataType,
    example: AttributeDataType.Text,
    description: 'Required for FIELD',
  })
  @IsEnum(AttributeDataType)
  @Transform(trimUpper)
  @IsOptional()
  dataType?: AttributeDataType;

  @ApiPropertyOptional({
    enum: AttributeGroupType,
    example: AttributeGroupType.Object,
    description: 'GROUP: "Field Group Type" (default OBJECT)',
  })
  @IsEnum(AttributeGroupType)
  @Transform(trimUpper)
  @IsOptional()
  groupType?: AttributeGroupType;

  @ApiPropertyOptional({
    description: 'Parent GROUP id (the "+" on a group row)',
  })
  @IsUUID('all')
  @Transform(trimLower)
  @IsOptional()
  parentId?: string;

  @ApiPropertyOptional({
    type: [AttributeOptionDto],
    description: 'DROPDOWN / MULTI_SELECT: the choices',
  })
  @ValidateNested({ each: true })
  @Type(() => AttributeOptionDto)
  @ArrayMaxSize(MAX_OPTIONS)
  @IsArray()
  @IsOptional()
  options?: AttributeOptionDto[];

  @ApiPropertyOptional({ example: 1 })
  @Max(10_000)
  @Min(0)
  @IsInt()
  @IsOptional()
  minLength?: number;

  @ApiPropertyOptional({ example: 20 })
  @Max(10_000)
  @Min(1)
  @IsInt()
  @IsOptional()
  maxLength?: number;

  @ApiPropertyOptional({ description: 'NUMBER: smallest allowed value' })
  @IsNumber()
  @IsOptional()
  min?: number;

  @ApiPropertyOptional({ description: 'NUMBER: largest allowed value' })
  @IsNumber()
  @IsOptional()
  max?: number;

  @ApiProperty({
    type: [String],
    example: ['profile'],
    description:
      'OpenID Connect scopes the variable is released under (GET /user-schema/options)',
  })
  @Matches(SCOPE_PATTERN, {
    each: true,
    message: 'each scope must be lowercase letters, digits, _ : . -',
  })
  @ArrayUnique()
  @ArrayMaxSize(20)
  @ArrayMinSize(1, { message: 'select at least one scope' })
  @IsArray()
  @IsDefined({ message: 'scopes is required' })
  scopes!: string[];

  @ApiProperty({
    type: [String],
    example: ['en'],
    description: 'Locales the variable applies to',
  })
  @Matches(LOCALE_PATTERN, {
    each: true,
    message: 'each locale must look like "en" or "en-IN"',
  })
  @ArrayUnique()
  @ArrayMaxSize(50)
  @ArrayMinSize(1, { message: 'select at least one locale' })
  @IsArray()
  @IsDefined({ message: 'locales is required' })
  locales!: string[];

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  isEnabled?: boolean;
  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  isRequired?: boolean;
  @ApiPropertyOptional({
    default: false,
    description: 'Admins only; hidden from the user',
  })
  @IsBoolean()
  @IsOptional()
  isInternal?: boolean;
  @ApiPropertyOptional({
    default: false,
    description:
      'Usable to sign in (implies unique; TEXT / EMAIL / MOBILE / NUMBER)',
  })
  @IsBoolean()
  @IsOptional()
  isUsername?: boolean;
  @ApiPropertyOptional({
    default: false,
    description: 'Stored hashed, never returned (write-only)',
  })
  @IsBoolean()
  @IsOptional()
  isPassword?: boolean;
  @ApiPropertyOptional({
    default: false,
    description: 'No two users may have the same value',
  })
  @IsBoolean()
  @IsOptional()
  isUnique?: boolean;
  @ApiPropertyOptional({
    default: false,
    description: 'Must equal `matchWith` in the same request',
  })
  @IsBoolean()
  @IsOptional()
  isMatchEnabled?: boolean;

  @ApiPropertyOptional({
    example: 'password',
    description: 'With isMatchEnabled: sibling variable to match',
  })
  @Matches(ATTRIBUTE_NAME_PATTERN)
  @Transform(trimLower)
  @IsString()
  @IsOptional()
  matchWith?: string;

  @ApiPropertyOptional({
    default: false,
    description: 'Added to the access token (claim `attrs`)',
  })
  @IsBoolean()
  @IsOptional()
  includeInToken?: boolean;
  @ApiPropertyOptional({
    default: false,
    description:
      'Admins can filter users by it: GET /admin/users?attr[name]=value',
  })
  @IsBoolean()
  @IsOptional()
  includeInSearchFilter?: boolean;

  @ApiPropertyOptional({
    enum: AttributeMutability,
    default: AttributeMutability.ReadWrite,
  })
  @IsEnum(AttributeMutability)
  @Transform(trimUpper)
  @IsOptional()
  mutability?: AttributeMutability;

  @ApiPropertyOptional({
    enum: AttributeReturned,
    default: AttributeReturned.Default,
  })
  @IsEnum(AttributeReturned)
  @Transform(trimUpper)
  @IsOptional()
  returned?: AttributeReturned;

  @ApiPropertyOptional({
    example: 10,
    description: 'Position in forms (ascending)',
  })
  @Max(100_000)
  @Min(0)
  @IsInt()
  @IsOptional()
  displayOrder?: number;
}

/** name, kind, type and parent are fixed after creation (existing values depend on them). */
export class UpdateAttributeDto extends PartialType(
  OmitType(CreateAttributeDto, [
    'name',
    'kind',
    'dataType',
    'groupType',
    'parentId',
  ] as const),
) {
  @ApiPropertyOptional({
    example: 2,
    description: 'The version you loaded (409 VERSION_CONFLICT if it changed)',
  })
  @Min(1)
  @IsInt()
  @IsOptional()
  version?: number;
}

export class AttributeListQueryDto {
  @ApiPropertyOptional({
    description: '"Search by name" (name or label, case-insensitive)',
  })
  @Transform(trimOrUndefined)
  @MaxLength(100)
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    default: false,
    description: 'Flat list instead of a tree',
  })
  @IsBoolean()
  @Transform(toBoolean)
  @IsOptional()
  flat?: boolean;
}

export class AttributeResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'employee_id' }) name!: string;
  @ApiProperty({ example: 'Employee ID' }) label!: string;
  @ApiProperty() description!: string;
  @ApiProperty({ enum: AttributeKind }) kind!: AttributeKind;
  @ApiProperty({ enum: AttributeDataType, nullable: true })
  dataType!: AttributeDataType | null;
  @ApiProperty({ enum: AttributeGroupType, nullable: true })
  groupType!: AttributeGroupType | null;
  @ApiProperty({ type: String, nullable: true }) parentId!: string | null;
  @ApiProperty({ type: [AttributeOptionDto] }) options!: AttributeOptionDto[];
  @ApiProperty({ type: Number, nullable: true }) minLength!: number | null;
  @ApiProperty({ type: Number, nullable: true }) maxLength!: number | null;
  @ApiProperty({ type: Number, nullable: true }) min!: number | null;
  @ApiProperty({ type: Number, nullable: true }) max!: number | null;
  @ApiProperty({ type: [String] }) scopes!: string[];
  @ApiProperty({ type: [String] }) locales!: string[];
  @ApiProperty() isEnabled!: boolean;
  @ApiProperty() isRequired!: boolean;
  @ApiProperty() isInternal!: boolean;
  @ApiProperty() isUsername!: boolean;
  @ApiProperty() isPassword!: boolean;
  @ApiProperty() isUnique!: boolean;
  @ApiProperty() isMatchEnabled!: boolean;
  @ApiProperty({ type: String, nullable: true }) matchWith!: string | null;
  @ApiProperty() includeInToken!: boolean;
  @ApiProperty() includeInSearchFilter!: boolean;
  @ApiProperty({ enum: AttributeMutability }) mutability!: AttributeMutability;
  @ApiProperty({ enum: AttributeReturned }) returned!: AttributeReturned;
  @ApiProperty() displayOrder!: number;
  @ApiProperty({ description: 'Seeded OpenID Connect claim' })
  isSystem!: boolean;
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Built-in user field it maps to',
  })
  coreField!: string | null;
  @ApiProperty() version!: number;
  @ApiProperty() updatedAt!: Date;
  @ApiPropertyOptional({
    type: () => [AttributeResponseDto],
    description: 'Tree view: child variables of a GROUP',
  })
  children?: AttributeResponseDto[];
}

export class OptionItemDto {
  @ApiProperty() value!: string;
  @ApiProperty() label!: string;
}

export class SchemaOptionsDto {
  @ApiProperty({ type: [OptionItemDto] }) kinds!: OptionItemDto[];
  @ApiProperty({ type: [OptionItemDto] }) dataTypes!: OptionItemDto[];
  @ApiProperty({ type: [OptionItemDto], description: 'Field Group Types' })
  groupTypes!: OptionItemDto[];
  @ApiProperty({ type: [OptionItemDto] }) scopes!: OptionItemDto[];
  @ApiProperty({ type: [OptionItemDto] }) locales!: OptionItemDto[];
  @ApiProperty({ type: [OptionItemDto] }) mutability!: OptionItemDto[];
  @ApiProperty({ type: [OptionItemDto] }) returned!: OptionItemDto[];
}

/** PATCH /users/me/attributes and /admin/users/:id/attributes */
export class UpdateAttributesDto {
  @ApiProperty({
    type: Object,
    example: {
      given_name: 'Royston',
      middle_name: null,
      gender: 'male',
      birthdate: '1995-04-12',
      phone_number: '+919876543210',
      address: { locality: 'Bengaluru', country: 'India' },
    },
    description:
      'Variable name → value (null clears). Validated against the user schema; groups are merged.',
  })
  @IsObject()
  @IsDefined({ message: 'attributes is required' })
  attributes!: Record<string, unknown>;
}

export class ProfileQueryDto {
  @ApiPropertyOptional({
    example: 'employee_id,nickname',
    description: 'Also return these returned=REQUEST variables',
  })
  @Transform(trimOrUndefined)
  @MaxLength(500)
  @IsString()
  @IsOptional()
  include?: string;
}

export class ProfileAttributesDto {
  @ApiProperty({
    type: Object,
    description: 'Variable values visible to the caller',
  })
  attributes!: Record<string, unknown>;

  @ApiProperty({
    type: [String],
    example: ['phone_number'],
    description: 'Required variables without a value',
  })
  missingRequired!: string[];
}
