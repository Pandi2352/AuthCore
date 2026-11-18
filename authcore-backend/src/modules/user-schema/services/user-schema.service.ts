import {
  HttpStatus,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { ErrorCode } from '@common/constants/error-codes.constants';
import { AppException } from '@common/exceptions/app.exception';
import { ValidationException } from '@common/exceptions/validation.exception';
import type { ApiFieldError } from '@common/interfaces/api-response.interface';
import { containsPattern } from '@common/utils/query.util';
import { generateUuid } from '@common/utils/uuid.util';
import {
  AuditAction,
  AuditEntity,
} from '@modules/access-control/enums/access-control.enum';
import type { Actor } from '@modules/access-control/interfaces/actor.interface';
import { AccessAuditService } from '@modules/access-control/services/access-audit.service';
import { UsersService } from '@modules/users/users.service';

import {
  LENGTH_TYPES,
  OPTION_TYPES,
  SCHEMA_CACHE_TTL_MS,
  STANDARD_SCOPES,
  SUPPORTED_LOCALES,
  SYSTEM_ATTRIBUTES,
  type SystemAttribute,
  USERNAME_TYPES,
} from '../constants/user-schema.constants';
import type {
  AttributeListQueryDto,
  AttributeResponseDto,
  CreateAttributeDto,
  SchemaOptionsDto,
  UpdateAttributeDto,
} from '../dto/user-attribute.dto';
import {
  AttributeDataType,
  AttributeGroupType,
  AttributeKind,
  AttributeMutability,
  AttributeReturned,
} from '../enums/user-schema.enum';
import { UserAttribute } from '../schemas/user-attribute.schema';

export interface CoreFieldSetting {
  label: string;
  isEnabled: boolean;
  isRequired: boolean;
  maxLength: number | null;
}

const SYSTEM_ACTOR = 'system';
/** Attributes of system variables that admins may not change. */
const SYSTEM_FIXED = [
  'isInternal',
  'isUsername',
  'isPassword',
  'isUnique',
  'isMatchEnabled',
  'matchWith',
  'mutability',
] as const;
const CORE_FIXED = ['isEnabled', 'isRequired', 'returned'] as const;

type Definition = UserAttribute;

/**
 * The user schema: definitions of the variables a user profile has (custom
 * ones plus the seeded OpenID Connect claims). Cached briefly; every change
 * clears the cache on this instance (others within SCHEMA_CACHE_TTL_MS).
 */
@Injectable()
export class UserSchemaService implements OnApplicationBootstrap {
  private readonly logger = new Logger(UserSchemaService.name);
  private cache: { items: Definition[]; loadedAt: number } | null = null;

  constructor(
    @InjectModel(UserAttribute.name)
    private readonly attributeModel: Model<UserAttribute>,
    private readonly usersService: UsersService,
    private readonly auditService: AccessAuditService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      for (const [index, definition] of SYSTEM_ATTRIBUTES.entries()) {
        const id = await this.seed(definition, null, index * 10);
        for (const [childIndex, child] of (
          definition.children ?? []
        ).entries()) {
          await this.seed(child, id, childIndex * 10);
        }
      }
      this.cache = null;
    } catch (error) {
      this.logger.error(
        { message: 'User schema system variables could not be seeded' },
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  /** All definitions (cached). */
  async definitions(): Promise<Definition[]> {
    if (this.cache && Date.now() - this.cache.loadedAt < SCHEMA_CACHE_TTL_MS) {
      return this.cache.items;
    }
    const items = await this.attributeModel
      .find()
      .sort({ displayOrder: 1, name: 1 })
      .lean();
    this.cache = { items, loadedAt: Date.now() };
    return items;
  }

  async list(query: AttributeListQueryDto): Promise<AttributeResponseDto[]> {
    const all = (await this.definitions()).map(toResponse);
    if (query.search) {
      const pattern = containsPattern(query.search);
      return all.filter((a) => pattern.test(a.name) || pattern.test(a.label));
    }
    return query.flat ? all : toTree(all);
  }

  async get(id: string): Promise<AttributeResponseDto> {
    const all = (await this.definitions()).map(toResponse);
    const found = all.find((a) => a.id === id);
    if (!found) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.NotFound,
        'Variable not found',
      );
    }
    return found.kind === AttributeKind.Group
      ? Object.assign(found, { children: all.filter((a) => a.parentId === id) })
      : found;
  }

  /**
   * What an admin form shows (create / edit a user): enabled variables incl. internal ones,
   * without the built-in fields (names, username, email, password) — those have their own inputs.
   */
  async adminForm(): Promise<AttributeResponseDto[]> {
    const all = (await this.definitions())
      .filter(
        (d) =>
          d.isEnabled && !d.coreField && !d.isPassword && !d.isMatchEnabled,
      )
      .map(toResponse);
    return toTree(all);
  }

  /** Label / enabled / required / max length of the built-in name fields (from the schema). */
  async coreFieldSettings(): Promise<
    Record<'firstName' | 'lastName' | 'username', CoreFieldSetting>
  > {
    const all = await this.definitions();
    const setting = (
      coreField: 'firstName' | 'lastName' | 'username',
      fallback: CoreFieldSetting,
    ): CoreFieldSetting => {
      const d = all.find((a) => a.coreField === coreField);
      return d
        ? {
            label: d.label,
            isEnabled: d.isEnabled,
            isRequired: d.isRequired,
            maxLength: d.maxLength ?? fallback.maxLength,
          }
        : fallback;
    };
    return {
      // First name is always required by the account model.
      firstName: {
        ...setting('firstName', {
          label: 'First name',
          isEnabled: true,
          isRequired: true,
          maxLength: 50,
        }),
        isEnabled: true,
        isRequired: true,
      },
      lastName: setting('lastName', {
        label: 'Last name',
        isEnabled: true,
        isRequired: false,
        maxLength: 50,
      }),
      username: setting('username', {
        label: 'Username',
        isEnabled: true,
        isRequired: false,
        maxLength: 30,
      }),
    };
  }

  /** What a user profile form shows: enabled, not internal, tree. */
  async form(): Promise<AttributeResponseDto[]> {
    const all = (await this.definitions())
      .filter((d) => d.isEnabled && !d.isInternal)
      .map(toResponse);
    return toTree(all);
  }

  options(): SchemaOptionsDto {
    const items = (values: string[]) =>
      values.map((value) => ({ value, label: humanize(value) }));
    return {
      kinds: items(Object.values(AttributeKind)),
      dataTypes: items(Object.values(AttributeDataType)),
      groupTypes: items(Object.values(AttributeGroupType)),
      scopes: items([...STANDARD_SCOPES]),
      locales: SUPPORTED_LOCALES.map((value) => ({ value, label: value })),
      mutability: items(Object.values(AttributeMutability)),
      returned: items(Object.values(AttributeReturned)),
    };
  }

  async create(
    dto: CreateAttributeDto,
    actor: Actor,
  ): Promise<AttributeResponseDto> {
    const parent = dto.parentId
      ? await this.attributeModel.findById(dto.parentId).lean()
      : null;
    if (dto.parentId && !parent) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.NotFound,
        'Parent variable not found',
        [{ field: 'parentId', message: 'not found' }],
      );
    }
    const definition = normalize({
      name: dto.name,
      label: dto.label ?? humanize(dto.name),
      description: dto.description ?? '',
      kind: dto.kind,
      dataType:
        dto.kind === AttributeKind.Field ? (dto.dataType ?? null) : null,
      groupType:
        dto.kind === AttributeKind.Group
          ? (dto.groupType ?? AttributeGroupType.Object)
          : null,
      parentId: parent?._id ?? null,
      options: dto.options ?? [],
      minLength: dto.minLength ?? null,
      maxLength: dto.maxLength ?? null,
      min: dto.min ?? null,
      max: dto.max ?? null,
      scopes: dto.scopes,
      locales: dto.locales,
      isEnabled: dto.isEnabled ?? true,
      isRequired: dto.isRequired ?? false,
      isInternal: dto.isInternal ?? false,
      isUsername: dto.isUsername ?? false,
      isPassword: dto.isPassword ?? false,
      isUnique: dto.isUnique ?? false,
      isMatchEnabled: dto.isMatchEnabled ?? false,
      matchWith: dto.matchWith ?? null,
      includeInToken: dto.includeInToken ?? false,
      includeInSearchFilter: dto.includeInSearchFilter ?? false,
      mutability: dto.mutability ?? AttributeMutability.ReadWrite,
      returned: dto.returned ?? AttributeReturned.Default,
      displayOrder: dto.displayOrder ?? 1000,
    });
    if (dto.kind === AttributeKind.Field && !dto.dataType) {
      throw new ValidationException([
        { field: 'dataType', message: 'dataType is required for a FIELD' },
      ]);
    }
    if (dto.kind === AttributeKind.Group && dto.dataType) {
      throw new ValidationException([
        {
          field: 'dataType',
          message: 'a GROUP has no dataType (use groupType)',
        },
      ]);
    }
    await this.assertConsistent(definition, parent, null);
    if (
      await this.attributeModel.exists({
        parentId: definition.parentId,
        name: definition.name,
      })
    ) {
      throw new AppException(
        HttpStatus.CONFLICT,
        ErrorCode.DuplicateResource,
        `A variable named "${definition.name}" already exists here`,
        [{ field: 'name', message: 'already exists' }],
      );
    }
    const created = await this.attributeModel.create({
      _id: generateUuid(),
      ...definition,
      isSystem: false,
      coreField: null,
      createdBy: actor.auth.userId,
      updatedBy: actor.auth.userId,
    });
    this.cache = null;
    await this.audit(actor, created._id, AuditAction.Create, null, {
      name: created.name,
      kind: created.kind,
      dataType: created.dataType,
      parentId: created.parentId,
    });
    this.logger.log({
      message: 'User schema variable created',
      name: created.name,
      userId: actor.auth.userId,
    });
    return this.get(created._id);
  }

  async update(
    id: string,
    dto: UpdateAttributeDto,
    actor: Actor,
  ): Promise<AttributeResponseDto> {
    const current = await this.attributeModel.findById(id).lean();
    if (!current) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.NotFound,
        'Variable not found',
      );
    }
    if (dto.version !== undefined && dto.version !== current.version) {
      throw new AppException(
        HttpStatus.CONFLICT,
        ErrorCode.VersionConflict,
        'This variable was changed by someone else. Reload it and try again.',
      );
    }
    const changes: Omit<UpdateAttributeDto, 'version'> = Object.assign({}, dto);
    delete (changes as { version?: number }).version;
    if (current.isSystem) {
      const blocked = [
        ...SYSTEM_FIXED,
        ...(current.coreField ? CORE_FIXED : []),
      ].filter((key) => changes[key as keyof typeof changes] !== undefined);
      if (blocked.length > 0) {
        throw new AppException(
          HttpStatus.CONFLICT,
          ErrorCode.SystemResourceProtected,
          'These settings of a system variable cannot be changed',
          blocked.map((field) => ({
            field,
            message: 'fixed for system variables',
          })),
        );
      }
    }
    const merged = normalize({
      ...pickDefinition(current),
      ...stripUndefined(changes),
    });
    const parent = current.parentId
      ? await this.attributeModel.findById(current.parentId).lean()
      : null;
    await this.assertConsistent(merged, parent, current);
    const result = await this.attributeModel.updateOne(
      { _id: id, version: current.version },
      {
        $set: {
          ...stripUndefined(changes),
          ...pickNormalized(merged),
          updatedBy: actor.auth.userId,
        },
        $inc: { version: 1 },
      },
    );
    if (result.modifiedCount === 0) {
      throw new AppException(
        HttpStatus.CONFLICT,
        ErrorCode.VersionConflict,
        'This variable was changed by someone else. Reload it and try again.',
      );
    }
    this.cache = null;
    await this.audit(actor, id, AuditAction.Update, null, {
      ...stripUndefined(changes),
    });
    return this.get(id);
  }

  /** Deletes a custom variable and removes its values from every user. */
  async remove(
    id: string,
    actor: Actor,
  ): Promise<{ id: string; valuesRemovedFrom: number }> {
    const current = await this.attributeModel.findById(id).lean();
    if (!current) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.NotFound,
        'Variable not found',
      );
    }
    if (current.isSystem) {
      throw new AppException(
        HttpStatus.CONFLICT,
        ErrorCode.SystemResourceProtected,
        'System variables cannot be deleted (disable them instead)',
      );
    }
    const childCount = await this.attributeModel.countDocuments({
      parentId: id,
    });
    if (childCount > 0) {
      throw new AppException(
        HttpStatus.CONFLICT,
        ErrorCode.ResourceInUse,
        `This group has ${String(childCount)} variable(s). Delete them first.`,
        [
          {
            field: 'children',
            message: `has ${String(childCount)} variable(s)`,
          },
        ],
      );
    }
    const parent = current.parentId
      ? await this.attributeModel.findById(current.parentId).lean()
      : null;
    await this.attributeModel.deleteOne({ _id: id });
    const valuesRemovedFrom = await this.usersService.unsetAttributeEverywhere(
      parent ? `${parent.name}.${current.name}` : current.name,
    );
    this.cache = null;
    await this.audit(
      actor,
      id,
      AuditAction.Delete,
      { name: current.name },
      { valuesRemovedFrom },
    );
    return { id, valuesRemovedFrom };
  }

  private async seed(
    definition: SystemAttribute,
    parentId: string | null,
    displayOrder: number,
  ): Promise<string> {
    const fixed = {
      kind: definition.kind,
      dataType: definition.dataType ?? null,
      groupType:
        definition.kind === AttributeKind.Group
          ? AttributeGroupType.Object
          : null,
      coreField: definition.coreField ?? null,
      isSystem: true,
      isPassword: definition.isPassword ?? false,
      isUnique: definition.isUnique ?? false,
      isUsername: definition.isUsername ?? false,
      isMatchEnabled: definition.isMatchEnabled ?? false,
      matchWith: definition.matchWith ?? null,
      isInternal: false,
      mutability: definition.mutability ?? AttributeMutability.ReadWrite,
    };
    await this.attributeModel
      .updateOne(
        { parentId, name: definition.name },
        {
          $set: fixed,
          $setOnInsert: {
            _id: generateUuid(),
            parentId,
            name: definition.name,
            label: definition.label,
            description: definition.description,
            options: definition.options ?? [],
            minLength: null,
            maxLength: definition.maxLength ?? null,
            min: null,
            max: null,
            scopes: definition.scopes,
            locales: ['en'],
            isEnabled: true,
            isRequired: false,
            includeInToken: false,
            includeInSearchFilter: false,
            returned: definition.returned ?? AttributeReturned.Default,
            displayOrder,
            createdBy: SYSTEM_ACTOR,
            updatedBy: SYSTEM_ACTOR,
            version: 1,
          },
        },
        { upsert: true },
      )
      .catch((error: unknown) => {
        if ((error as { code?: unknown }).code !== 11000) {
          throw error;
        }
      });
    const doc = await this.attributeModel
      .findOne({ parentId, name: definition.name }, { _id: 1 })
      .lean();
    return doc?._id ?? '';
  }

  /** Rules that combine several settings; 400 listing every problem. */
  private async assertConsistent(
    d: NormalizedDefinition,
    parent: Definition | null,
    current: Definition | null,
  ): Promise<void> {
    const errors: ApiFieldError[] = [];
    const err = (field: string, message: string) =>
      errors.push({ field, message });
    if (parent) {
      if (parent.kind !== AttributeKind.Group) {
        err('parentId', 'the parent must be a GROUP');
      }
      if (parent.parentId !== null) {
        err('parentId', 'groups can be nested one level only');
      }
      if (d.kind === AttributeKind.Group) {
        err('kind', 'a GROUP cannot be inside another GROUP');
      }
    }
    if (d.kind === AttributeKind.Group) {
      for (const flag of [
        'isUnique',
        'isUsername',
        'isPassword',
        'isMatchEnabled',
        'includeInSearchFilter',
      ] as const) {
        if (d[flag]) {
          err(flag, `${flag} applies to fields only`);
        }
      }
      if (
        d.options.length ||
        d.minLength !== null ||
        d.maxLength !== null ||
        d.min !== null ||
        d.max !== null
      ) {
        err('kind', 'options and limits apply to fields only');
      }
    } else {
      const type = d.dataType;
      if (type && OPTION_TYPES.includes(type)) {
        if (d.options.length === 0) {
          err('options', 'add at least one option');
        }
        if (new Set(d.options.map((o) => o.value)).size !== d.options.length) {
          err('options', 'option values must be unique');
        }
      } else if (d.options.length) {
        err('options', 'options apply to DROPDOWN / MULTI_SELECT only');
      }
      if (
        (d.minLength !== null || d.maxLength !== null) &&
        !(type && LENGTH_TYPES.includes(type))
      ) {
        err('maxLength', 'length limits apply to text-like types only');
      }
      if (
        d.minLength !== null &&
        d.maxLength !== null &&
        d.minLength > d.maxLength
      ) {
        err('minLength', 'minLength cannot exceed maxLength');
      }
      if (
        (d.min !== null || d.max !== null) &&
        type !== AttributeDataType.Number
      ) {
        err('min', 'min / max apply to NUMBER only');
      }
      if (d.min !== null && d.max !== null && d.min > d.max) {
        err('min', 'min cannot exceed max');
      }
      if (d.isUsername && !(type && USERNAME_TYPES.includes(type))) {
        err('isUsername', 'isUsername needs TEXT, EMAIL, MOBILE or NUMBER');
      }
      if (d.isUsername && parent) {
        err('isUsername', 'a sign-in variable must be at the top level');
      }
      if (
        d.isPassword &&
        (d.isUnique ||
          d.isUsername ||
          d.includeInToken ||
          d.includeInSearchFilter)
      ) {
        err(
          'isPassword',
          'a password variable cannot be unique, a username, in the token or searchable',
        );
      }
      if (d.isPassword && type !== AttributeDataType.Text) {
        err('isPassword', 'a password variable must be TEXT');
      }
      if (d.isMatchEnabled) {
        if (!d.matchWith) {
          err('matchWith', 'matchWith is required with isMatchEnabled');
        } else if (d.matchWith === d.name) {
          err('matchWith', 'a variable cannot match itself');
        } else if (
          !(await this.attributeModel.exists({
            parentId: d.parentId,
            name: d.matchWith,
          }))
        ) {
          err('matchWith', `no variable "${d.matchWith}" next to this one`);
        }
      }
      if (
        d.includeInToken &&
        (d.mutability === AttributeMutability.WriteOnly ||
          d.returned === AttributeReturned.Never)
      ) {
        err(
          'includeInToken',
          'a write-only / never-returned variable cannot be in the token',
        );
      }
    }
    if (current?.coreField === 'password' && !d.isEnabled) {
      err('isEnabled', 'the password variable cannot be disabled');
    }
    if (errors.length > 0) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.ValidationFailed,
        'Invalid variable settings',
        errors,
      );
    }
  }

  private async audit(
    actor: Actor,
    id: string,
    action: AuditAction,
    before: Record<string, unknown> | null,
    after: Record<string, unknown>,
  ): Promise<void> {
    await this.auditService.record(actor, [
      {
        entityType: AuditEntity.UserAttribute,
        entityId: id,
        action,
        before,
        after,
      },
    ]);
  }
}

type NormalizedDefinition = Pick<
  UserAttribute,
  | 'name'
  | 'label'
  | 'description'
  | 'kind'
  | 'dataType'
  | 'groupType'
  | 'parentId'
  | 'options'
  | 'minLength'
  | 'maxLength'
  | 'min'
  | 'max'
  | 'scopes'
  | 'locales'
  | 'isEnabled'
  | 'isRequired'
  | 'isInternal'
  | 'isUsername'
  | 'isPassword'
  | 'isUnique'
  | 'isMatchEnabled'
  | 'matchWith'
  | 'includeInToken'
  | 'includeInSearchFilter'
  | 'mutability'
  | 'returned'
  | 'displayOrder'
>;

/** Derived settings: username ⇒ unique; password ⇒ write-only, never returned. */
function normalize(d: NormalizedDefinition): NormalizedDefinition {
  return {
    ...d,
    isUnique: d.isUnique || d.isUsername,
    mutability: d.isPassword ? AttributeMutability.WriteOnly : d.mutability,
    returned:
      d.isPassword || d.mutability === AttributeMutability.WriteOnly
        ? AttributeReturned.Never
        : d.returned,
    matchWith: d.isMatchEnabled ? d.matchWith : null,
  };
}

function pickNormalized(d: NormalizedDefinition) {
  return {
    isUnique: d.isUnique,
    mutability: d.mutability,
    returned: d.returned,
    matchWith: d.matchWith,
  };
}

function pickDefinition(a: UserAttribute): NormalizedDefinition {
  return {
    name: a.name,
    label: a.label,
    description: a.description,
    kind: a.kind,
    dataType: a.dataType,
    groupType: a.groupType,
    parentId: a.parentId,
    options: a.options,
    minLength: a.minLength,
    maxLength: a.maxLength,
    min: a.min,
    max: a.max,
    scopes: a.scopes,
    locales: a.locales,
    isEnabled: a.isEnabled,
    isRequired: a.isRequired,
    isInternal: a.isInternal,
    isUsername: a.isUsername,
    isPassword: a.isPassword,
    isUnique: a.isUnique,
    isMatchEnabled: a.isMatchEnabled,
    matchWith: a.matchWith,
    includeInToken: a.includeInToken,
    includeInSearchFilter: a.includeInSearchFilter,
    mutability: a.mutability,
    returned: a.returned,
    displayOrder: a.displayOrder,
  };
}

function stripUndefined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined),
  ) as Partial<T>;
}

export function toResponse(a: UserAttribute): AttributeResponseDto {
  return {
    id: a._id,
    name: a.name,
    label: a.label,
    description: a.description,
    kind: a.kind,
    dataType: a.dataType,
    groupType: a.groupType,
    parentId: a.parentId,
    options: a.options.map((o) => ({ value: o.value, label: o.label })),
    minLength: a.minLength,
    maxLength: a.maxLength,
    min: a.min,
    max: a.max,
    scopes: a.scopes,
    locales: a.locales,
    isEnabled: a.isEnabled,
    isRequired: a.isRequired,
    isInternal: a.isInternal,
    isUsername: a.isUsername,
    isPassword: a.isPassword,
    isUnique: a.isUnique,
    isMatchEnabled: a.isMatchEnabled,
    matchWith: a.matchWith,
    includeInToken: a.includeInToken,
    includeInSearchFilter: a.includeInSearchFilter,
    mutability: a.mutability,
    returned: a.returned,
    displayOrder: a.displayOrder,
    isSystem: a.isSystem,
    coreField: a.coreField,
    version: a.version,
    updatedAt: a.updatedAt,
  };
}

function toTree(all: AttributeResponseDto[]): AttributeResponseDto[] {
  return all
    .filter((a) => a.parentId === null)
    .map((a) =>
      a.kind === AttributeKind.Group
        ? Object.assign(a, { children: all.filter((c) => c.parentId === a.id) })
        : a,
    );
}

function humanize(value: string): string {
  const words = value.toLowerCase().split('_').filter(Boolean).join(' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}
